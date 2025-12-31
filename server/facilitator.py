from typing import List, Dict, AsyncGenerator

from server.llm_cache import cached_chat_create, call_llm

class Facilitator:
    def __init__(self, episode: str, cast_str: str):
        
        self.cast_str = cast_str
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

        msg = [self.messages[0],{
            "role": "user",
            "content": f"""Task: 你需要作为导演切换镜头，目标是用最少轮次推进<active_node>节点结束(并进入<next_node>)。

<active_node>{active_node["title"]}: {active_node["desc"]}</active_node>
<next_node>{'end'if not next_node_desc else next_node_desc}</next_node>
<cast>{self.cast_str}</cast>

角色 “{agent_name}” 请求切换镜头，上下文如下：「{context_str}」。

**决策逻辑 (严格遵守)**
- 剧情推进：
    - 若角色表现了对某角色的兴趣，则转向该角色。
    - 若角色开始聊细节/跑题：立即拉回<active_node>并最大程度推进。
    - 最大程度上推进<active_node>节点结束，进入<next_node>
    - 如果<active_node>已接近结束，在旁白中进行总结和并说明进入<next_node>
- 旁白风格：
    - 极简（1-2句），第三人称。

输出格式 (严格)，ONLY Use English:
<meta targetName="下一个对话的对象，必须是 <cast> 中的 EXACT 名称"/> [旁白：描述镜头切换后的新画面/氛围，引出下一人的行动]
"""
        }]

        stream = await cached_chat_create(
                "gpt-5.1", 
                msg, 
                stream=True
            )
        return stream
    
    async def generate_tips(self,episode_title:str,user_role_name:str ,storyline: List[Dict], context_msgs: List[Dict]) -> Dict:
        """生成战略建议"""
        history_prefix_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n['id']}): {n['desc']}" for n in storyline])

        recent_logs = []
        for m in context_msgs:
            log_entry = {
                "from": m['from'] if m['from']!=user_role_name else f"{m['from']} (User)",
                "to": m['to'] if m['to']!=user_role_name else f"{m['to']} (User)",
                "content": m['content']
            }
            recent_logs.append(log_entry)

        recent_logs_str = "\n".join([f"{m['from']} -> {m['to']}: {m['content']}" for m in recent_logs])
        
        prompt = f"""你是用户的“历史战略顾问”。Learner 正在进行「{episode_title}」的历史模拟，已进行的故事线是<context>，参与的的角色包括<cast>，最近的对话是<logs>（重点关注最后一句提问），你需要根据当前局势，为用户提供2或4个不同的行动选项`options`，以探索不同的历史可能性或改写历史，要求精炼。目标是培养用户的历史思维（权衡利弊、预判后果）。

<context>{history_prefix_str}</context>
<cast>{self.cast_str}</cast>
<logs>{recent_logs_str}</logs>"""+"""
输出严格 JSON 格式，ONLY Use English：
{{
  "situation_analysis": "1句话简述当前尴尬/危机/决策点，点出核心矛盾。",
  "options": [
    {{"""+f"""
      "label": "短标签 (e.g. 强硬拒绝 / 妥协换取时间)",
      "target_agent": "建议对话的目标角色名 (EXACT name in <cast>, except the user({user_role_name}))",
      "example_response": "用户可以说的一句具体的台词示例 (自然口语，简短)",
      "rationale": "为什么要这么做 (收益/动机)",
      "risks": "潜在风险或代价 (Consequences)",
      "intent_type": "Escalation | De-escalation | Alliance Building | Info Gathering" """+"""
    }},
    ...
  ]
}}"""
        try:
            response = await call_llm(prompt)
            return response
        except Exception as e:
            print(f"Tip Gen Error: {e}")
            return {}