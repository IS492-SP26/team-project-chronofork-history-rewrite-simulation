import panel as pn
import holoviews as hv
import networkx as nx
from holoviews import opts, streams
from bokeh.palettes import Category10_10
from bokeh.models import HoverTool

from server.story_engine import StoryEngine

# 初始化
pn.extension()
hv.extension('bokeh')

# ==========================================
# PART 2: Frontend (StoryDashboard)
# ==========================================

def graph_hover_hook(plot, element):
    plot_state = plot.state
    graph_renderer = next((r for r in plot_state.renderers if hasattr(r, 'node_renderer')), None)
    if not graph_renderer: return
    for tool in plot_state.toolbar.tools:
        if isinstance(tool, HoverTool):
            tool.renderers = [graph_renderer.node_renderer]

class StoryDashboard:
    def __init__(self):
        # 1. Prepare Data
        json_data = [
{"title":"Respond to Soviet Missiles?","choice":"None","desc":"In October 1962, U.S. reconnaissance revealed Soviet nuclear missiles being installed in Cuba, only 90 miles from Florida. President John F. Kennedy convened the Executive Committee (ExComm), weighing military, diplomatic, and political risks under intense Cold War pressure. Soviet leader Nikita Khrushchev sought to alter the strategic balance, while Fidel Castro viewed the missiles as protection after the Bay of Pigs. With allies anxious and nuclear war imaginable, Washington faced a stark question: Respond to Soviet Missiles?"},
{"title":"Airstrike or Blockade?","choice":"Confront threat","desc":"Kennedy chose to respond decisively to the Soviet missiles. ExComm debated an immediate airstrike advocated by generals like Curtis LeMay versus a naval blockade urged by Robert McNamara and others to control escalation. Khrushchev watched for signs of U.S. aggression while Castro prepared for invasion. The administration now had to decide between forceful options, setting up the dilemma: Airstrike or Blockade?"},
{"title":"Escalate or Negotiate?","choice":"Naval quarantine","desc":"Kennedy ordered a naval quarantine of Cuba rather than an airstrike. U.S. Navy ships intercepted Soviet vessels as the world watched, while Khrushchev publicly denounced the move and weighed whether to challenge it. Behind the scenes, UN Secretary-General U Thant urged restraint, and Moscow and Washington tested each other’s resolve. As tensions peaked, leaders faced the next question: Escalate or Negotiate?"},
{"title":"Accept Secret Deal?","choice":"Pursue negotiations","desc":"Both leaders pursued negotiation through letters and backchannels. Khrushchev sent messages offering to withdraw missiles in exchange for a U.S. non-invasion pledge, while a second letter raised the issue of U.S. Jupiter missiles in Turkey. Robert Kennedy met secretly with Soviet ambassador Anatoly Dobrynin to clarify terms, excluding public allies and Castro. The crisis narrowed to a final decision: Accept Secret Deal?"},
{"title":"Resolution: Missiles Withdrawn","choice":"Accept secret trade","desc":"Kennedy accepted a secret trade removing U.S. missiles from Turkey while publicly pledging not to invade Cuba. Khrushchev announced the withdrawal of Soviet missiles from Cuba, averting nuclear war and claiming peace preserved. Castro felt sidelined and distrustful, while both superpowers reassessed crisis management. The Cuban Missile Crisis ended with de-escalation, leading to the hotline agreement and a fragile recalibration of Cold War relations."}
]
        
        # 2. Init Engine
        self.engine = StoryEngine(json_data)
        
        # UI State
        self.user_selected_node = "None"
        
        # UI Components
        self.input_choice = pn.widgets.TextInput(name='Decision (Edge Label)', placeholder='e.g. Yield')
        self.input_title = pn.widgets.TextInput(name='New Branch Title', placeholder='e.g. Fight Back')
        self.input_desc = pn.widgets.TextAreaInput(name='Description', height=60)
        self.input_msg = pn.widgets.TextInput(name='Add Message', placeholder='User says...')
        
        self.btn_start = pn.widgets.Button(name='▶ Start Story', button_type='success')
        self.btn_next = pn.widgets.Button(name='⬇ Next Node', button_type='primary')
        self.btn_msg = pn.widgets.Button(name='💬 Send', width=60)
        self.btn_branch = pn.widgets.Button(name='⚡ Diverge History', button_type='warning')
        self.btn_backtrack = pn.widgets.Button(name='↩ Backtrack Here', button_type='danger')
        self.btn_ctx = pn.widgets.Button(name='📜 Get Story Context (JSON)', button_type='light')
        self.btn_msgs = pn.widgets.Button(name='💬 Get Path Messages', button_type='light')
        
        # Bindings
        self.btn_start.on_click(self.on_start)
        self.btn_next.on_click(self.on_next)
        self.btn_msg.on_click(self.on_msg)
        self.btn_branch.on_click(self.on_branch)
        self.btn_backtrack.on_click(self.on_backtrack)
        self.btn_ctx.on_click(self.on_get_context)
        self.btn_msgs.on_click(self.on_get_messages)
        
        # Views
        self.details_area = pn.Column()
        self.tap_stream = streams.Tap(x=None, y=None)
        self.graph_pane = pn.pane.HoloViews(sizing_mode="stretch_both")
        
        # Initial Render
        self.render_graph()
        self.update_details()

    def render_graph(self, draw_select=False, *events):
        # Access Data via Snapshot
        G, pos, edge_label_data, active_id, current_path = self.engine.get_graph_snapshot()
        
        if not draw_select:
            self.user_selected_node = "None"
            
        for nid, data in G.nodes(data=True):
            depth, variant = map(int, nid.split('.'))
            status = data['status'] 
            
            # Styles
            base_color = Category10_10[(variant + 2) % 10]
            final_color, line_color, line_width = base_color, 'white', 1
            
            if depth == 0:
                final_color = "#141414"; label_text = "Start"
            elif status == "IN_PROGRESS":
                final_color = base_color; line_color = '#FFD700'; line_width = 4
            elif status == "COMPLETED":
                final_color = base_color; line_color = "#00FF04A9"; line_width = 4
            elif status == "SUSPENDED":
                final_color = base_color; line_color = "#313131"; line_width = 4
            elif status == "UNFINISHED":
                final_color = base_color; line_color = "#900000"; line_width = 4
            
            if nid == self.user_selected_node:
                line_color = '#FF00FF'; line_width = 6
                
            if depth != 0:
                emoji = {"IN_PROGRESS": "▶️", "COMPLETED": "✅", "SUSPENDED": "⏸️", "UNFINISHED": "🔒"}.get(status, "")
                label_text = f"{emoji} {nid}"
        

            G.nodes[nid].update({
                'label_id': label_text, 
                'status_label': status,
                'final_color': final_color,
                'line_color': line_color, 
                'line_width': line_width
            })

        # Plotting
        hover = HoverTool(tooltips="""
            <div style="font-family: sans-serif; max-width: 300px; white-space: normal; word-wrap: break-word;">
                <b>@hover_title</b> (@status_label)<br>
                <div style="font-size: 12px; margin-top: 5px; line-height: 1.2;">@hover_desc</div>
            </div>
        """)
        
        graph = hv.Graph.from_networkx(G, pos).opts(
            opts.Graph(
                node_size=50, 
                node_color='final_color', 
                node_line_color='line_color', 
                node_line_width='line_width',
                node_selection_fill_color=None, 
                node_selection_line_color=None, 
                node_nonselection_alpha=1.0,
                node_hover_fill_color=None, 
                node_hover_line_color='#FF00FF',
                       
                edge_color='gray', 
                edge_alpha=0.5, tools=[hover, 'tap'], 
                toolbar=None,
                xaxis=None, 
                yaxis=None, 
                title=f"Path: {' -> '.join(current_path)}", hooks=[graph_hover_hook])
        )
        
        # Labels
        labels_id = hv.Labels({
            'x': [pos[n][0] for n in G],
            'y': [pos[n][1] for n in G], 
            'text': [G.nodes[n]['label_id'] for n in G]}, ['x','y'], 'text').opts(
                text_color='white', yoffset=0, text_font_size='9pt', text_font_style='bold')

        labels_title = hv.Labels({
            'x': [pos[n][0] for n in G], 
            'y': [pos[n][1] for n in G], 
            'text': [f"{G.nodes[n]['hover_title']}\n\n" if G.nodes[n]['label_id']!="Start" else "" for n in G]}, ['x','y'], 'text').opts(
                text_color='#333', yoffset=0, text_baseline='bottom', text_font_size='8pt', text_font_style='bold')

        labels_edge = hv.Labels({
            'x': [i['x'] for i in edge_label_data], 
            'y': [i['y'] for i in edge_label_data], 
            'text': [f"{i['text']}\n" if i['text']!="None" else "" for i in edge_label_data]}, ['x','y'], 'text').opts(
                text_color='#222', text_alpha=0.8, text_font_size='9pt')

        self.tap_stream.source = graph
        self.tap_stream.add_subscriber(self.on_click)
        self.graph_pane.object = (graph * labels_id * labels_title * labels_edge)


    def on_click(self, x, y):
        if x is None: return
        G, pos, _, _, _ = self.engine.get_graph_snapshot()
        closest, min_dist = None, 0.2
        for nid, (nx, ny) in pos.items():
            dist = (nx-x)**2 + (ny-y)**2
            if dist < min_dist: min_dist=dist; closest=nid
        
        if closest:
            # Check status from graph node data
            status = G.nodes[closest]['status'] or closest != "0.0"
            if status in ["UNFINISHED", "IN_PROGRESS"]:
                print("🚫 Selection Denied")
                self.render_graph()
            else:
                self.user_selected_node = closest
                self.render_graph(draw_select=True)
                self.update_details()

    def update_details(self):
        active_id = self.engine._current_node_id
        target = self.user_selected_node if self.user_selected_node != "None" else active_id
        
        controls = pn.Column(
            f"## 📍 Selected: {target}",
            pn.layout.Divider(),
            "### Operations",
            self.btn_start, self.btn_next, self.btn_backtrack,
            pn.layout.Divider(),
            "### Branching (Define JSON)",
            self.input_choice, self.input_title, self.input_desc, self.btn_branch,
            pn.layout.Divider(),
            "### Chat",
            self.input_msg, self.btn_msg,
            pn.layout.Divider(),
            "### Data Retrieval",
            self.btn_ctx, self.btn_msgs
        )
        self.details_area.objects = [controls]

    # --- Actions mapped to Engine API ---
    def on_start(self, e): 
        self.engine.start_story()
        self.update_view()

    def on_next(self, e): 
        self.engine.move_next()
        self.update_view()

    def on_msg(self, e):
        if self.input_msg.value:
            self.engine.add_message("User", "System", self.input_msg.value)
            self.input_msg.value = ""
            self.update_view()

    def on_branch(self, e):
        if self.input_title.value and self.input_choice.value:
            # Construct JSON List as required by API
            branch_data = [{
                "title": self.input_title.value,
                "choice": self.input_choice.value,
                "desc": self.input_desc.value or "User Branch"
            },{
                "title": "Resolution: TBD",
                "choice": "TBD",
                "desc": "To be continued..."
            },{
                "title": "Resolution: TBD",
                "choice": "TBD",
                "desc": "To be continued..."
            },{
                "title": "Resolution: TBD",
                "choice": "TBD",
                "desc": "To be continued..."
            }]
            self.engine.alternative_branch(branch_data)
            self.input_title.value = ""; self.input_choice.value = ""; self.input_desc.value = ""
            self.update_view()

    def on_backtrack(self, e):
        if self.user_selected_node != "None":
            self.engine.backtrack_to(self.user_selected_node)
            self.user_selected_node = "None"
            self.update_view()

    def on_get_context(self, e):
        # API Call
        json_str = self.engine.get_story_context()
        self.show_modal(f"### Story Context (JSON)\n```json\n{json_str}\n```")

    def on_get_messages(self, e):
        # API Call
        msgs = self.engine.get_context_messages()
        txt = "\n".join([f"- **{m['role']}**: {m['content']}" for m in msgs])
        self.show_modal(f"### Context Messages\n{txt}")

    def show_modal(self, content):
        self.details_area.objects = [pn.Column(
            pn.pane.Markdown(content, height=400, sizing_mode="stretch_width"),
            pn.widgets.Button(name="Close", on_click=lambda x: self.update_details())
        )]

    def update_view(self):
        self.render_graph()
        self.update_details()

    def view(self):
        return pn.Row(
            pn.Card(self.graph_pane, title="Story Engine Viz", sizing_mode="stretch_both", min_height=600),
            pn.Card(self.details_area, title="Control Panel", width=400, sizing_mode="fixed")
        )

d = StoryDashboard()
d.view().servable()