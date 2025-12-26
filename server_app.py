import asyncio
import glob
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict
from server.cast_engine import CastEngine

app = FastAPI()

def load_latest_config():
    """读取 config/ 目录下最新的 session json"""
    list_of_files = glob.glob('config/session_*.json')
    if not list_of_files: return {}
    latest_file = max(list_of_files, key=os.path.getctime)
    try:
        with open(latest_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except: return {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

    def disconnect(self, websocket: WebSocket):
        # 取消该连接关联的任务
        if websocket in self.active_connections:
            self.active_connections[websocket].cancel()
            del self.active_connections[websocket]

    async def send_json(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_json(message)
        except: pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    # --- 2. 初始化 CastEngine (含 StoryEngine) ---
    config = load_latest_config()
    cast_engine = CastEngine(config)
    print("CastEngine initialized.")

    init_payload = {
        "type": "system_init",
        "data": {
            "config": config if config else {},
            "status": "ready" if config else "error_no_config"
        }
    }
    await manager.send_json(websocket, init_payload)
    
    if cast_engine.initial_graph_snapshot:
        await manager.send_json(websocket, {
            "type": "graph_update",
            "data": cast_engine.initial_graph_snapshot
        })
    
    cast_task = None
    try:
        while True:
            data = await websocket.receive_text()
            request = json.loads(data)
            print(f"Received WS request: {request}")
            func_name = request.get("type")
            params = request.get("data", {})

            if func_name == "start_experience":
                if manager.active_connections.get(websocket):
                    manager.active_connections[websocket].cancel()
                    print("Cancelled existing CastEngine task for this connection.")
                # 1. 启动 CastEngine
                cast_engine.start()
                # 2. 消费者任务：从 Engine Queue 读取并发送给 WS
                async def output_worker():
                    async for msg in cast_engine.output_generator():
                        await manager.send_json(websocket, msg)
                        
                cast_task = asyncio.create_task(output_worker())
                manager.active_connections[websocket] = cast_task

            elif func_name == "user_message":
                # 将用户消息“推”给正在运行的 CastEngine Loop
                # Loop 会在 await self.input_queue.get() 处收到这个消息并解除阻塞
                content = params.get("content")
                target = params.get("target")
                await cast_engine.push_user_message(content, target)
            

            elif func_name == "backtrack_to":
                target_id = params.get("target_id")
                perspective_agent = params.get("perspective_agent")
                # 直接操作内部 engine (如果允许) 或通过 cast_engine 代理
                cast_engine.backtrack_to(target_id, perspective_agent)
                # TODO

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        cast_engine.running = False
        if cast_engine.main_logic_task: cast_engine.main_logic_task.cancel()
        if cast_task: cast_task.cancel()
    except Exception as e:
        print(f"WS Error: {e}")
        if cast_task: cast_task.cancel()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)