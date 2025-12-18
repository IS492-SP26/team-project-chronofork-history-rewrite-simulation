from collections import defaultdict
import networkx as nx
from typing import List, Dict, Tuple
import json
import datetime
import csv
import os

class StoryGraph:
    """
    底层数据结构类，负责图的拓扑存储。
    不包含业务状态逻辑，仅负责 CRUD。
    """
    def __init__(self):
        self.nodes = {} 
        self.edges = [] 
        self.max_variant = 0
        self.edge_contexts: Dict[Tuple[str, str], List[dict]] = {} 
        self.edge_choices: Dict[Tuple[str, str], str] = {} 
        
        # 根节点初始化
        self.nodes["0.0"] = {'title': "ROOT", 'desc': "System Start", 'choice': "Start", 'parent_id': None}

    def add_node(self, title, desc, choice, parent_id=None, specific_id=None):
        new_id = specific_id
        if not new_id:
            if not parent_id or parent_id == "0.0":
                new_id = "1.0"
            else:
                p_depth, p_variant = map(int, parent_id.split('.'))
                new_id = f"{p_depth + 1}.{p_variant}"

        self.nodes[new_id] = {'title': title, 'desc': desc, 'choice': choice, 'parent_id': parent_id}
        
        if parent_id:
            self.edges.append((parent_id, new_id))
            self.edge_contexts[(parent_id, new_id)] = []
            self.edge_choices[(parent_id, new_id)] = choice
            
        return new_id

    def get_children(self, node_id):
        return [target for source, target in self.edges if source == node_id]

# --- 2. StoryEngine (对外唯一接口) ---

class StoryEngine:
    def __init__(self, initial_json: List[Dict], update_notifier=None):
        """
        初始化引擎
        :param initial_json: 定义故事初始路径的 JSON List
        :param log_file: 日志文件路径
        """
        self._notifier = update_notifier
        self._graph = StoryGraph()
        if not os.path.exists('history'):
            os.makedirs('history')
        now = datetime.datetime.now()
        date_str = now.strftime("%m-%d@%H_%M")
        self._log_file = f'history/log_{date_str}.tsv'

        # 状态管理
        self._node_statuses = {nid: "UNFINISHED" for nid in self._graph.nodes}
        self._node_statuses["0.0"] = "COMPLETED"
        self._current_path = ["0.0"]
        self._current_node_id = "0.0"
        
        # 初始化日志文件头
        if not os.path.exists(self._log_file):
            with open(self._log_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f, delimiter='\t')
                writer.writerow(['Timestamp', 'Function', 'Params'])

        # 解析初始 JSON 加载到图中
        self._init_graph_from_json(initial_json)
        self._push_graph_visualization()

    # ============================
    # Internal Helpers (Private)
    # ============================


    def _init_graph_from_json(self, json_list):
        """将扁平的 JSON List 转化为图中的线性路径"""
        prev_id = "0.0"
        for i, item in enumerate(json_list):
            # 自动计算 ID: 1.0, 2.0, 3.0...
            specific_id = f"{i+1}.0"
            self._graph.add_node(
                title=item.get('title', ''),
                desc=item.get('desc', ''),
                choice=item.get('choice', ''),
                parent_id=prev_id,
                specific_id=specific_id
            )
            self._node_statuses[specific_id] = "UNFINISHED"
            prev_id = specific_id

    def _reconstruct_path(self, target_node_id):
        """根据 parent_id 回溯路径"""
        path = []
        curr = target_node_id
        while curr:
            path.insert(0, curr)
            curr = self._graph.nodes[curr]['parent_id']
        return path

    def _move_state(self, target_node_id):
        """更新内部状态机指针"""
        if target_node_id not in self._graph.nodes:
            return

        # 1. 完成当前节点
        if self._current_node_id != "0.0":
            self._node_statuses[self._current_node_id] = "COMPLETED"
        
        # 2. 激活目标节点
        self._node_statuses[target_node_id] = "IN_PROGRESS"
        self._current_node_id = target_node_id
        
        # 3. 维护路径
        # 如果是前进，直接 append；如果是跳转/回溯，逻辑由上层保证 path 正确性
        if self._current_path[-1] != target_node_id:
            self._current_path.append(target_node_id)

    def _get_graph_snapshot(self):
        """仅供前端绘图使用，返回无逻辑的纯数据视图"""
        G = nx.DiGraph()
        pos = {}
        edge_label_data = []
        
        for nid, data in self._graph.nodes.items():
            depth, variant = map(int, nid.split('.'))
            status = self._node_statuses.get(nid, "UNFINISHED")
            
            G.add_node(nid, 
                       label_id=nid, 
                       hover_title=data['title'], 
                       hover_desc=data['desc'], 
                       status=status)
            
            pos[nid] = (depth, -variant)

        for src, dst in self._graph.edges:
            G.add_edge(src, dst)
            lbl = self._graph.edge_choices.get((src, dst), "")
            if lbl:
                x1, y1 = pos[src]; x2, y2 = pos[dst]
                edge_label_data.append({'x': (x1+x2)/2, 'y': (y1+y2)/2, 'text': lbl})
                
        return G, pos, edge_label_data, self._current_node_id, self._current_path
  
    def _push_graph_visualization(self):
        """
        主动向前端推送图可视化数据。
        需要将 NetworkX 对象和 Tuple Key 转换为 JSON 友好的格式。
        """
        if not self._notifier:
            return

        # 获取快照数据
        G, pos, edge_label_data, active_id, current_path = self._get_graph_snapshot()
        
        # 序列化 Nodes
        nodes_data = []
        for nid, data in G.nodes(data=True):
            # pos 是 {nid: (depth, -variant)}
            x, y = pos.get(nid, (0, 0))
            nodes_data.append({
                "id": nid,
                "x": x,
                "y": y,
                "label_id": data['label_id'],
                "hover_title": data['hover_title'],
                "hover_desc": data['hover_desc'],
                "status": data['status']
            })

        # 序列化 Edges
        edges_data = []
        for src, dst in G.edges():
            edges_data.append({"source": src, "target": dst})

        payload = {
            "nodes": nodes_data,
            "edges": edges_data,
            "edge_labels": edge_label_data,
            "active_node_id": active_id,
            "current_path": current_path
        }
        
        self._notifier("graph_update", payload)

    # ============================
    # Operational API (Write)
    # ============================

    def log(self, func_name, params):
        """记录操作日志到 TSV"""
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        # 将 params 转换为字符串以防包含复杂对象
        param_str = json.dumps(params, ensure_ascii=False) if params else ""
        
        with open(self._log_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f, delimiter='\t')
            writer.writerow([timestamp, func_name, param_str])

    def start_story(self):
        """开始故事，激活 1.0"""
        self.log("start_story", None)
        if "1.0" in self._graph.nodes:
            self._move_state("1.0")
            self._push_graph_visualization()

    def move_next(self):
        """
        自动移动到当前节点的下一个节点。
        逻辑：优先寻找相同 Variant 的子节点（保持在当前时间线）。
        """
        
        current_id = self._current_node_id
        children = self._graph.get_children(current_id)

        self.log("move_next", {"finished": current_id, "next_is": children})
        
        if not children:
            self.log("move_next", {"info": "No children to move to."})
            return # 无路可走
            
        # 策略：优先找同 Variant 的子节点 (e.g., 2.1 -> 3.1)
        curr_variant = current_id.split('.')[1]
        target = next((c for c in children if c.split('.')[1] == curr_variant), None)
        
        # 兜底：如果没有同 Variant (比如刚分叉?)，取第一个子节点
        if not target:
            self.log("move_next", {"info": f"No same variant child found, defaulting to first child {children[0]}."})
            target = children[0]
            
        self._move_state(target)
        self._push_graph_visualization()

    def alternative_branch(self, branch_json_list: List[Dict]):
        """
        创建新的分支并移动。
        :param branch_json_list: 一个列表。
               index 0: 导致分叉的那个节点（User Choice Node）。
               index 1..N: 后续的自动推演节点。
        """
        self.log("alternative_branch", branch_json_list)
        
        if not branch_json_list:
            return

        current_node = self._current_node_id
        
        # 1. 状态变更：完成当前，挂起旧子节点
        self._node_statuses[current_node] = "COMPLETED"
        old_children = self._graph.get_children(current_node)
        for child in old_children:
            self._node_statuses[child] = "SUSPENDED"
            
        # 2. 计算新 Variant ID
        try:
            s_depth, _ = map(int, current_node.split('.'))
        except:
            s_depth = 0
        
        next_depth = s_depth + 1
        self._graph.max_variant += 1
        new_variant = self._graph.max_variant
        
        # 3. 创建分支头 (branch_json_list[0])
        head_data = branch_json_list[0]
        branch_head_id = f"{next_depth}.{new_variant}"
        
        self._graph.add_node(
            title=head_data.get('title', ''),
            desc=head_data.get('desc', ''),
            choice=head_data.get('choice', ''),
            parent_id=current_node,
            specific_id=branch_head_id
        )
        self._node_statuses[branch_head_id] = "UNFINISHED"
        
        # 4. 创建后续推演节点 (branch_json_list[1:])
        prev_auto_id = branch_head_id
        for i in range(1, len(branch_json_list)):
            item = branch_json_list[i]
            d, v = map(int, prev_auto_id.split('.'))
            next_auto_id = f"{d+1}.{v}"
            
            self._graph.add_node(
                title=item.get('title', ''),
                desc=item.get('desc', ''),
                choice=item.get('choice', ''),
                parent_id=prev_auto_id,
                specific_id=next_auto_id
            )
            self._node_statuses[next_auto_id] = "UNFINISHED"
            prev_auto_id = next_auto_id
            
        # 5. 移动到分支头
        self._move_state(branch_head_id)
        self._push_graph_visualization()

    def backtrack_to(self, target_node_id):
        """回溯到指定节点"""
        self.log("backtrack_to", {"target": target_node_id})
        
        if target_node_id == self._current_node_id or target_node_id not in self._graph.nodes:
            return
            
        # 当前节点挂起
        if self._node_statuses[self._current_node_id] == "IN_PROGRESS":
            self._node_statuses[self._current_node_id] = "SUSPENDED"
            
        # 重建路径
        self._current_path = self._reconstruct_path(target_node_id)
        
        # 激活目标
        self._current_node_id = target_node_id
        self._node_statuses[target_node_id] = "IN_PROGRESS"
        self._push_graph_visualization()

    def add_message(self, from_name, to_name, content):
        """记录边上的消息"""
        self.log("add_message", {"from": from_name, "to": to_name, "content": content})
        
        if self._current_node_id == "0.0": return
        
        # 找到当前 Active 的边 (Parent -> Current)
        parent = self._current_path[-2]
        key = (parent, self._current_node_id)
        
        if key not in self._graph.edge_contexts:
            self._graph.edge_contexts[key] = []
        
        self._graph.edge_contexts[key].append({
            "from": from_name,
            "to": to_name,
            "content": content
        })
        

    # ============================
    # Retrieval API (Read)
    # ============================

    def get_story_context(self) -> str:
        """
        返回当前路径的 JSON String。
        包含：从 Root 到 Current 的完整路径，以及 Current 的所有直接子节点（作为未来的可能性）。
        """
        # 1. 获取当前路径上的节点数据
        path_nodes = []
        for nid in self._current_path:
            # 跳过虚拟根节点 0.0，除非你想包含它
            if nid == "0.0": continue
            
            node = self._graph.nodes[nid]
            path_nodes.append({
                "id": nid,
                "title": node['title'],
                "choice": node['choice'],
                "desc": node['desc'],
                "status": "History" if nid != self._current_node_id else "Active"
            })
            
        # 2. 获取当前节点的直接子节点 (Future Options)
        children_ids = self._graph.get_children(self._current_node_id)
        for cid in children_ids:
            node = self._graph.nodes[cid]
            path_nodes.append({
                "id": cid,
                "title": node['title'],
                "choice": node['choice'],
                "desc": node['desc'],
                "status": "Future/Option"
            })
            
        return json.dumps(path_nodes[-3:], ensure_ascii=False, indent=2)

    def get_context_messages(self) -> List[Dict]:
        msgs = []
        path = self._current_path
        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            msgs.extend(self._graph.edge_contexts.get((u, v), []))
        return msgs