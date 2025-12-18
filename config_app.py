import datetime
import json
import os
import re
import asyncio
import panel as pn
import param
from functools import partial

from server.llm_cache import cached_chat_create

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

.bk-input-group label, .bk-input-group span {
    font-size: 1.25em !important;
    line-height: 1.7 !important;
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
            placeholder="E.g., Ancient China, WWII, The French Revolution...",
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
        self._layout = pn.GridBox(
            self.card1,
            self.card2,
            self.card3,
            ncols=3,  # 指定3列
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
        
        # LLM Call
        prompt = f"""Based on the historical theme: "{self.selected_theme}", recommend 5 distinct "Episodes" (high-leverage historical moments).
Output ONLY JSON format:"""+"""
[
    {{"emoji": "⚔️", "title": "Storming of the Bastille", "desc": "The flashpoint of the revolution..."}},
    ...
]
Important: title must be concise and descriptive.
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
        
        prompt = f"""Create a historically grounded, linear Storyline as a JSON array of 4–6 nodes for the episode:
"{self.selected_episode['title']}"

Each node is a Decision Checkpoint (or a final Resolution) in a Storyline used for agent casting and later Scene Script expansion.

OUTPUT FORMAT (ONLY valid JSON, no extra text):"""+"""
[
  {"title": "...", "choice": "...", "desc": "..."},
  ...
]

FIELD REQUIREMENTS
- title: a concise dilemma/question for the Decision Checkpoint (< 10 words). Node 1 title MUST be the first checkpoint. The last node may be "Resolution: ..." (also concise).
- choice: the REAL-HISTORY canonical choice made for PREVIOUS checkpoint (very short, < 6 words, "None" for the first node), for visualization.
- desc: 3–5 sentences, historically coherent, multi-perspective, character-rich. Be concise and easy to read. NO MORE THAN 5 SENTENCES.

DESC RULES (cause → effect → next)
- Node 1 desc: background only (time/place/context + key figures/factions), ending by setting up Node 1 title. Do NOT reveal Node 1 choice here.
- Node i>1 desc: the FIRST sentence MUST answer the PREVIOUS title’s real-history choice. Then describe canonical consequences (chronology + tensions + named people), ending by setting up the CURRENT node title (or, if Resolution, the outcome).

CONTENT REQUIREMENTS
- Historical coherence: correct chronology, actors, locations; no anachronisms.
- Multi-perspective tension: at least two viewpoints each node (e.g., leaders vs advisors, allies vs opponents).
- Character richness: each desc names key figures (at least 2 per node; 4–8 across the storyline).
- No dialogue; no scene directions—only storyline-level narrative.

Return ONLY JSON."""
        try:
            nodes = await self.call_llm(prompt)
            self.storyline_data = nodes
            self.render_story_graph(nodes)
        except Exception as e:
            self.graph_container[:] = [f"Error: {str(e)}"]

    def render_story_graph(self, nodes):
        self.graph_container.clear()
        html_content = '<div style="padding: 10px;">'
        
        scenario_title = self.selected_episode.get('title', 'Scenario')

        for idx, node in enumerate(nodes):
            is_last = (idx == len(nodes) - 1)
            is_first = (idx == 0)
            last_class = "last-node" if is_last else ""
            
            # --- 1. 准备文本内容 ---

            # 卡片 Header (灰色小标题)
            if is_first:
                header_text = f"🟢 🚩 {scenario_title} START"
            else:
                header_text = f"🟢 ⚖️ Choice: {node.get('choice')}"

            # 卡片 Body (描述)
            body_text = node.get('desc')

            # 卡片 Footer (决策问题) - 最后一个节点没有
            footer_html = ""
            if not is_last:
                decision_question = node.get('title')
                footer_html = f"""
                <div class="node-decision">
                    🤔 Decision: {decision_question}
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
        self.cast_container[:] = [pn.Row(pn.indicators.LoadingSpinner(value=True, size=30), "Casting Agents & Observers...")]
        
        storyline_str = json.dumps(self.storyline_data, ensure_ascii=False)

        # 修改 Prompt 以请求两类角色
        prompt = f"""Based on the episode "{self.selected_episode['title']}" and the <storyline> provided, recommend characters for two distinct categories:

1. "protagonists": Historical figures/leaders with agency who make decisions affecting the graph.
2. "observers": Ordinary citizens, minor stakeholders, or witnesses who primarily experience the consequences (e.g., a merchant, a soldier's mother, a journalist).

<storyline>
{storyline_str}
</storyline>

REQUIREMENTS:
- Generate 2-5 characters for EACH category.
- For Observers, focus the description on what they see/feel/lose rather than political power.
- All characters must be historically grounded.
- Both name and title should be concise.

Output ONLY JSON format:"""+"""
{{
    "protagonists": [
        {{"name": "General LaFayette", "title": "Commander", "desc": "Controls the city guard...", "avatar": "👮"}},
        ...
    ],
    "observers": [
        {{"name": "Jean Valjean", "title": "Bread Thief", "desc": "Starving in the slums...", "avatar": "🥖"}},
        ...
    ]
}}
"""
        try:
            cast_data = await self.call_llm(prompt)
            self.full_cast_data = cast_data # 保存完整字典
            self.cast_data=cast_data.get('protagonists',[])
            self.render_cast(cast_data)
        except Exception as e:
            self.cast_container[:] = [f"Error: {str(e)}", pn.widgets.Button(name="Retry", on_click=lambda e: asyncio.create_task(self.generate_cast()))]

    # ==========================================
    # STAGE 3 UI: CAST SELECTION
    # ==========================================
    def render_cast(self, cast_data):
        self.cast_container.clear()
        
        # 1. 类别选择器 (互斥按钮组)
        self.category_selector = pn.widgets.RadioButtonGroup(
            name='Perspective Type',
            options=['Protagonists', 'Observers'], 
            value='Protagonists',
            button_type='primary',
            button_style='outline',
            sizing_mode='stretch_width'
        )

        # 2. 角色列表选择器 (RadioBoxGroup)
        self.cast_selector = pn.widgets.RadioBoxGroup(
            name='Select Character',
            inline=False,
            sizing_mode='stretch_width'
        )

        # 3. 详情展示区域
        self.cast_detail_view = pn.pane.Markdown(
            "",
            styles=description_style,
            sizing_mode='stretch_width'
        )

        # --- 内部逻辑方法 ---

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
            
        # B. 监听类别切换
        def on_category_change(event):
            update_list_by_category(event.new)
        
        self.category_selector.param.watch(on_category_change, 'value')

        # C. 监听角色切换 (更新详情)
        def on_character_change(event):
            selected_label = event.new
            if selected_label and selected_label in self.cast_map:
                char_data = self.cast_map[selected_label]
                # 区分显示不同类别的提示语
                role_type = self.category_selector.value
                prefix = "🎯 Decision Maker" if role_type == 'Protagonists' else "👁️ Historical Witness"
                
                self.cast_detail_view.object = f"**{prefix} Description:**\n\n{char_data.get('desc', '')}"
                self.cast_detail_view.styles = description_style # 恢复灰底

        self.cast_selector.param.watch(on_character_change, 'value')

        # 4. 初始化一次界面 (默认加载 Protagonists)
        update_list_by_category('Protagonists')

        # 5. 按钮组
        self.cast_confirm_btn = pn.widgets.Button(name='Confirm Character & Launch', button_type='success', sizing_mode='stretch_width')
        self.cast_confirm_btn.on_click(self.on_cast_confirm_click)

        self.cast_back_btn = pn.widgets.Button(name="Back to Storyline", button_type='default', sizing_mode='stretch_width')
        self.cast_back_btn.on_click(self.back_to_stage2)

        self.cast_reselect_btn = pn.widgets.Button(name='Reselect Character', button_type='warning', sizing_mode='stretch_width', visible=False)
        self.cast_reselect_btn.on_click(self.on_cast_reselect_click)

        # 6. 组装 UI
        self.cast_container.extend([
            pn.pane.Markdown("### Choose your Perspective:"),
            self.category_selector, 
            self.cast_selector,
            self.cast_detail_view,
            pn.Row(self.cast_confirm_btn, self.cast_back_btn, self.cast_reselect_btn, sizing_mode='stretch_width')
        ])

    def back_to_stage2(self, event):
        self.card3.collapsed = True
        self.card2.collapsed = False
        self.graph_actions.visible = True

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
            <h3 style="margin-top:0; color: #28a745;">✅ Role Selected</h3>
            <p><strong>Type:</strong> {role_category}</p>
            <p><strong>Name:</strong> {selected_label}</p>
            <p style="color: #666; margin-bottom:0;">{character_data.get('desc')}</p>
        </div>
        """
        self.cast_detail_view.object = highlight_html
        self.cast_detail_view.styles = {} 

        # 3. 准备 JSON (保存完整的 prompt output 以便系统后续使用其他 NPC)
        config_data = {
            "theme": self.selected_theme,
            "episode": self.selected_episode,
            "storyline": self.storyline_data,
            "cast_data": self.cast_data,
            "user_role": character_data
        }
        
        # 4. 保存
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

        if pn.state.notifications:
            pn.state.notifications.success('✅ You’re all set! Enter the VR space.', duration=5000)
    
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
            char_data = self.cast_map[selected_label]
            self.cast_detail_view.object = f"**Role Description:**\n\n{char_data.get('desc', '')}"
            self.cast_detail_view.styles = description_style

    # ==========================================
    # HELPER: LLM CALL (Based on your snippet)
    # ==========================================

    async def call_llm(self, user_prompt):
        messages = [
            {"role": "system", "content": "You are a helpful historical assistant. Output strictly in JSON format."},
            {"role": "user", "content": user_prompt}
        ]

        content = await cached_chat_create("gpt-5.2", messages, stream=False)
        
        # ... (后续解析 JSON 的逻辑保持不变) ...
        json_pattern = re.compile(r'```json\n(.*?)```', re.DOTALL)
        json_match = json_pattern.search(content)
        
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = content
            
        return json.loads(json_str)

# Create Panel Server
app = pn.template.VanillaTemplate(title='ChronoFork · Configuration')
config_component = ConfigPage()
app.main.append(config_component)
app.servable()