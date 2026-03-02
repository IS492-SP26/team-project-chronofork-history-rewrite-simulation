import datetime
import io
import os
import textwrap
import panel as pn
from panel.viewable import Viewer

I18N = {
    "en": {
        "default_save_filename": "save.json",
        "user_name": "User",
        "facilitator_name": "Facilitator",
        "system_name": "System",
        "chat_init": "### ⚙️ {system} ➜ 😉 {user}\nPress Play Button to Start\n\n---\n\n",
        "placeholder_initializing": "System initializing...",
        "facilitator_stage2": "👀 **Facilitator**: Select a Node and a Perspective then 🔄 Backtrack!",
        "chat_stream_title": "💭 Chat Stream",
        "btn_back_to_chat": "💬 Back to Chat",
        "btn_export_save": "💾 Export Save",
        "btn_download_save": "📥 Download Save",
        "btn_download_report": "📥 Download Report",
        "report_default_filename": "report.html",
        "display_user_suffix": "(😉 User)",
        "unknown_name": "Unknown",
        "divergence_loading": "Analyzing Divergented History Resulted from Your Actions...",
        "story_begins": "🌱 Story Begins at Node {to_id}",
        "story_ending": "🏁 Reached Ending (Node {from_id})",
        "story_moving": "── 📍 Moving: {from_id} ➔ {to_id} ──",
        "history_context": "── 📝 Previous Interaction Context ──",
        "backtracking_loading": "Backtracking to Node <b>{target_node}</b> as <b>{role}</b>",
        "backtrack_complete_title": "🔄 Backtrack Complete",
        "backtrack_complete_desc": "Backtracked to Node <b>{new_node_id}</b> as <b>{new_role}</b>.",
        "divergence_title": "⚡ Divergence Analysis",
        "placeholder_starting_engine": "Starting engine...",
        "warn_enter_message": "Please enter a message.",
        "warn_select_target": "Please select a target character.",
        "btn_generating": "⏳ Generating...",
        "tip_loading": "Analyzing Strategic Landscape... May take ~20 seconds",
        "tip_empty": "### ⚠️ No tips available.",
        "btn_back": "🔙 Back",
        "strategic_advisor": "### 💡 Strategic Advisor",
        "btn_close": "✕ Close",
        "situation_analysis": "Situation Analysis",
        "situation_default": "Analyze current situation.",
        "tip_to": "To",
        "tip_why": "✅ Why",
        "tip_risk": "⚠️ Risk",
        "btn_select_option": "✨ Select Option",
        "intent_default": "Action",
        "reflection_title": "💡 Reflection",
        "facilitator_reflection": "👀 **Facilitator**: Check Reflections about Your Decisions and Potential Alternatives!",
        "reflection_loading": "Loading Reflection... It may take ~1 minute",
        "report_saved": "Report saved as {filename}",
        "download_report_title": "ChronoFork Reflection Report - {timestamp}",
        "chat_report_title": "Chrono Chat Report",
        "placeholder_message_to": "Message {name}...",
        "placeholder_stage1": "Stage 1: Observing Canonical History...",
        "placeholder_select_backtrack": "Select a node in the graph to Backtrack...",
        "placeholder_agent_thinking": "{agent_name} is thinking...",
        "warning_selected_label_not_found": "Warning: Selected label '{selected_label}' not found in map.",
        "warning_input_request_ignored": "Input request received at Stage 1. Ignoring.",
        "log_input_requested_by": "Input requested by {from_name}",
        "facilitator_prefix": "👀 **Facilitator**: ",
        "intent_labels": {
            "Escalation": "Escalation",
            "De-escalation": "De-escalation",
            "Alliance Building": "Alliance Building",
            "Info Gathering": "Info Gathering",
            "Action": "Action",
        },
    },
    "zh": {
        "default_save_filename": "save.json",
        "user_name": "用户",
        "facilitator_name": "引导者",
        "system_name": "系统",
        "chat_init": "### ⚙️ {system} ➜ 😉 {user}\n点击播放按钮开始\n\n---\n\n",
        "placeholder_initializing": "系统初始化中...",
        "facilitator_stage2": "👀 **引导者**：请选择一个节点和视角，然后点击 🔄 回溯！",
        "chat_stream_title": "💭 聊天流",
        "btn_back_to_chat": "💬 返回聊天",
        "btn_export_save": "💾 导出存档",
        "btn_download_save": "📥 下载存档",
        "btn_download_report": "📥 下载报告",
        "report_default_filename": "report.html",
        "display_user_suffix": "(😉 用户)",
        "unknown_name": "未知",
        "divergence_loading": "正在分析你行为导致的分歧历史结果...",
        "story_begins": "🌱 故事从节点 {to_id} 开始",
        "story_ending": "🏁 到达结局（节点 {from_id}）",
        "story_moving": "── 📍 流转：{from_id} ➔ {to_id} ──",
        "history_context": "── 📝 之前的交互上下文 ──",
        "backtracking_loading": "正在以 <b>{role}</b> 身份回溯到节点 <b>{target_node}</b>",
        "backtrack_complete_title": "🔄 回溯完成",
        "backtrack_complete_desc": "已以 <b>{new_role}</b> 身份回溯到节点 <b>{new_node_id}</b>。",
        "divergence_title": "⚡ 分歧分析",
        "placeholder_starting_engine": "正在启动引擎...",
        "warn_enter_message": "请输入消息。",
        "warn_select_target": "请选择目标角色。",
        "btn_generating": "⏳ 生成中...",
        "tip_loading": "正在分析策略局势... 约需 20 秒",
        "tip_empty": "### ⚠️ 暂无建议。",
        "btn_back": "🔙 返回",
        "strategic_advisor": "### 💡 策略顾问",
        "btn_close": "✕ 关闭",
        "situation_analysis": "局势分析",
        "situation_default": "分析当前局势。",
        "tip_to": "目标",
        "tip_why": "✅ 原因",
        "tip_risk": "⚠️ 风险",
        "btn_select_option": "✨ 选择此方案",
        "intent_default": "行动",
        "reflection_title": "💡 复盘",
        "facilitator_reflection": "👀 **引导者**：查看你决策带来的反思和备选方案！",
        "reflection_loading": "正在生成复盘... 约需 1 分钟",
        "report_saved": "报告已保存为 {filename}",
        "download_report_title": "ChronoFork 复盘报告 - {timestamp}",
        "chat_report_title": "Chrono 聊天报告",
        "placeholder_message_to": "发送给 {name}...",
        "placeholder_stage1": "阶段一：观察正史流程...",
        "placeholder_select_backtrack": "请先在图中选择要回溯的节点...",
        "placeholder_agent_thinking": "{agent_name} 正在思考...",
        "warning_selected_label_not_found": "警告：未在映射中找到选中标签 '{selected_label}'。",
        "warning_input_request_ignored": "在阶段一收到输入请求，已忽略。",
        "log_input_requested_by": "{from_name} 请求你的输入",
        "facilitator_prefix": "👀 **引导者**：",
        "intent_labels": {
            "Escalation": "升级施压",
            "De-escalation": "降温缓和",
            "Alliance Building": "联盟构建",
            "Info Gathering": "信息收集",
            "Action": "行动",
        },
    },
}


class ChatInterface(Viewer):

    def __init__(self, agents, send_callback, user_role_name, lang="en", **params):
        super().__init__(**params)
        self.lang = lang if lang in I18N else "en"
        self.t = I18N[self.lang]
        self.send_callback = send_callback
        self.user_role_name = user_role_name
        self.agents = agents
        # --- State Management ---
        self.history_log = "" # 存储已经完成的历史对话 (倒序积累)
        self.current_stream_buffer = "" # 当前正在流式传输的文本
        self.current_stream_meta = {} # 当前流的元数据 (speaker, target)
        self.current_stage = 1
        self.is_diverging = False # 标记是否正在计算分歧

        # 维护选项映射
        self.selected_target_name = None 
        self.label_to_name_map = {}

        self.cached_report_html = ""
        self._temp_export_content = ""
        self._temp_export_filename = self.t["default_save_filename"]
        
        # --- UI Resources ---
        self.avatars = {agent["name"]: agent["avatar"] for agent in self.agents}
        self.avatars["User"] = "😉" # Ensure User avatar exists for backend key
        self.avatars[self.t["user_name"]] = "😉"
        self.avatars["Facilitator"] = "👀" # System avatar
        self.avatars[self.t["facilitator_name"]] = "👀"
        

        # The main chat area
        self.chat_container = pn.pane.Markdown(
            self.t["chat_init"].format(system=self.t["system_name"], user=self.t["user_name"]),
            sizing_mode='stretch_both',
            styles={'font-size': '1.1em'},
        )

        # 2. Input Area
        self.text_input = pn.widgets.TextAreaInput(
            placeholder=self.t["placeholder_initializing"], disabled=True, 
            sizing_mode='stretch_both', resizable='width', min_height=50,styles={'margin-right': '-3px'}
        )
        self.send_button = pn.widgets.Button(
            button_type='warning', icon="player-play", icon_size="25px", 
            sizing_mode='stretch_height', width=50
        )
        self.send_button.on_click(self.chat_send)


        self.tip_button = pn.widgets.Button(
            button_type='warning', icon="bulb", icon_size="25px",
            sizing_mode='stretch_height', width=50, visible=False,
        )
        self.tip_button.on_click(self.req_tip)


        self.reflection_button = pn.widgets.Button(
            button_type='success', icon="report-analytics", icon_size="25px",
            sizing_mode='stretch_height', width=50, visible=False,
        )
        self.reflection_button.on_click(self.req_reflection)

        # 初始化 Agent Selector
        self.radio_group = pn.widgets.RadioButtonGroup(
            options=[], # 初始化为空，由 _update_target_options 填充
            button_type='primary', button_style='outline', 
            sizing_mode='stretch_width', height=30, disabled=True, value=None,
        )
        self._update_target_options() # 初始化选项

        # 使用 Row 包裹并开启滚动
        radio_scroll_container = pn.Row(
            self.radio_group, 
            scroll=True, 
            sizing_mode='stretch_width',
            # 用css隐藏滚动条
            styles={'overflow': 'auto', 'scrollbar-width': 'none', '-ms-overflow-style': 'none'}
        )


        self.radio_group.param.watch(self.on_radio_group_change, "value")

        self.facilitator_markdown = pn.pane.Markdown(
            self.t["facilitator_stage2"],
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
            visible=False
        )
        self.facilitator_buffer = ""
        self.facilitator_streaming_active = False

        # Layout
        button_row = pn.Column(
            self.send_button,
            self.reflection_button,
            self.tip_button,
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

        
        self.chat_display_card = pn.Card(chat_display, title=self.t["chat_stream_title"], sizing_mode='stretch_both',collapsible=False)


        self.back_to_chat_button = pn.widgets.Button(
            button_type='primary', name=self.t["btn_back_to_chat"],
            sizing_mode='stretch_both',
        )
        self.back_to_chat_button.on_click(self.back_to_chat)

        self.export_save_button = pn.widgets.Button(
            button_type='warning', name=self.t["btn_export_save"],
            sizing_mode='stretch_both',
        )

        self.export_save_button.on_click(self.export_save)
        self.download_save_button = pn.widgets.FileDownload(
            callback=self.get_save_stream, # 点击时触发的回调
            button_type='success',           # 用不同颜色区分状态
            label=self.t["btn_download_save"],
            sizing_mode='stretch_both',
            visible=False                    # 初始不可见
        )


        self.download_report_button = pn.widgets.FileDownload(
            callback=self.get_report_stream,  # 绑定回调函数，点击时才生成
            filename=self.t["report_default_filename"],           # 默认文件名
            button_type='success',
            label=self.t["btn_download_report"],
            sizing_mode='stretch_both'       # 或者你之前的布局参数
        )

        reflection_btn_row = pn.Row(
            self.back_to_chat_button,
            self.export_save_button,
            self.download_save_button,
            self.download_report_button,
            sizing_mode='stretch_both',
        )
        
        self.tip_display = pn.Column(
            sizing_mode='stretch_both',
            scroll=True,
        )
        self.tip_card = pn.Card(self.tip_display, collapsible=False, hide_header=True, sizing_mode='stretch_width', margin=(10,0,0,0),height=450,visible=False)

        self.input_card = pn.Card(input_area, collapsible=False, hide_header=True, sizing_mode='stretch_width', margin=(10,0,0,0),height=200)

        self.reflection_button_card = pn.Card(reflection_btn_row, collapsible=False, hide_header=True,sizing_mode='stretch_width', margin=(10,0,0,0),height=50, visible=False)
        
        self._layout = pn.Column(
            self.chat_display_card,
            self.tip_card,
            self.input_card,
            self.reflection_button_card,
        )
        

    def __panel__(self):
        return self._layout

    def _localize_intent(self, intent):
        return self.t["intent_labels"].get(intent, intent)
    
    # --- [New Helper] 统一管理目标列表 ---
    def _update_target_options(self, waiting_agent_name=None):
        """
        重新生成 RadioGroup 的选项，并更新 label->name 映射。
        :param waiting_agent_name: 如果有 Agent 正在等待回复，给它加 ⏳
        """
        new_options = []
        self.label_to_name_map = {}
        
        # 1. 生成选项
        for agent in self.agents:
            if agent['name'] == self.user_role_name:
                continue
                
            label = f"{agent['avatar']} {agent['name']}"
            if agent['name'] == waiting_agent_name:
                label += " ⏳" # 添加等待标识
            
            new_options.append(label)
            self.label_to_name_map[label] = agent['name']

        # 2. 更新 UI
        self.radio_group.options = new_options
        
        target_to_select = None
        
        if waiting_agent_name:
            # 优先选中等待的人
            target_to_select = next((lbl for lbl, name in self.label_to_name_map.items() if name == waiting_agent_name), None)
        
        if target_to_select:
            self.radio_group.value = target_to_select
        else:
            self.radio_group.value = None
            self.selected_target_name = None

    

    # --- Formatting Helpers ---
    def _format_name_display(self, name):
        """Append (User) if the name matches user role"""
        if name == self.user_role_name:
            return f"{name} {self.t['display_user_suffix']}"
        if name == "User":
            return self.t["user_name"]
        if name == "Facilitator":
            return self.t["facilitator_name"]
        if name == "System":
            return self.t["system_name"]
        return name

    def _header_for_chat(self, agent_name, target_name):
        """Generate header for current streaming block"""
        src_display = self._format_name_display(agent_name)
        tgt_display = self.t["user_name"] if target_name == "User" else self._format_name_display(target_name)
        src_av = self.avatars.get(agent_name, "🤖")
        tgt_av = self.avatars.get(target_name, "🤔")
        header = f"### {src_av} {src_display} ➜ {tgt_av} {tgt_display}"
        return header
    
    def _render_full_log(self):
        """Combine current stream + history log (Newest at Top)"""
        content = ""
        # 1. Divergence Loading (Always on top if active, since we are reverse order)
        if self.is_diverging:
            content += """<div style="text-align: center; margin: 10px; color: #007bff;">
                <div class="small-loader" style="margin-right: 10px;"></div> {text}
            </div>\n\n""".format(text=self.t["divergence_loading"])
        # 1. Render Current Stream (if any)
        if self.current_stream_buffer and self.current_stream_meta:
            src = self.current_stream_meta.get('agent', self.t["unknown_name"])
            tgt = self.current_stream_meta.get('target', self.t["unknown_name"])

            header = self._header_for_chat(src, tgt)
            content += f"{header}\n{self.current_stream_buffer}\n\n---\n\n"
            
        # 2. Append History
        content += self.history_log
        self.chat_container.object = content

    def update_user_role(self, new_role_name):
        self.user_role_name = new_role_name
        self._update_target_options() # 使用新逻辑刷新列表

    # --- Event Handlers ---

    def add_node_divider(self, from_id, to_id):
        """插入节点流转提示"""

        if from_id == 'start':
            self._flush_current_stream()
        
        if from_id == 'start':
            html = f"""<div style="text-align: center; color: #28a745; margin: 20px 0; font-weight: bold;">
            {self.t["story_begins"].format(to_id=to_id)}</div>"""
        elif to_id == 'end':
            html = f"""<div style="text-align: center; color: #dc3545; margin: 20px 0; font-weight: bold;">
            {self.t["story_ending"].format(from_id=from_id)}</div>"""
        else:
            html = f"""<div style="text-align: center; color: #888; font-size: 0.9em; margin: 15px 0;">
            {self.t["story_moving"].format(from_id=from_id, to_id=to_id)}</div>"""
        
        self.history_log = html + "\n\n" + self.history_log 
        self._render_full_log()
    
    def add_history_divider(self):
        self._flush_current_stream()
        html = f"""<div style="text-align: center; color: #888; font-size: 0.9em; margin: 15px 0;">
            {self.t["history_context"]}</div>"""
        
        self.history_log = html + "\n\n" + self.history_log 
        self._render_full_log()

    def start_backtrack_loading(self, target_node, role):
        """进入 Backtrack 加载状态 (清空屏幕)"""
        if self.reflection_button.visible:
            self.reflection_button.visible = False
        self._flush_current_stream()
        # 清空状态
        self.history_log = ""
        self.current_stream_buffer = ""
        self.current_stream_meta = {}
        
        # 居中显示 Loading
        loading_html = f"""
        <div style="text-align: center; padding-top: 50px; color: #666;">
            <div class="big-loader" style="margin: 0 auto; display: block;"></div>
            <div style="margin-top: 10px;">{self.t["backtracking_loading"].format(target_node=target_node, role=role)}</div>
        </div>
        """
        self.chat_container.object = loading_html

    def finish_backtrack(self, new_role, new_node_id):
        """Backtrack 完成，显示结果"""
        # 构造系统提示消息作为第一条
        sys_msg = f"""<div style="background: #e2e3e5; padding: 10px; border-radius: 5px; margin-bottom: 20px; border-left: 5px solid #ffaa00;">
            <b>{self.t["backtrack_complete_title"]}</b><br>
            {self.t["backtrack_complete_desc"].format(new_node_id=new_node_id, new_role=new_role)}
        </div>
        """
        self.history_log = sys_msg + "\n\n"
        self._render_full_log()

    def start_divergence_loading(self):
        """显示分歧计算 Loading"""
        self.is_diverging = True
        self._render_full_log() # Trigger render which will check flag

    def finish_divergence(self, report_html_content):
        """移除 Loading，显示 Report"""
        self.is_diverging = False
        
        # 外层容器：使用 Panel Pane 的 HTML 样式，或者直接写 style
        # 这里模拟一个漂亮的卡片容器
        wrapper_html = f"""<div style="
            background: #fff3cd; 
            border: 1px solid #ffeeba; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 15px 0; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        ">
            <div style="
                display: flex; align-items: center; gap: 8px;
                font-weight: bold; color: #856404; font-size: 1.1em; margin-bottom: 10px;
                border-bottom: 2px solid #eecbaeb0; padding-bottom: 8px;
            ">
                {self.t["divergence_title"]}
            </div>
            <div style="font-size: 0.95em; line-height: 1.5;">
                {report_html_content}
            </div>
        </div>"""
        
        # 插入历史 (倒序)
        self.history_log = wrapper_html + "\n\n" + self.history_log
        self._render_full_log()

    def chat_send(self, event):
        # 1. Start Experience
        if self.send_button.icon == 'player-play':
            self.send_button.icon = 'send'
            self.send_button.button_type = 'primary'
            self.send_button.disabled = True
            self.send_callback("start_experience", {})
            self.text_input.placeholder = self.t["placeholder_starting_engine"]
            self.chat_container.object = ""
            return

        # 2. User Message
        msg = self.text_input.value.strip()
        if not msg: 
            pn.state.notifications.warning(self.t["warn_enter_message"], duration=2000)
            return
        
        if not self.selected_target_name:
             pn.state.notifications.error(self.t["warn_select_target"], duration=3000)
             return
        
        target_name = self.selected_target_name
        
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
        pn.state.schedule_task("unlock", self.unlock_input, period='1s')

    def req_export_save(self, event):
        """用户点击 'Export Config'"""
        # 1. 改变 UI 状态提示加载
        self.export_save_button.name = self.t["btn_generating"]
        self.export_save_button.disabled = True
        
        # 2. 发送请求
        self.send_callback("export_save", {})

    def handle_save_data(self, filename, json_content):
        """收到后端发来的 JSON 数据"""
        # 1. 存入临时变量
        self._temp_export_filename = filename
        self._temp_export_content = json_content
        
        # 2. 更新下载按钮属性
        self.download_save_button.filename = filename
        
        # 3. 切换按钮显示 (隐藏请求按钮，显示下载按钮)
        self.export_save_button.visible = False
        self.download_save_button.visible = True
        
        # 4. 恢复请求按钮状态 (为下一次做准备)
        self.export_save_button.name = self.t["btn_export_save"]
        self.export_save_button.disabled = False

    def get_save_stream(self):
        """
        FileDownload 点击时的回调。
        将内存中的字符串转换为文件流供浏览器下载。
        """
        if not self._temp_export_content:
            return None
            
        # 1. 创建流
        f = io.BytesIO()
        f.write(self._temp_export_content.encode('utf-8'))
        f.seek(0)
        
        # 2. 下载开始后，延时恢复界面状态
        # 让用户看到下载开始后，按钮变回 "Export Save"
        def restore_ui():
            self.download_save_button.visible = False
            self.export_save_button.visible = True
            
        pn.state.schedule_task("restore_export_ui", restore_ui, period='1s')
        
        return f
    
    def req_tip(self, event):
        """Request Tip from backend"""
        self.input_card.visible = False # Hide Input Area
        self.tip_button.disabled = True

        if self.tip_display:
            self.tip_card.visible = True # Show Tip Area
            return
        
        self.send_callback("request_tip", {})
        self.tip_display.clear()

        loading_html = f"""<div style="text-align: center; padding-top: 50px; color: #666;">
            <div class="big-loader" style="margin: 0 auto; display: block;"></div>
            <div style="margin-top: 20px;">{self.t["tip_loading"]}</div>
        </div>"""
        self.tip_display.append(pn.pane.Markdown(loading_html, sizing_mode='stretch_width'))
        self.tip_card.visible = True # Show Tip Area

    def _close_tip_view(self, event=None):
        """辅助函数：关闭 Tip 界面，切回 Input 界面"""
        self.tip_card.visible = False
        self.input_card.visible = True
        self.tip_button.disabled = False # 解锁按钮以便下次请求

    def _apply_tip_to_input(self, target, text):
        """应用建议并切回"""
        # 1. 填入文本
        self.text_input.value = text
        
        # 2. 选中目标 (模糊匹配)
        if target:
            # 尝试在 label map 中找到对应的 key (Label)
            # self.label_to_name_map: { "Avatar Name": "Name" }
            # 我们需要反向查找，或者遍历 options
            target_label = None
            for label, name in self.label_to_name_map.items():
                if target == name: # 精确匹配名字
                    target_label = label
                    break
            
            if target_label:
                self.radio_group.value = target_label
        
        # 3. 切回界面
        self._close_tip_view()

    def render_tip_content(self, tip_data):
        """渲染美观的建议卡片 (Refined Card Style)"""
        self.tip_display.clear()
        self.tip_button.disabled = False 

        if not tip_data:
            self.tip_display.append(pn.pane.Markdown(self.t["tip_empty"]))
            back_btn = pn.widgets.Button(name=self.t["btn_back"], button_type='light')
            back_btn.on_click(self._close_tip_view)
            self.tip_display.append(back_btn)
            return

        situation = tip_data.get('situation_analysis', self.t["situation_default"])
        options = tip_data.get('options', [])

        # --- 1. Sticky Top Bar ---
        top_bar = pn.Row(
            pn.pane.Markdown(self.t["strategic_advisor"], sizing_mode='stretch_width', styles={'margin': '2px 0 0 5px'}),
            pn.widgets.Button(name=self.t["btn_close"], width=70, button_type='light', on_click=self._close_tip_view, margin=(2, 10, 0, 5)),
            sizing_mode='stretch_width',
            css_classes=['sticky-top-bar']
        )
        self.tip_display.append(top_bar)

        # --- 2. Situation Analysis (Using rf-card-info style) ---
        situation_box = pn.pane.HTML(
            f"""
            <div class="tip-root" style="margin-top:2px; margin-bottom:-3px;">
                <div style="background:#e3f2fd; padding:8px; border-radius:6px; border-left:5px solid #2196f3; color:#0d47a1; font-size:1em; line-height:1.5; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                        <span>📊</span> {self.t["situation_analysis"]}
                    </div>
                    <div style="opacity:0.9;">{situation}</div>
                </div>
            </div>
            """,
            sizing_mode='stretch_width'
        )
        self.tip_display.append(situation_box)

        # --- 3. Options Grid (Equal Height Ticket) ---
        grid = pn.GridBox(ncols=2, sizing_mode='stretch_width', styles={'align-items': 'stretch', 'gap': '10px','margin': '10px'})

        for opt in options:
            intent = opt.get('intent_type', self.t["intent_default"])
            intent_display = self._localize_intent(intent)
            target_name = opt.get('target_agent')
            avatar = self.avatars.get(target_name, "👤")
            
            # 颜色编码 (Border & Badge) - 对应 Ref 中的 rf-card-xxx
            colors = {
                "Escalation":   ("#e74c3c", "#fdedec", "#c0392b"), # Red (Border, Bg, Text)
                "De-escalation":("#27ae60", "#e9f7ef", "#1e8449"), # Green
                "Alliance Building":     ("#2980b9", "#ebf5fb", "#2980b9"), # Blue
                "Info Gathering":         ("#f39c12", "#fef9e7", "#d35400")  # Orange
            }
            # 模糊匹配
            border_col, badge_bg, badge_txt = "#95a5a6", "#f4f6f7", "#7f8c8d"
            for key, val in colors.items():
                if key in intent:
                    border_col, badge_bg, badge_txt = val
                    break

            # 构造卡片内容 HTML
            # 布局参考：Ref 中的 rf-card + rf-outcome 块
            card_html = f"""
            <div class="tip-root" style="height: 100%;">
                <div class="tip-header">
                    <span class="tip-tag" style="background:{badge_bg}; color:{badge_txt};">
                        {intent_display}
                    </span>
                    <span style="font-size:0.85em; color:#999; font-weight:600;">
                        {self.t["tip_to"]}: {avatar} {target_name}
                    </span>
                </div>
                
                <div class="tip-title">{opt.get('label')}</div>
                
                <div class="tip-quote">"{opt.get('example_response')}"</div>
                
                <div style="margin-top:auto; display:flex; flex-direction:column; gap:5px;">
                    <div class="tip-block tip-block-green">
                        <b>{self.t["tip_why"]}:</b> {opt.get('rationale')}
                    </div>
                    <div class="tip-block tip-block-red">
                        <b>{self.t["tip_risk"]}:</b> {opt.get('risks')}
                    </div>
                </div>
            </div>
            """
            
            # Action Closure
            def apply_cb(e, t=target_name, c=opt.get('example_response')):
                self._apply_tip_to_input(t, c)

            # 按钮 (Full Width Bottom)
            btn = pn.widgets.Button(
                name=self.t["btn_select_option"], 
                button_type='primary', 
                sizing_mode='stretch_width',
                css_classes=['tip-btn'],
                styles={'margin-top': '-5px'}
            )
            # 动态修改按钮颜色有点难，统一用 primary 保持整洁，或者用 js hack，这里保持 primary
            btn.on_click(apply_cb)
            
            # 组合卡片
            # tip-card-wrapper 处理边框、圆角和阴影
            # tip-body 包含 HTML 内容，flex-grow 撑开
            opt_card = pn.Column(
                pn.pane.HTML(card_html, sizing_mode='stretch_width', css_classes=['tip-body']),
                btn,
                sizing_mode='stretch_width',
                css_classes=['tip-card-wrapper'], 
                styles={'border-left-color': border_col} # 动态设置左边框颜色
            )
            grid.append(opt_card)

        self.tip_display.append(grid)

    def enable_reflection(self):
        """Enable Reflection Button"""
        self.reflection_button.visible = True
        self.tip_button.visible = False
        self.cached_report_html = ""

    def req_reflection(self, event):
        """Request Reflection from backend"""
        
        # Send to backend

        self.chat_display_card.title = self.t["reflection_title"]
        self.input_card.visible = False # Hide Input Area
        self.reflection_button_card.visible = True # Show Reflection Buttons
        self.facilitator_markdown.object = self.t["facilitator_reflection"]

        self.back_to_chat_button.disabled = True
        self.export_save_button.disabled = True
        self.download_report_button.disabled = True

        if self.cached_report_html=='':
            self.send_callback("request_reflection", {})
            loading_html = f"""<div style="text-align: center; padding-top: 50px; color: #666;">
                <div class="big-loader" style="margin: 0 auto; display: block;"></div>
                <div style="margin-top: 20px;">{self.t["reflection_loading"]}</div>
            </div>
            """
            self.chat_container.object = loading_html
        else:
            self.render_reflection_report(self.cached_report_html)
    
    def render_reflection_report(self, html_content):
        """渲染报告"""
        self.back_to_chat_button.disabled = False
        self.export_save_button.disabled = False
        self.download_report_button.disabled = False
        
        self.cached_report_html = html_content
        report_block = f"""<div style="margin: 20px 0;">{html_content}</div>
        <div style="text-align: center; margin-bottom: 20px;">--- End of Report ---</div>"""
        
        self.chat_container.object = html_content

    
    def back_to_chat(self, event):
        """Return from Reflection to Chat View"""

        self.chat_display_card.title = self.t["chat_stream_title"]
        self.input_card.visible = True # Show Input Area
        self.reflection_button_card.visible = False # Hide Reflection Buttons
        self.facilitator_markdown.object = self.t["facilitator_stage2"]

        self._render_full_log()

    def export_save(self, event):
        """Trigger config export"""
        self.send_callback("export_save", {})

    def download_report(self, event):
        """Trigger report download"""
        # 将chat_container.object的内容以html文件形式下载
        download_content = f"""<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{self.t["chat_report_title"]}</title>
        </head>
        <body>
            {self.chat_container.object}
        </body>
        </html>
        """
        timestamp = datetime.datetime.now().strftime("%m%d_%H%M")
        filename = f"report_{timestamp}.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(download_content)
        pn.state.notifications.success(self.t["report_saved"].format(filename=filename), duration=4000)

    def get_report_stream(self):
        """
        FileDownload 的回调函数。
        点击按钮时执行，返回一个文件流对象。
        """
        # 1. 动态生成文件名 (如果需要带时间戳)
        timestamp = datetime.datetime.now().strftime("%m-%d_%H-%M")
        self.download_report_button.filename = f"report_{timestamp}.html"

        # 2. 准备 HTML 内容
        html_content = f"""<!DOCTYPE html><html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.t["download_report_title"].format(timestamp=timestamp)}</title>
    <style>
        /* 给整个页面一个浅灰背景，这样白色的 Report 卡片会更突出 */
        body {{ 
            margin: 0; 
            padding: 40px 20px; 
            background-color: #f4f4f9; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }}
        /* 让 Report 居中显示 */
        .rf-root {{
            max-width: 900px;
            margin: 0 auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important; /* 强制增加阴影立体感 */
        }}
    </style>
</head>
<body>
    {self.chat_container.object}
</body>
</html>
"""
        # 3. 将字符串转换为二进制流 (BytesIO)
        # 也可以用 StringIO，但 BytesIO 通用性更好，避免编码问题
        f = io.BytesIO()
        f.write(html_content.encode('utf-8'))
        f.seek(0)  # 指针回到开头，非常重要！
        
        return f

    def _commit_user_message(self, content, target):
        """Commit user message to history immediately (Newest at Top)"""
        self._flush_current_stream()

        header = self._header_for_chat(self.user_role_name, target)
        new_block = f"{header}\n{content}\n\n---\n\n"
        self.history_log = new_block + self.history_log

        self._render_full_log()

        if self.tip_display:
            self.tip_display.clear()
            self.tip_card.visible = False # Hide Tip Area

    def on_radio_group_change(self, event):
        """当用户点击 Radio Button 时触发"""
        selected_label = event.new
        if not selected_label: return
        
        # [核心] 通过 Map 安全获取 Name
        real_name = self.label_to_name_map.get(selected_label)
        
        if real_name:
            self.selected_target_name = real_name
            self.text_input.placeholder = self.t["placeholder_message_to"].format(name=real_name)
            
            # 如果是 Stage 2 且不在 Start 状态，确保发送按钮可用
            if self.current_stage == 2 and self.send_button.icon == 'send':
                self.send_button.disabled = False
                self.text_input.disabled = False
        else:
            print(self.t["warning_selected_label_not_found"].format(selected_label=selected_label))

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

    def set_stage_mode(self, stage):
        self.current_stage = stage
        if stage == 1:
            # 隐藏输入，只读模式
            self.text_input.disabled = True
            self.text_input.placeholder = self.t["placeholder_stage1"]
            self.send_button.disabled = True
            self.radio_group.disabled = True
            # Card 标题更新
            self.input_card.visible = False # 隐藏 Input Area 整个 Card
            
        elif stage == 2:
            # 显示输入（虽然可能先要 Backtrack）
            self.facilitator_view.visible = True
            self.input_card.visible = True
            self.text_input.disabled = True # 等待 Backtrack Briefing 结束后解锁
            self.text_input.placeholder = self.t["placeholder_select_backtrack"]

    def handle_input_request(self, msg_text, from_name):
        """
        Backend requests input. 
        from_name: The agent waiting for answer.
        """
        if self.current_stage == 1:
            print(self.t["warning_input_request_ignored"])
            return
        self.unlock_input()
        self.tip_button.visible = True
        self.text_input.placeholder = msg_text

        print(self.t["log_input_requested_by"].format(from_name=from_name))
        
        self._update_target_options(waiting_agent_name=from_name)

    
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
        self.text_input.placeholder = self.t["placeholder_agent_thinking"].format(agent_name=agent_name)
        # Reset labels (remove hourglass)
        self._update_target_options(waiting_agent_name=None)

    def handle_facilitator_stream(self, token):
        # 1. 检查是否是结束标记
        if token == "<END>":
            self.facilitator_streaming_active = False
            return

        # 2. 如果是新的一轮对话开始（上一轮已结束），先清空旧内容
        if not self.facilitator_streaming_active:
            self.facilitator_buffer = self.t["facilitator_prefix"] # 重置 Buffer
            self.facilitator_streaming_active = True        # 标记为活跃

        # 3. 追加 Token 并更新 UI
        self.facilitator_buffer += token
        self.facilitator_markdown.object = self.facilitator_buffer

    def unlock_input(self):
        """Restore input state"""
        # 只有在选择了目标的情况下才启用发送按钮
        self.send_button.disabled = True if not self.selected_target_name else False
        self.text_input.disabled = True if not self.selected_target_name else False
        self.radio_group.disabled = False
