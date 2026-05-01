import json
import hashlib
import re
from dotenv import load_dotenv
load_dotenv()
import os
from diskcache import Cache
from typing import List, Dict

from openai import AsyncOpenAI
from server.prompts import get_prompt, normalize_lang

GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# 初始化缓存，指定目录
# 这会自动在目录下生成 sqlite.db，完美持久化
cache = Cache("./cache")

class MockDelta:
    def __init__(self, content): self.content = content
class MockChoice:
    def __init__(self, content): self.delta = MockDelta(content)
class MockChunk:
    def __init__(self, content): self.choices = [MockChoice(content)]

async def cached_chat_create(
    model: str,
    messages: List[Dict],
    stream: bool = False,
    provider: str = "openai",
):
    provider = provider.lower()

    # 1. 生成 Key
    key_content = json.dumps(
        {"provider": provider, "model": model, "messages": messages},
        sort_keys=True,
    )
    cache_key = hashlib.md5(key_content.encode('utf-8')).hexdigest()
    
    # 2. 查缓存
    print(f"🔍 Checking cache for key: {cache_key}")
    if cache_key in cache:
        print(f"⚡ [Cache Hit] {cache_key[:8]}")
        cached_res = cache[cache_key]
        
        if stream:
            async def async_generator():
                yield MockChunk(cached_res)
            return async_generator()
        else:
            return cached_res

    # 3. API 请求
    print(f"🌐 [API Call] {cache_key[:8]}")


    # 0. 初始化 Client (从环境变量读取 Key)
    if provider == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("Missing GROQ_API_KEY environment variable.")
        client = AsyncOpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
    else:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("Missing OPENAI_API_KEY environment variable.")
        client = AsyncOpenAI(api_key=api_key)
    
    if stream:
        response_stream = await client.chat.completions.create(
            model=model, messages=messages, stream=True, temperature=1
        )

        async def caching_generator():
            full_content = []
            async for chunk in response_stream:
                content = chunk.choices[0].delta.content
                if content:
                    full_content.append(content)
                    yield chunk
            
            # 存入缓存
            cache[cache_key] = "".join(full_content)
            
        return caching_generator()
    
    else:
        response = await client.chat.completions.create(
            model=model, messages=messages, stream=False, temperature=0.7
        )
        content = response.choices[0].message.content
        # 存入缓存
        cache[cache_key] = content
        return content
    

async def call_llm(
    user_prompt,
    lang: str = "zh",
    model: str = "gpt-5.2",
    provider: str = "openai",
):
    prompt_lang = normalize_lang(lang)
    messages = [
        {"role": "system", "content": get_prompt("llm.system_json", prompt_lang)},
        {"role": "user", "content": user_prompt}
    ]

    content = await cached_chat_create(model, messages, stream=False, provider=provider)
    
    # ... (后续解析 JSON 的逻辑保持不变) ...
    json_pattern = re.compile(r'```json\n(.*?)```', re.DOTALL)
    json_match = json_pattern.search(content)
    
    if json_match:
        json_str = json_match.group(1)
    else:
        json_str = content
        
    return json.loads(json_str)
