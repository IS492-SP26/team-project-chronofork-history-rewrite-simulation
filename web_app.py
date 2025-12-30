# web_app.py
import json
import asyncio
import aiohttp
import panel as pn
from panel.viewable import Viewer
from components.chat_interface import ChatInterface
from components.episode_cast import EpisodeCastInfo
from components.story_graph import StoryGraph

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
"""
pn.extension(raw_css=[css],notifications=True)
pn.extension('modal')

class GameController(Viewer):
    def __init__(self, **params):
        super().__init__(**params)
        
        # Loading View
        self.loading_spinner = pn.indicators.LoadingSpinner(value=True, size=50, color='warning')
        self.status_text = pn.widgets.StaticText(value="Connecting to Server...", align='center')
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
            self.status_text.value = "Connected! Waiting for config..."
            await self.listen_loop()
        except Exception as e:
            self.status_text.value = f"Connection Failed: {e}"
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
            self.status_text.value = "Error: No config file found."
            self.loading_spinner.color = 'danger'
            return

        self.config = config
        self.status_text.value = "Config Loaded. Initializing UI..."
        self.user_role_name = self.config.get('user_role', {}).get('name', 'User')

        # 1. Cast UI
        self.cast_ui = EpisodeCastInfo(
            episode_data=self.config.get('episode', {}),
            cast_data=self.config.get('cast_data', []),
            user_role_name=self.user_role_name
        )

        # 2. Graph UI
        self.graph_ui = StoryGraph(
            send_callback=self.send_to_backend,
            on_select_callback=self.on_graph_selection_change
        )

        # 3. Chat UI
        self.chat_ui = ChatInterface(
            agents=self.config.get('cast_data', []),
            user_role_name=self.user_role_name,
            send_callback=self.send_to_backend
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
            
        # --- New Handlers ---
        elif msg_type == "stage_update":
            stage = data.get("stage")
            self.cast_ui.update_stage_display(stage) # Update Badge
            self.chat_ui.set_stage_mode(stage)       # Enable/Disable Input
            self.graph_ui.set_stage_mode(stage)      # Enable Backtrack Button
            if stage == 2:
                pn.state.notifications.success("Stage 1 Complete. Please select a node to Backtrack.", duration=5000)
                
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
                report_md=data.get("report_md", "")
                self.chat_ui.finish_divergence(report_md)
        
        elif msg_type == "enable_reflection":
            self.chat_ui.enable_reflection()
        elif msg_type == "reflection_report":
            html = data.get("html")
            self.chat_ui.render_reflection_report(html)

            
        elif msg_type == "error":
            pn.state.notifications.error(f"Error: {data}", duration=5000)

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
            pn.state.notifications.warning("WebSocket Disconnected!", duration=3000)

app = pn.template.VanillaTemplate(title='ChronoFork · WebUI')
config_component = GameController()
app.main.append(config_component)
app.servable()