import datetime
import json
import os
import re
import asyncio
import argparse
import sys
import panel as pn
import param
from functools import partial

from server.utilities.llm_cache import call_llm
from server.prompts import get_prompt

# CSS for the Timeline Graph and General Styling
css = """
.story-node {
    display: flex;
    align-items: flex-start;
    margin-bottom: 0px;
    position: relative;
}

.node-content {
    background: #fff;
    border-radius: 8px;
    border: 1px solid #eee;
    width: 100%;
    margin-bottom: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    overflow: hidden; /* 确保footer不溢出 */
    font-size: 1.05em;
}
.node-header {
    background: #f8f9fa;
    padding: 8px 15px;
    font-size: 1.15em;
    font-weight: bold;
    color: #6c757d;
    border-bottom: 1px solid #eee;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.node-body {
    padding: 15px;
    font-size: 1.05em;
    color: #333;
    line-height: 1.5;
}
.last-node {
    margin-bottom: -10px;
}

/* 新增：底部的决策问题样式 */
.node-decision {
    background: #e8f5e9; /* 浅绿色背景 */
    padding: 10px 15px;
    font-weight: bold;
    color: #155724;
    border-top: 1px solid #c3e6cb;
    display: flex;
    align-items: center;
    justify-content: center;
}


.highlight-card {
    border: 2px solid #28a745 !important;
    background-color: #f0fff4 !important;
}

.description-box {
    font-size: 1.2em !important;  /* 增大描述文本字体 */
    color: #444;
}
.bk-btn {
    font-size: 1.2em !important;
}
textarea, input {
    font-size: 1.2em !important;
}

"""

pn.extension(raw_css=[css],notifications=True)


def resolve_lang() -> str:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--lang")
    args, _ = parser.parse_known_args()
    if not args.lang:
        print(
            "[Startup Error] Missing required '--lang'. "
            "Use: panel serve config_app.py --args --lang zh|en"
        )
        raise SystemExit(2)
    if args.lang not in {"zh", "en"}:
        print(
            f"[Startup Error] Invalid --lang='{args.lang}'. "
            "Allowed values: zh, en. "
            "Use: panel serve config_app.py --args --lang zh|en"
        )
        raise SystemExit(2)
    return args.lang

UI_TEXTS = {
    "zh": {
        "theme_placeholder": "例如：春秋战国、二战、法国大革命...",
        "analyze_theme": "分析主题",
        "stage1_title": "阶段 1：配置",
        "stage2_loading": "正在构建故事图...",
        "stage2_select_first": "请先在阶段 1 中选择一个事件。",
        "confirm_storyline": "确认故事线",
        "back_to_episodes": "返回事件列表",
        "stage2_title": "阶段 2：故事线",
        "stage3_loading": "正在生成角色...",
        "perspective_type": "视角类型",
        "protagonists": "决策者",
        "observers": "观察者",
        "select_character": "选择角色",
        "confirm_character_launch": "确认角色并启动",
        "back_to_storyline": "返回故事线",
        "reselect_character": "重新选择角色",
        "stage3_title": "阶段 3：角色与视角",
        "theme_input_heading": "### 主题输入",
        "retrieving_episodes": "正在检索历史事件...",
        "error_prefix": "错误",
        "retry": "重试",
        "select_episode": "选择事件",
        "confirm_selection": "确认选择",
        "back_to_theme": "返回主题",
        "select_episode_heading": "### 请选择一个事件：",
        "selected_prefix": "✅ 已选择",
        "scenario_default": "场景",
        "start_suffix": "开始",
        "choice_prefix": "选择",
        "decision_prefix": "决策",
        "storyline_confirmed": "✅ 故事线已确认",
        "with_storyline_nodes": "共 {count} 个节点",
        "select_decision_maker": "选择决策者",
        "select_historical_witness": "选择历史观察者",
        "decision_maker_type": "🎯 决策者",
        "historical_witness_type": "👁️ 历史观察者",
        "char_default": "角色",
        "type_label": "类型",
        "title_label": "身份",
        "saved_notice": "✅ 配置完成，已可进入体验。",
        "app_title": "ChronoFork · 配置",
    },
    "en": {
        "theme_placeholder": "E.g., Ancient China, WWII, The French Revolution...",
        "analyze_theme": "Analyze Theme",
        "stage1_title": "Stage 1: Configuration",
        "stage2_loading": "Constructing Story Graph...",
        "stage2_select_first": "Please select an episode in Stage 1.",
        "confirm_storyline": "Confirm Storyline",
        "back_to_episodes": "Back to Episodes",
        "stage2_title": "Stage 2: Storyline",
        "stage3_loading": "Casting Agents & Observers...",
        "perspective_type": "Perspective Type",
        "protagonists": "Protagonists",
        "observers": "Observers",
        "select_character": "Select Character",
        "confirm_character_launch": "Confirm Character & Launch",
        "back_to_storyline": "Back to Storyline",
        "reselect_character": "Reselect Character",
        "stage3_title": "Stage 3: Cast & Perspective",
        "theme_input_heading": "### Theme Input",
        "retrieving_episodes": "Retrieving Historical Episodes...",
        "error_prefix": "Error",
        "retry": "Retry",
        "select_episode": "Select Episode",
        "confirm_selection": "Confirm Selection",
        "back_to_theme": "Back to Theme",
        "select_episode_heading": "### Select an Episode:",
        "selected_prefix": "✅ Selected",
        "scenario_default": "Scenario",
        "start_suffix": "START",
        "choice_prefix": "Choice",
        "decision_prefix": "Decision",
        "storyline_confirmed": "✅ Storyline Confirmed",
        "with_storyline_nodes": "With {count} storyline nodes",
        "select_decision_maker": "Select Decision Maker",
        "select_historical_witness": "Select Historical Witness",
        "decision_maker_type": "🎯 Decision Maker",
        "historical_witness_type": "👁️ Historical Witness",
        "char_default": "Character",
        "type_label": "Type",
        "title_label": "Title",
        "saved_notice": "✅ You’re all set! Enter the VR space.",
        "app_title": "ChronoFork · Configuration",
    },
}

class ConfigPage(pn.viewable.Viewer):
    # State Variables
    selected_theme = param.String(default="")
    episode_list = param.List(default=[])
    selected_episode = param.Dict(default={})
    storyline_data = param.List(default=[])
    cast_list = param.List(default=[])
    selected_character = param.String(default="")

    def __init__(self, **params):
        super().__init__(**params)
        self.prompt_lang = LANG
        self.ui = UI_TEXTS[self.prompt_lang]
        self._init_ui()

    def _t(self, key: str) -> str:
        return self.ui[key]

    def _init_ui(self):
        # --- STAGE 1: THEME & EPISODES ---
        self.theme_input = pn.widgets.TextAreaInput(
            placeholder=self._t("theme_placeholder"),
            height=100, sizing_mode='stretch_width'
        )
        self.theme_confirm_btn = pn.widgets.Button(name=self._t("analyze_theme"), button_type='primary', sizing_mode='stretch_width')
        self.theme_confirm_btn.on_click(partial(self.on_theme_confirm))
        
        self.episode_list_col = pn.Column(sizing_mode='stretch_both') # Container for generated episode buttons
        
        self.card1_content = pn.Column(
            self._t("theme_input_heading"),
            self.theme_input,
            self.theme_confirm_btn,
            self.episode_list_col,sizing_mode='stretch_both'
        )
        self.card1 = pn.Card(self.card1_content, title=self._t("stage1_title"), sizing_mode='stretch_both', collapsed=False,margin=(0, 10, 0, 0))

        # --- STAGE 2: STORYLINE ---
        self.loading_spinner = pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), self._t("stage2_loading"),sizing_mode='stretch_width',visible=False)
        self.graph_desc=pn.pane.HTML(self._t("stage2_select_first"), sizing_mode='stretch_both')
        
        self.graph_desc_container = pn.Column(self.loading_spinner, self.graph_desc, sizing_mode='stretch_both',scroll=True)

        # Setup Footer Buttons
        self.confirm_btn = pn.widgets.Button(name=self._t("confirm_storyline"), button_type='success', sizing_mode='stretch_width',visible=False)
        self.confirm_btn.on_click(partial(self.on_storyline_confirm))
        
        self.back_btn = pn.widgets.Button(name=self._t("back_to_episodes"), sizing_mode='stretch_width',visible=False)
        self.back_btn.on_click(partial(self.back_to_stage1))

        self.graph_ctrls_display = pn.pane.HTML("", sizing_mode='stretch_width',margin=(5,0,5,0))

        self.sl_btns_row = pn.Row(self.confirm_btn, self.back_btn, sizing_mode='stretch_width')
        self.graph_ctrls_container = pn.Column(self.graph_ctrls_display, self.sl_btns_row, sizing_mode='stretch_width')
        
        self.card2_content = pn.Column(
            self.graph_desc_container,
            self.graph_ctrls_container,sizing_mode='stretch_both'
        )
        self.card2 = pn.Card(self.card2_content, title=self._t("stage2_title"), sizing_mode='stretch_both', collapsed=True,margin=(0, 10, 0, 0))

        # --- STAGE 3: CAST ---
        self.cast_loading = pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), self._t("stage3_loading"), visible=False)

        # 1. 类别选择器 (互斥按钮组)
        self.category_option_labels = {
            "Protagonists": self._t("protagonists"),
            "Observers": self._t("observers"),
        }
        category_options = {label: value for value, label in self.category_option_labels.items()}
        self.category_selector = pn.widgets.RadioButtonGroup(
            name=self._t("perspective_type"),
            options=category_options, 
            value='Protagonists',
            button_type='default',
            button_style='solid',
            sizing_mode='stretch_width',
            visible=False
        )

        # 2. 角色列表选择器 (RadioBoxGroup)
        self.cast_selector = pn.widgets.RadioButtonGroup(
            name=self._t("select_character"),
            button_type='primary',
            button_style='outline',
            orientation='vertical', # 垂直排列名字
            sizing_mode='stretch_both',
            visible=False
        )

        # 3. 详情展示区域
        self.cast_detail_view = pn.pane.Markdown(
            "",
            sizing_mode='stretch_width',
            visible=False
        )

        # 5. 按钮组
        self.cast_confirm_btn = pn.widgets.Button(name=self._t("confirm_character_launch"), button_type='success', sizing_mode='stretch_width',visible=False)
        self.cast_confirm_btn.on_click(self.on_cast_confirm_click)

        self.cast_back_btn = pn.widgets.Button(name=self._t("back_to_storyline"), button_type='default', sizing_mode='stretch_width',visible=False)
        self.cast_back_btn.on_click(self.back_to_stage2)

        self.cast_reselect_btn = pn.widgets.Button(name=self._t("reselect_character"), button_type='warning', sizing_mode='stretch_width', visible=False)
        self.cast_reselect_btn.on_click(self.on_cast_reselect_click)


        cast_ctrl_row=pn.Row(self.cast_confirm_btn, self.cast_back_btn, self.cast_reselect_btn, sizing_mode='stretch_width')

        self.card3_content = pn.Column(
            self.cast_loading,
            self.category_selector,
            self.cast_selector,
            self.cast_detail_view,
            cast_ctrl_row,
            sizing_mode='stretch_both'
        )

        self.card3 = pn.Card(self.card3_content, title=self._t("stage3_title"), sizing_mode='stretch_both', collapsed=True)

        # Layout
        self._layout = pn.GridBox(
            self.card1,
            self.card2,
            self.card3,
            ncols=3,  # 指定3列
            sizing_mode='stretch_both'
        )

    def __panel__(self):
        return self._layout

    # ==========================================
    # STAGE 1 LOGIC: THEME -> EPISODES
    # ==========================================
    async def on_theme_confirm(self, event):
        if not self.theme_input.value: return
        
        self.selected_theme = self.theme_input.value
        self.theme_confirm_btn.disabled = True
        self.theme_input.disabled = True
        
        # Loading State
        self.episode_list_col[:] = [
            pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), self._t("retrieving_episodes"))
        ]
        
        # LLM Call
        prompt = get_prompt(
            "config.theme_to_episodes",
            self.prompt_lang,
            selected_theme=self.selected_theme,
        )
        try:
            response_data = await call_llm(prompt, lang=self.prompt_lang)
            self.episode_list=response_data
            self.render_episodes(response_data)
        except Exception as e:
            self.episode_list_col[:] = [f"{self._t('error_prefix')}: {str(e)}", pn.widgets.Button(name=self._t("retry"), on_click=partial(self.on_theme_confirm))]
            self.theme_confirm_btn.disabled = False

    def render_episodes(self, episodes):
        self.episode_list_col.clear()
        
        # 1. 构建映射和选项
        self.episode_map = {f"{ep.get('emoji','')} {ep.get('title','')}": ep for ep in episodes}
        options_labels = list(self.episode_map.keys())

        # 2. 单选组件
        self.episode_selector = pn.widgets.RadioButtonGroup(
            name=self._t("select_episode"),
            options=options_labels,
            value=options_labels[0],
            button_type='primary',
            button_style='outline',
            orientation='vertical', # 垂直排列名字
            sizing_mode='stretch_both',
        )

        # 3. 详情展示区域 (初始状态)
        first_ep = self.episode_map[options_labels[0]]
        self.episode_detail_view = pn.pane.Markdown('',
            sizing_mode='stretch_width'
        )
        self.refresh_episode_list(options_labels[0])

        # 监听切换
        def update_details(event):
            selected_label = event.new
            self.refresh_episode_list(selected_label)
        self.episode_selector.param.watch(update_details, 'value')

        # 4. 按钮组 (Confirm 和 Redo)
        self.ep_confirm_btn = pn.widgets.Button(name=self._t("confirm_selection"), button_type='success', sizing_mode='stretch_width')
        self.ep_confirm_btn.on_click(self.on_episode_confirm_click)

        self.ep_redo_btn = pn.widgets.Button(name=self._t("back_to_theme"), sizing_mode='stretch_width')
        self.ep_redo_btn.on_click(self.on_reset_theme_click)

        self.ep_buttons_row = pn.Row(self.ep_confirm_btn, self.ep_redo_btn, sizing_mode='stretch_width')

        # 5. 组装
        self.episode_list_col.extend([
            pn.pane.Markdown(self._t("select_episode_heading")),
            self.episode_selector,
            self.episode_detail_view,
            self.ep_buttons_row
        ])

    def refresh_episode_list(self,selected_label):
        ep_data = self.episode_map[selected_label]
        self.episode_detail_view.object = f'''
    <div style="background-color: #f5f5f5; border: 2px solid #C5C5C7; padding: 15px; border-radius: 8px;">
        <h3 style="margin-top:0;">{selected_label}:</h3>
        <p style="margin-bottom:0;font-size:1em;">{ep_data.get('desc', '')}</p>
    </div>'''
        
    # 新增：重置按钮逻辑
    def on_reset_theme_click(self, event):
        # 1. 清空 Episode 选择区
        self.episode_list_col.clear()
        
        # 2. 解锁 Theme 输入区
        self.theme_input.disabled = False
        self.theme_confirm_btn.disabled = False
        
        # 3. 如果之前已经生成过 Stage 2/3，也可以选择在这里重置它们
        self.card2.collapsed = True
        self.card3.collapsed = True

    # 修改：确认按钮逻辑
    async def on_episode_confirm_click(self, event):
        selected_label = self.episode_selector.value
        episode_data = self.episode_map[selected_label]
        
        # 1. 冻结交互
        self.episode_selector.disabled = True
        self.ep_confirm_btn.disabled = True
        self.ep_redo_btn.disabled = True # 确认后也不允许直接Redo，需按需调整逻辑
        
        # 2. 将详情区域更新为高亮样式 (Green Highlight)
        highlight_html = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0; color: #28a745;">{self._t("selected_prefix")}: {selected_label}</h3>
            <p style="color: #666; margin-bottom:0; ">{episode_data.get('desc')}</p>
        </div>
        """
        # 替换 Markdown 内容为 HTML 样式
        self.episode_detail_view.object = highlight_html
        
        # 4. 激活 Stage 2
        self.selected_episode = episode_data
        self.card2.collapsed = False
        await self.generate_storyline()



    # ==========================================
    # STAGE 2 LOGIC: EPISODE -> STORYLINE
    # ==========================================
    async def generate_storyline(self):
        self.loading_spinner.visible = True
        self.graph_desc.object = ""
        
        prompt = get_prompt(
            "config.episode_to_storyline",
            self.prompt_lang,
            episode_title=self.selected_episode["title"],
        )
        try:
            nodes = await call_llm(prompt, lang=self.prompt_lang)
            self.storyline_data = nodes
            self.render_story_graph(nodes)
        except Exception as e:
            self.loading_spinner.visible = False
            self.graph_desc.object = f"{self._t('error_prefix')}: {str(e)}"

    def render_story_graph(self, nodes):
        self.loading_spinner.visible = False
        html_content = '<div style="padding: 10px;">'
        
        scenario_title = self.selected_episode.get('title', self._t("scenario_default"))

        for idx, node in enumerate(nodes):
            is_last = (idx == len(nodes) - 1)
            is_first = (idx == 0)
            last_class = "last-node" if is_last else ""
            
            # --- 1. 准备文本内容 ---

            # 卡片 Header (灰色小标题)
            if is_first:
                header_text = f"🟢 🚩 {scenario_title} {self._t('start_suffix')}"
            else:
                header_text = f"🟢 ⚖️ {self._t('choice_prefix')}: {node.get('choice')}"

            # 卡片 Body (描述)
            body_text = node.get('desc')

            # 卡片 Footer (决策问题) - 最后一个节点没有
            footer_html = ""
            if not is_last:
                decision_question = node.get('title')
                footer_html = f"""
                <div class="node-decision">
                    🤔 {self._t('decision_prefix')}: {decision_question}
                </div>
                """
            else:
                footer_html = f"""
                <div class="node-decision">
                    🏁 {node.get('title')}
                </div>
                """

            # --- 2. 组装 HTML ---
            
            html_content += f"""
            <div class="story-node {last_class}">
                <div class="node-content">
                    <div class="node-header">{header_text}</div>
                    <div class="node-body">{body_text}</div>
                    {footer_html}
                </div>
            </div>
            """
            
        html_content += '</div>'
        
        self.graph_desc.object=html_content
        self.confirm_btn.visible = True
        self.back_btn.visible = True

    async def on_storyline_confirm(self, event):
        self.confirm_btn.disabled = True
        self.back_btn.disabled = True
        self.graph_ctrls_display.visible = True
        self.graph_ctrls_display.object = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px; margin-left:5px; margin-right:5px;">
            <h3 style="margin-top:0; color: #28a745;">{self._t("storyline_confirmed")}</h3>
            <p style="color: #666; margin-bottom:0;">{self._t("with_storyline_nodes").format(count=len(self.storyline_data))}</p>
        </div>
        """
        # Activate Stage 3
        self.card3.collapsed = False
        await self.generate_cast()
        
    def back_to_stage1(self, event):
        self.card2.collapsed = True
        self.card1.collapsed = False
        # Reset Stage 1 UI to selection mode (simple reload of list or regeneration)
        # For simplicity, we just re-enable the theme button to allow restart or re-render list
        self.render_episodes(self.episode_list) # Re-trigger list generation logic or cached list

    # ==========================================
    # STAGE 3 LOGIC: STORYLINE -> CAST
    # ==========================================
    async def generate_cast(self):
        self.cast_loading.visible = True
        
        storyline_str = json.dumps(self.storyline_data, ensure_ascii=False)

        # 修改 Prompt 以请求两类角色
        prompt = get_prompt(
            "config.storyline_to_cast",
            self.prompt_lang,
            episode_title=self.selected_episode["title"],
            storyline_str=storyline_str,
        )
        try:
            cast_data = await call_llm(prompt, lang=self.prompt_lang)
            self.full_cast_data = cast_data # 保存完整字典
            self.cast_data=cast_data.get('protagonists',[])
            self.render_cast(cast_data)
        except Exception as e:
            self.cast_detail_view.object = f"{self._t('error_prefix')}: {str(e)}"

    # ==========================================
    # STAGE 3 UI: CAST SELECTION
    # ==========================================
    def render_cast(self, cast_data):
        self.cast_loading.visible = False
        self.category_selector.visible = True
        self.cast_selector.visible = True
        self.cast_detail_view.visible = True
        self.cast_confirm_btn.visible = True
        self.cast_back_btn.visible = True

        # A. 根据当前选中的类别，刷新下方的角色列表
        def update_list_by_category(category_name):
            # 转换 key (UI显示的大写 -> 数据的小写)
            data_key = category_name.lower() 
            current_list = self.full_cast_data.get(data_key, [])
            
            # 重建映射字典
            self.cast_map = {f"{char.get('avatar','👤')} {char.get('name')} - {char.get('title')}": char for char in current_list}
            new_options = list(self.cast_map.keys())
            
            # 更新列表组件
            self.cast_selector.options = new_options
            if new_options:
                self.cast_selector.value = new_options[0] # 默认选中第一个
                if category_name=='Protagonists':
                    self.cast_selector.name=self._t("select_decision_maker")
                    self.cast_selector.button_type='primary'
                else:
                    self.cast_selector.name=self._t("select_historical_witness")
                    self.cast_selector.button_type='warning'
            
        # B. 监听类别切换
        def on_category_change(event):
            update_list_by_category(event.new)
        
        self.category_selector.param.watch(on_category_change, 'value')

        # C. 监听角色切换 (更新详情)
        def on_character_change(event):
            selected_label = event.new
            self.refresh_cast_list(selected_label)
        self.cast_selector.param.watch(on_character_change, 'value')

        # 4. 初始化一次界面 (默认加载 Protagonists)
        update_list_by_category('Protagonists')

    def refresh_cast_list(self,selected_label):
        if selected_label in self.cast_map:
            char_data = self.cast_map[selected_label]
            # 区分显示不同类别的提示语
            role_type = self.category_selector.value
            prefix = self._t("decision_maker_type") if role_type == 'Protagonists' else self._t("historical_witness_type")
            self.cast_detail_view.object = f'''
        <div style="background-color: #f5f5f5; border: 2px solid #C5C5C7; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0;">{char_data.get('avatar','👤')} {char_data.get('name',self._t('char_default'))}:</h3>
            <p style="font-size:1.1em;"><strong>{self._t('type_label')}:</strong> {prefix}</p>
            <p style="font-size:1.1em;"><strong>{self._t('title_label')}:</strong> {char_data.get('title',self._t('char_default'))}</p>
            <p style="color: #666; margin-bottom:0;font-size:1em;">{char_data.get('desc')}</p>
        </div>'''



    def back_to_stage2(self, event):
        self.card3.collapsed = True
        self.card2.collapsed = False
        self.confirm_btn.disabled = False
        self.back_btn.disabled = False

    async def on_cast_confirm_click(self, event):
        selected_label = self.cast_selector.value
        character_data = self.cast_map[selected_label]
        self.selected_character = character_data['name']
        role_category = self.category_selector.value # 记录用户选的是主角还是观察者
        
        # 1. 冻结 UI
        self.category_selector.disabled = True # 冻结类别切换
        self.cast_selector.disabled = True     # 冻结角色选择
        self.cast_confirm_btn.visible = False
        self.cast_back_btn.visible = False
        self.cast_reselect_btn.visible = True
        
        # 2. 高亮展示
        highlight_html = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0; color: #28a745;">{self._t("selected_prefix")}: {selected_label}</h3>
            <p><strong>{self._t("type_label")}:</strong> {self.category_option_labels.get(role_category, role_category)}</p>
            <p style="color: #666; margin-bottom:0;">{character_data.get('desc')}</p>
        </div>
        """
        self.cast_detail_view.object = highlight_html

        # 3. 准备 JSON (保存完整的 prompt output 以便系统后续使用其他 NPC)
        config_data = {
            "episode": self.selected_episode,
            "storyline": self.storyline_data,
            "cast_data": self.cast_data,
            "user_role": character_data
        }
        
        # 4. 保存
        if not os.path.exists('config'):
            os.makedirs('config')
        now = datetime.datetime.now()
        date_str = now.strftime("%m-%d_%H-%M")
        filename = f'config/{date_str}.json'
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=4)
            print(f"Config saved to {filename}")
        except Exception as e:
            print(f"Error saving config: {e}")

        if pn.state.notifications:
            pn.state.notifications.success(self._t("saved_notice"), duration=5000)
    
    def on_cast_reselect_click(self, event):
        # 1. 解锁
        self.category_selector.disabled = False
        self.cast_selector.disabled = False
        
        # 2. 按钮复原
        self.cast_reselect_btn.visible = False
        self.cast_confirm_btn.visible = True
        self.cast_back_btn.visible = True
        
        # 3. 恢复详情描述 (触发一次手动更新)
        selected_label = self.cast_selector.value
        if selected_label:
            self.refresh_cast_list(selected_label)


LANG = resolve_lang()
print(f"[Startup] config_app prompt language: {LANG}")

# Create Panel Server
app = pn.template.VanillaTemplate(title=UI_TEXTS[LANG]["app_title"])
config_component = ConfigPage()
app.main.append(config_component)
app.servable()
