import datetime
import json
import os
import re
from server.utilities.logger import EventLogger
import asyncio
import textwrap
from typing import List, Dict, Any, AsyncGenerator
from server.facilitator import Facilitator
from server.utilities.llm_cache import cached_chat_create, call_llm
from server.prompts import get_prompt, normalize_lang
from server.story_engine import StoryEngine
from typing import List, Dict
from server.reflection_worker import ReflectionWorker
from server.utilities.html_renderer import  render_reflection_report


class Agent:
    def __init__(self, profile: Dict, model: str = "gpt-5.1"):
        self.name = profile["name"]
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
            role = "assistant" if msg["from"] == self.name else "user"
            # 为了防止 Agent 混淆，把发送者名字写进 content
            content = f"[{msg['from']} -> {msg['to']}]: {msg['content']}"
            openai_msgs.append({"role": role, "content": content})

        messages.extend(openai_msgs)

        try:
            # --- 修改：调用全局缓存接口 ---
            # stream=True，返回的是一个 Async Generator (可能是真流，也可能是伪造流)
            response_stream = await cached_chat_create(self.model, messages, stream=True)
            return response_stream

        except Exception as e:
            print(f"Error calling OpenAI: {str(e)}")
            return None


class CastEngine:
    def __init__(self, config: Dict):
        # --- 1. 通信管道 ---
        self.output_queue = asyncio.Queue()  # 所有的输出都放入这里
        self.input_queue = asyncio.Queue()  # 用户的输入
        self.interruption_event = asyncio.Event()  # 打断信号

        self.logger = EventLogger()
        self.logger.log("CastEngine", "Boot", "System Starting", config)

        self.config = config
        self.prompt_lang = normalize_lang(config.get("prompt_lang", "zh"))

        if not os.path.exists('saves'):
            os.makedirs('saves')
        timestamp = datetime.datetime.now().strftime("%m-%d_%H-%M")
        self.cp_file = f'saves/{timestamp}.json'

        # --- 2. 引擎初始化 ---
        def _internal_notifier(event_type: str, payload: Any):
            # 将同步回调转为异步队列消息
            self.output_queue.put_nowait({ "type": event_type, "data": payload })

        storyline = config.get("storyline", [])
        self.engine = StoryEngine(storyline, logger=self.logger, update_notifier=_internal_notifier)
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
            self.agents[profile["name"]] = Agent(profile)
        self.raw_cast_data = cast_data

        self.cast_str = "\n".join([f"{p['name']}: {p['title']};" for p in self.raw_cast_data])

        # Facilitator 初始化
        self.facilitator = Facilitator(
            self.episode.get("title", ""),
            self.cast_str,
            lang=self.prompt_lang,
        )

        # --- 4. 运行时状态 ---
        self.running = False
        self.current_speaker = None
        self.msg_counter = 0  # 计数器，用于触发 Facilitator

        # 任务句柄，用于取消
        self.main_logic_task = None

        self.stage = 1  # 1: Observation, 2: Intervention
        # 【需求1】pending_message 缓存
        # 结构: List[Dict] -> [{'from':..., 'to':..., 'content':..., 'is_briefing': True/False}]
        self.pending_messages = []
        # 状态标志：是否处于“回溯草稿”模式
        # True = 我们正在一个已完成的节点上进行“假想”对话，尚未分歧
        # False = 我们在一个正常的活跃节点上 (Stage 1 或 Stage 2 分歧后)
        self.in_backtrack_draft_mode = False

        self.history_msg = []  # 回溯前的历史消息缓存

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
        await self.input_queue.put({"content": content, "target": target})

    async def push_user_message(self, content: str, target: str):
        """Server 将前端收到的消息塞入这里"""
        await self.input_queue.put({"content": content, "target": target, "interruption": True})

    # ==========================
    # 内部主逻辑 (串行状态机)
    # ==========================
    async def _main_logic_loop(self):
        """
        负责 Intro -> Loop (Agent/User Turn)
        """
        try:
            # --- STAGE 1 LOGIC ---
            if self.stage == 1:
                # ... (Intro logic 保持不变)
                await self.send_stage_update(1)

                start_node = self.engine.get_story_context()
                # 取第一个节点描述作为 Intro
                start_node_desc = start_node[0].get("desc", "")
                first_speaker = await self._run_facilitator_intro(start_node_desc, self.user_role_name)
                self.current_speaker = first_speaker

                await self.send_node_update("start", self.engine._current_node_id)

                while self.running:
                    # Stage 1: User Role is AI, standard logic
                    # ... (执行 Agent Turn) ...
                    prev_node = self.engine._current_node_id
                    next_speaker, meta_status = await self._run_agent_turn(self.current_speaker)

                    curr_node = self.engine._current_node_id
                    if curr_node != prev_node:
                        await self.send_node_update(prev_node, curr_node)

                    if meta_status == "STAGE1_END":
                        self.stage = 2
                        await self.send_stage_update(2)
                        break

                    self.current_speaker = next_speaker
                    await asyncio.sleep(0.1)

            # --- STAGE 2 LOGIC (Backtrack Session) ---
            elif self.stage == 2:
                if self.history_msg:
                    for msg in self.history_msg:
                        await self.output_queue.put(
                            {
                                "type": "stream_token",
                                "data": {
                                    "agent": msg["from"],
                                    "token": msg["content"],
                                    "target": msg["to"],
                                },
                            }
                        )

                await self.output_queue.put(
                    {
                        "type": "complete_history_review",
                        "data": {
                        },
                    }
                )

                # 这些东西是 backtrack_to 塞进来的历史遗留
                if self.pending_messages:
                    for msg in self.pending_messages:
                        await self.output_queue.put(
                            {
                                "type": "stream_token",
                                "data": {
                                    "agent": msg["from"],
                                    "token": msg["content"],
                                    "target": msg["to"],
                                },
                            }
                        )
                        await asyncio.sleep(0.5)

                # 回放结束，Current Speaker 设为 User (Stage 2 总是用户先手)
                self.current_speaker = self.user_role_name
                # 2. 进入交互循环
                while self.running:
                    self.interruption_event.clear()

                    # --- CASE A: User Turn ---
                    if self.current_speaker == self.user_role_name:
                        # 确定 Prompt 的来源
                        if self.in_backtrack_draft_mode:
                            last_msg = self.pending_messages[-1] if self.pending_messages else self.history_msg[-1]
                        else:
                            last_msg = (
                                self.engine.get_context_messages()[-1] if self.engine.get_context_messages() else {}
                            )

                        from_name = last_msg.get("from", "System")

                        if from_name == "System" or from_name == "Facilitator":
                            msg = 'Select an Agent to address your message to.'
                        else:
                            msg = f'{from_name} is talking to you. Respond or select another character.'

                        await self.output_queue.put(
                            {
                                "type": "input_request",
                                "data": {"msg": msg, "from_name": from_name},
                            }
                        )

                        user_input = await self.input_queue.get()

                        # 【核心写逻辑】
                        await self._unified_commit_message(
                            self.user_role_name,
                            user_input["target"],
                            user_input["content"],
                        )
                        self.current_speaker = user_input["target"]

                        self.logger.log("User", "MessageSent", f"Message sent to {user_input['target']}", {"content": user_input["content"]})

                    # CASE B: Agent Turn
                    else:
                        agent_name = self.current_speaker
                        await self.output_queue.put({"type": "agent_thinking", "data": {"agent": agent_name}})

                        # 运行 Agent，传入 override context
                        # 注意：_run_agent_turn 需要修改以接受 context

                        prev_node = self.engine._current_node_id
                        next_speaker, meta_status = await self._run_agent_turn(agent_name)

                        curr_node = self.engine._current_node_id
                        if curr_node != prev_node:
                            await self.send_node_update(prev_node, curr_node)
                        if meta_status == "DIVERGENCE_END":
                            # 结束回溯草稿模式
                            self.in_backtrack_draft_mode = False
                            self.pending_messages = []
                            break

                        # 检查打断
                        if self.interruption_event.is_set():
                            if not self.input_queue.empty():
                                # 处理打断输入
                                user_input = self.input_queue.get_nowait()
                                self.pending_messages.append(
                                    {
                                        "from": self.user_role_name,
                                        "to": user_input["target"],
                                        "content": user_input["content"] + " --(interrupted)",
                                    }
                                )
                                self.current_speaker = user_input["target"]
                        else:
                            # 【需求2.1】处理返回值
                            if meta_status == "DIVERGENCE_TRIGGERED":
                                print("Divergence identified in main loop.")
                                pass

                            self.current_speaker = next_speaker

                        await asyncio.sleep(0.1)

        except Exception as e:
            print(f"Logic Loop Error: {e}")
            import traceback

            traceback.print_exc()

    # ==========================
    # Helper Methods
    # ==========================

    async def _unified_commit_message(self, src, tgt, content):
        """
        【统一写入口】根据当前模式决定写 Engine 还是 Pending Buffer
        """
        if self.in_backtrack_draft_mode:
            self.pending_messages.append({"from": src, "to": tgt, "content": content})
            recent = self.pending_messages[-3:]
        else:
            self.engine.add_message(src, tgt, content)
            recent = self.engine.get_context_messages()[-3:]

        if self.stage == 2:
            self.msg_counter += 1

            # 每 3 条消息，且不在 Intro 阶段，并行触发 Facilitator
            if self.msg_counter % 3 == 0:
                # Fire-and-forget task
                asyncio.create_task(self._run_parallel_facilitator_reflection(recent))

    def backtrack_to(self, target_node_id, perspective_agent=None):
        if self.stage != 2:
            return
        asyncio.create_task(self._backtrack_sequence(target_node_id, perspective_agent))

    async def _backtrack_sequence(self, target_node_id, perspective_agent):
        """执行回溯序列，包含 UI 动效"""

        # 2. 物理回溯
        self.engine.backtrack_to(target_node_id)
        self.user_role_name = perspective_agent
        print(f"Backtracking to node {target_node_id} as {perspective_agent}")

        self.logger.log("CastEngine", "BacktrackTo", f"Backtracking to {target_node_id} as {perspective_agent}", {"target": target_node_id, "perspective_agent": perspective_agent})

        # 3. 准备数据
        self.in_backtrack_draft_mode = True
        parent = self.engine._graph.nodes[target_node_id]["parent_id"]
        history_msg = self.engine.get_context_messages(include_current_edge=False)
        raw_msgs = self.engine._graph.edge_contexts.get((parent, target_node_id), [])

        print(f"Preparing {len(raw_msgs)} pending messages for backtrack draft mode.")

        depth, variant = map(int, target_node_id.split('.'))

        self.pending_messages = []
        for msg in raw_msgs:
            if msg["from"] == self.user_role_name and variant == 0:
                break
            self.pending_messages.append(msg)

        if len(self.pending_messages) < 3:
            self.history_msg = history_msg[-3:]

        # 4. 完成 UI 更新
        # 发送新的图状态 (engine 内部已 push snapshot)
        # 停止 Loading

        await self.output_queue.put(
            {
                "type": "action_update",
                "data": {
                    "action": "backtrack_complete",
                    "new_node_id": target_node_id,
                    "new_role": self.user_role_name,
                },
            }
        )

        # 5. 重启 Loop
        if self.main_logic_task:
            self.main_logic_task.cancel()
        self.main_logic_task = asyncio.create_task(self._main_logic_loop())

    # ==========================
    # 子任务处理
    # ==========================

    async def _run_facilitator_intro(self, start_node_desc, user_role):
        """运行 Intro，直接推送到 output_queue，并解析 Meta 返回 first_speaker"""
        await self.output_queue.put({"type": "agent_thinking", "data": {"agent": "Facilitator"}})

        buffer = ""
        meta_parsed = False
        target_name = "User"  # Default

        async for token in self.facilitator.run_intro(start_node_desc, user_role):
            # 这里也需要 Strict Parsing 吗？最好保持一致，虽然 Intro 只有 Meta 没有 Target 变更
            if not meta_parsed:
                buffer += token
                if "/>" in buffer:
                    t_name, _ = self._parse_meta_line(buffer)  # Reuse existing parser
                    if t_name:
                        target_name = t_name

                    # 发送剩余部分
                    split_idx = buffer.find("/>") + 2
                    remaining = buffer[split_idx:].lstrip()
                    if remaining:
                        await self.output_queue.put(
                            {
                                "type": "stream_token",
                                "data": {
                                    "agent": "Facilitator",
                                    "token": remaining,
                                    "target": "User",
                                },
                            }
                        )
                    meta_parsed = True
            else:
                await self.output_queue.put(
                    {
                        "type": "stream_token",
                        "data": {
                            "agent": "Facilitator",
                            "token": token,
                            "target": "User",
                        },
                    }
                )

        return target_name

    async def _run_agent_turn(self, agent_name: str):
        """
        运行 Agent 的一轮对话。
        关键：实现“打断”和“Strict Meta Parsing”。
        """
        self.logger.log("CastEngine", "TurnStart", f"{agent_name} thinking...", {"stage": self.stage})

        if agent_name != "Facilitator" and not agent_name in self.agents:
            print(f"Error: Agent {agent_name} not found.")
            return self.user_role_name, "ERROR"

        # 构造 Context
        if self.in_backtrack_draft_mode:
            base_context = self.engine.get_context_messages(include_current_edge=False)
            full_context = base_context + self.pending_messages
        else:
            full_context = self.engine.get_context_messages(include_current_edge=True)

        if agent_name == "Facilitator" or not agent_name in self.agents:
            # Facilitator 特例
            last_msg = full_context[-1]
            storyline_json = self.engine.get_story_context()
            chat_coro = self.facilitator.run_bridge(storyline_json, last_msg["from"], full_context)
        else:
            sys_msg = self._construct_system_message(agent_name)
            agent = self.agents[agent_name]
            agent.update_system_message(sys_msg)
            # 我们不直接 await chat()，而是把它包装成 task 以便 cancel
            chat_coro = agent.chat(full_context)

        chat_task = asyncio.create_task(chat_coro)
        # 2. 显式创建打断任务 (Fix RuntimeWarning)
        interrupt_task = asyncio.create_task(self.interruption_event.wait())

        stream = None
        try:
            # Race condition: 等待 API 响应 VS 打断信号
            done, pending = await asyncio.wait([chat_task, interrupt_task], return_when=asyncio.FIRST_COMPLETED)

            if self.interruption_event.is_set():
                # 被打断了！
                chat_task.cancel()  # 取消请求
                return None, "ERROR"

            # 正常拿到 Stream
            interrupt_task.cancel()
            stream = await chat_task
        except Exception as e:
            print(f"LLM Call Error: {e}")
            if not chat_task.done():
                chat_task.cancel()
            if not interrupt_task.done():
                interrupt_task.cancel()
            return self.user_role_name, "ERROR"

        if not stream:
            return self.user_role_name, "ERROR"

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
                    return None, "ERROR"

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
                            if t_name:
                                target_name = t_name
                            if n_id:
                                meta_node_id = n_id
                            meta_parsed = True

                            # 发送积压的 buffer 里的正文
                            split_idx = buffer.find("/>") + 2
                            remaining = buffer[split_idx:].lstrip()
                            if remaining:
                                full_content.append(remaining)
                                await self.output_queue.put(
                                    {
                                        "type": "stream_token",
                                        "data": {
                                            "agent": agent_name,
                                            "token": remaining,
                                            "target": target_name,
                                        },
                                    }
                                )
                    else:
                        # Meta 已解析，Token 和 Target 安全发送
                        full_content.append(token)
                        await self.output_queue.put(
                            {
                                "type": "stream_token",
                                "data": {
                                    "agent": agent_name,
                                    "token": token,
                                    "target": target_name,
                                },
                            }
                        )

        except asyncio.CancelledError:
            return None, "ERROR"

        # 4. 正常结束处理
        final_body = "".join(full_content).strip()

        self.logger.log("LLM", "Response", f"{agent_name} generated content", {
            "content": final_body, 
            "meta_node": meta_node_id,
            "target": target_name
        })

        tag='OK'

        # 状态更新 (Move Node)
        if meta_node_id == self.engine._current_node_id:
            print(f"Info: Staying at node {self.engine._current_node_id}.")
            self.logger.log("StoryEngine", "StateUpdate", f"Staying at node {self.engine._current_node_id}", {})
        elif meta_node_id == "diverged":
            print(f"Info: Divergence detected at node {self.engine._current_node_id} by {agent_name}.")
            if self.in_backtrack_draft_mode:
                await self._handle_divergence()
                tag = "DIVERGENCE_TRIGGERED"
            else:
                print("Warning: Divergence triggered outside of backtrack draft mode. Ignored.")
                pass
        elif meta_node_id == "end":
            print(f"Info: Reached end of story at node {self.engine._current_node_id}.")
            self.engine.move_next()
            await self.send_node_update(self.engine._current_node_id, "end")

            depth, variant = map(int, self.engine._current_node_id.split('.'))
            if variant == 0:
                tag = "STAGE1_END"
            else:
                tag = "DIVERGENCE_END"
                await self.output_queue.put({"type": "enable_reflection", "data": {}})
        else:
            if int(meta_node_id.split(".")[0]) == int(self.engine._current_node_id.split(".")[0]) + 1:
                self.engine.move_next()
                self.logger.log("StoryEngine", "StateUpdate", f"Moved to next node {self.engine._current_node_id}", {})
                if self.in_backtrack_draft_mode:
                    self.pending_messages = []  # 清空 pending，因为我们正式前进了
            else:
                print(f"Warning: Unable to parse/move node ids: {self.engine._current_node_id}, {meta_node_id}")

        
        await self._unified_commit_message(agent_name, target_name, final_body)

        return target_name, tag

    async def _handle_divergence(self):
        """
        核心：分歧推理
        """
        await self.output_queue.put({"type": "action_update", "data": {"action": "divergence_in_progress"}})
        

        # 1. 准备 Context
        trigger_segment = []
        # 从前往后找，直到找到 User 的发言
        user_msg_index = -1
        for i in range(len(self.pending_messages)-1):
            if self.pending_messages[i]["from"] == self.user_role_name:
                user_msg_index = i
                break

        if user_msg_index != -1:
            trigger_segment = self.pending_messages[user_msg_index:]
        else:
            trigger_segment = self.pending_messages  # Fallback: 全都是 trigger context

        extra_context = None
        if len(trigger_segment) < 3:
            # 保底，至少 3 条
            extra_needed = 3 - len(trigger_segment)
            extra_msgs = self.history_msg[-extra_needed:]
            extra_context = extra_msgs + trigger_segment

        self.logger.log("CastEngine", "Divergence", "Triggered", {"agent": trigger_segment[-1].get("from", "Unknown"), "trigger_content": trigger_segment})

        cast_str = ", ".join([f"{a.name} ({a.profile.get('title')})" for a in self.agents.values()])
        storyline_list = self.engine.get_story_context()  # JSON string
        prompt = self.get_divergence_prompt(self.episode.get('title',''),cast_str, storyline_list, trigger_segment if not extra_context else extra_context)

        # 3. 调用 LLM (假设有一个专门的 JSON 生成接口)

        try:
            # 这里调用非流式接口拿到 JSON
            # 实际生产中建议用 Function Calling 强制 JSON
            divergence_data = await call_llm(prompt, lang=self.prompt_lang)

            # 更新图
            # 收集导致分歧的消息，用于迁移
            context_to_save = []
            target = divergence_data.get("target",'NONE')
            if target == "sibling":
                context_to_save = list(self.pending_messages)  # Copy
            else:
                context_to_save = list(trigger_segment)  # Copy

            new_node_id = self.engine.create_divergence_branch(divergence_data, context_to_save)

            self.in_backtrack_draft_mode = False
            self.pending_messages = []  # 清空 Buffer

            # 4. 展示分析结果 (Markdown Table) 加个new_node_id
            report = self._generate_divergence_report(divergence_data, new_node_id)

            await self.output_queue.put(
                {"type": "action_update", "data": {"action": "divergence_complete", "report": report}}
            )

            self.logger.log("CastEngine", "Divergence", "Inference Result", report)
            self.save_checkpoint(reason="post_divergence")

        except Exception as e:
            print(f"Divergence Inference Failed: {e}")
            await self.output_queue.put(
                {
                    "type": "stream_token",
                    "data": {
                        "agent": "Facilitator",
                        "token": f"\n\n[System Error] Divergence calculation failed: {str(e)}",
                        "target": "User",
                    },
                }
            )

    # ==========================
    # 辅助逻辑
    # ==========================
    def save_checkpoint(self, reason="manual"):
        """
        导出完整系统状态为 JSON 文件
        包含：图结构、所有对话历史、当前阶段、PendingBuffer 等
        """
        
        # 1. 收集 StoryEngine 状态
        engine_state = self.engine.export_state()
        
        # 2. 收集 CastEngine 状态
        cast_state = {
            "stage": self.stage,
            "in_backtrack_draft_mode": self.in_backtrack_draft_mode,
            "pending_messages": self.pending_messages,
            "current_speaker": self.current_speaker,
            "user_role_name": self.user_role_name,
            "config": self.config 
        }
        
        full_state = {
            "timestamp": datetime.datetime.now().isoformat(),
            "engine": engine_state,
            "cast": cast_state
        }

        json_str = json.dumps(full_state, indent=2, ensure_ascii=False)
        
        with open(self.cp_file, 'w', encoding='utf-8') as f:
            f.write(json_str)
            
        self.logger.log("System", "Checkpoint", f"Saved to {self.cp_file}", {"reason": reason})
        return json_str
    
    async def handle_save_request(self):
        """处理前端的 Save 请求"""
        state_json = self.save_checkpoint(reason="user_requested")
        await self.output_queue.put({
            "type": "save_complete",
            "data": {"filename": self.cp_file, "json_content": state_json}
        })

    
    def load_checkpoint(self, filename):
        """从文件恢复状态 (Demo用，通常在 Init 时调用)"""
        with open(self.cp_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        self.engine.restore_state(data["engine"])
        
        c_data = data["cast"]
        self.stage = c_data["stage"]
        self.in_backtrack_draft_mode = c_data["in_backtrack_draft_mode"]
        self.pending_messages = c_data["pending_messages"]
        self.current_speaker = c_data["current_speaker"]
        self.user_role_name = c_data["user_role_name"]
        
        self.logger.log("System", "Checkpoint", f"Loaded from {self.cp_file}")
        
        # 恢复后推送到前端
        self.engine._push_graph_snapshot()

    async def _run_parallel_facilitator_reflection(self, recent):
        """并行运行 Facilitator 反思，不阻塞主流程"""
        try:

            async for token in self.facilitator.run_reflection(recent):
                await self.output_queue.put({"type": "facilitator_stream", "data": {"token": token}})

            await self.output_queue.put({"type": "facilitator_stream", "data": {"token": "<END>"}})
        except Exception as e:
            print(f"Facilitator Error: {e}")

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

    async def send_node_update(self, fromid: str, toid: str):
        await self.output_queue.put({"type": "node_update", "data": {"from_id": fromid, "to_id": toid}})

    async def send_stage_update(self, stage: str):
        await self.output_queue.put({"type": "stage_update", "data": {"stage": stage}})


    async def handle_reflection_request(self):
        self.logger.log("System", "Reflection", "Start Generating")
        
        try:
            # 实例化 Worker
            worker = ReflectionWorker(self.engine, self)
            
            # 1. 获取完整的 JSON 数据结构
            report_data = await worker.generate_report()

            # 将report_data写文件用于调试


            if not os.path.exists('debug'):
                os.makedirs('debug')
            timestamp = datetime.datetime.now().strftime("%m-%d_%H-%M")
            with open(f'debug/reflection_{timestamp}.json', 'w', encoding='utf-8') as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            
            # 2. 渲染成 HTML (需要更新 html_renderer 以适配新的 report_data 结构)
            html_report = render_reflection_report(report_data)

            await self.output_queue.put({
                "type": "reflection_report",
                "data": {"report": html_report}
            })

            html_file =f"""<!DOCTYPE html><html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ChronoFork Reflection Report - {timestamp}</title>
    <style>
        /* 给整个页面一个浅灰背景，这样白色的 Report 卡片会更突出 */
        body {{ 
            margin: 0; 
            padding: 40px 20px; 
            background-color: #f4f4f9; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }}
        /* 让 Report 居中显示 */
        .rf-root {{
            max-width: 900px;
            margin: 0 auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important; /* 强制增加阴影立体感 */
        }}
    </style>
</head>
<body>
    {html_report}
</body>
</html>"""

            if not os.path.exists('reflections'):
                os.makedirs('reflections')
            timestamp = datetime.datetime.now().strftime("%m-%d_%H-%M")
            file_path = f'reflections/{timestamp}.html'
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_file)

            self.logger.log("System", "Reflection", f"Report saved to {file_path}")
            
            # 顺便存个档
            self.save_checkpoint(reason="reflection_generated")
            
        except Exception as e:
            print(f"Reflection Error: {e}")
            import traceback
            traceback.print_exc()

    async def handle_tip_request(self):
        """处理前端的 Tip 请求"""
        self.logger.log("System", "Tip", "Request Received")

        # 1. 获取上下文
        if self.in_backtrack_draft_mode:
            context = self.pending_messages
            if len(context) < 3 and self.history_msg:
                context = self.history_msg + context
        else:
            context = self.engine.get_context_messages()

        storyline_json = self.engine.get_story_context(only_current=True)

        try:
            
            tip_data = await self.facilitator.generate_tips(
                self.episode.get('title',''),
                self.user_role_name,
                storyline_json,
                context
            )
            
            # 3. 发送回前端
            await self.output_queue.put({
                "type": "tip_data",
                "data": tip_data
            })
            
        except Exception as e:
            print(f"Handle Tip Error: {e}")
            # 发送错误状态关闭 loading
            await self.output_queue.put({
                "type": "tip_error",
                "data": {"msg": str(e)}
            })

    def _construct_system_message(self, agent_name: str) -> str:
        agent = self.agents.get(agent_name)
        cast_str = "\n".join([f"“{p['name']}”: {p['title']};" for p in self.raw_cast_data if p["name"] != agent_name])

        storyline_json = self.engine.get_story_context()
        if storyline_json[-1].get("status") == "Active":
            active_node = storyline_json[-1]
            next_node_desc = None
            next_id = "end"
        else:
            active_node = storyline_json[-2]
            future_node = storyline_json[-1]
            next_node_desc = f"{future_node["choice"]}(nodeid={future_node["id"]}): {future_node["desc"]}"
            next_id = future_node["id"]

        return get_prompt(
            "cast.agent_system",
            self.prompt_lang,
            agent_name=agent.name,
            agent_title=agent.profile["title"],
            episode_title=self.episode.get("title", ""),
            active_node_title=active_node["title"],
            active_node_id=active_node["id"],
            active_node_desc=active_node["desc"],
            next_node_desc=("nodeid=end" if not next_node_desc else next_node_desc),
            cast_str=cast_str,
            next_id=next_id,
        )

    def get_divergence_prompt(self, episode_title, cast_str, storyline_json, recent_context):

        if storyline_json[-1].get("status")=="Active":
            active_node = storyline_json[-1]
            next_node_desc = None
        else:
            active_node = storyline_json[-2]
            future_node = storyline_json[-1]
            next_node_desc = f"{future_node["choice"]}"

        
        context_str = "\n".join([f"[{m['from']} -> {m['to']}]: {m['content']}" for m in recent_context[-3:]])

        return get_prompt(
            "cast.divergence",
            self.prompt_lang,
            episode_title=episode_title,
            cast_str=cast_str,
            active_node_title=active_node["title"],
            active_node_desc=active_node["desc"],
            canonical_next=("end" if not next_node_desc else next_node_desc),
            context_str=context_str,
        )


    def _generate_divergence_report(self, data: dict, new_node_id: str) -> str:
        """
        生成 HTML 格式的高级分歧报告
        """
        feasibility = data.get("feasibility", {})
        score = feasibility.get("score", 0)
        rationale = feasibility.get("rationale", "No rationale provided.")
        drivers = feasibility.get("key_drivers", [])
        constraints = feasibility.get("key_constraints", [])
        outcomes = data.get("outcomes_brief", [])

        # 1. 颜色逻辑
        if score >= 70:
            bar_color = "#28a745" # Green
            text_color = "#155724"
        elif score >= 40:
            bar_color = "#ffc107" # Yellow
            text_color = "#856404"
        else:
            bar_color = "#dc3545" # Red
            text_color = "#721c24"

        # 2. 列表转 HTML li
        drivers_html = "".join([f"<li>{d}</li>" for d in drivers]) if drivers else "<li>None</li>"
        constraints_html = "".join([f"<li>{c}</li>" for c in constraints]) if constraints else "<li>None</li>"

        # 3. Outcomes HTML
        outcome_map = {"Most likely": "⚖️", "Best-case": "🌟", "Worst-case": "🌩️"}
        outcomes_html = ""
        for outcome in outcomes:
            label = outcome.get("label", "")
            icon = outcome_map.get(label, "🔹")
            summary = outcome.get("summary", "")
            outcomes_html += f"""<div style="margin-bottom: 4px;">
                <span style="font-weight:600;">{icon} {label}:</span> 
                <span style="color:#444;">{summary}</span>
            </div>"""

        # 4. 组装 HTML (使用 textwrap.dedent 去除代码缩进带来的空格)
        html = textwrap.dedent(f"""<div class="divergence-quote">
                "{rationale}"
            </div>
            <div class="score-container">
                <span style="font-weight:bold; color:{text_color}; min-width: 140px;">
                    🤔 Feasibility: {score}/100
                </span>
                <div class="progress-track">
                    <div class="progress-fill" style="width: {score}%; background-color: {bar_color};"></div>
                </div>
            </div>
            <div class="drivers-grid">
                <div class="driver-col">
                    <h4>🚀 Core Drivers</h4>
                    <ul>{drivers_html}</ul>
                </div>
                <div class="driver-col">
                    <h4>🚧 Constraints</h4>
                    <ul>{constraints_html}</ul>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
                <div style="font-weight: bold; margin-bottom: 5px; color: #333; text-align: center; font-size: 1.1em;">🔮 Projected Outcomes</div>
                {outcomes_html}
            </div>
            <div style="margin-top: 10px; text-align: right; font-size: 0.95em; color: #666;">
                🔀 New timeline established: <b>{new_node_id}</b>
            </div>""")
        
        return html
