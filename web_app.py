import json
import asyncio
import aiohttp
import panel as pn

from panel.viewable import Viewer

from components.chat_interface import ChatInterface
from components.episode_cast import EpisodeCastInfo
from components.story_graph import StoryGraph

# CSS 保持不变
css = """
#input{
  font-size: 120%;
}

.bk-btn {
    font-size: 1.1em !important;
"""
pn.extension(raw_css=[css])

class GameController(Viewer):
    def __init__(self, **params):
        super().__init__(**params)
        
        # --- Loading View (Same as before) ---
        self.loading_spinner = pn.indicators.LoadingSpinner(value=True, size=50, color='warning')
        self.status_text = pn.widgets.StaticText(value="Connecting to Server...", align='center')
        self.loading_view = pn.Column(
            pn.layout.VSpacer(),
            pn.Row(self.loading_spinner, self.status_text),
            pn.layout.VSpacer(),
            sizing_mode='stretch_both', align='center'
        )

        # --- Main View (3 Columns) ---
        self.main_view = pn.Row(sizing_mode='stretch_both', visible=False)
        self._layout = pn.Column(self.loading_view, self.main_view, sizing_mode='stretch_both')

        # State
        self.ws = None
        self.config = None
        
        # Components
        self.chat_ui = None
        self.graph_ui = None
        self.cast_ui = None

    def __panel__(self):
        pn.state.onload(self.connect_websocket)
        return self._layout

    # --- WebSocket Logic (Same as before) ---
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
        """收到配置，初始化所有组件"""
        config = data.get("config")
        status = data.get("status")

        if status == "error_no_config":
            self.status_text.value = "Error: No config file found."
            self.loading_spinner.color = 'danger'
            return

        self.config = config
        self.status_text.value = "Config Loaded. Initializing UI..."
        user_role_dict = self.config.get('user_role', {})
        user_role_name = user_role_dict.get('name', 'User')

        # 1. Initialize Cast/Episode Info (New Component)
        self.cast_ui = EpisodeCastInfo(
            episode_data=self.config.get('episode', {}),
            cast_data=self.config.get('cast_data', []),
            user_role_name=user_role_name
        )

        # 2. Initialize Graph (With select callback)
        self.graph_ui = StoryGraph(
            send_callback=self.send_to_backend,
            on_select_callback=self.on_graph_selection_change # Bind callback
        )

        # 3. Initialize Chat
        self.chat_ui = ChatInterface(
            agents=self.config.get('cast_data', []),
            user_role_name=user_role_name,
            send_callback=self.send_to_backend
        )

        # 4. Final Layout: 3 Columns
        # Left: Info (Fixed width-ish), Center: Graph, Right: Chat
        self.main_view.objects = [
            pn.Column(self.cast_ui, width=350, sizing_mode='stretch_height',margin=(0,10,0,0)),
            pn.Column(self.graph_ui, max_width=500, sizing_mode='stretch_both',margin=(0,10,0,0)),
            pn.Column(self.chat_ui, min_width=500, sizing_mode='stretch_both')
        ]
        
        self.loading_view.visible = False
        self.main_view.visible = True

    # --- Interaction Logic ---

    def on_graph_selection_change(self, is_selected: bool):
        """当 StoryGraph 选中或取消选中节点时触发"""
        if self.cast_ui:
            self.cast_ui.enable_perspective_selection( is_selected)

    def dispatch_message(self, message):
        """分发消息"""
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
        elif msg_type == "error":
            pn.state.notifications.error(f"Error: {data}", duration=5000)

    def send_to_backend(self, msg_type, data):
        """
        发送中心，负责拦截和注入数据
        """
        if self.ws and not self.ws.closed:
            if msg_type == "backtrack_to":
                if self.cast_ui:
                    # 获取当前面板上合法的切换目标
                    target_agent = self.cast_ui.get_selected_perspective_candidate()
                    if target_agent:
                        data["perspective_agent"] = target_agent
                        print(f"Requesting backtrack with perspective switch: {target_agent}")
            payload = json.dumps({"type": msg_type, "data": data})
            asyncio.create_task(self.ws.send_str(payload))
        else:
            pn.state.notifications.warning("WebSocket Disconnected!", duration=3000)

# App Entry
app = pn.template.VanillaTemplate(title='ChronoFork · WebUI')
config_component = GameController()
app.main.append(config_component)
app.servable()