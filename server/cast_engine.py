import re
import json
import asyncio
from typing import List, Dict, Any, AsyncGenerator
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
        """
        初始化时直接创建 StoryEngine，保证 Server 无法直接操作 StoryEngine
        """
        self._event_buffer = []

        def _internal_notifier(event_type: str, payload: Any):
            """
            这是传给 StoryEngine 的同步回调。
            当 StoryEngine 更新图表时，它会调用这个函数。
            我们将消息暂存在 buffer 中，稍后在 run_loop 中统一发给 WebSocket。
            """
            message = { "type": event_type, "data": payload }
            self._event_buffer.append(message)
            
        # --- 初始化 StoryEngine ---
        storyline = config.get("storyline", [])
        self.engine = StoryEngine(storyline, update_notifier=_internal_notifier)
        
        # --- 初始化 Cast ---
        cast_data = config.get("cast_data", [])
        self.theme = config.get("theme", "Unknown")
        user_role = config.get("user_role", {})
        self.user_role_name = user_role.get("name", "User")

        # 确保 User 在 Cast 列表中
        if self.user_role_name not in [a.get("name") for a in cast_data]:
            cast_data.append(user_role)
            
        self.agents: Dict[str, Agent] = {}
        for profile in cast_data:
            self.agents[profile['name']] = Agent(profile)
        self.raw_cast_data = cast_data

        # --- 运行时状态控制 ---
        self.input_queue = asyncio.Queue() # 用于接收用户输入
        self.running = False
        self.current_speaker = None # 当前轮到谁说话

    async def _flush_events(self) -> AsyncGenerator[Dict, None]:
        """
        将 _event_buffer 中积累的 StoryEngine 消息（如图表更新）全部 Yield 出去
        并清空缓冲区。
        """
        while self._event_buffer:
            # 弹出第一个消息 (FIFO)
            msg = self._event_buffer.pop(0)
            yield msg
    # ==========================
    # 对外接口 (Server调用)
    # ==========================
    async def start(self) -> AsyncGenerator[Dict, None]:
        """启动故事"""
        self.engine.start_story()
        async for msg in self._flush_events():
            yield msg
        self.running = True
        # 默认由第一个非用户 Agent 开始，或者由配置决定
        # 这里假设第一个 Agent 先说话
        first_agent = next((name for name in self.agents.keys() if name != self.user_role_name), None)
        self.current_speaker = first_agent

    async def push_user_message(self, content: str, target: str):
        """Server 将前端收到的消息塞入这里"""
        await self.input_queue.put({
            "content": content,
            "target": target
        })

    async def run_loop(self) -> AsyncGenerator[Dict, None]:
        """
        核心主循环。
        Main loop logic: Check Speaker -> (Wait User OR Run Agent) -> Update State -> Repeat
        Yields: 用于发往前端的 WebSocket 消息对象
        """
        if not self.running:
            return

        while self.running:
            async for msg in self.flush_events():
                yield msg
            # 1. 检查当前发言人
            if not self.current_speaker:
                # 如果没有指定发言人，默认用户发言
                self.current_speaker = self.user_role_name

            # 2. 分支逻辑：用户 vs Agent
            if self.current_speaker == (self.user_role_name or "user" or "User"):
                # --- CASE A: 等待用户输入 ---
                
                # 通知前端：现在轮到用户了
                yield {"type": "input_request", "data": {"from": "System", "msg": "Waiting for user..."}}
                
                # 暂停 Loop，直到队列里有东西 (Await)
                user_input = await self.input_queue.get()
                
                content = user_input["content"]
                target = user_input["target"]

                # 存入 StoryEngine
                self.engine.add_message(
                    from_name=self.user_role_name,
                    to_name=target,
                    content=content
                )

                async for msg in self._flush_events():
                    yield msg
                
                # 用户说完，下一个轮到用户指定的 Target
                self.current_speaker = target
                
            else:
                # --- CASE B: Agent 回合 ---
                agent_name = self.current_speaker

                # 调用 Agent 生成逻辑 (Streaming)
                next_target = self.user_role_name # 默认回落给用户
                
                async for msg_type, msg_data in self.streaming_step(agent_name):
                    if msg_type == "token":
                        # 直接流式输出内容
                        yield {"type": "stream_token", "data": {"agent": agent_name, "token": msg_data}}
                    elif msg_type == "meta_next":
                        # 捕获 Agent 决定的下一个说话人
                        next_target = msg_data
                    elif msg_type == "error":
                        yield {"type": "error", "data": msg_data}
                  
                async for msg in self._flush_events():
                    yield msg

                # Agent 说完，更新下一轮发言人
                self.current_speaker = next_target
                
                # 可以稍微 sleep 一下避免死循环过快
                await asyncio.sleep(0.1)

    # ==========================
    # 内部逻辑 (Prompt & LLM)
    # ==========================
    
    # ... _construct_system_message 和 _parse_meta_line 保持不变 ...
    def _construct_system_message(self, agent_name: str) -> str:
        # (保持你原有的逻辑，只需把 self.user_role 改为 self.user_role_name)
        agent = self.agents.get(agent_name)
        other_cast = [p for p in self.raw_cast_data if p['name'] != agent_name]
        cast_json = json.dumps(other_cast, ensure_ascii=False, indent=2)
        storyline_json = self.engine.get_story_context()
        prompt = f"""You are {agent.name}, role-playing as {agent.profile['title']} in the historical theme: {self.theme}.
The user role-plays as: {self.user_role_name}.

You are given:
<storyline>
{storyline_json}
</storyline>

<cast>
{cast_json}
</cast>

MISSION
Co-roleplay the episode with the user in a historically grounded, decision-driven way, using the active Storyline node as the immediate anchor.

CORE RULES
1) Anchor on the active node: Identify the node where status == "Active". Stay within its time/place/conflict until the node’s dilemma is reached and resolved.
2) Slow, detailed progression: Gradually unfold the active node (4–8 conversational turns) Add concrete situational details, constraints, and interpersonal dynamics. Do NOT resolve everything at once.
3) Co-roleplay (not Q&A): Treat the user as an in-world participant. Engage them through questions, invitations, and reactions (negotiate, persuade, request action, respond to their moves).
4) Decision checkpoints are story beats, not mandatory user choices:
   - When approaching the node’s key dilemma (node title), surface it clearly in-character.
   - The user MAY influence, advise, resist, propose alternatives, or take side actions.
   - If the user does not initiate a divergence, the appropriate in-world decision-maker(s) (often a CharacterAgent) may proceed with the canonical choice to advance the story.
5) Divergence can happen anytime:
   - Encourage plausible divergences at key checkpoints AND during non-checkpoint moments (new tactics, side negotiations, changed tone, different messaging, etc.).
   - If a divergence meaningfully departs from canonical events, continue in-context and mark nodeid as "<activeNodeId>/diverged".
6) Plausibility guardrails:
   - If the user requests absurd/out-of-context actions (aliens, impossible tech, ahistorical magic), refuse briefly in-character and steer to plausible options within the setting.
7) Transition logic:
   - Once the active node’s dilemma is resolved (canonically or via divergence), naturally move toward the next node (by chronology and consequences), without jumping multiple nodes at once.

OUTPUT FORMAT (STRICT)
Return plain text with exactly:
- Line 1: <meta targetName="..." nodeid="..." />
- Line 2+: Your in-character message (spoken, natural).

META TAG RULES
- targetName: the primary person you are addressing this turn (a cast member name or {self.user_role_name}).
- nodeid:
  - If staying on canonical track: use the active node id (e.g., "2.1").
  - If a meaningful divergence is underway at this node: use "diverged".

Do not output JSON. Do not add any other tags or headers."""
        
        return prompt

    def _parse_meta_line(self, content: str):
        meta_pattern = r'<meta targetName="(.*?)" nodeid="(.*?)"\s*/>'
        match = re.search(meta_pattern, content)
        if match:
            return match.group(1), match.group(2)
        return None, None

    async def streaming_step(self, agent_name: str):
        """
        异步生成器。
        Yields: ("token", str) 或 ("meta_next", str)
        """
        current_agent = self.agents.get(agent_name)
        if not current_agent:
            print(f"Error: Agent {agent_name} not found.")
            yield "error", f"Agent {agent_name} not found."
            return

        # 1. 准备 Context
        sys_msg = self._construct_system_message(agent_name)
        current_agent.update_system_message(sys_msg)
        context_msgs = self.engine.get_context_messages()

        # 2. 调用 LLM (Async Stream)
        stream = await current_agent.chat(context_msgs)
        if not stream:
            return

        buffer = ""
        meta_parsed = False
        target_name = self.user_role_name
        meta_node_id = self.engine._current_node_id
        full_content_body = []

        # 3. 异步迭代流
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                
                if not meta_parsed:
                    buffer += token
                    if "\n" in buffer or "/>" in buffer:
                        if "/>" in buffer:
                            split_idx = buffer.find("/>") + 2
                            meta_line = buffer[:split_idx]
                            remaining = buffer[split_idx:].lstrip()
                            
                            t_name, n_id = self._parse_meta_line(meta_line)
                            if t_name: target_name = t_name
                            if n_id: meta_node_id = n_id
                            
                            meta_parsed = True
                            
                            if remaining:
                                full_content_body.append(remaining)
                                yield "token", remaining
                else:
                    full_content_body.append(token)
                    yield "token", token

        # 4. 结束处理 (Side Effects)
        final_body = "".join(full_content_body).strip()
        
        # 更新 StoryEngine 状态 (Log / Move Next)
        current_engine_node = self.engine._current_node_id
        if meta_node_id != "diverged" and meta_node_id != current_engine_node:
             try:
                 curr_depth = int(current_engine_node.split('.')[0])
                 llm_depth = int(meta_node_id.split('.')[0])
                 if llm_depth > curr_depth:
                     self.engine.move_next()
             except: 
                print(f"Warning: Unable to parse node ids: {current_engine_node}, {meta_node_id}")
                pass

        if final_body:
            self.engine.add_message(from_name=agent_name, to_name=target_name, content=final_body)

        # 告知 Loop 谁是下一个
        yield "meta_next", target_name