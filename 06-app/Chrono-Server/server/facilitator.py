from typing import List, Dict, AsyncGenerator

from server.utilities.llm_cache import GROQ_MODEL, cached_chat_create, call_llm
from server.prompts import get_prompt, normalize_lang

class Facilitator:
    def __init__(self, episode: str, cast_str: str, lang: str = "zh"):
        
        self.cast_str = cast_str
        self.lang = normalize_lang(lang)
        # 1. System Prompt
        self.messages = [{
            "role": "system", 
            "content": get_prompt(
                "facilitator.system",
                self.lang,
                episode=episode,
                cast_str=cast_str,
            )
        }]

    async def run_intro(self,start_node_desc,user_role) -> AsyncGenerator[str, None]:
        """运行 Intro，返回流式 Token"""
        msg = [self.messages[0],{
            "role": "user",
            "content": get_prompt(
                "facilitator.intro",
                self.lang,
                start_node_desc=start_node_desc,
                user_role=user_role,
            )
        }]
        stream = await cached_chat_create(
                "gpt-5.2", 
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
            "content": get_prompt(
                "facilitator.reflection",
                self.lang,
                msgs_str=msgs_str,
            )
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
            "content": get_prompt(
                "facilitator.bridge",
                self.lang,
                active_node_title=active_node["title"],
                active_node_decision=active_node.get("decision", active_node["title"]),
                active_node_desc=active_node["desc"],
                next_node_desc=("end" if not next_node_desc else next_node_desc),
                cast_str=self.cast_str,
                agent_name=agent_name,
                context_str=context_str,
            )
        }]

        stream = await cached_chat_create(
                "gpt-5.2", 
                msg, 
                stream=True
            )
        return stream
    
    async def generate_timeline_epilogue(
        self,
        episode_title: str,
        canonical_storyline: List[Dict],
        divergent_messages: List[Dict],
    ) -> Dict:
        """生成历史改写结局的可视化 JSON 总结"""
        canonical_str = "\n".join(
            f"[{n['id']}] {n['title']}: {n['desc']} (decision: {n.get('decision','None')})"
            for n in canonical_storyline
        )
        divergent_str = "\n".join(
            f"[{m['from']} -> {m['to']}]: {m['content']}"
            for m in divergent_messages
        )
        prompt = get_prompt(
            "facilitator.timeline_epilogue",
            self.lang,
            episode_title=episode_title,
            canonical_storyline_str=canonical_str,
            divergent_context_str=divergent_str,
            cast_str=self.cast_str,
        )
        try:
            response = await call_llm(prompt, lang=self.lang)
            return response
        except Exception as e:
            print(f"Timeline Epilogue Gen Error: {e}")
            return {}

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
        
        prompt = get_prompt(
            "facilitator.tips",
            self.lang,
            episode_title=episode_title,
            history_prefix_str=history_prefix_str,
            cast_str=self.cast_str,
            recent_logs_str=recent_logs_str,
            user_role_name=user_role_name,
        )
        try:
            response = await call_llm(
                prompt,
                lang=self.lang,
                model=GROQ_MODEL,
                provider="groq",
            )
            return response
        except Exception as e:
            print(f"Tip Gen Error: {e}")
            return {}
