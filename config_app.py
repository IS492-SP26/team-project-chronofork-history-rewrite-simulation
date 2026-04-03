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

/* 决策问题样式 */
.node-decision {
    background: #e8f5e9;
    padding: 10px 15px;
    font-weight: bold;
    color: #155724;
    border-top: 1px solid #c3e6cb;
    display: flex;
    align-items: center;
    gap: 6px;
}
.decision-maker-tag {
    color: #0056b3;
    font-weight: bold;
}

/* Timeline Styles */
.timeline-container {
    padding: 10px 10px 10px 10px;
}
.timeline-step {
    display: flex;
    gap: 14px;
    align-items: flex-start;
}
.step-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 34px;
    flex-shrink: 0;
}
.step-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #007bff, #28a745);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.85em;
    flex-shrink: 0;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}
.step-dot-last {
    background: linear-gradient(135deg, #28a745, #20c997);
}
.step-line {
    width: 2px;
    flex: 1;
    min-height: 16px;
    background: linear-gradient(to bottom, #007bff55, #dee2e6);
}
.step-content {
    flex: 1;
    margin-bottom: 0;
}
.choice-connector {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 3px 0 5px 0;
    padding: 5px 12px;
    background: #f1f8ff;
    border-left: 3px solid #007bff;
    border-radius: 0 4px 4px 0;
    font-size: 0.88em;
    color: #444;
    font-style: italic;
}
.char-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 7px 14px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafafa;
}
.char-badge {
    display: inline-flex;
    align-items: center;
    background: #e9ecef;
    border: 1px solid #ced4da;
    border-radius: 12px;
    padding: 2px 9px;
    font-size: 0.82em;
    white-space: nowrap;
    gap: 3px;
}

/* Cast Grid */
.cast-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    padding: 10px;
}
.cast-card {
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    transition: box-shadow 0.2s;
}
.cast-card:hover {
    box-shadow: 0 3px 10px rgba(0,0,0,0.1);
}
.cast-avatar-large {
    font-size: 2.2em;
    margin-bottom: 6px;
}
.cast-char-name {
    font-weight: bold;
    font-size: 1em;
    margin-bottom: 3px;
    color: #1a1a2e;
}
.cast-char-title {
    color: #6c757d;
    font-size: 0.8em;
    margin-bottom: 8px;
    font-style: italic;
}
.cast-char-desc {
    font-size: 0.8em;
    color: #555;
    text-align: left;
    line-height: 1.45;
}

.highlight-card {
    border: 2px solid #28a745 !important;
    background-color: #f0fff4 !important;
}
.description-box {
    font-size: 1.2em !important;
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
        "stage2_loading": "正在生成角色阵容...",
        "stage2_select_first": "请先在阶段 1 中选择一个事件。",
        "confirm_cast": "确认阵容",
        "confirm_storyline": "确认故事线",
        "back_to_episodes": "返回事件列表",
        "back_to_cast": "返回角色阵容",
        "stage2_title": "阶段 2：角色阵容",
        "stage3_loading": "正在生成故事线...",
        "stage3_select_first": "请先在阶段 2 中确认角色阵容。",
        "stage3_title": "阶段 3：故事线",
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
        "cast_confirmed": "✅ 角色阵容已确认",
        "with_cast_members": "共 {count} 位角色",
        "storyline_confirmed": "✅ 故事线已确认",
        "with_storyline_nodes": "共 {count} 个节点",
        "char_default": "角色",
        "saved_notice": "✅ 配置完成，已可进入体验。",
        "app_title": "ChronoFork · 配置",
    },
    "en": {
        "theme_placeholder": "E.g., Ancient China, WWII, The French Revolution...",
        "analyze_theme": "Analyze Theme",
        "stage1_title": "Stage 1: Configuration",
        "stage2_loading": "Generating Cast...",
        "stage2_select_first": "Please select an episode in Stage 1.",
        "confirm_cast": "Confirm Cast",
        "confirm_storyline": "Confirm Storyline",
        "back_to_episodes": "Back to Episodes",
        "back_to_cast": "Back to Cast",
        "stage2_title": "Stage 2: Cast",
        "stage3_loading": "Constructing Story Graph...",
        "stage3_select_first": "Please confirm the cast in Stage 2 first.",
        "stage3_title": "Stage 3: Storyline",
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
        "cast_confirmed": "✅ Cast Confirmed",
        "with_cast_members": "With {count} cast members",
        "storyline_confirmed": "✅ Storyline Confirmed",
        "with_storyline_nodes": "With {count} storyline nodes",
        "char_default": "Character",
        "saved_notice": "✅ You’re all set! Enter the VR space.",
        "app_title": "ChronoFork · Configuration",
    },
}

class ConfigPage(pn.viewable.Viewer):
    # State Variables
    selected_theme = param.String(default="")
    episode_list = param.List(default=[])
    selected_episode = param.Dict(default={})
    cast_list = param.List(default=[])
    storyline_data = param.List(default=[])

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

        # --- STAGE 2: CAST ---
        self.cast_loading = pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), self._t("stage2_loading"), visible=False)

        self.cast_selector = pn.widgets.RadioButtonGroup(
            button_type='primary',
            button_style='outline',
            orientation='vertical',
            sizing_mode='stretch_both',
            visible=False,
        )
        self.cast_detail_view = pn.pane.HTML("", sizing_mode='stretch_width', visible=False)
        self.cast_confirmed_display = pn.pane.HTML("", sizing_mode='stretch_width', visible=False, margin=(5,0,5,0))

        self.cast_confirm_btn = pn.widgets.Button(name=self._t("confirm_cast"), button_type='success', sizing_mode='stretch_width', visible=False)
        self.cast_confirm_btn.on_click(self.on_cast_confirm_click)

        self.cast_back_btn = pn.widgets.Button(name=self._t("back_to_episodes"), button_type='default', sizing_mode='stretch_width', visible=False)
        self.cast_back_btn.on_click(self.back_to_stage1)

        cast_btns_row = pn.Row(self.cast_confirm_btn, self.cast_back_btn, sizing_mode='stretch_width')

        self.card2_content = pn.Column(
            self.cast_loading,
            self.cast_selector,
            self.cast_detail_view,
            self.cast_confirmed_display,
            cast_btns_row,
            sizing_mode='stretch_both'
        )
        self.card2 = pn.Card(self.card2_content, title=self._t("stage2_title"), sizing_mode='stretch_both', collapsed=True, margin=(0, 10, 0, 0))

        # --- STAGE 3: STORYLINE ---
        self.loading_spinner = pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), self._t("stage3_loading"), sizing_mode='stretch_width', visible=False)
        self.graph_desc = pn.pane.HTML(self._t("stage3_select_first"), sizing_mode='stretch_both')

        self.graph_desc_container = pn.Column(self.loading_spinner, self.graph_desc, sizing_mode='stretch_both', scroll=True)

        self.confirm_btn = pn.widgets.Button(name=self._t("confirm_storyline"), button_type='success', sizing_mode='stretch_width', visible=False)
        self.confirm_btn.on_click(partial(self.on_storyline_confirm))

        self.back_btn = pn.widgets.Button(name=self._t("back_to_cast"), sizing_mode='stretch_width', visible=False)
        self.back_btn.on_click(partial(self.back_to_stage2))

        self.graph_ctrls_display = pn.pane.HTML("", sizing_mode='stretch_width', margin=(5,0,5,0))

        self.sl_btns_row = pn.Row(self.confirm_btn, self.back_btn, sizing_mode='stretch_width')
        self.graph_ctrls_container = pn.Column(self.graph_ctrls_display, self.sl_btns_row, sizing_mode='stretch_width')

        self.card3_content = pn.Column(
            self.graph_desc_container,
            self.graph_ctrls_container,
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
        
        # 4. 激活 Stage 2 (Cast)
        self.selected_episode = episode_data
        self.card2.collapsed = False
        await self.generate_cast()



    # ==========================================
    # STAGE 2 LOGIC: EPISODE -> CAST
    # ==========================================
    async def generate_cast(self):
        self.cast_loading.visible = True
        self.cast_detail_view.object = ""

        prompt = get_prompt(
            "config.episode_to_cast",
            self.prompt_lang,
            episode_title=self.selected_episode["title"],
        )
        try:
            cast_data = await call_llm(prompt, lang=self.prompt_lang)
            self.cast_list = cast_data
            self.render_cast(cast_data)
        except Exception as e:
            self.cast_loading.visible = False
            self.cast_detail_view.object = f"{self._t('error_prefix')}: {str(e)}"
            self.cast_detail_view.visible = True

    def render_cast(self, cast_data):
        self.cast_loading.visible = False

        self.cast_map = {
            f"{c.get('avatar', '👤')}  {c.get('name')}": c
            for c in cast_data
        }
        options = list(self.cast_map.keys())
        self.cast_selector.options = options
        self.cast_selector.value = options[0] if options else None
        self.cast_selector.visible = True
        self.cast_detail_view.visible = True
        self.cast_confirm_btn.visible = True
        self.cast_back_btn.visible = True

        def on_character_change(event):
            self._refresh_cast_detail(event.new)
        self.cast_selector.param.watch(on_character_change, 'value')

        if options:
            self._refresh_cast_detail(options[0])

    def _refresh_cast_detail(self, selected_label):
        char = self.cast_map.get(selected_label)
        if not char:
            return
        self.cast_detail_view.object = f"""
        <div style="background-color:#f5f5f5;border:1.5px solid #C5C5C7;padding:14px;border-radius:8px;margin-top:6px;">
            <h3 style="margin-top:0;">{char.get('avatar','👤')} {char.get('name','')}</h3>
            <p style="color:#6c757d;margin:0 0 8px 0;font-size:0.9em;font-style:italic;">{char.get('title','')}</p>
            <p style="color:#444;margin:0;font-size:0.95em;line-height:1.5;">{char.get('desc','')}</p>
        </div>"""

    async def on_cast_confirm_click(self, event):
        # 1. 冻结 UI
        # self.cast_selector.disabled = True
        self.cast_confirm_btn.disabled = True
        self.cast_back_btn.disabled = True

        # 2. 显示确认状态
        self.cast_confirmed_display.object = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0; color: #28a745;">{self._t("cast_confirmed")}</h3>
            <p style="color: #666; margin-bottom:0;">{self._t("with_cast_members").format(count=len(self.cast_list))}</p>
        </div>
        """

        self.cast_confirmed_display.visible = True

        # 3. 激活 Stage 3 (Storyline)
        self.card3.collapsed = False
        await self.generate_storyline()

    def back_to_stage1(self, event):
        self.card2.collapsed = True
        self.card1.collapsed = False
        self.render_episodes(self.episode_list)

    # ==========================================
    # STAGE 3 LOGIC: CAST -> STORYLINE
    # ==========================================
    async def generate_storyline(self):
        self.loading_spinner.visible = True
        self.graph_desc.object = ""

        cast_str = json.dumps(self.cast_list, ensure_ascii=False)
        prompt = get_prompt(
            "config.cast_to_storyline",
            self.prompt_lang,
            episode_title=self.selected_episode["title"],
            cast_str=cast_str,
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

        # Build a lookup of cast for avatar resolution
        cast_lookup = {c.get('name'): c.get('avatar', '👤') for c in self.cast_list}

        html = '<div class="timeline-container">'

        for idx, node in enumerate(nodes):
            is_last = idx == len(nodes) - 1
            step_num = idx + 1

            # --- Choice connector between nodes ---
            if idx > 0:
                choice = node.get('choice', '')
                if choice and choice not in ('None', None):
                    html += f"""
                    <div style="display:flex;gap:14px;align-items:stretch;">
                        <div class="step-indicator">
                            <div class="step-line"></div>
                        </div>
                        <div style="flex:1;">
                            <div class="choice-connector">
                                ✅ {self._t('choice_prefix')}: {choice}
                            </div>
                        </div>
                    </div>"""

            # --- Character badges ---
            characters = node.get('characters', [])
            char_badges_html = ''
            if characters:
                badges = ''.join([
                    f'<span class="char-badge">{cast_lookup.get(name, "👤")} {name}</span>'
                    for name in characters
                ])
                char_badges_html = f'<div class="char-badges">{badges}</div>'

            # --- Decision footer ---
            decision = node.get('decision', 'None')
            decision_maker = node.get('decision_maker', 'None')
            if is_last or not decision or decision == 'None':
                footer_html = f'<div class="node-decision">🏁 {node.get("title", "")}</div>'
            else:
                dm_avatar = cast_lookup.get(decision_maker, '👤')
                dm_tag = f'<span class="decision-maker-tag">🤔 {decision_maker}</span>: ' if decision_maker and decision_maker != 'None' else ''
                footer_html = f'<div class="node-decision">{dm_tag}{decision}</div>'

            # --- Node title ---
            node_title = node.get('title') or f"{self.selected_episode.get('title', self._t('scenario_default'))} {self._t('start_suffix')}"
            dot_class = 'step-dot-last' if is_last else ''
            line_html = '<div class="step-line"></div>' if not is_last else ''

            html += f"""
            <div class="timeline-step">
                <div class="step-indicator">
                    <div class="step-dot {dot_class}">{step_num}</div>
                    {line_html}
                </div>
                <div class="step-content">
                    <div class="node-content">
                        <div class="node-header">{'🏁' if is_last else '🟢'} {node_title}</div>
                        {char_badges_html}
                        <div class="node-body">{node.get('desc', '')}</div>
                        {footer_html}
                    </div>
                </div>
            </div>"""

        html += '</div>'
        self.graph_desc.object = html
        self.confirm_btn.visible = True
        self.back_btn.visible = True

    async def on_storyline_confirm(self, event):
        self.confirm_btn.disabled = True
        self.back_btn.disabled = True
        self.graph_ctrls_display.object = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0; color: #28a745;">{self._t("storyline_confirmed")}</h3>
            <p style="color: #666; margin-bottom:0;">{self._t("with_storyline_nodes").format(count=len(self.storyline_data))}</p>
        </div>
        """

        config_data = {
            "episode": self.selected_episode,
            "cast": self.cast_list,
            "storyline": self.storyline_data,
        }

        if not os.path.exists('config'):
            os.makedirs('config')
        now = datetime.datetime.now()
        filename = f'config/{now.strftime("%m-%d_%H-%M")}.json'
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=4)
            print(f"Config saved to {filename}")
        except Exception as e:
            print(f"Error saving config: {e}")

        if pn.state.notifications:
            pn.state.notifications.success(self._t("saved_notice"), duration=5000)

    def back_to_stage2(self, event):
        self.card3.collapsed = True
        self.card2.collapsed = False
        self.cast_selector.disabled = False
        self.cast_confirm_btn.disabled = False
        self.cast_back_btn.disabled = False


LANG = resolve_lang()
print(f"[Startup] config_app prompt language: {LANG}")

# Create Panel Server
app = pn.template.VanillaTemplate(title=UI_TEXTS[LANG]["app_title"])
config_component = ConfigPage()
app.main.append(config_component)
app.servable()
