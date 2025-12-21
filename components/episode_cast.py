import param
import panel as pn
from panel.viewable import Viewer

class EpisodeCastInfo(Viewer):
    episode_data = param.Dict(default={})
    cast_data = param.List(default=[])
    user_role_name = param.String(default="User")

    def __init__(self, **params):
        super().__init__(**params)
        
        # 内部状态：记录外部 StoryGraph 是否处于选中模式
        self._is_graph_selected = False
        
        # --- 1. Episode Info Section (UI Optimization) ---
        title = self.episode_data.get("title", "Unknown Episode")
        desc = self.episode_data.get("desc", "No description available.")
        emoji = self.episode_data.get("emoji", "🎬") # 假设数据中有emoji字段，没有则默认
        
        # 使用 HTML/CSS 进行简单美化
        episode_pane = pn.Column(
            pn.pane.Markdown(f"## {emoji} {title}", margin=(0, 10, 0, 10)),
            pn.pane.Markdown(f"{desc}", margin=(-5, 10, -5, 10), styles={'color': '#555', 'font-size': '1em'}),
            styles={
                'border-left': '5px solid #ffaa00', 
                'border-radius': '4px',
                'padding': '5px',
                'font-size': '1.1em'
            },
            sizing_mode='stretch_width'
        )


        episode_card = pn.Card(episode_pane, title="🎬 Episode Info", sizing_mode='stretch_width',collapsible=False,styles={'margin-bottom': '10px'})


        # --- 2. Cast Master-Detail Section ---
        
        # A. 数据准备
        self.cast_map = {}
        options = []
        default_val = None

        for agent in self.cast_data:
            name = agent['name']
            avatar = agent.get('avatar', '👤')
            title = agent.get('title', 'Character')
            # 如果是用户扮演的角色，加上标识
            display_name = f"{avatar} {name}"
            if name == self.user_role_name:
                display_name += " (😉 User)"
            display_name += f" - {title}"
            
            self.cast_map[name] = agent
            options.append(display_name)
            
            # 建立 display_name -> real_name 的反向映射以便查找
            agent['_display_name'] = display_name

        # B. 选择器 (Master)
        # 默认选中第一个
        default_val = options[0] if options else None
        
        self.cast_selector = pn.widgets.RadioButtonGroup(
            name='Character Switcher',
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
        
        # D. 切换按钮
        self.switch_btn = pn.widgets.Button(
            name="🚫 Select Node to Switch", 
            button_type='primary', 
            disabled=True, 
            sizing_mode='stretch_width'
        )
        

        cast_card = pn.Card(
            pn.Column(
                self.cast_selector,
                self.cast_detail_view,
                self.switch_btn
            ),
            title="🎭 Cast & Perspective",
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
        name_tag += " (😉 User)" if real_name == self.user_role_name else ""
        self.cast_detail_view.object = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0;">{agent.get('avatar','👤')} {name_tag}:</h3>
            <p style="font-size:1.1em;"><strong>Title:</strong> {agent.get('title','Character')}</p>
            <p style="color: #666; margin-bottom:0;font-size:1em;">{agent.get('desc')}</p>
        </div>
        """

        # 2. 更新按钮状态
        is_me = (real_name == self.user_role_name)
        
        if is_me:
            # Case A: 是我自己
            self.switch_btn.name = "🚫 Cannot Switch Perspective to Yourself"
            self.switch_btn.disabled = True
            self.switch_btn.button_type = 'danger'
        elif not self._is_graph_selected:
            # Case B: 是别人，但没选节点
            self.switch_btn.name = "🚫 Select a Graph Node to Switch Perspective"
            self.switch_btn.disabled = True
            self.switch_btn.button_type = 'danger'
        else:
            # Case C: 是别人，且已选节点 -> 允许切换
            self.switch_btn.name = f"🔀 Switch Perspective to {real_name}"
            self.switch_btn.disabled = False
            self.switch_btn.button_type = 'success'

    def __panel__(self):
        return self._layout

    # --- Public API ---

    def enable_perspective_selection(self, is_active: bool):
        """外部控制器调用：通知图谱选中状态改变"""
        self._is_graph_selected = is_active
        # 重新运行一次状态检查来更新按钮
        self._update_detail_view()

    def get_selected_perspective_candidate(self):
        """获取当前详情页展示的角色名字（用于回溯）"""
        selection = self.cast_selector.value
        real_name = self._get_real_name_from_selection(selection)
        
        # 如果选的是自己，或者当前图谱没选中，则返回 None (表示不切换)
        if real_name == self.user_role_name or not self._is_graph_selected:
            return None
            
        return real_name