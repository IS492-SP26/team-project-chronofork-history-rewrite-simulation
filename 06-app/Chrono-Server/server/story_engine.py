from collections import defaultdict
import networkx as nx
from typing import List, Dict, Tuple

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
        self.edge_seed_counts: Dict[Tuple[str, str], int] = {}  # seed messages pre-loaded at diverge, not counted as turns
        
        # 根节点初始化
        self.nodes["0.0"] = {
            'title': "ROOT",
            'desc': "System Start",
            'decision': "ROOT",
            'choice': "Start",
            'parent_id': None,
        }

    def to_dict(self):
        """序列化图数据"""
        # 将 tuple key 转为 string key "u|v"
        serialized_contexts = {f"{k[0]}|{k[1]}": v for k, v in self.edge_contexts.items()}
        serialized_choices = {f"{k[0]}|{k[1]}": v for k, v in self.edge_choices.items()}
        serialized_seed_counts = {f"{k[0]}|{k[1]}": v for k, v in self.edge_seed_counts.items()}

        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "max_variant": self.max_variant,
            "edge_contexts": serialized_contexts,
            "edge_choices": serialized_choices,
            "edge_seed_counts": serialized_seed_counts,
        }
    
    def load_from_dict(self, data):
        """反序列化"""
        self.nodes = data["nodes"]
        for node in self.nodes.values():
            if "decision" not in node:
                node["decision"] = node.get("title", "")
        self.edges = [tuple(e) for e in data["edges"]] # list -> tuple
        self.max_variant = data["max_variant"]
        
        self.edge_contexts = {}
        for k, v in data["edge_contexts"].items():
            u, target = k.split("|")
            self.edge_contexts[(u, target)] = v
            
        self.edge_choices = {}
        for k, v in data["edge_choices"].items():
            u, target = k.split("|")
            self.edge_choices[(u, target)] = v

        self.edge_seed_counts = {}
        for k, v in data.get("edge_seed_counts", {}).items():
            u, target = k.split("|")
            self.edge_seed_counts[(u, target)] = v

    def add_node(self, title, desc, decision, choice, parent_id=None, specific_id=None):
        new_id = specific_id
        if not new_id:
            if not parent_id or parent_id == "0.0":
                new_id = "1.0"
            else:
                p_depth, p_variant = map(int, parent_id.split('.'))
                new_id = f"{p_depth + 1}.{p_variant}"

        self.nodes[new_id] = {
            'title': title,
            'desc': desc,
            'decision': decision,
            'choice': choice,
            'parent_id': parent_id,
        }
        
        if parent_id:
            self.edges.append((parent_id, new_id))
            self.edge_contexts[(parent_id, new_id)] = []
            self.edge_choices[(parent_id, new_id)] = choice
            
        return new_id

    def get_children(self, node_id):
        if not node_id: return []
        return [target for source, target in self.edges if source == node_id]

# --- 2. StoryEngine (对外唯一接口) ---

class StoryEngine:
    def __init__(self, initial_json: List[Dict], logger, update_notifier=None):
        """
        初始化引擎
        :param initial_json: 定义故事初始路径的 JSON List
        :param log_file: 日志文件路径
        """
        self._notifier = update_notifier
        self.logger = logger
        self._graph = StoryGraph()

        # 状态管理
        self._node_statuses = {nid: "UNFINISHED" for nid in self._graph.nodes}
        self._node_statuses["0.0"] = "COMPLETED"
        self._current_path = ["0.0"]
        self._current_node_id = "0.0"
        

        # 解析初始 JSON 加载到图中
        self._init_graph_from_json(initial_json)
        self.logger.log("StoryEngine", "Init", "Engine Initialized", {"initial_nodes": len(initial_json)})

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
                decision=item.get('decision', item.get('title', '')),
                choice=item.get('choice', ''),
                parent_id=prev_id,
                specific_id=specific_id
            )
            self._node_statuses[specific_id] = "UNFINISHED"
            prev_id = specific_id

    # --- 新增：完整状态导出 ---
    def export_state(self):
        """导出引擎完整快照"""
        return {
            "graph": self._graph.to_dict(),
            "node_statuses": dict(self._node_statuses),
            "current_path": self._current_path,
            "current_node_id": self._current_node_id
        }
    
    def restore_state(self, state_data):
        """恢复状态"""
        self._graph = StoryGraph()
        self._graph.load_from_dict(state_data["graph"])
        self._node_statuses = defaultdict(lambda: "UNFINISHED", state_data["node_statuses"])
        self._current_path = state_data["current_path"]
        self._current_node_id = state_data["current_node_id"]
        if self.logger:
             self.logger.log("StoryEngine", "Restore", "State Restored", {"current_node": self._current_node_id})

    def _reconstruct_path(self, target_node_id):
        """根据 parent_id 回溯路径"""
        path = []
        curr = target_node_id
        while curr:
            path.insert(0, curr)
            curr = self._graph.nodes[curr]['parent_id']
        return path

    def _move_state(self, target_node_id, suspend_current=False):
        """更新内部状态机指针"""
        if target_node_id not in self._graph.nodes:
            return

        # 1. 完成/挂起当前节点
        if self._current_node_id != "0.0":
            self._node_statuses[self._current_node_id] = "SUSPENDED" if suspend_current else "COMPLETED"

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
            if nid == "0.0":  # 虚拟根节点特殊处理
                continue
            depth, variant = map(int, nid.split('.'))
            status = self._node_statuses.get(nid, "UNFINISHED")
            
            G.add_node(nid, 
                       label_id=data['title'], 
                       hover_title=data.get('decision', data['title']),
                       hover_desc=data['desc'], 
                       status=status)
            
            pos[nid] = (variant, -depth)

        for src, dst in self._graph.edges:
            if src not in pos or dst not in pos:
                continue
            G.add_edge(src, dst)
            lbl = self._graph.edge_choices.get((src, dst), "")
            if lbl:
                x1, y1 = pos[src]; x2, y2 = pos[dst]
                edge_label_data.append({'x': (x1+x2)/2, 'y': (y1+y2)/2, 'text': lbl})
                
        return G, pos, edge_label_data, self._current_node_id, self._current_path

    # ============================
    # Operational API (Write)
    # ============================

    def start_story(self):
        """开始故事，激活 1.0"""
        self.logger.log("StoryEngine", "StartStory", "Story started", {"start_node": "1.0"})
        if "1.0" in self._graph.nodes:
            self._move_state("1.0")
            self._push_graph_snapshot()

    def move_next(self):
        """
        自动移动到当前节点的下一个节点。
        逻辑：优先寻找相同 Variant 的子节点（保持在当前时间线）。
        """
        
        current_id = self._current_node_id
        children = self._graph.get_children(current_id)
        
        if not children:
            # 标记当前节点为完成状态 (这是关键，否则前端显示的还是 IN_PROGRESS)
            self._node_statuses[current_id] = "COMPLETED"
            self._push_graph_snapshot() # 通知前端更新颜色
            
            self.logger.log("StoryEngine", "MoveState", f"Reached end at {current_id}", {"result": "reached_end"})
            return "end"
            
        # 策略：优先找同 Variant 的子节点 (e.g., 2.1 -> 3.1)
        curr_variant = current_id.split('.')[1]
        target = next((c for c in children if c.split('.')[1] == curr_variant), None)

        self.logger.log("StoryEngine", "MoveState", f"Moved to {target}", {"from": current_id, "to": target})
        
        # 兜底：如果没有同 Variant (比如刚分叉?)，取第一个子节点
        if not target:
            target = children[0]
            self.logger.log("StoryEngine", "MoveState", f"No same variant child found, defaulting to first child {children[0]}.", {"children": children})
            print(f"No same variant child found for {current_id}, defaulting to {children[0]}.")
            
        self._move_state(target)
        self._push_graph_snapshot()

    def alternative_branch(self, branch_json_list: List[Dict]):
        """
        创建新的分支并移动。
        :param branch_json_list: 一个列表。
               index 0: 导致分叉的那个节点（User Choice Node）。
               index 1..N: 后续的自动推演节点。
        """
        self.logger.log("StoryEngine", "AlternativeBranch", "Creating alternative branch", {"branch_json_list": branch_json_list})
        
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
            decision=head_data.get('decision', head_data.get('title', '')),
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
                decision=item.get('decision', item.get('title', '')),
                choice=item.get('choice', ''),
                parent_id=prev_auto_id,
                specific_id=next_auto_id
            )
            self._node_statuses[next_auto_id] = "UNFINISHED"
            prev_auto_id = next_auto_id
            
        # 5. 移动到分支头
        self._move_state(branch_head_id)
        self._push_graph_snapshot()

    def backtrack_to(self, target_node_id):
        """回溯到指定节点"""
        
        if target_node_id == self._current_node_id or target_node_id not in self._graph.nodes:
            return
            
        # 当前节点挂起

        depth, variant = map(int, target_node_id.split('.'))
        
        if self._node_statuses[self._current_node_id] == "IN_PROGRESS":
            if variant == 0:
                self._node_statuses[self._current_node_id] = "COMPLETED"
            else:
                self._node_statuses[self._current_node_id] = "SUSPENDED"
            
        # 重建路径
        self._current_path = self._reconstruct_path(target_node_id)
        
        # 激活目标
        self._current_node_id = target_node_id
        self._node_statuses[target_node_id] = "IN_PROGRESS"
        self._push_graph_snapshot()

    def add_message(self, from_name, to_name, content, user_authored=False):
        """记录边上的消息"""
        if self._current_node_id == "0.0": return

        # 找到当前 Active 的边 (Parent -> Current)
        parent = self._current_path[-2]
        key = (parent, self._current_node_id)

        if key not in self._graph.edge_contexts:
            self._graph.edge_contexts[key] = []

        msg = {"from": from_name, "to": to_name, "content": content}
        if user_authored:
            msg["user_authored"] = True
        self._graph.edge_contexts[key].append(msg)

    def create_divergence_branch(self, divergence_data: dict, context_to_save: List[dict], suspend_current: bool = False):
        """
        根据推理结果创建新的分支，并将缓存的 Context 写入新边。
        :param divergence_data: LLM 推理出的 JSON
        :param context_to_save: 需要固化到新边上的对话历史 (从 pending_messages 转化而来)
        :param suspend_current: True 时将当前节点标为 SUSPENDED（正常流分歧），False 标为 COMPLETED（回溯分歧）
        """
        target_type = divergence_data.get("target", "child")
        new_nodes_data = divergence_data.get("branch_storyline", [])
        
        if not new_nodes_data: return None

        # 1. 确定 Parent Node
        if target_type == "sibling":
            # Sibling: 挂在父节点下 (e.g., 1.0 -> 2.1)
            parent_id = self._graph.nodes[self._current_node_id]['parent_id']
            self.logger.log("StoryEngine", "CreateDivergenceBranch", f"Divergence target is sibling; saving full pending messages. {parent_id}", {"parent_id": parent_id})
            if not parent_id: parent_id = self._current_node_id # Root fallback
        else:
            # Child: 挂在当前节点下 (e.g., 2.0 -> 3.1)
            parent_id = self._current_node_id

        # 2. 计算新 ID
        try:
            p_depth, _ = map(int, parent_id.split('.'))
        except:
            p_depth = 0
        
        next_depth = p_depth + 1
        self._graph.max_variant += 1
        new_variant = self._graph.max_variant
        
        # 3. 创建分支头节点
        head_data = new_nodes_data[0]
        branch_head_id = f"{next_depth}.{new_variant}"
        
        self._graph.add_node(
            title=head_data.get('title', 'Divergence'),
            desc=head_data.get('desc', ''),
            decision=head_data.get('decision', head_data.get('title', 'Divergence')),
            choice=head_data.get('choice', 'New Path'),
            parent_id=parent_id,
            specific_id=branch_head_id
        )
        self._node_statuses[branch_head_id] = "UNFINISHED"

        # 4. 【核心】将 Draft Context 写入新边 (Parent -> NewHead)
        key = (parent_id, branch_head_id)
        # 这里直接接收外部清洗好的 list，不做逻辑判断，保证 Engine 只负责存储
        self._graph.edge_contexts[key] = context_to_save
        self._graph.edge_seed_counts[key] = len(context_to_save)  # exclude seed from turn_number

        # 5. 创建后续自动推演节点
        prev_auto_id = branch_head_id
        for i in range(1, len(new_nodes_data)):
            item = new_nodes_data[i]
            d, v = map(int, prev_auto_id.split('.'))
            next_auto_id = f"{d+1}.{v}"
            
            self._graph.add_node(
                title=item.get('title', ''),
                desc=item.get('desc', ''),
                decision=item.get('decision', item.get('title', '')),
                choice=item.get('choice', ''),
                parent_id=prev_auto_id,
                specific_id=next_auto_id
            )
            self._node_statuses[next_auto_id] = "UNFINISHED"
            prev_auto_id = next_auto_id
            
        # 6. 移动状态（suspend_current=True 时旧节点标为 SUSPENDED，保留可回溯）
        self._move_state(branch_head_id, suspend_current=suspend_current)
        self._push_graph_snapshot()
        
        return branch_head_id
    # ============================
    # Retrieval API (Read)
    # ============================

    def _push_graph_snapshot(self,no_push=False):
        """将图数据编码为JSON字符串返回"""
        # 1. 获取原始对象数据
        G, pos, edge_label_data, active_id, current_path = self._get_graph_snapshot()

        # 2. 序列化 NetworkX 图节点 (将 label_id, hover_title 等属性解包)
        # NetworkX 的 G 无法直接 JSON 化，需转换为列表结构
        nodes_data = []
        for nid, attributes in G.nodes(data=True):
            node_item = attributes.copy()
            node_item['id'] = nid  # 将节点ID存入字典
            nodes_data.append(node_item)

        # 3. 序列化边
        edges_data = list(G.edges())

        # 4. 组装并返回 JSON
        payload = {
            "nodes": nodes_data,
            "edges": edges_data,
            "pos": pos,  # JSON 会将 tuple (x,y) 转换为 list [x,y]，前端需兼容或还原
            "edge_label_data": edge_label_data,
            "active_id": active_id,
            "current_path": current_path
        }
        if not no_push and self._notifier:
            self._notifier("graph_update", payload)
        
        return payload

    def get_story_context(self,only_current=False) -> List[Dict]:
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
                "decision": node.get('decision', node['title']),
                "choice": node['choice'],
                "desc": node['desc'],
                "status": "History" if nid != self._current_node_id else "Active"
            })
        if only_current:
            return path_nodes
            
        # 2. 获取当前节点的直接子节点 (Future Options)
        children_ids = self._graph.get_children(self._current_node_id)
        if children_ids:
            cid = children_ids[0]
            node = self._graph.nodes[cid]
            path_nodes.append({
                "id": cid,
                "title": node['title'],
                "decision": node.get('decision', node['title']),
                "choice": node['choice'],
                "desc": node['desc'],
                "status": "Future/Option"
            })
            
        return path_nodes[-3:]
    
    def get_context_messages(self, include_current_edge: bool = True) -> List[Dict]:
        """
        获取当前路径上的上下文消息。
        :param include_current_edge: 
            If True (Stage 1): 返回 0.0 -> ... -> Current 的完整历史。
            If False (Stage 2): 仅返回 0.0 -> ... -> Parent 的历史。
                               (当前的边被视为待定/重写中，由 CastEngine 的 pending_messages 替代)
        """
        msgs = []
        path = self._current_path
        
        # 计算遍历路径的终点
        # 路径长度为 N，边数为 N-1
        # 如果包含当前边，遍历到 N-1
        # 如果不包含当前边，遍历到 N-2
        limit = len(path) - 1 if include_current_edge else len(path) - 2
        
        # 边界检查：防止刚开始时 range 报错（虽然 range 自身能处理负数，但逻辑上保持清晰）
        if limit < 0: limit = 0

        for i in range(limit):
            u, v = path[i], path[i+1]
            msgs.extend(self._graph.edge_contexts.get((u, v), []))
        return msgs