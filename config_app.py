import datetime
import json
import os
import time
import re
import asyncio
from autogen_core import CancellationToken
import panel as pn
import param
from dataclasses import dataclass
from autogen_agentchat.messages import TextMessage
from functools import partial

import global_vars


# CSS for the Timeline Graph and General Styling
css = """
.story-node {
    display: flex;
    align-items: flex-start;
    margin-bottom: 0px;
}
.node-visual {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-right: 15px;
    min-width: 30px;
}
.node-circle {
    width: 20px;
    height: 20px;
    background-color: #28a745; /* Green */
    border-radius: 50%;
    margin-top: 5px;
    box-shadow: 0 0 5px rgba(0,0,0,0.2);
}
.node-line {
    width: 3px;
    height: 60px;
    background-color: #e0e0e0;
    margin-top: 5px;
}
.last-node .node-line {
    display: none;
}
.node-content {
    background: #f9f9f9;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #eee;
    width: 100%;
    margin-bottom: 10px;
    font-size: 1.05em;
}
.node-title {
    font-weight: bold;
    font-size: 1.15em;
}
.highlight-card {
    border: 2px solid #28a745 !important;
    background-color: #f0fff4 !important;
}

.bk-input-group label, .bk-input-group span {
    font-size: 1.2em !important;
    line-height: 1.65 !important;
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

description_style={'background': '#f5f5f5', 'padding': '10px', 'border-radius': '8px', 'font-size': '1.1em'}

pn.extension(raw_css=[css],notifications=True)

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
        self._init_ui()

    def _init_ui(self):
        # --- STAGE 1: THEME & EPISODES ---
        self.theme_input = pn.widgets.TextAreaInput(
            placeholder="E.g., The French Revolution (1789), focusing on the perspective of the commoners...",
            height=100, sizing_mode='stretch_width'
        )
        self.theme_confirm_btn = pn.widgets.Button(name='Analyze Theme', button_type='primary', sizing_mode='stretch_width')
        self.theme_confirm_btn.on_click(partial(self.on_theme_confirm))
        
        self.episode_list_col = pn.Column() # Container for generated episode buttons
        
        self.card1_content = pn.Column(
            "### 1.1 Theme Input",
            self.theme_input,
            self.theme_confirm_btn,
            self.episode_list_col
        )
        self.card1 = pn.Card(self.card1_content, title='Stage 1: Configuration', sizing_mode='stretch_width', collapsed=False,margin=(0, 10, 0, 0))

        # --- STAGE 2: STORYLINE ---
        self.graph_container = pn.Column("Please select an episode in Stage 1.")
        
        self.card2_content = pn.Column(
            self.graph_container,
        )
        self.card2 = pn.Card(self.card2_content, title='Stage 2: Storyline', sizing_mode='stretch_width', collapsed=True,margin=(0, 10, 0, 0))

        # --- STAGE 3: CAST ---
        self.cast_container = pn.Column("Please confirm storyline in Stage 2.")
        
        self.card3_content = pn.Column(
            self.cast_container
        )
        self.card3 = pn.Card(self.card3_content, title='Stage 3: Cast & Perspective', sizing_mode='stretch_width', collapsed=True)

        # Layout
        self._layout = pn.Row(
            self.card1,
            self.card2,
            self.card3,
            sizing_mode='stretch_width'
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
            pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), "Retrieving Historical Episodes...")
        ]

        print(f"Generating episodes for theme: {self.selected_theme}")
        
        # LLM Call
        prompt = f"""
        Based on the historical theme: "{self.selected_theme}", recommend 5 distinct "Episodes" (high-leverage historical moments).
        Output ONLY JSON format:
        [
            {{"emoji": "⚔️", "title": "Storming of the Bastille", "desc": "The flashpoint of the revolution..."}},
            ...
        ]
        """
        try:
            response_data = await self.call_llm(prompt)
            self.episode_list=response_data
            self.render_episodes(response_data)
        except Exception as e:
            self.episode_list_col[:] = [f"Error: {str(e)}", pn.widgets.Button(name="Retry", on_click=partial(self.on_theme_confirm))]
            self.theme_confirm_btn.disabled = False

    def render_episodes(self, episodes):
        self.episode_list_col.clear()
        
        # 1. 构建映射和选项
        self.episode_map = {f"{ep.get('emoji','')} {ep.get('title','')}": ep for ep in episodes}
        options_labels = list(self.episode_map.keys())

        # 2. 单选组件
        self.episode_selector = pn.widgets.RadioBoxGroup(
            name='Select Episode',
            options=options_labels,
            value=options_labels[0],
            inline=False,
            sizing_mode='stretch_width'
        )

        # 3. 详情展示区域 (初始状态)
        first_ep = self.episode_map[options_labels[0]]
        self.episode_detail_view = pn.pane.Markdown(
            f"**Description:**\n\n{first_ep.get('desc', '')}",
            styles=description_style,
            sizing_mode='stretch_width'
        )

        # 监听切换
        def update_details(event):
            selected_label = event.new
            ep_data = self.episode_map[selected_label]
            self.episode_detail_view.object = f"**Description:**\n\n{ep_data.get('desc', '')}"
            # 恢复灰色背景（防止之前被改成了绿色）
            self.episode_detail_view.styles = description_style
        
        self.episode_selector.param.watch(update_details, 'value')

        # 4. 按钮组 (Confirm 和 Redo)
        self.ep_confirm_btn = pn.widgets.Button(name='Confirm Selection', button_type='primary', sizing_mode='stretch_width')
        self.ep_confirm_btn.on_click(self.on_episode_confirm_click)

        self.ep_redo_btn = pn.widgets.Button(name='Back to Theme', sizing_mode='stretch_width')
        self.ep_redo_btn.on_click(self.on_reset_theme_click)

        self.ep_buttons_row = pn.Row(self.ep_confirm_btn, self.ep_redo_btn, sizing_mode='stretch_width')

        # 5. 组装
        self.episode_list_col.extend([
            pn.pane.Markdown("### Select an Episode:"),
            self.episode_selector,
            self.episode_detail_view,
            self.ep_buttons_row
        ])

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
            <h3 style="margin-top:0; color: #28a745;">✅ Episode Selected</h3>
            <p><strong>{selected_label}</strong></p>
            <p style="color: #666; margin-bottom:0; ">{episode_data.get('desc')}</p>
        </div>
        """
        # 替换 Markdown 内容为 HTML 样式
        self.episode_detail_view.object = highlight_html
        self.episode_detail_view.styles = {} # 清除之前的灰色背景style，使用HTML内部的style
        
        # 4. 激活 Stage 2
        self.selected_episode = episode_data
        self.card2.collapsed = False
        await self.generate_storyline()



    # ==========================================
    # STAGE 2 LOGIC: EPISODE -> STORYLINE
    # ==========================================
    async def generate_storyline(self):
        self.graph_container[:] = [pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), "Constructing Story Graph...")]
        
        prompt = f"""Create a historically grounded, linear storyline (4-6 key nodes) for the episode: "{self.selected_episode['title']}".
        
IMPORTANT Requirements:
- Multi-perspective tension: Events should involve MULTIPLE perspectives (e.g., conflicting groups, negotiation, trade-offs) to justify a Multi-Agent simulation.
- Historical coherence: Keep chronology consistent, avoid anachronisms, and align locations/actors with FACTS.
        
Output ONLY JSON format:
[
    {{"title": "Start", "desc": "Facilitator sets the scene...", "type": "facilitator"}},
    {{"title": "The Dilemma", "desc": "Faction A demands X while Faction B refuses...", "type": "event"}},
    ...
]"""
        try:
            nodes = await self.call_llm(prompt)
            self.storyline_data = nodes
            self.render_story_graph(nodes)
        except Exception as e:
            self.graph_container[:] = [f"Error: {str(e)}"]

    def render_story_graph(self, nodes):
        self.graph_container.clear()
        html_content = '<div style="padding: 10px;">'
        
        for idx, node in enumerate(nodes):
            is_last = (idx == len(nodes) - 1)
            last_class = "last-node" if is_last else ""
            
            html_content += f"""
            <div class="story-node {last_class}">
                <div class="node-visual">
                    <div class="node-circle"></div>
                    <div class="node-line"></div>
                </div>
                <div class="node-content">
                    <div class="node-title">{node.get('title')}</div>
                    <div>{node.get('desc')}</div>
                </div>
            </div>
            """
        html_content += '</div>'
        
        self.graph_container.append(pn.pane.HTML(html_content, sizing_mode='stretch_width'))
        
        # Setup Footer Buttons
        self.confirm_btn = pn.widgets.Button(name="Confirm Storyline", button_type='success', sizing_mode='stretch_width')
        self.confirm_btn.on_click(partial(self.on_storyline_confirm))
        
        self.back_btn = pn.widgets.Button(name="Back to Episodes", sizing_mode='stretch_width')
        self.back_btn.on_click(partial(self.back_to_stage1))
        
        self.graph_container.append(pn.Row(self.confirm_btn, self.back_btn, sizing_mode='stretch_width'))

    async def on_storyline_confirm(self, event):
        self.confirm_btn.disabled = True
        self.back_btn.disabled = True
        self.graph_container.append(pn.pane.HTML(f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0; color: #28a745;">✅ Storyline Confirmed</h3>
            <p style="color: #666; margin-bottom:0;">With {len(self.storyline_data)} storyline nodes</p>
        </div>
        """, sizing_mode='stretch_width'))
        # Activate Stage 3
        self.card3.collapsed = False
        await self.generate_cast()
        
    async def back_to_stage1(self, event):
        self.card2.collapsed = True
        self.card1.collapsed = False
        # Reset Stage 1 UI to selection mode (simple reload of list or regeneration)
        # For simplicity, we just re-enable the theme button to allow restart or re-render list
        await self.render_episodes(self.episode_list) # Re-trigger list generation logic or cached list

    # ==========================================
    # STAGE 3 LOGIC: STORYLINE -> CAST
    # ==========================================
    async def generate_cast(self):
        self.cast_container[:] = [pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), "Casting Agents...")]
        
        # 将 Storyline 转为字符串嵌入 Prompt
        storyline_str = json.dumps(self.storyline_data, ensure_ascii=False)

        prompt = f"""Based on the episode "{self.selected_episode['title']}" and the <storyline> provided below, recommend 3-5 key characters (Agents) for the user to play or interact with.

<storyline>
{storyline_str}
</storyline>

REQUIREMENTS:
- Historical grounding: Prefer real historical figures/groups.
- Direct involvement: Each CharacterAgent must be directly involved in at least one storyline node; cite which nodes.
- Distinct perspectives: Each CharacterAgent must have a clearly different stake and constraints (goals, fears, power, dependencies).
- Multi-agent justification: Ensure the cast spans competing factions/roles (e.g., authority, opposition, civilian, mediator) to enable negotiation/trade-offs.

Output ONLY JSON format:
[
    {{"name": "General LaFayette", "title": "Commander", "desc": "Torn between duty and the people, he controls the city guard mentioned in node 3.", "avatar": "👮"}},
    ...
]
"""
        try:
            cast = await self.call_llm(prompt)
            self.cast_list = cast
            self.render_cast(cast)
        except Exception as e:
            self.cast_container[:] = [f"Error: {str(e)}"]

    # ==========================================
    # STAGE 3 UI: CAST SELECTION
    # ==========================================
    def render_cast(self, cast_list):
        self.cast_container.clear()
        
        # 1. 构建映射字典
        self.cast_map = {f"{char.get('avatar','👤')} {char.get('name')} - {char.get('title')}": char for char in cast_list}
        options_labels = list(self.cast_map.keys())

        # 2. 创建单选组件
        self.cast_selector = pn.widgets.RadioBoxGroup(
            name='Select Character',
            options=options_labels,
            value=options_labels[0],
            inline=False,
            sizing_mode='stretch_width'
        )

        # 3. 创建详情展示区域 (初始显示第一个)
        first_char = self.cast_map[options_labels[0]]
        self.cast_detail_view = pn.pane.Markdown(
            f"**Role Description:**\n\n{first_char.get('desc', '')}",
            styles=description_style,
            sizing_mode='stretch_width'
        )

        # 4. 绑定事件：选项切换时更新详情
        def update_cast_details(event):
            selected_label = event.new
            char_data = self.cast_map[selected_label]
            self.cast_detail_view.object = f"**Role Description:**\n\n{char_data.get('desc', '')}"
            # 恢复灰色背景（防止重置时保留了绿色）
            self.cast_detail_view.styles =description_style
        
        self.cast_selector.param.watch(update_cast_details, 'value')

        # 5. 按钮组
        self.cast_confirm_btn = pn.widgets.Button(name='Confirm Character & Launch', button_type='success', sizing_mode='stretch_width')
        self.cast_confirm_btn.on_click(self.on_cast_confirm_click)

        self.cast_back_btn = pn.widgets.Button(name="Back to Storyline", button_type='default', sizing_mode='stretch_width')
        self.cast_back_btn.on_click(self.back_to_stage2)

        # 新增：Reselect 按钮 (初始隐藏)
        self.cast_reselect_btn = pn.widgets.Button(name='Reselect Character', button_type='warning', sizing_mode='stretch_width', visible=False)
        self.cast_reselect_btn.on_click(self.on_cast_reselect_click)

        # 6. 组装 UI
        self.cast_container.extend([
            pn.pane.Markdown("### Choose your Perspective:"),
            self.cast_selector,
            self.cast_detail_view,
            pn.Row(self.cast_confirm_btn, self.cast_back_btn,self.cast_reselect_btn, sizing_mode='stretch_width')
        ])

    def back_to_stage2(self, event):
        self.card3.collapsed = True
        self.card2.collapsed = False
        self.render_story_graph(self.storyline_data)

    async def on_cast_confirm_click(self, event):
        selected_label = self.cast_selector.value
        character_data = self.cast_map[selected_label]
        self.selected_character = character_data['name']
        
        # 1. 冻结 UI (交互锁定)
        self.cast_selector.disabled = True
        self.cast_confirm_btn.visible = False   # 隐藏 Confirm
        self.cast_back_btn.visible = False      # 隐藏 Back
        self.cast_reselect_btn.visible = True   # 显示 Reselect
        
        # 2. 更新详情框为高亮样式 (Green Highlight)
        highlight_html = f"""
        <div style="background-color: #f0fff4; border: 2px solid #28a745; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top:0; color: #28a745;">✅ Role Selected</h3>
            <p><strong>Role:</strong> {selected_label}</p>
            <p style="color: #666; margin-bottom:0;">{character_data.get('desc')}</p>
        </div>
        """
        self.cast_detail_view.object = highlight_html
        self.cast_detail_view.styles = {} # 清除之前的 style，使用 HTML 内联样式

        # 3. 准备 JSON 数据
        config_data = {
            "theme": self.selected_theme,
            "episode": self.selected_episode,
            "storyline": self.storyline_data,
            "full_cast": self.cast_list,       # 所有的角色列表
            "user_role": self.selected_character # 用户选中的角色
        }
        
        # 4. 保存文件
        # 确保 config 文件夹存在
        if not os.path.exists('config'):
            os.makedirs('config')
        now = datetime.datetime.now()
        date_str = now.strftime("%m-%d@%H_%M")
        filename = f'config/session_{date_str}.json'
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=4)
            print(f"Config saved to {filename}")
        except Exception as e:
            print(f"Error saving config: {e}")

        # 5. 显示成功通知
        if pn.state.notifications:
            pn.state.notifications.success('✅ You’re all set! Enter the VR space to experience your episode.', duration=5000)
    
    # 新增：Reselect 按钮回调
    def on_cast_reselect_click(self, event):
        # 1. 解锁选择器
        self.cast_selector.disabled = False
        
        # 2. 按钮状态复原
        self.cast_reselect_btn.visible = False  # 隐藏 Reselect
        self.cast_confirm_btn.visible = True    # 显示 Confirm
        self.cast_back_btn.visible = True       # 显示 Back
        
        # 3. 恢复详情框为当前选中项的普通描述
        selected_label = self.cast_selector.value
        char_data = self.cast_map[selected_label]
        
        self.cast_detail_view.object = f"**Role Description:**\n\n{char_data.get('desc', '')}"
        self.cast_detail_view.styles = description_style

    # ==========================================
    # HELPER: LLM CALL (Based on your snippet)
    # ==========================================
    async def call_llm(self, user_prompt):
        # Cancellation token as per your snippet
        cancellation_token = CancellationToken()
        
        # Construct the message payload
        raw_response = await global_vars.global_assistant.on_messages(
            [TextMessage(source='user', content=user_prompt)],
            cancellation_token=cancellation_token
        )
        
        # Parse JSON
        content = raw_response.chat_message.content
        json_pattern = re.compile(r'```json\n(.*?)```', re.DOTALL)
        json_match = json_pattern.search(content)
        
        if json_match:
            json_str = json_match.group(1)
        else:
            # Fallback if no code blocks
            json_str = content
            
        return json.loads(json_str)

# ==========================================
# APP LAUNCH
# ==========================================
# Create Panel Server
app = pn.template.VanillaTemplate(title='ChronoFork · Configuration')
config_component = ConfigPage()
app.main.append(config_component)
app.servable()