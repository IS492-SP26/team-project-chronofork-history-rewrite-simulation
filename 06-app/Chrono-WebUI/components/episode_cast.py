import param
import panel as pn
from panel.viewable import Viewer

I18N = {
    "en": {
        "unknown_episode": "Unknown Episode",
        "no_desc": "No description available.",
        "episode_info": "🎬 Episode Info",
        "character_default_title": "Character",
        "user_tag": "(😉 User)",
        "character_switcher": "Character Switcher",
        "backtrack_select_node_switch": "🚫 Select Node to Switch",
        "cast_perspective": "🎭 Cast & Perspective",
        "indicator_current": "CURRENT",
        "stage1_title": "Stage 1: Observation",
        "stage1_desc": "Observe the canonical history flow.",
        "stage2_title": "Stage 2: Intervention",
        "stage2_desc": "Backtrack, rewrite decisions, and create divergent timelines.",
        "label_title": "Title",
        "backtrack_as": "✅ Backtrack as {name}",
        "select_valid_node_switch": "🚫 Select Valid Node to Switch Perspective",
        "select_valid_node_backtrack": "🚀 Select a Valid Node to Backtrack Perspective",
    },
    "zh": {
        "unknown_episode": "未知章节",
        "no_desc": "暂无描述。",
        "episode_info": "🎬 章节信息",
        "character_default_title": "角色",
        "user_tag": "(😉 用户)",
        "character_switcher": "角色切换",
        "backtrack_select_node_switch": "🚫 请选择节点后再切换",
        "cast_perspective": "🎭 角色与视角",
        "indicator_current": "当前阶段",
        "stage1_title": "阶段一：观察",
        "stage1_desc": "观察正史时间线的发展。",
        "stage2_title": "阶段二：干预",
        "stage2_desc": "回溯并重写决策，创造分歧时间线。",
        "label_title": "身份",
        "backtrack_as": "✅ 以 {name} 身份回溯",
        "select_valid_node_switch": "🚫 请选择可回溯节点以切换视角",
        "select_valid_node_backtrack": "🚀 请选择有效节点并开始回溯",
    },
}


class EpisodeCastInfo(Viewer):
    episode_data = param.Dict(default={})
    cast_data = param.List(default=[])
    user_role_name = param.String(default="User")

    def __init__(self, lang="en", **params):
        super().__init__(**params)
        self.lang = lang
        self.t = I18N[self.lang] if self.lang in I18N else I18N["en"]
        
        # 内部状态：记录外部 StoryGraph 是否处于选中模式
        self._is_graph_selected = False
        self.current_stage = 0  # 0=Init, 1=Stage1, 2=Stage2
        
        # --- 1. Episode Info Section (UI Optimization) ---
        title = self.episode_data.get("title", self.t["unknown_episode"])
        desc = self.episode_data.get("desc", self.t["no_desc"])
        emoji = self.episode_data.get("emoji", "🎬") # 假设数据中有emoji字段，没有则默认

        self.stage1_pane = pn.pane.HTML(sizing_mode='stretch_width', styles={'margin-top': '5px'})
        self.stage2_pane = pn.pane.HTML(sizing_mode='stretch_width', styles={'margin-top': '5px'})
        self._refresh_stage_indicators()

        # 使用 HTML/CSS 进行简单美化
        episode_pane = pn.Column(
            pn.pane.Markdown(f"## {emoji} {title}", margin=(0, 10, 0, 10)),
            pn.pane.Markdown(f"{desc}", margin=(-5, 10, -5, 10), styles={'color': '#555', 'font-size': '1em'}),
            self.stage1_pane,
            self.stage2_pane,
            styles={
                'border-left': '5px solid #ffaa00', 
                'border-radius': '4px',
                'padding': '5px',
                'font-size': '1.1em'
            },
            sizing_mode='stretch_width'
        )


        episode_card = pn.Card(episode_pane, title=self.t["episode_info"], sizing_mode='stretch_width',collapsible=False,styles={'margin-bottom': '10px'})


        # --- 2. Cast Master-Detail Section ---
        
        # A. 数据准备
        self.cast_map = {}
        options = []
        default_val = None

        for agent in self.cast_data:
            name = agent['name']
            avatar = agent.get('avatar', '👤')
            title = agent.get('title', self.t["character_default_title"])
            # 如果是用户扮演的角色，加上标识
            display_name = f"{avatar} {name}"
            if name == self.user_role_name:
                display_name += f" {self.t['user_tag']}"
            display_name += f" - {title}"
            
            self.cast_map[name] = agent
            options.append(display_name)
            
            # 建立 display_name -> real_name 的反向映射以便查找
            agent['_display_name'] = display_name

        # B. 选择器 (Master)
        # 默认选中第一个
        default_val = options[0] if options else None
        
        self.cast_selector = pn.widgets.RadioButtonGroup(
            name=self.t["character_switcher"],
            options=options,
            value=default_val,
            button_type='primary',
            button_style='outline',
            orientation='vertical', # 垂直排列名字
            sizing_mode='stretch_both',
            styles={'font-size': '1em'}
        )

        self.cast_selector.param.watch(self._update_detail_view, 'value')

        # C. 详情视图 (Detail)
        self.cast_detail_view = pn.pane.Markdown(
            "",
            sizing_mode='stretch_width',
        )

        self.backtrack_tip = pn.pane.Markdown(
            self.t["backtrack_select_node_switch"],
            styles={"font-size": "1.1em"},
            sizing_mode="stretch_width",
            align="center",
            margin=(0, 0, 0, 10),  # 统一一点边距
        )

        self.backtrack_group = pn.Row(
            self.backtrack_tip,
            sizing_mode="stretch_width",
            styles={
                "background": "#f0f0f5",
                "margin": "5px 10px 5px 10px",  # 简写 margin (上 右 下 左)
                "border-radius": "5px",
                "border-left": "5px solid #6c757d",
                "align-items": "center",  # 【CSS关键】确保 Row 内部元素垂直居中
            },
            visible=False,
        )
        

        cast_card = pn.Card(
            pn.Column(
                self.backtrack_group,
                self.cast_selector,
                self.cast_detail_view,
            ),
            title=self.t["cast_perspective"],
            sizing_mode='stretch_both',
            scroll=True,
            collapsible=False
        )

        self._layout = pn.Column(
            episode_card,
            cast_card,
            sizing_mode='stretch_both',
        )

        # 初始化视图
        if default_val:
            self._update_detail_view()

    def _generate_stage_html(self, title, desc, icon, theme_color, bg_color, state):
        """
        State: 'inactive', 'active', 'completed'
        """
        # 默认样式 (Inactive)
        opacity = "0.4"
        border = "1px dashed #ccc"
        background = "#f0f0f5"
        text_color = "#888"
        box_shadow = "none"
        indicator = ""

        if state == 'active':
            opacity = "1.0"
            border = f"2px solid {theme_color}"
            background = bg_color
            text_color = theme_color
            box_shadow = "0 2px 5px rgba(0,0,0,0.1)"
            indicator = f"<div style='float:right; font-size:0.8em; background:{theme_color}; color:white; padding:2px 6px; border-radius:4px;'>{self.t['indicator_current']}</div>"
        
        elif state == 'completed':
            opacity = "0.7"
            border = f"1px solid {theme_color}"
            background = bg_color
            text_color = theme_color
            box_shadow = "none"
            indicator = f"<div style='float:right; font-size:1.2em;'>✅</div>"

        return f"""
        <div style="
            opacity: {opacity};
            background-color: {background};
            color: {text_color};
            border: {border};
            padding: 8px 12px;
            border-radius: 6px;
            box-shadow: {box_shadow};
            transition: all 0.3s ease;
        ">
            {indicator}
            <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">
                {icon} {title}
            </div>
            <div style="font-size: 0.9em; opacity: 0.9;">
                {desc}
            </div>
        </div>
        """
        

    def update_stage_display(self, stage):
        """外部调用：更新 Stage 状态"""
        self.current_stage = stage
        self.set_stage_mode(stage) # 处理按钮显隐
        self._refresh_stage_indicators()

    def _refresh_stage_indicators(self):
        """根据 current_stage 渲染两个 HTML 卡片"""
        
        # 定义状态样式
        # 0: Inactive (Gray), 1: Active (Bright), 2: Completed (Dimmed)
        
        # Logic for Stage 1 Card
        if self.current_stage == 0:
            s1_state = 'inactive'
        elif self.current_stage == 1:
            s1_state = 'active'
        else: # stage >= 2
            s1_state = 'completed'

        # Logic for Stage 2 Card
        if self.current_stage < 2:
            s2_state = 'inactive'
        else:
            s2_state = 'active'

        self.stage1_pane.object = self._generate_stage_html(
            title=self.t["stage1_title"],
            desc=self.t["stage1_desc"],
            icon="🧐",
            theme_color="#155724", # Green
            bg_color="#d4edda",
            state=s1_state
        )

        self.stage2_pane.object = self._generate_stage_html(
            title=self.t["stage2_title"],
            desc=self.t["stage2_desc"],
            icon="🙌",
            theme_color="#721c24", # Red
            bg_color="#f8d7da",
            state=s2_state
        )

    def _get_real_name_from_selection(self, selection):
        """根据显示名(带User后缀)反查真实名字"""
        for name, agent in self.cast_map.items():
            if agent['_display_name'] == selection:
                return name
        return None

    def _update_detail_view(self, event=None):
        """当选择角色改变 或 外部调用刷新时 更新详情和按钮状态"""
        selection = self.cast_selector.value
        if not selection: return

        real_name = self._get_real_name_from_selection(selection)
        agent = self.cast_map.get(real_name)
        
        if not agent: return

        name_tag = real_name 
        name_tag += f" {self.t['user_tag']}" if real_name == self.user_role_name else ""
        self.cast_detail_view.object = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0;">{agent.get('avatar','👤')} {name_tag}:</h3>
            <p style="font-size:1.1em;"><strong>{self.t['label_title']}:</strong> {agent.get('title', self.t['character_default_title'])}</p>
            <p style="color: #666; margin-bottom:0;font-size:1em;">{agent.get('desc')}</p>
        </div>
        """
        
        if self._is_graph_selected:
            self.backtrack_tip.object = self.t["backtrack_as"].format(name=real_name)
        else:
            self.backtrack_tip.object = self.t["select_valid_node_switch"]

    def __panel__(self):
        return self._layout

    # --- Public API ---

    def enable_perspective_selection(self, is_active: bool):
        """外部控制器调用：通知图谱选中状态改变"""
        self._is_graph_selected = is_active
        if self._is_graph_selected:
            real_name = self._get_real_name_from_selection(self.cast_selector.value)
            self.backtrack_tip.object = self.t["backtrack_as"].format(name=real_name)
        else:
            self.backtrack_tip.object = self.t["select_valid_node_switch"]
        # 重新运行一次状态检查来更新按钮
        self._update_detail_view()

    def get_selected_perspective_candidate(self):
        """获取当前详情页展示的角色名字（用于回溯）"""
        selection = self.cast_selector.value
        real_name = self._get_real_name_from_selection(selection)
        
        return real_name
    
    def update_user_role(self, new_role_name):
        """Backtrack 后更新当前用户角色"""
        print(f"Updating user role from {self.user_role_name} to {new_role_name}")
        self.user_role_name = new_role_name
        # 重新生成 options 以更新 (😉 User) 标记
        options = []
        for name, agent in self.cast_map.items():
            display_name = f"{agent.get('avatar','👤')} {name}"
            if name == self.user_role_name:
                display_name += f" {self.t['user_tag']}"
            display_name += f" - {agent.get('title', self.t['character_default_title'])}"
            options.append(display_name)
            agent['_display_name'] = display_name
        
        self.cast_selector.options = options
        # 尝试保持选中
        for opt in options:
            if new_role_name in opt:
                self.cast_selector.value = opt
                break
    
    def set_stage_mode(self, stage):
        self.current_stage = stage
        if stage == 1:
            self.backtrack_group.visible = False
        elif stage == 2:
            self.backtrack_tip.object = self.t["select_valid_node_backtrack"]
            self.backtrack_group.visible = True
