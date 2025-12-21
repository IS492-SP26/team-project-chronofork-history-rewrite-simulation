import re
import json
import asyncio
from typing import List, Dict, Any, AsyncGenerator
from server.facilitator import Facilitator
from server.llm_cache import cached_chat_create
from server.story_engine import StoryEngine
from typing import List, Dict

class Agent:
    def __init__(self, profile: Dict, model: str = "gpt-5.1"):
        self.name = profile['name']
        self.profile = profile
        self.model = model
        self.system_message_content = ""

    def update_system_message(self, content: str):
        self.system_message_content = content

    async def chat(self, context_messages: List[Dict]):
        """异步调用 LLM (带全局缓存)"""
        # 1. 构建 Prompt
        messages = [{"role": "system", "content": self.system_message_content}]
        
        openai_msgs = []
        for msg in context_messages:
            # 简单的格式转换
            role = "assistant" if msg['from'] == self.name else "user"
            # 为了防止 Agent 混淆，把发送者名字写进 content
            content = f"[{msg['from']} -> {msg['to']}]: {msg['content']}"
            openai_msgs.append({"role": role, "content": content})
            
        messages.extend(openai_msgs)

        try:
            # --- 修改：调用全局缓存接口 ---
            # stream=True，返回的是一个 Async Generator (可能是真流，也可能是伪造流)
            response_stream = await cached_chat_create(
                self.model, 
                messages, 
                stream=True
            )
            return response_stream
            
        except Exception as e:
            print(f"Error calling OpenAI: {str(e)}")
            return None


class CastEngine:
    def __init__(self, config: Dict):
        # --- 1. 通信管道 ---
        self.output_queue = asyncio.Queue()  # 所有的输出都放入这里
        self.input_queue = asyncio.Queue()   # 用户的输入
        self.interruption_event = asyncio.Event() # 打断信号

        # --- 2. 引擎初始化 ---
        self._event_buffer = [] # 暂时保留，用于 StoryEngine 回调
        
        def _internal_notifier(event_type: str, payload: Any):
            # 将同步回调转为异步队列消息
            self.output_queue.put_nowait({ "type": event_type, "data": payload })

        storyline = config.get("storyline", [])
        self.engine = StoryEngine(storyline, update_notifier=_internal_notifier)
        self.initial_graph_snapshot = self.engine._push_graph_snapshot(no_push=True)
        
        # --- 3. 角色与 Facilitator ---
        cast_data = config.get("cast_data", [])
        self.episode = config.get("episode", {})
        user_role = config.get("user_role", {})
        self.user_role_name = user_role.get("name", "User")
        
        if self.user_role_name not in [a.get("name") for a in cast_data]:
            cast_data.append(user_role)
            
        self.agents: Dict[str, Agent] = {}
        for profile in cast_data:
            self.agents[profile['name']] = Agent(profile)
        self.raw_cast_data = cast_data


        cast_str = "\n".join([f"{p['name']}: {p['title']};" for p in self.raw_cast_data])

        # Facilitator 初始化
        start_node = self.engine.get_story_context()
        # 取第一个节点描述作为 Intro
        start_node_desc = start_node[0].get('desc', '')
        self.facilitator = Facilitator(self.episode.get("title", ""), cast_str, self.user_role_name, start_node_desc)

        # --- 4. 运行时状态 ---
        self.running = False
        self.current_speaker = None
        self.msg_counter = 0 # 计数器，用于触发 Facilitator

        # 任务句柄，用于取消
        self.main_logic_task = None
        
   
    def start(self):
        """启动引擎"""
        self.running = True
        self.engine.start_story()
        
        # 启动后台主逻辑任务
        self.main_logic_task = asyncio.create_task(self._main_logic_loop())
        
    async def output_generator(self) -> AsyncGenerator[Dict, None]:
        """
        Server 的 main.py 只需要监听这个生成器。
        它是一个无限的消费者，从 output_queue 读取数据。
        """
        while self.running:
            # 阻塞等待队列消息
            msg = await self.output_queue.get()
            yield msg
            self.output_queue.task_done()

    async def push_user_message(self, content: str, target: str):
        """用户发送消息 (含打断逻辑)"""
        # 1. 触发打断事件
        self.interruption_event.set()
        
        # 2. 入队
        await self.input_queue.put({
            "content": content,
            "target": target
        })

    async def push_user_message(self, content: str, target: str):
        """Server 将前端收到的消息塞入这里"""
        await self.input_queue.put({
            "content": content,
            "target": target,
            "interruption": True
        })

    # ==========================
    # 内部主逻辑 (串行状态机)
    # ==========================
    async def _main_logic_loop(self):
        """
        负责 Intro -> Loop (Agent/User Turn)
        """
        try:
            # --- PHASE 1: Facilitator Intro ---
            # Facilitator 决定第一个 Speaker
            first_speaker = await self._run_facilitator_intro()
            self.current_speaker = first_speaker

            # --- PHASE 2: Main Loop ---
            while self.running:
                # 重置打断信号
                self.interruption_event.clear()

                # --- CASE A: 用户回合 ---
                if self.current_speaker == self.user_role_name:
                    # 获取上一个说话的人作为 waiting source
                    last_msg = self.engine.get_context_messages()[-1] if self.engine.get_context_messages() else {}
                    from_name = last_msg.get('from', 'System')

                    await self.output_queue.put({
                        "type": "input_request", 
                        "data": {"msg": "Your turn...", "from_name": from_name}
                    })
                    
                    # 等待用户输入 (此处也可以被打断，虽然逻辑上用户打断自己没意义，但为了代码一致性)
                    user_input = await self.input_queue.get() 
                    # 注意：如果是在 input_request 期间收到的消息，直接处理，不需要“打断逻辑”
                    await self._process_user_commit(user_input)

                # --- CASE B: Agent 回合 ---
                else:
                    agent_name = self.current_speaker
                    await self.output_queue.put({"type": "agent_thinking", "data": {"agent": agent_name}})

                    # 执行 Agent 生成 (可被打断)
                    # next_speaker 会在 _run_agent_turn 内部解析 meta 后返回
                    next_speaker = await self._run_agent_turn(agent_name)
                    
                    # 检查是否发生过打断 (如果是打断，_run_agent_turn 会返回 None 或特定标识)
                    if self.interruption_event.is_set():
                        # 打断发生后，消费 Input Queue 里的那条打断消息
                        if not self.input_queue.empty():
                            user_input = self.input_queue.get_nowait()
                            await self._process_user_commit(user_input)
                        # 打断处理完，current_speaker 已在 _process_user_commit 更新
                    else:
                        # 正常结束，流转到下一个人
                        self.current_speaker = next_speaker

                    # 稍微歇息
                    await asyncio.sleep(0.1)

        except asyncio.CancelledError:
            print("Main logic loop cancelled.")
        except Exception as e:
            print(f"CRITICAL ERROR in Logic Loop: {e}")
            import traceback
            traceback.print_exc()

    # ==========================
    # 子任务处理
    # ==========================

    async def _run_facilitator_intro(self):
        """运行 Intro，直接推送到 output_queue，并解析 Meta 返回 first_speaker"""
        await self.output_queue.put({"type": "agent_thinking", "data": {"agent": "Facilitator"}})
        
        buffer = ""
        meta_parsed = False
        target_name = "User" # Default
        
        async for token in self.facilitator.run_intro():
            # 这里也需要 Strict Parsing 吗？最好保持一致，虽然 Intro 只有 Meta 没有 Target 变更
            if not meta_parsed:
                buffer += token
                if "/>" in buffer:
                    t_name, _ = self._parse_meta_line(buffer) # Reuse existing parser
                    if t_name: target_name = t_name
                    
                    # 发送剩余部分
                    split_idx = buffer.find("/>") + 2
                    remaining = buffer[split_idx:].lstrip()
                    if remaining:
                         await self.output_queue.put({
                            "type": "stream_token", 
                            "data": {"agent": "Facilitator", "token": remaining, "target": "User"}
                        })
                    meta_parsed = True
            else:
                 await self.output_queue.put({
                    "type": "stream_token", 
                    "data": {"agent": "Facilitator", "token": token, "target": "User"}
                })
        
        return target_name
    
    async def _run_agent_turn(self, agent_name: str):
        """
        运行 Agent 的一轮对话。
        关键：实现“打断”和“Strict Meta Parsing”。
        """
        agent = self.agents[agent_name]

        if not agent:
            print(f"Error: Agent {agent_name} not found.")
            return
        
        sys_msg = self._construct_system_message(agent_name)
        agent.update_system_message(sys_msg)
        context = self.engine.get_context_messages()

        # 1. 启动 LLM 请求 Task
        # 我们不直接 await chat()，而是把它包装成 task 以便 cancel
        chat_coro = agent.chat(context)
        chat_task = asyncio.create_task(chat_coro)
        # 2. 显式创建打断任务 (Fix RuntimeWarning)
        interrupt_task = asyncio.create_task(self.interruption_event.wait())
        
        stream = None
        try:
            # Race condition: 等待 API 响应 VS 打断信号
            done, pending = await asyncio.wait(
                [chat_task, interrupt_task], 
                return_when=asyncio.FIRST_COMPLETED
            )

            if self.interruption_event.is_set():
                # 被打断了！
                chat_task.cancel() # 取消请求
                return None

            # 正常拿到 Stream
            interrupt_task.cancel()
            stream = await chat_task 
        except Exception as e:
            print(f"LLM Call Error: {e}")
            if not chat_task.done(): chat_task.cancel()
            if not interrupt_task.done(): interrupt_task.cancel()
            return self.user_role_name

        if not stream: return self.user_role_name

        # 3. 处理流 (Strict Meta + Interrupt Check)
        buffer = ""
        meta_parsed = False
        target_name = self.user_role_name
        meta_node_id = self.engine._current_node_id
        full_content = []
        
        # 手动迭代器，以便在每次 next() 前检查打断
        async_iter = stream.__aiter__()
        
        try:
            while True:
                # 每次取 Token 前检查打断
                if self.interruption_event.is_set():
                    # 这里不需要 cancel stream，直接 break，GC 会处理连接断开
                    # 保存“半句话”
                    partial = "".join(full_content).strip()
                    if partial:
                        self.engine.add_message(agent_name, target_name, partial + " --(interrupted)")
                    return None

                try:
                    # 获取下一个 Token，设置极短超时以保持响应性 (可选，或者直接 await)
                    # 直接 await 也可以，因为 interruption_event 主要靠上面的 wait 捕获
                    # 但为了粒度更细，我们可以用 wait wrap next
                    # 简化起见：直接 await，因为 OpenAI chunk 很快。
                    # 如果要极致打断，可以用 asyncio.wait([next_task, interrupt_wait])
                    chunk = await async_iter.__anext__()
                except StopAsyncIteration:
                    break

                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    
                    if not meta_parsed:
                        buffer += token
                        # Strict Parsing: 只有找到 /> 才放行
                        if "/>" in buffer:
                            t_name, n_id = self._parse_meta_line(buffer)
                            if t_name: target_name = t_name
                            if n_id: meta_node_id = n_id
                            meta_parsed = True
                            
                            # 发送积压的 buffer 里的正文
                            split_idx = buffer.find("/>") + 2
                            remaining = buffer[split_idx:].lstrip()
                            if remaining:
                                full_content.append(remaining)
                                await self.output_queue.put({
                                    "type": "stream_token",
                                    "data": {"agent": agent_name, "token": remaining, "target": target_name}
                                })
                    else:
                        # Meta 已解析，Token 和 Target 安全发送
                        full_content.append(token)
                        await self.output_queue.put({
                            "type": "stream_token",
                            "data": {"agent": agent_name, "token": token, "target": target_name}
                        })
        
        except asyncio.CancelledError:
             return None

        # 4. 正常结束处理
        final_body = "".join(full_content).strip()
        
        # 状态更新 (Move Node)
        if meta_node_id == self.engine._current_node_id:
            print(f"Info: Staying at node {self.engine._current_node_id}.")
        elif meta_node_id == "diverged":
            print(f"Info: Divergence detected at node {self.engine._current_node_id} by {agent_name}.")
        else:
            if int(meta_node_id.split('.')[0]) == int(self.engine._current_node_id.split('.')[0])+1:
                self.engine.move_next()
            else:
                print(f"Warning: Unable to parse/move node ids: {self.engine._current_node_id}, {meta_node_id}")

        if final_body:
            self._commit_message_and_trigger_facilitator(agent_name, target_name, final_body)

        return target_name

    # ==========================
    # 辅助逻辑
    # ==========================

    async def _process_user_commit(self, user_input):
        """处理用户输入提交"""
        content = user_input["content"]
        target = user_input["target"]
        
        self._commit_message_and_trigger_facilitator(self.user_role_name, target, content)
        self.current_speaker = target
    
    def _commit_message_and_trigger_facilitator(self, src, tgt, content):
        """统一提交消息入口，并检查 Facilitator 触发条件"""
        self.engine.add_message(src, tgt, content)
        self.msg_counter += 1
        
        # 每 3 条消息，且不在 Intro 阶段，并行触发 Facilitator
        if self.msg_counter % 3 == 0:
            # Fire-and-forget task
            asyncio.create_task(self._run_parallel_facilitator_reflection())

    async def _run_parallel_facilitator_reflection(self):
        """并行运行 Facilitator 反思，不阻塞主流程"""
        try:
            # 获取最近 3 条消息作为上下文
            recent = self.engine.get_context_messages()[-3:]
            
            async for token in self.facilitator.run_reflection(recent):
                await self.output_queue.put({
                    "type": "facilitator_stream", 
                    "data": {"token": token}
                })
                
            await self.output_queue.put({
                "type": "facilitator_stream", 
                "data": {"token": "<END>"}
            })
        except Exception as e:
            print(f"Facilitator Error: {e}")
    
    def _construct_system_message(self, agent_name: str) -> str:
        agent = self.agents.get(agent_name)
        cast_str = "\n".join([f"{p['name']}: {p['title']};" for p in self.raw_cast_data if p['name'] != agent_name])
        
        storyline_json = self.engine.get_story_context()
        prompt = f"""You are {agent.name}, role-playing as {agent.profile['title']} in: {self.episode.get('title','')}.
User role: {self.user_role_name}.

You are given:
<storyline>
{storyline_json}
</storyline>
<cast>
{cast_str}
</cast>

GOAL
Co-roleplay the episode, staying historically grounded and engaging.

RULES
- Anchor on the node where status=="Active". Stay in its time/place/conflict.
- Slow-burn: do NOT reach the node.title dilemma in the first 3 turns. Play 5–8 short turns total.
- Micro-beats only: each turn advances ONE small beat + mentions 1 concrete detail from active node.desc.
- Talk like speech: 1–3 short sentences. End with at most ONE short question.
- No Q&A and no menus: don’t lecture; don’t list options (“A or B”). Ask open-endedly.
- Divergence anytime: encourage plausible side moves.
- Dilemma reveal: hint pressure → surface tensions → ask next move
- Absurd requests: refuse briefly, redirect to plausible actions.
- After the dilemma resolves, move to the next node naturally (no skips).

OUTPUT (STRICT)
Line 1: <meta targetName="..." nodeid="..." />
Line 2+: in-character message (spoken, natural, very concise).

META
- targetName: who you’re addressing (exact name in <cast>).
- nodeid:
    - If still in the current Active node, use its id (e.g., "2.1").
    - If a major divergence happens OR the dilemma resolves non-canonically, use "diverged".
    - If you have entered the next node canonically, use the next node id (e.g., "3.1").

No JSON. No extra headers."""
        
        return prompt
    
    def _parse_meta_line(self, content: str):
        # 1. 提取 targetName (必须存在)
        target_match = re.search(r'targetName="(.*?)"', content)
        target_name = target_match.group(1) if target_match else None

        # 2. 提取 nodeid (可选)
        node_match = re.search(r'nodeid="(.*?)"', content)
        node_id = node_match.group(1) if node_match else None

        # 只要有 targetName 就算解析成功
        if target_name:
            return target_name, node_id
            
        return None, None