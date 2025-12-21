import param
import time
import panel as pn
from panel.viewable import Viewer


class ChatInterface(Viewer):

    def __init__(self, agents, send_callback, user_role_name, **params):
        super().__init__(**params)
        self.send_callback = send_callback
        self.user_role_name = user_role_name
        self.agents = agents
        # --- State Management ---
        self.history_log = "" # 存储已经完成的历史对话 (倒序积累)
        self.current_stream_buffer = "" # 当前正在流式传输的文本
        self.current_stream_meta = {} # 当前流的元数据 (speaker, target)
        
        # --- UI Resources ---
        self.avatars = {agent["name"]: agent["avatar"] for agent in self.agents}
        self.avatars["User"] = "😉" # Ensure User avatar exists
        self.avatars["Facilitator"] = "👀" # System avatar
        

        # The main chat area
        self.chat_container = pn.pane.Markdown("### ⚙️ System ➜ 😉 User\nPress Play Button to Start\n\n---\n\n", sizing_mode='stretch_both', styles={'font-size': '1.1em'})

        # 2. Input Area
        self.text_input = pn.widgets.TextAreaInput(
            placeholder="System initializing...", disabled=True, 
            sizing_mode='stretch_both', resizable='width', min_height=50,styles={'margin-right': '-3px'}
        )
        self.send_button = pn.widgets.Button(
            button_type='warning', icon="player-play", icon_size="25px", 
            sizing_mode='stretch_height', width=50
        )
        self.send_button.on_click(self.chat_send)
        
        self.start_stop_button = pn.widgets.Button(
            button_type='success', icon="microphone", icon_size="25px", 
            sizing_mode='stretch_height', width=50, disabled=True
        )

        # 3. Agent Selector (Filter out User)
        self.target_options = [
            {'name': agent['name'], 'label': f"{agent['avatar']} {agent['name']}"}
            for agent in self.agents if agent['name'] != self.user_role_name
        ]
        
        self.radio_group = pn.widgets.RadioButtonGroup(
            options=[opt['label'] for opt in self.target_options], 
            button_type='primary', button_style='outline', 
            sizing_mode='stretch_width', height=30, disabled=True, value=None,
        )
        # 关键修改2: 使用 Row 包裹并开启滚动，这个 Row 负责撑满宽度
        radio_scroll_container = pn.Row(
            self.radio_group, 
            scroll=True, 
            sizing_mode='stretch_width',
            # 用css隐藏滚动条
            styles={'overflow': 'auto', 'scrollbar-width': 'none', '-ms-overflow-style': 'none'}
        )


        self.radio_group.param.watch(self.on_radio_group_change, "value")

        self.facilitator_markdown = pn.pane.Markdown(
            "👀 **Facilitator**: Observing...", 
            sizing_mode='stretch_width',
            styles={'font-size': '1.1em'}
        )
        
        # 2. 容器组件：负责滚动、背景和高度限制
        self.facilitator_view = pn.Column(
            self.facilitator_markdown,
            sizing_mode='stretch_width',
            max_height=100,  # 设定最大高度，超过此高度出现滚动条
            scroll=True,     # 开启滚动
            styles={         # 将样式应用在容器上
                'background': '#f0f0f5', 
                'margin-left': '10px',  
                'margin-right': '10px', 
                'border-radius': '5px', 
                'border-left': '5px solid #6c757d' # 加个左边框装饰，突出Facilitator
            },
        )
        self.facilitator_buffer = ""
        self.facilitator_streaming_active = False

        # Layout
        button_row = pn.Column(
            self.send_button,
            self.start_stop_button,
            sizing_mode='stretch_height'
        )
        input_area = pn.Column(
            radio_scroll_container,
            pn.Row(self.text_input,button_row, sizing_mode='stretch_width')
        )

        chat_display = pn.Column(
            self.facilitator_view,
            self.chat_container,
            sizing_mode='stretch_both',
            scroll=True,
        )
        
        self._layout = pn.Column(
            pn.Card(chat_display, title='💭 Chat Stream', sizing_mode='stretch_both',collapsible=False),
            pn.Card(input_area, collapsible=False, hide_header=True, sizing_mode='stretch_width', margin=(10,0,0,0),max_height=200)
        )

    def __panel__(self):
        return self._layout

    # --- Formatting Helpers ---
    def _format_name_display(self, name):
        """Append (User) if the name matches user role"""
        if name == self.user_role_name:
            return f"{name} (😉 User)"
        return name

    def _header_for_chat(self, agent_name, target_name):
        """Generate header for current streaming block"""
        src_display = self._format_name_display(agent_name)
        tgt_display = "User" if target_name == "User" else self._format_name_display(target_name)
        src_av = self.avatars.get(agent_name, "🤖")
        tgt_av = self.avatars.get(target_name, "🤔")
        header = f"### {src_av} {src_display} ➜ {tgt_av} {tgt_display}"
        return header
    
    def _render_full_log(self):
        """Combine current stream + history log (Newest at Top)"""
        content = ""
        # 1. Render Current Stream (if any)
        if self.current_stream_buffer and self.current_stream_meta:
            src = self.current_stream_meta.get('agent', 'Unknown')
            tgt = self.current_stream_meta.get('target', 'Unknown')

            header = self._header_for_chat(src, tgt)
            content += f"{header}\n{self.current_stream_buffer}\n\n---\n\n"
            
        # 2. Append History
        content += self.history_log
        self.chat_container.object = content

    # --- Event Handlers ---

    def chat_send(self, event):
        # 1. Start Experience
        if self.send_button.icon == 'player-play':
            self.send_button.disabled = True
            self.send_callback("start_experience", {})
            self.text_input.placeholder = "Starting engine..."
            # Remove init view, show markdown
            self.chat_container.object = ""
            return

        # 2. User Message
        msg = self.text_input.value.strip()
        if not msg: return
        
        # Get target name from label
        selected_label = self.radio_group.value
        target_name = next(
            (opt['name'] for opt in self.target_options if opt['label'] == selected_label), 
            self.target_options[0]['name'] # Fallback
        )

        # Send to backend
        self.send_callback("user_message", {
            "content": msg,
            "target": target_name,
            "from_name": self.user_role_name
        })
        
        # Optimistic UI Update (Insert immediately at top)
        self._commit_user_message(msg, target_name)
        
        # Clear Input
        self.text_input.value = ''
        
        # Freeze for 1s then unlock (Allow interrupt)
        self.send_button.disabled = True
        # 先查看是否已经有任务在运行，避免重复调度
        if not pn.state.tasks.get("unlock"):
            pn.state.schedule_task("unlock", self.unlock_input, period='1s')

    def _commit_user_message(self, content, target):
        """Commit user message to history immediately (Newest at Top)"""
        self._flush_current_stream()

        header = self._header_for_chat(self.user_role_name, target)
        new_block = f"{header}\n{content}\n\n---\n\n"
        self.history_log = new_block + self.history_log

        self._render_full_log()

    def on_radio_group_change(self, event):
        val = event.new
        if val:
             name = next((o['name'] for o in self.target_options if o['label'] == val), val)
             self.text_input.placeholder = f"Message {name}..."

    def _flush_current_stream(self):
        """
        将当前正在流式传输的内容（如果有）强制提交到历史记录中。
        防止用户发送新消息或切换发言人时，上一条未完成的消息丢失。
        """
        if self.current_stream_buffer and self.current_stream_meta:
            src = self.current_stream_meta.get('agent')
            tgt = self.current_stream_meta.get('target')
            header = self._header_for_chat(src, tgt) # 假设你有这个helper方法
            # 倒序排列：新块在最上面
            block = f"{header}\n{self.current_stream_buffer}\n\n---\n\n"
            self.history_log = block + self.history_log
            # 重置流状态
            self.current_stream_buffer = ""
            self.current_stream_meta = {}
    # --- Backend Callbacks ---

    def handle_input_request(self, msg_text, from_name):
        """
        Backend requests input. 
        from_name: The agent waiting for answer.
        """
        self.unlock_input()
        self.text_input.placeholder = msg_text
        
        # Update labels to show who is waiting
        new_options = []
        for opt in self.target_options:
            label = opt['label']
            if opt['name'] == from_name:
                label = f"{label} ⏳" # Add Emoji to the requester
            new_options.append(label)
        self.radio_group.options = new_options
        
        # Auto-select the requester if possible
        target_label = next((o for o in new_options if from_name in o), None)
        if target_label:
            self.radio_group.value = target_label

    
    def handle_stream_token(self, agent_name, target_name, token):
        """
        Handle streaming. 
        Requires backend to send 'target_name' in payload.
        """
        # 1. 获取当前流的状态
        current_speaker = self.current_stream_meta.get('agent')
        current_target = self.current_stream_meta.get('target') # 新增：获取当前目标
        
        
        # 2. 修正判定逻辑：如果是新的人说话，或者说话的对象变了，都视为新的一轮
        is_new_turn = (current_speaker != agent_name) or (current_target != target_name)
        try:
            if is_new_turn:
                self._flush_current_stream()
                # Start new stream
                self.current_stream_buffer = ""
                self.current_stream_meta = {'agent': agent_name, 'target': target_name}
            
            self.current_stream_buffer += token
            self._render_full_log()
        except Exception as e:
            print(f"Error handling stream token: {e}")
    
    def handle_agent_thinking(self, agent_name):
        self.text_input.placeholder = f"{agent_name} is thinking..."
        # Reset labels (remove hourglass)
        self.radio_group.options = [opt['label'] for opt in self.target_options]

    def handle_facilitator_stream(self, token):
        # 1. 检查是否是结束标记
        if token == "<END>":
            self.facilitator_streaming_active = False
            return

        # 2. 如果是新的一轮对话开始（上一轮已结束），先清空旧内容
        if not self.facilitator_streaming_active:
            self.facilitator_buffer = "👀 **Facilitator**: " # 重置 Buffer
            self.facilitator_streaming_active = True        # 标记为活跃

        # 3. 追加 Token 并更新 UI
        self.facilitator_buffer += token
        self.facilitator_markdown.object = self.facilitator_buffer

    def unlock_input(self):
        """Restore input state"""
        if self.send_button.icon == 'player-play':
            self.send_button.icon = 'send'
            self.send_button.button_type = 'primary'
        
        self.send_button.disabled = False
        self.text_input.disabled = False
        self.start_stop_button.disabled = False
        self.radio_group.disabled = False