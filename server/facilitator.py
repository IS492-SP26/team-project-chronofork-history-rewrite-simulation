from typing import List, Dict, AsyncGenerator

from server.llm_cache import cached_chat_create

class Facilitator:
    def __init__(self, episode: str, cast_str: str):
        
        
        # 1. System Prompt
        self.messages = [{
            "role": "system", 
            "content": f"You are the Facilitator for a historical role-play experience. Theme: {episode}. The participating characters are <cast>{cast_str}</cast>. You do not role-play. Your job is to provide brief, spoken, plain-language guidance to the user."
        }]

    async def run_intro(self,start_node_desc,user_role) -> AsyncGenerator[str, None]:
        """运行 Intro，返回流式 Token"""
        msg = [self.messages[0],{
            "role": "user",
            "content": f"Task: Open the experience with a short intro and hand the spotlight to the first character to speak. The script for the first scene is <first_scene>{start_node_desc}</first_scene>\n\nOutput format (strict):\n- Line 1: <meta targetName=\"exact name of the first introduced member in <cast>, except the user ({user_role})\"/>\n- Line 2+: Briefly introduce the background. Briefly introduce key cast members and their stances. End with a final sentence that hands the conversation to targetName. Use concise, spoken short sentences. Keep it short."
        }]
        stream = await cached_chat_create(
                "gpt-5-mini", 
                msg, 
                stream=True
            )
        
        full_content = []
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_content.append(token)
                yield token
        

    async def run_reflection(self, recent_messages: List[Dict]) -> AsyncGenerator[str, None]:
        """运行 Reflection，返回流式 Token"""
        # 格式化最近消息
        msgs_str = "\n".join([f"[{m['from']} -> {m['to']}]: {m['content']}" for m in recent_messages])
        
        # 构造 User Task (不存入 self.messages 长期记忆，避免 Context 过长，或者根据需求存入)
        # 这里按照你的 Prompt 结构，似乎是希望追加到历史中。
        user_msg = {
            "role": "user",
            "content": f"Task: Based on the dialogue snippet, give the user a brief analysis by choosing 1-2 suitable focuses from: Recap (what important things just happened), Orientation (did a key tension emerge), Causal thread (did an action lead to a consequence), Divergence nudges (are there plausible ways to diverge or explore alternatives—suggest options), Micro-reflection (a light prompt/question to elicit stance/strategy/trade-offs). <messages>{msgs_str}</messages>\n\nOutput: 1–2 short spoken sentences in one line, starting with an emoji. Don’t list options. Ask open-endedly if needed."
        }
        
        # 临时构建请求 Messages (System + Intro History + Current Task)
        # 这样既保留了 System 设定，又包含了最新的任务，同时避免无限堆叠 user/assistant
        # 或者如果你希望 Facilitator 记得之前的建议，可以 append。这里采用 append 模式：
        self.messages.append(user_msg)

        stream = await cached_chat_create(
                "gpt-5-mini", 
                self.messages, 
                stream=True
            )

        full_content = []
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_content.append(token)
                yield token
        
        self.messages.append({"role": "assistant", "content": "".join(full_content)})

    async def run_bridge(self,storyline_json:List[Dict], agent_name: str, recent_context: List[Dict]) -> AsyncGenerator[str, None]:
        """
        [新增] 导演模式：进行转场调度。
        """
        # 1. 构造 Context
        context_str = "\n".join([f"[{m['from']} -> {m['to']}]: {m['content']}" for m in recent_context[-3:]])

        if storyline_json[-1].get("status")=="Active":
            active_node = storyline_json[-1]
            next_node_desc = None
        else:
            active_node = storyline_json[-2]
            future_node = storyline_json[-1]
            next_node_desc = f"{future_node["choice"]}: {future_node["desc"]}"

        
        # 2. 构造 Task
        bridge_task = {
            "role": "user",
            "content": f"""Task: 你需要作为导演切换镜头，目标是用最少轮次推进<active_node>节点结束(并进入<next_node>)。

<active_node>{active_node["title"]}: {active_node["desc"]}</active_node>
<next_node>{'end'if not next_node_desc else next_node_desc}</next_node>

角色 “{agent_name}” 请求切换镜头，上下文如下：「{context_str}」。

**决策逻辑 (严格遵守)**
- 剧情推进：
    - 若角色表现了对某角色的兴趣，则转向该角色。
    - 若角色开始聊细节/跑题：立即拉回<active_node>并最大程度推进。
    - 最大程度上推进<active_node>节点结束，进入<next_node>
    - 如果<active_node>已接近结束，在旁白中进行总结和并说明进入<next_node>
- 旁白风格：
    - 极简（1-2句），第三人称。

输出格式 (严格)
<meta targetName="下一个对话的对象，必须是 <cast> 中的 EXACT 名称"/> [旁白：描述镜头切换后的新画面/氛围，引出下一人的行动]
"""
        }
        
        # 暂时 append 到消息历史，或者使用临时列表以节省 token，建议 append 以保持连贯性
        self.messages.append(bridge_task)

        stream = await cached_chat_create(
                "gpt-5-mini", 
                self.messages, 
                stream=True
            )
        return stream