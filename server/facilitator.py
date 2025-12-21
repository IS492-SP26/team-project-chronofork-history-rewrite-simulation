import os
import json
from typing import List, Dict, AsyncGenerator

from server.llm_cache import cached_chat_create

class Facilitator:
    def __init__(self, theme: str, cast_str: str, user_role: str, start_node_desc: str):
        
        
        # 1. System Prompt
        self.messages = [{
            "role": "system", 
            "content": f"You are the Facilitator for a historical role-play experience. Theme: {theme}. The participating characters are <cast>{cast_str}</cast>. You do not role-play. Your job is to provide brief, spoken, plain-language guidance to the user."
        }]
        
        # 2. 预埋 Intro Task
        self.messages.append({
            "role": "user",
            "content": f"Task: Open the experience with a short intro and hand the spotlight to the first character to speak. The script for the first scene is <first_scene>{start_node_desc}</first_scene>\n\nOutput format (strict):\n- Line 1: <meta targetName=\"exact name of the first introduced member in <cast>, except the user ({user_role})\"/>\n- Line 2+: Briefly introduce the background. Briefly introduce key cast members and their stances. End with a final sentence that hands the conversation to targetName. Use concise, spoken short sentences. Keep it short."
        })
        
        # 状态标记
        self.has_intro_run = False

    async def run_intro(self) -> AsyncGenerator[str, None]:
        """运行 Intro，返回流式 Token"""
        self.has_intro_run = True
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
        
        # 记录 Assistant 的回复，保持对话历史闭环
        self.messages.append({"role": "assistant", "content": "".join(full_content)})

    async def run_reflection(self, recent_messages: List[Dict]) -> AsyncGenerator[str, None]:
        """运行 Reflection，返回流式 Token"""
        # 格式化最近消息
        msgs_str = "\n".join([f"[{m['from']}]: {m['content']}" for m in recent_messages])
        
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