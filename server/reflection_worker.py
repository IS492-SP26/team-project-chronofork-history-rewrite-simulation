# reflection_worker.py
import datetime
import json
import asyncio
import os
from typing import Dict, List, Any
from server.llm_cache import call_llm

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
        
        canon_summary_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n['title']})" for n in [self._get_node_data(nid) for nid in canonical_nodes]])

        branch_summary_str = " -> ".join([f"{'' if n['choice']=='None' else n['choice']}({n['title']})" for n in branch_nodes_data])

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
        task_a = self._call_llm(PROMPT_WORKER_A, ctx)
        task_b = self._call_llm(PROMPT_WORKER_B, ctx)
        task_c = self._call_llm(PROMPT_WORKER_C, ctx)
        task_d = self._call_llm(PROMPT_WORKER_D, ctx)
        
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
        
        task_e = self._call_llm(PROMPT_WORKER_E, ctx_stage2)
        
        task_f = self._call_llm(PROMPT_WORKER_F, ctx_stage2)
        
        res_e, res_f = await asyncio.gather(task_e, task_f)
        
        # --- Stage 3: Assembly ---
        full_report = self._assemble_final_json(ctx, res_a, res_b, res_c, res_d, res_e, res_f)
        
        return full_report

    async def _call_llm(self, prompt_tmpl, ctx):
        """Helper to format prompt and call LLM safely"""
        try:
            # 使用 .format(**ctx) 自动填充
            prompt = prompt_tmpl.format(**ctx)
            # 这里的 cached_chat_create 需支持 json mode
            response = await call_llm(prompt)
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
    

# reflection_prompts.py

# ==============================================================================
# Worker A: Scenario Analyst (I.1)
# ==============================================================================
PROMPT_WORKER_A = """你是Scenario Analyst。Learner 完成了「{episode}」的历史模拟，体验的故事线见<history>，重点在{divergence_node_id}，你需要根据故事线中的重点和其他node生成体验Reflection报告中的Decision Context部分。

<history>{history_prefix}</history>

内容要求：
- Trade-off Map：真实决策前需权衡的多维度因素（如安全升级、联盟/信誉、国内政治、时间压力、信息可靠性、伦理约束），选取最关键的维度，不超过6个。
- Stakeholders & Constraints：不同历史角色的目标、底线、资源与约束（为多视角理解铺垫）），选取最关键的维度，不超过6个。

输出严格 JSON 格式，每个field都需要极其精炼，以避免文本负担过重，Use English：
{{
  "tradeoff_map": [
    {{
      "dimension": "String (e.g., Security vs Stability)",
      "tensions": ["String", "String"],
      "why_it_matters": "String (1 sentence)",
      "typical_failure_mode": "String (1 sentence)"
    }}
  ],
  "stakeholders_constraints": [
    {{
      "stakeholder": "String (Name/Group)",
      "goals": ["String", "..."],
      "red_lines": ["String", "..."],
      "levers": ["String", "..."],
      "constraints": ["String", "..."]
    }}
  ]
}}
"""

# ==============================================================================
# Worker B: Branch Forensics (I.2)
# ==============================================================================
PROMPT_WORKER_B = """你是Branch Forensics。Learner 完成了「{episode}」的历史模拟，故事线是<history_prefix>，但因为做出了与历史不同的决策变成了<branch_line>，你需要根据这些信息，结合用户的交互记录<branch_logs>，生成体验Reflection报告中的Outcome Analysis部分。

<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>

内容要求：
- Outcome Dashboard：<branch_line>在多个维度上的结果画像（风险/升级、联盟/政治、信誉、长期稳定性等），区分短期 (Short-term) 与 中长期 (Long-term Unintended)，不仅列出直接结果（如：赢了战争），还要列出长期的隐性代价（如：国库亏空导致十年后的内乱）。
- Causal Chain：关键因果链条 + 影响最大的 turning points（从 outcome 回溯到 checkpoint）。
- Plausibility：在当时语境下评估这条路径“为何可能/为何不太可能”，指出关键假设。


输出严格 JSON 格式，每个field都需要极其精炼，以避免文本负担过重，Use English：
{{
  "outcome_dashboard": [
    {{
      "dimension": "String (e.g., Nuclear Risk)",
      "assessment": "String (1-2 sentences)",
      "short_term": "String",
      "long_term_unintended_cost": "String",
      "confidence": Integer (0-100),
    }}
  ],
  "causal_chain_turning_points": [
    {{
      "from_node": "id (e.g., 4.1)",
      "to_node": "id",
      "mechanism": "String",
      "turning_point": Boolean,
    }}
  ],
  "plausibility_reasonableness_check": {{
    "summary": "String",
    "key_assumptions": ["String"],
    "stress_points": ["String"],
    "plausibility_score": Integer (0-100)
  }}
}}
"""

# ==============================================================================
# Worker C: Historical Thinking Coach (I.3, I.4)
# ==============================================================================
PROMPT_WORKER_C = """你是Historical Thinking Coach。Learner 完成了「{episode}」的历史模拟，故事线是<history_prefix>，但因为做出了与历史不同的决策变成了<branch_line>，你需要根据这些信息，结合用户的交互记录<branch_logs>，生成体验Reflection报告中的Information Limits和Structure vs Agency部分。

输入信息：
<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>

内容要求：
- What Was Knowable Then：当时可得信息、信息质量、误判空间、偶然性作用。
- Hindsight / Anachronism Flags：识别用户是否使用“上帝视角”或时代错置的知识/价值框架，并解释为何在当时难以成立（教育价值：语境意识与证据意识）。
- Effective Leverage Points：用户哪些行动真正改变了轨迹（agency 生效点）。
- Structural Constraints：哪些结构性力量难以被个人决策撼动（联盟体系、军政制度、资源/后勤、核威慑结构等）（教育价值：必然性/偶然性边界）。

输出严格 JSON 格式，每个field都需要极其精炼并限制列表内元素最多6个，以避免文本负担过重，Use English：
{{
  "what_was_knowable_then": {{
    "available_information": ["String"],
    "information_gaps": ["String"],
    "info_quality_notes": ["String"],
    "chance_and_fog_factors": ["String"]
  }},
  "hindsight_anachronism_flags": [
    {{
      "flag": "String",
      "why_unrealistic_then": "String",
      "period_consistent_reframe": "String"
    }}
  ],
  "structure_vs_agency": {{
    "effective_leverage_points": [
      {{
        "action_summary": "String",
        "why_it_mattered": "String"
      }}
    ],
    "structural_constraints": [
      {{
        "constraint": "String",
        "why_binding": "String"
      }}
    ]
  }}
}}
"""

# ==============================================================================
# Worker D: Counterfactual Analyst (I.5)
# ==============================================================================
PROMPT_WORKER_D = """你是Counterfactual Analyst。Learner 完成了「{episode}」的历史模拟，故事线是<history_prefix>，但因为做出了与历史不同的决策，接下来的故事线由<original_future>变成了<branch_line>，你需要根据这些信息，对比“用户走过的路”与“未选择的路”，进行沙盘推演，生成体验Reflection报告中的Alternative Paths部分。

输入信息：
<history_prefix>{history_prefix}</history_prefix>
<original_future>{original_future}</original_future>
<branch_line>{branch_line}</branch_line>

内容要求：
- Unchosen Options & Likely Rollouts：列出关键 checkpoint 未选选项及其最可能后果（短 rollout,<=6条）。
- Branch Contrast：与当前分支/ canonical 的关键差异：从哪个 checkpoint 开始扩散、为何扩散。
- Recommended Next Experiment：建议下次最值得回溯的 checkpoint 与可切换的视角（形成迭代学习闭环）。

输出严格 JSON 格式，每个field都需要极其精炼，以避免文本负担过重，Use English：
{{
  "alternative_paths": {{
    "unchosen_options_likely_rollouts": [
      {{
        "checkpoint_node": "id (Where the choice existed, e.g., 4.1)",
        "unchosen_options": [
          {{
            "option_label": "String (The path not taken)",
            "most_likely_rollout": "String (Short simulation of consequence)",
            "risk_level": "low/medium/high"
          }}
        ]
      }}
    ],
    "recommended_next_experiment": {{
      "recommended_checkpoint": "id (a.b)",
      "recommended_perspective": "String (Role)",
      "rationale": "String (Why this is a good learning loop)"
    }}
  }}
}}
"""

# ==============================================================================
# Worker E: Learner Profiler (II.1, II.2)
# ==============================================================================
PROMPT_WORKER_E = """你是Learner Profiler。Learner 完成了「{episode}」的历史模拟，故事线是<history_prefix>，参与的的角色包括<cast>，但因为做出了与历史不同的决策变成了<branch_line>，你需要根据这些信息，结合用户的交互记录<branch_logs>和<outcome_snapshot>，生成体验Reflection报告中的Decision Profile和Personalized Learning Suggestions部分。

输入信息：
<cast>{cast_str}</cast>
<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>
<outcome_snapshot>{outcome_snapshot}</outcome_snapshot>


内容要求：
- Decision Pattern Summary：风险偏好、妥协/对抗、短期/长期导向、对联盟/国内政治的权重等用户特点
- Blind Spots：被忽略的角色/群体/后果维度（例如忽略民意、忽略盟友、忽略长期稳定性）。
- Historical Archetype Matching：将该决策风格类比到某类历史人物/流派（作为启发式镜像）。
- Coaching Recommendations：针对用户的决策模式给出下次探索策略（例如在不确定时如何降低升级风险、如何主动获取对手视角）。
- Skill Targets (Historical Thinking)：明确要练的能力点：多重因果、证据与不确定性、视角转换、反事实比较、结构-能动辨析。
- Skill Visualization (Radar)：把上述能力点映射成可视化维度供可视化展示，须给出具体分数和理由。
- Next Steps：建议继续探索的 checkpoint / perspective / episode（促进迁移学习与持续练习）。

输出严格 JSON 格式，每个field都需要极其精炼，以避免文本负担过重，Use English：
{{
  "decision_profile_blind_spots": {{
    "decision_pattern_summary": [
      {{ "pattern": "String", "explanation": "String" }}
    ],
    "blind_spots": [
      {{ "blind_spot": "String", "why_it_matters": "String" }}
    ],
    "historical_archetype_matching": {{ "archetype": "String", "why_fit": "String", "caveat": "String" }}
  }},
  "personalized_learning_suggestions": {{
    "coaching_recommendations": [
      {{ "recommendation": "String", "rationale": "String" }}
    ],
    "skill_targets_historical_thinking": ["Multi-causality", "Evidence & Uncertainty", "Perspective Taking", "Counterfactual Comparison", "Structure vs Agency"],
    "skill_visualization_radar": {{
      "Multi-causality": {{ "score": Integer (0-10), "rationale": "String" }},
      "Evidence & Uncertainty": {{ "score": Integer, "rationale": "String" }},
      "Perspective Taking": {{ "score": Integer, "rationale": "String" }},
      "Counterfactual Comparison": {{ "score": Integer, "rationale": "String" }},
      "Structure vs Agency": {{ "score": Integer, "rationale": "String" }}
    }},
    "next_steps": [
      {{ "recommended_checkpoint": "id (a.b)", "recommended_perspective": "String, EXACT name in <cast>", "learning_goal": "String" }}
    ]
  }}
}}
"""

# ==============================================================================
# Worker F: Meta-Historian (III.1)
# ==============================================================================
PROMPT_WORKER_F = """你是Meta-Historian。Learner 完成了「{episode}」的历史模拟，你的任务是跳出具体细节，提供宏观的 Anchors, Boundaries & Transfer部分。

输入信息：
<canonical_summary>{canonical_summary}</canonical_summary>
<branch_summary>{branch_summary}</branch_summary>
<outcome_snapshot>{outcome_snapshot}</outcome_snapshot>
<key_tradeoff>{key_tradeoff}</key_tradeoff>

内容要求：
- Canonical Fact Anchors：本 episode 的关键史实锚点（真实历史上这里发生了什么，作为对照）。
- Simulation Disclaimer：指出哪些推演是合理假设但不可证的。
- Meta-Lessons & Transfer：围绕因果、结构约束的总括性启示，以及可迁移到现代场景的模式（如安全困境）。
- Transferable Patterns：将本事件抽象为可迁移的模式（安全困境、信誉承诺、升级控制、联盟政治等），引导用户识别现实世界的相似结构（迁移学习）。

输出严格 JSON 格式，每个field都需要极其精炼，以避免文本负担过重，Use English：
{{
    "canonical_fact_anchors": [
      {{ "fact": "String", "contrast_to_branch": "String" }}
    ],
    "simulation_disclaimer": [
      {{ "assumption": "String", "why_uncertain": "String" }}
    ],
    "meta_lessons": ["String (Deep historical insight)"],
    "transferable_patterns": [
      {{ "pattern": "String", "in_episode": "String", "modern_parallel": "String" }}
    ]
}}
"""