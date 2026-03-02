# web_app.py
import json
import asyncio
import argparse
import aiohttp
import panel as pn
from panel.viewable import Viewer
from components.chat_interface import ChatInterface
from components.episode_cast import EpisodeCastInfo
from components.story_graph import StoryGraph
import dotenv
dotenv.load_dotenv()

css = """
#input{ font-size: 120%; }
.bk-btn { font-size: 1.1em !important; }

.small-loader {
  border: 4px solid #f3f3f3;
  border-radius: 50%;
  border-top: 4px solid #3498db;
  width: 20px;
  height: 20px;
  -webkit-animation: spin 1s linear infinite; /* Safari */
  animation: spin 1s linear infinite;
  display: inline-block;
  vertical-align: middle;
}
.big-loader {
  border: 8px solid #f3f3f3;
  border-radius: 50%;
  border-top: 8px solid #ffaa00;
  width: 50px;
  height: 50px;
  -webkit-animation: spin 1s linear infinite;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 引用块样式 */
.divergence-quote {
    background: rgba(255, 255, 255, 0.6);
    border-left: 4px solid #856404;
    padding: 10px 15px;
    margin: 10px 0;
    font-style: italic;
    color: #555;
    border-radius: 0 4px 4px 0;
}

/* 进度条容器 */
.score-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px 0;
    font-family: 'Segoe UI', Roboto, sans-serif;
}

/* 现代 CSS 进度条 */
.progress-track {
    flex-grow: 1;
    height: 8px;
    background-color: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
}
.progress-fill {
    height: 100%;
    transition: width 0.6s ease;
}

/* 驱动因素表格布局 */
.drivers-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-top: 15px;
    background: rgba(255,255,255,0.5);
    padding: 10px;
    border-radius: 5px;
}
.driver-col h4 {
    margin: 0 0 5px 0;
    font-size: 0.9em;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 3px;
}
.driver-col ul {
    margin: 0;
    padding-left: 20px;
    font-size: 0.9em;
    color: #333;
}

.tip-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

/* 粘性顶部 */
.sticky-top-bar {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255,255,255,0.95); backdrop-filter: blur(5px);
    border-bottom: 1px solid #eee; padding: 2px 0; margin-bottom: 3px;
}

/* 卡片容器：复用 rf-card 风格 */
.tip-card-wrapper {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-left-width: 5px; /* 左侧色条 */
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    height: 100%;
    display: flex; flex-direction: column;
    transition: transform 0.2s, box-shadow 0.2s;
    overflow: hidden;
}
.tip-card-wrapper:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.1);
}

/* 内容区 */
.tip-body { padding: 6px; flex-grow: 1; display: flex; flex-direction: column; gap: 8px; }

/* 头部 */
.tip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }

/* 标签：复用 rf-tag */
.tip-tag { 
    display: inline-block; padding: 2px 8px; border-radius: 4px; 
    font-size: 0.85em; font-weight: 700; text-transform: uppercase; 
    letter-spacing: 0.5px;
}

/* 标题 */
.tip-title { font-size: 1.2em; font-weight: 700; color: #2d3436; line-height: 1.3; text-align: center; margin-top: 5px; margin-bottom: 4px; }

/* 对话引用 */
.tip-quote {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic; color: #555; font-size: 1em;
    background: #f8f9fa; border-left: 3px solid #dfe6e9;
    padding: 8px; border-radius: 0 4px 4px 0;
    margin: 5px 0;
}

/* 分析块：复用 rf-outcome 风格 */
.tip-block { font-size: 0.95em; padding: 6px 8px; border-radius: 4px; line-height: 1.4; }
.tip-block-green { background: #e8f6f3; color: #16a085; border: 1px solid #d4efdf; }
.tip-block-red { background: #fdedec; color: #c0392b; border: 1px solid #fadbd8; }

/* 按钮修正 */
.tip-btn button { margin: 0 !important; border-radius: 0 !important; height: 36px; font-weight: 600; }
"""
pn.extension(raw_css=[css],notifications=True)


I18N = {
    "en": {
        "app_title": "ChronoFork · WebUI",
        "connecting": "Connecting to Server...",
        "connected_waiting_config": "Connected! Waiting for config...",
        "connection_failed": "Connection Failed: {error}",
        "error_no_config": "Error: No config file found.",
        "config_loaded": "Config Loaded. Initializing UI...",
        "stage1_complete": "Stage 1 Complete. Please select a node to Backtrack.",
        "tip_error": "### Error: {msg}",
        "error_prefix": "Error: {data}",
        "ws_disconnected": "WebSocket Disconnected!",
    },
    "zh": {
        "app_title": "ChronoFork · 网页界面",
        "connecting": "正在连接服务器...",
        "connected_waiting_config": "已连接，等待配置...",
        "connection_failed": "连接失败: {error}",
        "error_no_config": "错误：未找到配置文件。",
        "config_loaded": "配置已加载，正在初始化界面...",
        "stage1_complete": "第一阶段完成，请选择一个节点进行回溯。",
        "tip_error": "### 错误：{msg}",
        "error_prefix": "错误：{data}",
        "ws_disconnected": "WebSocket 已断开！",
    },
}


def resolve_lang() -> str:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--lang")
    args, _ = parser.parse_known_args()
    if not args.lang:
        print(
            "[Startup Error] Missing required '--lang'. "
            "Use: panel serve web_app.py --args --lang zh|en"
        )
        raise SystemExit(2)
    if args.lang not in {"zh", "en"}:
        print(
            f"[Startup Error] Invalid --lang='{args.lang}'. "
            "Allowed values: zh, en. "
            "Use: panel serve web_app.py --args --lang zh|en"
        )
        raise SystemExit(2)
    return args.lang


class GameController(Viewer):
    def __init__(self, lang="en", **params):
        super().__init__(**params)
        self.lang = lang if lang in I18N else "en"
        self.t = I18N[self.lang]
        
        # Loading View
        self.loading_spinner = pn.indicators.LoadingSpinner(value=True, size=50, color='warning')
        self.status_text = pn.widgets.StaticText(value=self.t["connecting"], align='center')
        self.loading_view = pn.Column(
            pn.layout.VSpacer(),
            pn.Row(self.loading_spinner, self.status_text),
            pn.layout.VSpacer(),
            sizing_mode='stretch_both', align='center'
        )

        # Main View
        self.main_view = pn.Row(sizing_mode='stretch_both', visible=False)
        self._layout = pn.Column(self.loading_view, self.main_view, sizing_mode='stretch_both')

        # State
        self.ws = None
        self.config = None
        self.user_role_name = "User" # Local Cache

        self.chat_ui = None
        self.graph_ui = None
        self.cast_ui = None

    def __panel__(self):
        pn.state.onload(self.connect_websocket)
        return self._layout

    async def connect_websocket(self):
        url = "ws://localhost:8000/ws"
        try:
            session = aiohttp.ClientSession()
            self.ws = await session.ws_connect(url)
            self.status_text.value = self.t["connected_waiting_config"]
            await self.listen_loop()
        except Exception as e:
            self.status_text.value = self.t["connection_failed"].format(error=e)
            self.loading_spinner.color = 'danger'

    async def listen_loop(self):
        async for msg in self.ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                if data.get("type") == "system_init":
                    self.handle_system_init(data.get("data", {}))
                else:
                    self.dispatch_message(data)
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                break

    def handle_system_init(self, data):
        config = data.get("config")
        status = data.get("status")

        if status == "error_no_config":
            self.status_text.value = self.t["error_no_config"]
            self.loading_spinner.color = 'danger'
            return

        self.config = config
        self.status_text.value = self.t["config_loaded"]
        self.user_role_name = self.config.get('user_role', {}).get('name', 'User')

        # 1. Cast UI
        self.cast_ui = EpisodeCastInfo(
            episode_data=self.config.get('episode', {}),
            cast_data=self.config.get('cast_data', []),
            user_role_name=self.user_role_name,
            lang=self.lang,
        )

        # 2. Graph UI
        self.graph_ui = StoryGraph(
            send_callback=self.send_to_backend,
            on_select_callback=self.on_graph_selection_change,
            lang=self.lang,
        )

        # 3. Chat UI
        self.chat_ui = ChatInterface(
            agents=self.config.get('cast_data', []),
            user_role_name=self.user_role_name,
            send_callback=self.send_to_backend,
            lang=self.lang,
        )

        # Layout
        self.main_view.objects = [
            pn.Column(self.cast_ui, width=350, sizing_mode='stretch_height', margin=(0,10,0,0)),
            pn.Column(self.graph_ui, max_width=600, sizing_mode='stretch_both', margin=(0,10,0,0)),
            pn.Column(self.chat_ui, min_width=500, sizing_mode='stretch_both')
        ]
        
        self.loading_view.visible = False
        self.main_view.visible = True

    def on_graph_selection_change(self, is_selected: bool):
        if self.chat_ui.current_stage == 2:
            self.cast_ui.enable_perspective_selection(is_selected)

    def dispatch_message(self, message):
        if not self.chat_ui: return
        
        msg_type = message.get("type")
        data = message.get("data", {})

        if msg_type == "graph_update":
            self.graph_ui.update_graph(data)
        elif msg_type == "stream_token":
            self.chat_ui.handle_stream_token(data.get("agent"), data.get("target"), data.get("token"))
        elif msg_type == "input_request":
            self.chat_ui.handle_input_request(data.get("msg"), data.get("from_name"))
        elif msg_type == "agent_thinking":
            self.chat_ui.handle_agent_thinking(data.get("agent"))
        elif msg_type == "facilitator_stream":
            self.chat_ui.handle_facilitator_stream(data.get("token", ""))
            
        elif msg_type == "stage_update":
            stage = data.get("stage")
            self.cast_ui.update_stage_display(stage) # Update Badge
            self.chat_ui.set_stage_mode(stage)       # Enable/Disable Input
            self.graph_ui.set_stage_mode(stage)      # Enable Backtrack Button
            if stage == 2:
                pn.state.notifications.success(self.t["stage1_complete"], duration=2000)
                
        elif msg_type == "node_update":
            self.chat_ui.add_node_divider(data.get("from_id"), data.get("to_id"))
        elif msg_type == "complete_history_review":
            self.chat_ui.add_history_divider()

        elif msg_type == "action_update":
            action = data.get("action")
            if action == 'backtrack_complete':
                # Backend 确认完成，更新 UI
                new_role = data.get("new_role")
                new_node_id = data.get("new_node_id")
                self.chat_ui.finish_backtrack(new_role, new_node_id)
                if new_role:
                    self.user_role_name = new_role
                    self.cast_ui.update_user_role(new_role)
                    self.chat_ui.update_user_role(new_role)

            elif action == 'divergence_in_progress':
                self.chat_ui.start_divergence_loading()
                
            elif action == 'divergence_complete':
                report = data.get("report", data.get("report_md", ""))
                self.chat_ui.finish_divergence(report)
        
        elif msg_type == "enable_reflection":
            self.chat_ui.enable_reflection()
        elif msg_type == "reflection_report":
            html = data.get("report", data.get("html"))
            self.chat_ui.render_reflection_report(html)

        elif msg_type == "save_complete":
            filename = data.get("filename")
            json_content = data.get("json_content")
            self.chat_ui.handle_save_data(filename, json_content)

        elif msg_type == "tip_data":
            # 渲染数据
            self.chat_ui.render_tip_content(data)
        elif msg_type == "tip_error":
            # 显示错误并允许关闭
            self.chat_ui.tip_display.clear()
            self.chat_ui.tip_display.append(
                pn.pane.Markdown(self.t["tip_error"].format(msg=data.get("msg")))
            )

            
        elif msg_type == "error":
            pn.state.notifications.error(self.t["error_prefix"].format(data=data), duration=5000)

    def send_to_backend(self, msg_type, data):
        if self.ws and not self.ws.closed:
            if msg_type == "backtrack_to":
                target_node = data.get("target_id")
                
                perspective_agent = None
                if self.cast_ui:
                    perspective_agent = self.cast_ui.get_selected_perspective_candidate()
                else:
                    perspective_agent = self.user_role_name
                    print("Warning: Cast UI not initialized when sending backtrack request.")
                        
                data["perspective_agent"] = perspective_agent
                # Immediate UI Feedback (Optimistic)
                role_display = perspective_agent if perspective_agent else self.user_role_name
                self.chat_ui.start_backtrack_loading(target_node, role_display)
                self.cast_ui.enable_perspective_selection(False) # Disable until complete
                
            payload = json.dumps({"type": msg_type, "data": data})
            asyncio.create_task(self.ws.send_str(payload))
        else:
            pn.state.notifications.warning(self.t["ws_disconnected"], duration=3000)


LANG = resolve_lang()
print(f"[Startup] config_app prompt language: {LANG}")

app = pn.template.VanillaTemplate(title=I18N[LANG]["app_title"])
config_component = GameController(lang=LANG)
app.main.append(config_component)
app.servable()
