# reflection_worker.py
import datetime
import json
import asyncio
import os
from typing import Dict, List, Any
from server.utilities.llm_cache import call_llm
from server.prompts import get_prompt

class ReflectionWorker:
    def __init__(self, engine, cast_engine):
        self.engine = engine
        self.cast_engine = cast_engine
        self.graph = engine._graph

    def _get_node_data(self, node_id):
        if not node_id or node_id not in self.graph.nodes: return {}
        node = self.graph.nodes[node_id]
        return {
            "id": node_id,
            "title": node['title'],
            "decision": node.get('decision', node['title']),
            "choice": node['choice'],
            "desc": node['desc']
        }

    def _prepare_context(self):
        """
        准备所有 Worker 需要的上下文数据。
        """
        # 1. 基础信息
        episode_info = f"{self.cast_engine.episode.get('title')}"

        cast_str = self.cast_engine.cast_str
        
        # 2. 路径分析
        user_path_ids = self.engine._current_path # e.g. ['0.0', '1.0', '2.0', '3.1', '4.1', '5.2', '6.2']

        # 移除路径开头的根节点 '0.0', 专注于决策节点
        if user_path_ids and user_path_ids[0] == '0.0':
            user_path_ids = user_path_ids[1:]
        
        # --- 核心修改：倒序查找分歧点 (Divergence Node) ---
        divergence_index = len(user_path_ids) - 1 # 默认指向最后一个
        
        # 从后往前遍历，寻找 Variant ID 突变的位置
        # 只要找到一次突变就停止，因为那是导致当前分支的“最近一次决策”
        for i in range(len(user_path_ids) - 1, 0, -1):
            curr_id = user_path_ids[i]     # e.g. 5.2
            prev_id = user_path_ids[i-1]   # e.g. 4.1
            
            try:
                curr_variant = int(curr_id.split('.')[1])
                prev_variant = int(prev_id.split('.')[1])
                
                if curr_variant != prev_variant:
                    # 发现分歧！分歧发生在 prev_id 之后
                    divergence_index = i - 1
                    break
            except:
                continue

        divergence_node_id = user_path_ids[divergence_index]
        divergence_node_data = self._get_node_data(divergence_node_id)

        # 3. 构建 History Prefix (映射为 <canonical> 标签)
        # 定义：从根节点一直到 Divergence Node (含)
        # 例如：0.0 -> ... -> 4.1
        history_prefix_ids = user_path_ids[:divergence_index + 1]
        history_prefix_data = [self._get_node_data(nid) for nid in history_prefix_ids]
        depth, variant = user_path_ids[divergence_index + 1].split('.')
        try:
            history_prefix_data.append(self._get_node_data(f"{depth}.{int(variant)-1}"))
        except:
            print("Error appending canonical node to history prefix.")
            pass
        history_prefix_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n['id']}): {n['desc']}" for n in history_prefix_data])


        # 4. 构建 Branch Line (当前新分支)
        # 定义：从 Divergence Node 的下一个节点开始，直到结束
        # 例如：5.2 -> 6.2
        # (Worker B 需要这部分来分析 Outcome)
        branch_path_ids = user_path_ids[divergence_index + 1:] 
        branch_nodes_data = [self._get_node_data(nid) for nid in branch_path_ids]
        
        branch_line_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n['id']}): {n['desc']}" for n in branch_nodes_data])

        # 如果没有新分支（branch_path_ids为空），说明还在主线上，做容错处理
        if not branch_nodes_data:
            branch_nodes_data = [divergence_node_data] # Fallback

        # 5. 构建 Canonical Future (对比组)
        # 定义：Divergence Node 的“原定未来”。
        # 逻辑：查找 Divergence Node (4.1) 的子节点中，Variant ID 与其相同 (4.1 -> 5.1) 的路径。
        original_future_nodes = []
        
        try:
            current_anchor = divergence_node_id
            target_variant = int(current_anchor.split('.')[1]) # 寻找延续 variant 1 的子节点
            
            # 简单的向前查找模拟（只找一层或几层，取决于图结构能查多深）
            # 这里简化为：在 Graph 中寻找同 Variant 的后续链条
            while True:
                children = self.graph.get_children(current_anchor)
                # 找到 variant 相同的子节点
                next_canon = next((c for c in children if int(c.split('.')[1]) == target_variant), None)
                if next_canon:
                    original_future_nodes.append(self._get_node_data(next_canon))
                    current_anchor = next_canon
                else:
                    break
        except:
            print("Error in constructing canonical future nodes.")
            pass # 图结构解析失败或无后续

        original_future_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n['id']}): {n['desc']}" for n in original_future_nodes])

        # 6. Logs Extraction (Updated)
        # 逻辑：提取从 Divergence Node 开始往后的所有边上的交互
        # 范围：从 divergence_index 开始，覆盖 (4.1->5.2), (5.2->6.2)
        branch_logs = []
        
        for i in range(divergence_index, len(user_path_ids) - 1):
            u = user_path_ids[i]
            v = user_path_ids[i+1]
            
            msgs = self.graph.edge_contexts.get((u, v), [])
            for m in msgs:
                log_entry = {
                    "from": m['from'] if m['from']!=self.cast_engine.user_role_name else f"{m['from']} (User)",
                    "to": m['to'] if m['to']!=self.cast_engine.user_role_name else f"{m['to']} (User)",
                    "content": m['content']
                }
                branch_logs.append(log_entry)
        
        branch_logs_str = '\n'.join([f"{log['from']} -> {log['to']}: {log['content']}" for log in branch_logs])

        # 7. 摘要生成 (给 Worker E 使用)
        
        canonical_nodes = []
        n = 1
        while True:
            node_id = f"{n}.0"
            if node_id in self.graph.nodes:
                canonical_nodes.append(node_id)
                n += 1
            else:
                break
        
        canon_summary_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n.get('decision', n['title'])})" for n in [self._get_node_data(nid) for nid in canonical_nodes]])

        branch_summary_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n.get('decision', n['title'])})" for n in branch_nodes_data])

        user_path_data = [self._get_node_data(nid) for nid in user_path_ids]

        return {
            "episode": episode_info,
            "history_prefix": history_prefix_str,
            "divergence_node_id": divergence_node_id,
            "original_future": original_future_str,
            "branch_line": branch_line_str,
            "branch_logs": branch_logs_str,
            "cast_str": cast_str,
            # 辅助摘要
            "canonical_summary": canon_summary_str,
            "branch_summary": branch_summary_str,
            # Overview
            "user_path_data": json.dumps(user_path_data, ensure_ascii=False)
        }

    async def generate_report(self):
        ctx = self._prepare_context()
        # 保存ctx到文件以便调试
        
        if not os.path.exists('debug'):
            os.makedirs('debug')
        timestamp = datetime.datetime.now().strftime("%m-%d_%H-%M")
        with open(f'debug/reflection_ctx_{timestamp}.json', 'w', encoding='utf-8') as f:
            json.dump(ctx, f, ensure_ascii=False, indent=2)

        # --- Stage 1: Parallel Execution (A, B, C, D) ---
        # A: 语境
        # B: 结果 (Outcome Only)
        # C: 细节/认知
        # D: 反事实 (Alternatives Only)
        task_a = self._call_llm("reflection.worker_a", ctx)
        task_b = self._call_llm("reflection.worker_b", ctx)
        task_c = self._call_llm("reflection.worker_c", ctx)
        task_d = self._call_llm("reflection.worker_d", ctx)
        
        res_a, res_b, res_c, res_d = await asyncio.gather(task_a, task_b, task_c, task_d)
        
        # --- Stage 2: Dependent Execution (E, F) ---
        
        # 提取中间结果供 E 和 F 使用
        outcome_snapshot = "Unknown Outcome"
        if res_b and "outcome_dashboard" in res_b:
            snapshots = [f"{i['dimension']}: {i['assessment']}" for i in res_b["outcome_dashboard"][:3]]
            outcome_snapshot = "; ".join(snapshots)
            
        key_tradeoff = "Unknown Context"
        if res_a and "tradeoff_map" in res_a and res_a["tradeoff_map"]:
            # 取第一个主要的 trade-off
            t = res_a["tradeoff_map"][0]
            key_tradeoff = f"{t['dimension']} ({', '.join(t.get('tensions',[]))})"

        # 更新上下文
        ctx_stage2 = ctx.copy()
        ctx_stage2["outcome_snapshot"] = outcome_snapshot
        ctx_stage2["key_tradeoff"] = key_tradeoff
        
        task_e = self._call_llm("reflection.worker_e", ctx_stage2)
        
        task_f = self._call_llm("reflection.worker_f", ctx_stage2)
        
        res_e, res_f = await asyncio.gather(task_e, task_f)
        
        # --- Stage 3: Assembly ---
        full_report = self._assemble_final_json(ctx, res_a, res_b, res_c, res_d, res_e, res_f)
        
        return full_report

    async def _call_llm(self, prompt_key, ctx):
        """Helper to format prompt and call LLM safely"""
        try:
            prompt = get_prompt(prompt_key, self.cast_engine.prompt_lang, **ctx)
            response = await call_llm(prompt, lang=self.cast_engine.prompt_lang)
            return response
        except Exception as e:
            print(f"Worker Error: {e}")
            return {}

    def _assemble_final_json(self, ctx, a, b, c, d, e, f):
        """
        按照 <reflection> 结构组装
        0. Overview (Calculated locally)
        I. Scenario (A + B + C + D)
        II. Learner (E)
        III. Meta (F)
        """
        # 0. Overview
        # 解析 branch line start/end
        user_path_data = json.loads(ctx['user_path_data'])
        
        overview = {
            "episode_id": self.cast_engine.episode.get('title'),
            "timeline_snapshot": {
                "divergence": ctx['divergence_node_id'],
                "checkpoints": [n['id'] for n in user_path_data]
            }
        }
        
        # I. Scenario Analysis
        scenario = {
            # From A
            "1_decision_context": {
                "tradeoff_map": a.get("tradeoff_map", []),
                "stakeholders_constraints": a.get("stakeholders_constraints", [])
            },
            # From B
            "2_outcome_analysis": {
                "outcome_dashboard": b.get("outcome_dashboard", []),
                "causal_chain": b.get("causal_chain_turning_points", []),
                "plausibility_check": b.get("plausibility_reasonableness_check", {})
            },
            # From C
            "3_information_limits": {
                "what_was_knowable": c.get("what_was_knowable_then", {}),
                "hindsight_flags": c.get("hindsight_anachronism_flags", [])
            },
            # From C
            "4_structure_vs_agency": c.get("structure_vs_agency", {}),
            # From D
            "5_alternative_paths": d.get("alternative_paths", {})
        }
        
        # II. Learner-Level
        learner = e # 直接是 E 的输出结构 (II.1, II.2)
        
        # III. Meta
        meta = f
        
        return {
            "0_report_overview": overview,
            "I_scenario_analysis": scenario,
            "II_learner_level_reflection": learner,
            "III_meta_historical_takeaways": meta
        }
    

