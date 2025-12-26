import json
import panel as pn
import holoviews as hv
import networkx as nx
from holoviews import opts, streams
from bokeh.palettes import Category10_10
from bokeh.models import HoverTool
from panel.viewable import Viewer

pn.extension()
hv.extension("bokeh")


def graph_hover_hook(plot, element):
    plot_state = plot.state
    graph_renderer = next(
        (r for r in plot_state.renderers if hasattr(r, "node_renderer")), None
    )
    if not graph_renderer:
        return
    for tool in plot_state.toolbar.tools:
        if isinstance(tool, HoverTool):
            tool.renderers = [graph_renderer.node_renderer]


class StoryGraph(Viewer):
    def __init__(self, send_callback, on_select_callback, **params):
        """
        :param send_callback: function(msg_type, msg_data) 用于向后端发送请求
        """
        super().__init__(**params)
        self.send_callback = send_callback
        self.on_select_callback = on_select_callback

        self.stage = 1  # 当前阶段，默认1
        # 1. 初始化 Stream
        self.tap_stream = streams.Tap(x=None, y=None)

        self.cached_payload = None
        self.user_selected_node = "None"

        self.graph_pane = pn.pane.HoloViews(
            hv.Text(0.5, 0.5, "Waiting for Story...").opts(xaxis=None, yaxis=None),
            sizing_mode="stretch_both",
            min_width=350,
        )

        self.backtrack_tip = pn.pane.Markdown(
            "ℹ️ Select a completed or suspended node to backtrack that decision.",
            styles={"font-size": "1.1em"},
            sizing_mode="stretch_width",  # 让文字占满剩余空间
            align="center",  # 【关键】垂直方向居中
            margin=(0, 0, 0, 10),  # 统一一点边距
        )

        self.backtrack_btn = pn.widgets.Button(
            name="🚫 To Select",
            button_type="danger",
            disabled=True,
            visible=True,
            width=80,  # 给定一个合适的固定宽度
            align="center",  # 【关键】垂直方向居中
            margin=(0, 30, 0, 3),  # 统一边距
        )

        self.backtrack_btn.on_click(self.on_backtrack)

        self.backtrack_group = pn.Row(
            self.backtrack_tip,
            self.backtrack_btn,
            sizing_mode="stretch_width",
            styles={
                "background": "#f0f0f5",
                "margin": "-5px 10px 5px 10px",  # 简写 margin (上 右 下 左)
                "border-radius": "5px",
                "border-left": "5px solid #6c757d",
                "align-items": "center",  # 【CSS关键】确保 Row 内部元素垂直居中
            },
            visible=False,
        )

        self._layout = pn.Card(
            pn.Column(
                self.graph_pane,
                self.backtrack_group,
                sizing_mode="stretch_both",
            ),
            title="🎯 Story Graph",
            collapsible=False,
            sizing_mode="stretch_both",
        )

    def __panel__(self):
        return self._layout
    

    def set_stage_mode(self, stage):
        self.current_stage = stage
        if stage == 1:
            self.backtrack_group.visible = False
        elif stage == 2:
            self.backtrack_group.visible = True

    def update_graph(self, payload):
        """接收后端 Graph 数据并刷新视图"""
        # 兼容处理：如果 payload 是 JSON 字符串则解析，如果是字典则直接用
        if isinstance(payload, str):
            try:
                self.cached_payload = json.loads(payload)
            except json.JSONDecodeError:
                print("Error: Invalid JSON string received")
                return
        else:
            self.cached_payload = payload

        self._change_backtrack_button_state(None)

        self.on_select_callback(False)
        self._render(self.cached_payload)

    def _fetch_and_decode_graph(self, data):
        """从字典数据还原 NetworkX 对象"""
        try:
            G = nx.DiGraph()
            # 还原节点
            for node_data in data.get("nodes", []):
                # copy防止修改原始缓存
                nd = node_data.copy()
                nid = nd.pop("id")
                G.add_node(nid, **nd)

            # 还原边
            G.add_edges_from(data.get("edges", []))

            # 还原 pos (JSON list [x,y] -> tuple (x,y))
            # 必须转 tuple，否则 NetworkX/HoloViews 可能会有布局问题
            raw_pos = data.get("pos", {})
            pos = {k: tuple(v) for k, v in raw_pos.items()}

            return (
                G,
                pos,
                data.get("edge_label_data", []),
                data.get("active_id", "0.0"),
                data.get("current_path", []),
            )
        except Exception as e:
            print(f"Error decoding graph data: {e}")
            return nx.DiGraph(), {}, [], "None", []
    
    def _change_backtrack_button_state(self, nodeid=None):
        if nodeid is None:
            self.backtrack_btn.name = "🚫 To Select"
            self.backtrack_btn.button_type = "danger"
            self.backtrack_btn.disabled = True
            self.user_selected_node = "None"
        else:
            self.backtrack_btn.name = f"🔄 Backtrack"
            self.backtrack_btn.button_type = "success"
            self.backtrack_btn.disabled = False
            self.user_selected_node = nodeid

    def _render(self, payload, draw_select=False):
        G, pos, edge_label_data, active_id, current_path = self._fetch_and_decode_graph(
            payload
        )

        if not draw_select:
            self.user_selected_node = "None"

        for nid, data in G.nodes(data=True):
            # 防御性编程：确保 ID 格式正确
            if "." not in nid:
                continue

            depth, variant = map(int, nid.split("."))
            status = data.get("status", "UNFINISHED")

            # Styles
            base_color = Category10_10[(variant + 2) % 10]
            final_color, line_color, line_width = base_color, "white", 1

            if depth == 0:
                final_color = "#141414"
                label_text = "Start"
            elif status == "IN_PROGRESS":
                final_color = base_color
                line_color = "#FFD700"
                line_width = 4
            elif status == "COMPLETED":
                final_color = base_color
                line_color = "#00FF04A9"
                line_width = 4
            elif status == "SUSPENDED":
                final_color = base_color
                line_color = "#313131"
                line_width = 4
            elif status == "UNFINISHED":
                final_color = base_color
                line_color = "#900000"
                line_width = 4

            if nid == self.user_selected_node:
                line_color = "#FF00FF"
                line_width = 6

            if depth != 0:
                emoji = {
                    "IN_PROGRESS": "▶️",
                    "COMPLETED": "✅",
                    "SUSPENDED": "⏸️",
                    "UNFINISHED": "🔒",
                }.get(status, "")
                label_text = f"{emoji} {nid}"

            G.nodes[nid].update(
                {
                    "label_id": label_text,
                    "status_label": status,
                    "final_color": final_color,
                    "line_color": line_color,
                    "line_width": line_width,
                    "hover_title": data.get("hover_title", ""),
                    "hover_desc": data.get("hover_desc", ""),
                }
            )

        # Plotting
        hover = HoverTool(
            tooltips="""
            <div style="font-family: sans-serif; max-width: 300px; white-space: normal; word-wrap: break-word;">
                <b>@hover_title</b> (@status_label)<br>
                <div style="font-size: 12px; margin-top: 5px; line-height: 1.2;">@hover_desc</div>
            </div>
        """
        )

        graph = hv.Graph.from_networkx(G, pos).opts(
            opts.Graph(
                node_size=50,
                node_color="final_color",
                node_line_color="line_color",
                node_line_width="line_width",
                node_selection_fill_color=None,
                node_selection_line_color=None,
                node_nonselection_alpha=1.0,
                node_nonselection_fill_color="final_color",
                node_nonselection_line_color="line_color",
                node_nonselection_line_width="line_width",
                node_nonselection_line_alpha=1,
                node_hover_fill_color=None,
                node_hover_line_color="#FF00FF",
                edge_color="gray",
                edge_alpha=0.5,
                tools=[hover, "tap"],
                toolbar=None,
                xaxis=None,
                yaxis=None,
                title=f"Path: {' -> '.join(current_path)}",
                hooks=[graph_hover_hook],
            )
        )

        # Labels
        labels_id = hv.Labels(
            {
                "x": [pos[n][0] for n in G],
                "y": [pos[n][1] for n in G],
                "text": [G.nodes[n]["label_id"] for n in G],
            },
            ["x", "y"],
            "text",
        ).opts(
            text_color="white", yoffset=0, text_font_size="9pt", text_font_style="bold"
        )

        labels_title = hv.Labels(
            {
                "x": [pos[n][0] for n in G],
                "y": [pos[n][1] for n in G],
                "text": [
                    (
                        f"{G.nodes[n]['hover_title']}\n\n"
                        if G.nodes[n].get("label_id") != "Start"
                        else ""
                    )
                    for n in G
                ],
            },
            ["x", "y"],
            "text",
        ).opts(
            text_color="#333",
            yoffset=0,
            text_baseline="bottom",
            text_font_size="8pt",
            text_font_style="bold",
        )

        labels_edge = hv.Labels(
            {
                "x": [i["x"] for i in edge_label_data],
                "y": [i["y"] for i in edge_label_data],
                "text": [
                    f"{i['text']}" if i["text"] != "None" else ""
                    for i in edge_label_data
                ],
            },
            ["x", "y"],
            "text",
        ).opts(text_color="#222", text_alpha=0.8, text_font_size="7.5pt",background_fill_color="white", background_fill_alpha=0.8)

        # 2. 绑定事件：必须在这里重新绑定 Source
        self.tap_stream.source = graph
        # 3. 修正：订阅的方法名必须匹配 (self.on_click)
        self.tap_stream.clear()  # 清除旧的订阅，防止重复触发
        self.tap_stream.add_subscriber(self.on_click)

        self.graph_pane.object = graph * labels_id * labels_title * labels_edge

    # 4. 修正：重命名方法为 on_click 以匹配订阅，并修正查找逻辑
    def on_click(self, x, y):
        """处理点击事件，检查距离最近的节点"""
        if not self.cached_payload or x is None:
            return

        # 修正：坐标在 pos 字段里，不在 nodes 列表里
        # cached_payload['pos'] 结构为 { "0.0": [0, 0], ... }
        pos_data = self.cached_payload.get("pos", {})
        nodes_list = self.cached_payload.get("nodes", [])

        closest, min_dist = None, 0.3  # 阈值

        # 遍历 pos 字典查找最近节点
        for nid, coords in pos_data.items():
            # coords 可能是 list 或 tuple
            nx, ny = coords[0], coords[1]
            dist = (nx - x) ** 2 + (ny - y) ** 2
            if dist < min_dist:
                min_dist = dist
                closest = nid

        if closest:
            # 找到 ID 后，去 nodes 列表里查状态
            # 使用 next 在列表里查找匹配 ID 的字典
            node_info = next((n for n in nodes_list if n["id"] == closest), None)

            if node_info:
                status = node_info.get("status", "UNFINISHED")

                if status in ["UNFINISHED", "IN_PROGRESS"]:
                    self.backtrack_tip.object = (
                        "⚠️ You can only backtrack to COMPLETED or SUSPENDED decisions."
                    )
                    self._change_backtrack_button_state(None)
                    self._render(self.cached_payload)  # 重绘以取消高亮
                    self.on_select_callback(False)
                elif closest == "0.0":
                    self.backtrack_tip.object = "⚠️ Cannot backtrack to the Start node."
                    self._change_backtrack_button_state(None)
                    self._render(self.cached_payload)  # 重绘以取消高亮
                    self.on_select_callback(False)
                else:
                    self.user_selected_node = closest
                    self.backtrack_tip.object = (
                        f"✅ Selected Node {closest} for Backtracking."
                    )
                    self._change_backtrack_button_state(closest)
                    self.on_select_callback(True)
                    self._render(self.cached_payload, draw_select=True)
        else:
            # 点击空白处，取消选中
            self._change_backtrack_button_state(None)
            self.on_select_callback(False)
            self._render(self.cached_payload)

    def on_backtrack(self, event):
        """点击 Backtrack 按钮触发"""
        if self.user_selected_node != "None":
            # 1. 准备数据
            target_node = self.user_selected_node
            
            # 2. 调用回调发送请求给 WebApp -> Server
            if self.send_callback:
                print(f"Graph requesting backtrack to {target_node}")
                # 注意：perspective_agent 的逻辑已经在 web_app.py 的 send_to_backend 中处理了
                # 这里只需要发送目标节点 ID
                self.send_callback("backtrack_to", {"target_id": target_node})

            # 3. UI 立即反馈 (让按钮变灰，提示已发送)
            self.backtrack_btn.name = "⏳ Requested..."
            self.backtrack_btn.disabled = True
            
            # 提示语更新
            self.backtrack_tip.object = f"⏳ Sending request to backtrack to Node {target_node}..."