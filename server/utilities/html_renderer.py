# html_renderer.py

import re


def render_reflection_report(report_data):
    """
    渲染高颜值、全字段覆盖、结构严格的 HTML 报告 (Final Refined Version)。
    """
    if not report_data:
        return "<div style='color:red; padding:20px;'>⚠️ Error: No report data available.</div>"

    # 数据解包
    overview = report_data.get("0_report_overview", {})
    scenario = report_data.get("I_scenario_analysis", {})
    learner = report_data.get("II_learner_level_reflection", {})
    meta = report_data.get("III_meta_historical_takeaways", {})

    # ==========================
    # CSS Styles
    # ==========================
    css = """
    <style>
        .rf-root { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            font-size: 14px; 
            line-height: 1.5; 
            color: #2d3436; 
            background: #fff; 
            padding: 12px; 
            border-radius: 8px; 
            border: 1px solid #dfe6e9; 
            max-width: 100%;
        }
        
        /* Headers & Layout */
        .rf-h1 { font-size: 1.5em; font-weight: 800; text-align: center; color: #2d3436; margin: 5px 0; }
        .rf-meta { font-size: 0.85em; color: #636e72; text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px dashed #b2bec3; }
        
        .rf-chapter-banner { 
            font-size: 1.1em; font-weight: 700; color: #fff; 
            padding: 8px 12px; border-radius: 6px; margin: 25px 0 15px 0; 
            display: flex; align-items: center; gap: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .rf-bg-blue { background: linear-gradient(135deg, #0984e3, #74b9ff); }
        .rf-bg-green { background: linear-gradient(135deg, #00b894, #55efc4); }
        .rf-bg-purple { background: linear-gradient(135deg, #6c5ce7, #a29bfe); }
        
        /* Collapsible Sections */
        details.rf-section { margin-bottom: 15px; border: 1px solid #f1f2f6; border-radius: 8px; overflow: hidden; }
        summary.rf-section-header { 
            background: #f8f9fa; padding: 10px 15px; font-weight: 700; 
            font-size: 1.0em; color: #2d3436; cursor: pointer; list-style: none;
            display: flex; align-items: center; justify-content: space-between;
        }
        summary.rf-section-header:hover { background: #e9ecef; }
        summary.rf-section-header::-webkit-details-marker { display: none; }
        summary.rf-section-header::after { content: '▼'; font-size: 0.8em; color: #b2bec3; transition: transform 0.2s; }
        details[open] > summary.rf-section-header::after { transform: rotate(180deg); }
        .rf-section-content { padding: 15px; }

        /* Grids */
        .rf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
        .rf-mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        
        /* General Card */
        .rf-card { 
            background: #fff; border: 1px solid #dfe6e9; border-left-width: 4px;
            border-radius: 6px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            display: flex; flex-direction: column;
        }
        .rf-card-head { font-weight: 700; margin-bottom: 8px; color: #2d3436; display: flex; justify-content: space-between; align-items: center; }
        
        /* Stakeholder Specifics */
        .rf-sh-block { font-size: 0.85em; background: #fdfdfd; padding: 5px; border-radius: 4px; border: 1px solid #f1f2f6; }
        .rf-sh-label { font-weight: 700; font-size: 0.8em; text-transform: uppercase; margin-bottom: 2px; display: block; }
        .rf-sh-list { margin: 0; padding-left: 15px; color: #555;}
        
        /* Outcome Specifics */
        .rf-outcome-short { background: #e3f2fd; color: #2980b9; padding: 6px; border-radius: 4px; margin-top: 8px; font-size: 0.8em; }
        .rf-outcome-long { background: #fdedec; color: #c0392b; padding: 6px; border-radius: 4px; margin-top: 5px; font-size: 0.8em; }
        
        /* Skills & Next Steps */
        .rf-rationale { font-size: 0.85em; color: #636e72; margin-top: 2px; font-style: italic; }
        .rf-ticket { 
            border: 2px dashed #00b894; background: #f0fdfa; padding: 10px; border-radius: 6px;
            display: flex; flex-direction: column; gap: 5px;
        }

        /* Timeline */
        .rf-timeline { position: relative; padding-left: 15px; border-left: 2px solid #dfe6e9; margin-left: 5px; }
        .rf-time-item { margin-bottom: 12px; position: relative; }
        .rf-time-dot { position: absolute; left: -21px; top: 2px; width: 10px; height: 10px; border-radius: 50%; background: #b2bec3; border: 2px solid #fff; box-shadow: 0 0 0 1px #dfe6e9; }
        .rf-time-dot.tp { background: #e17055; width: 12px; height: 12px; left: -22px; }
        
        /* Transfer */
        .rf-transfer-row { display: flex; flex-direction: column; gap: 5px; margin-top: 5px; }
        .rf-transfer-box { padding: 6px; border-radius: 4px; font-size: 0.9em; }
        .rf-trans-hist { background: #ebebeb; color: #2d3436; opacity: 0.8; }
        .rf-trans-mod { background: #d1c4e9; color: #512da8; opacity: 0.8; }

        /* Skill Bars */
        .rf-skill-row { margin-bottom: 8px; }
        .rf-skill-track { height: 8px; background: #dfe6e9; border-radius: 4px; overflow: hidden; margin: 4px 0; }
        .rf-skill-fill { height: 100%; border-radius: 4px; }


        /* Plausibility */
        .rf-plaus-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; font-size: 1em; }
        .rf-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 700; margin-right: 4px; background: #dfe6e9; color: #636e72; }
        .rf-tag-risk-high { background: #ff7675; color: #fff; }
        .rf-tag-risk-med { background: #ffeaa7; color: #d35400; }
        .rf-tag-risk-low { background: #55efc4; color: #009432; }

        /* --- Fog of War Grid --- */
        .rf-fog-grid {
                    display: grid;
                    gap: 10px;
                    grid-template-columns: repeat(2, 1fr); /* 默认 2列 (2x2) */
                }
                @media (max-width: 600px) {
                    .rf-fog-grid { grid-template-columns: 1fr; } /* 窄屏 1列 */
                }
        .rf-fog-cell {
            background: #fdfdfd;
            border: 1px solid #eee;
            border-radius: 6px;
            padding: 10px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.03);
            border-top-width: 3px; /* 顶部色条 */
        }
        /* 四种类型配色 */
        .rf-fog-avail { border-top-color: #27ae60; } /* Green */
        .rf-fog-gaps { border-top-color: #e17055; }  /* Red */
        .rf-fog-qual { border-top-color: #f1c40f; }  /* Yellow */
        .rf-fog-chance { border-top-color: #9b59b6; } /* Purple */

        .rf-fog-title {
            display: flex; align-items: center; gap: 5px;
            font-weight: 700; font-size: 0.9em; color: #2d3436;
            margin-bottom: 5px; padding-bottom: 5px;
            border-bottom: 1px dashed #eee;
        }
        .rf-fog-list { margin: 0; padding-left: 18px; color: #636e72; font-size: 0.9em; }


        /* Archetype Caveat */
        .rf-caveat { margin-top: 8px; padding: 6px; background: #fff3cd; color: #856404; font-size: 0.85em; border-radius: 4px; display: flex; gap: 5px; }


        /* Meta Lessons */
        .rf-lesson-card { 
            background: #fef9e7; border-left: 4px solid #f1c40f; padding: 10px 15px; 
            margin-bottom: 8px; font-size: 0.95em; color: #574b08; border-radius: 4px; position: relative;
        }
        .rf-lesson-card::before { content: '💡'; position: absolute; left: 10px; top: 10px; font-size: 1.2em; opacity: 0.5; }
        .rf-lesson-content { padding-left: 25px; }

        /* 新增：Meta Lesson 专用样式 */
        .rf-lesson-card {
            background: #fffbf0; /* 极淡的紫色背景 */
            border: 1px solid #e9d8fd;
            border-left: 4px solid #f1c40f; /* 深紫色边框 */
            border-radius: 6px;
            padding: 12px 15px;
            box-shadow: 0 2px 4px rgba(142, 68, 173, 0.05);
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 60px;
        }
        .rf-lesson-content {
            font-size: 1.05em;
            font-weight: 600;
            color: #d35400; /* 文字颜色加深 */
            font-style: italic;
            font-family: Georgia, 'Times New Roman'
            line-height: 1.4;
        }
        .rf-section-subtitle {
            font-size: 0.85em;
            font-weight: 700;
            color: #95a5a6;
            text-transform: uppercase;
            margin: 15px 0 8px 0;
            letter-spacing: 0.5px;
        }
    </style>
    """
    
    html = f"{css}<div class='rf-root'>"

    # ==========================================================================
    # 0. Overview
    # ==========================================================================
    snap = overview.get('timeline_snapshot', {})
    # 1. 预处理 Timeline HTML：高亮 Divergence 节点
    checkpoints = snap.get('checkpoints', [])
    div_node = snap.get('divergence') # 获取分歧点 ID
    
    timeline_parts = []
    for cp in checkpoints:
        # 转换为字符串比较以防万一
        if str(cp) == str(div_node):
            # 特殊标记样式：例如橙红色高亮 + 图标
            timeline_parts.append(f"<span style='color:#d35400; font-weight:bold; background:#fadbd8; padding:2px 6px; border-radius:4px; border:1px solid #e6b0aa;'>🔀 {cp}</span>")
        else:
            timeline_parts.append(str(cp))
            
    timeline_html = ' ➔ '.join(timeline_parts)

    html += f"""
    <div class="rf-h1">📜 Reflection Report</div>
    <div class="rf-meta">
        🏷️ <b>Episode:</b> {overview.get('episode_id', 'N/A')} &nbsp;|&nbsp; 
        ⏳ <b>Timeline:</b> {timeline_html}
    </div>
    """

    # ==========================================================================
    # I. Scenario Analysis
    # ==========================================================================
    html += '<div class="rf-chapter-banner rf-bg-blue">🔍 I. Scenario Analysis</div>'

    # --- 1.1 Decision Context (Trade-offs) ---
    s1 = scenario.get('1_decision_context', {})
    tradeoffs = s1.get('tradeoff_map', [])
    if tradeoffs:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">1. Trade-off Map</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for t in tradeoffs:
            html += f"""
            <div class="rf-card" style="border-left-color:#0984e3;">
                <div class="rf-card-head" style="color:#0984e3;">⚖️ {t.get('dimension')}</div>
                <div style="font-size:0.9em; margin-bottom:4px;">{' 🆚 '.join(t.get('tensions', []))}</div>
                <div style="font-size:0.85em; color:#636e72;">"{t.get('why_it_matters')}"</div>
                <div style="margin-top:5px; padding-top:5px; border-top:1px dashed #eee; color:#d63031; font-size:0.85em;">
                    ⚠️ Failure: {t.get('typical_failure_mode')}
                </div>
            </div>
            """
        html += "</div></div></details>"

    # --- 1.2 Stakeholders (Visual Grid) ---
    stakeholders = s1.get('stakeholders_constraints', [])
    if stakeholders:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">2. Stakeholders & Constraints</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for s in stakeholders:
            # Helper to create list items
            def make_list(items): return "".join([f"<li>{x}</li>" for x in items[:2]])
            
            html += f"""
            <div class="rf-card" style="border-left-color:#74b9ff;">
                <div style="font-weight:bold; font-size:1.05em; border-bottom:1px solid #eee; margin-bottom:5px; padding-bottom:5px;">
                    👤 {s.get('stakeholder')}
                </div>
                <div class="rf-mini-grid">
                    <div class="rf-sh-block">
                        <span class="rf-sh-label" style="color:#27ae60;">🎯 Goals</span>
                        <ul class="rf-sh-list">{make_list(s.get('goals', []))}</ul>
                    </div>
                    <div class="rf-sh-block">
                        <span class="rf-sh-label" style="color:#d63031;">🚫 Red Lines</span>
                        <ul class="rf-sh-list">{make_list(s.get('red_lines', []))}</ul>
                    </div>
                    <div class="rf-sh-block">
                        <span class="rf-sh-label" style="color:#2980b9;">🔧 Levers</span>
                        <ul class="rf-sh-list">{make_list(s.get('levers', []))}</ul>
                    </div>
                    <div class="rf-sh-block">
                        <span class="rf-sh-label" style="color:#636e72;">⛓️ Constraints</span>
                        <ul class="rf-sh-list">{make_list(s.get('constraints', []))}</ul>
                    </div>
                </div>
            </div>
            """
        html += "</div></div></details>"

    # --- 2. Outcome Analysis ---
    s2 = scenario.get('2_outcome_analysis', {})
    if s2:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">3. Outcomes & Causal Chain</summary>
            <div class="rf-section-content">
        """
        # Dashboard Grid
        html += '<div class="rf-grid">'
        for o in s2.get('outcome_dashboard', []):
            score = o.get('confidence', 5) # Default 5 if missing
            if score >10:
                score = round(score / 10, 1)
            # Score is 0-10 based on prompt instructions
            color = "#00b894" if score >= 7 else "#fdcb6e" if score >= 4 else "#ff7675"
            
            html += f"""
            <div class="rf-card" style="border-left-color:{color};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:bold; color:#2d3436;">📊 {o.get('dimension')}</div>
                    <div style="background:{color}; color:#fff; padding:1px 6px; border-radius:3px; font-weight:bold; font-size:0.85em;">{score}/10</div>
                </div>
                <div style="margin:6px 0; font-size:0.95em;">{o.get('assessment')}</div>
                
                <div class="rf-outcome-short">
                    <b>⚡ Short-term:</b> {o.get('short_term')}
                </div>
                <div class="rf-outcome-long">
                    <b>⏳ Long-term Cost:</b> {o.get('long_term_unintended_cost')}
                </div>
            </div>
            """
        html += '</div>' # End Grid
        
        # Causal Chain (Turning Points)
        if s2.get('causal_chain'):
            html += "<div style='margin-top:20px; margin-bottom:10px; font-weight:700; color:#555;'>🦋 Causal Chain</div><div class='rf-timeline'>"
            for link in s2.get('causal_chain', []):
                is_tp = link.get('turning_point', False)
                dot = "tp" if is_tp else ""
                bg = "background:#fff8e1; border:1px solid #ffe082;" if is_tp else "background:#f8f9fa;"
                tp_tag = "<span style='color:#e67e22; font-weight:bold;'>[Turning Point]</span> " if is_tp else ""
                html += f"""
                <div class="rf-time-item">
                    <div class="rf-time-dot {dot}"></div>
                    <div style="{bg} padding:8px; border-radius:4px; font-size:0.9em;">
                        <div>{tp_tag}<b>{link.get('from_node')}</b> ➔ <b>{link.get('to_node')}</b></div>
                        <div style="color:#636e72; margin-top:2px;">{link.get('mechanism')}</div>
                    </div>
                </div>
                """
            html += "</div>"

        # Plausibility
        plaus = s2.get('plausibility_check', {})

        if plaus:
            html += f"""
            <div style="margin-top:15px; background:#eaf2f8; padding:10px; border-radius:6px; font-size:0.9em; border-left:4px solid #3498db;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:700; color:#34495e;">🧐 Plausibility Check</div>
                    <div style="background:#34495e; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold;">{plaus.get('plausibility_score',0)}/100</div>
                </div>
                <div style="margin-top:5px; font-style:italic;">{plaus.get('summary')}</div>
                <div class="rf-plaus-grid">
                    <div>
                        <span class="rf-tag">Assumptions</span>
                        <ul style="margin:5px 0 0 15px; padding:0; color:#555;">{''.join([f'<li>{x}</li>' for x in plaus.get('key_assumptions', [])])}</ul>
                    </div>
                    <div>
                        <span class="rf-tag rf-tag-risk-high">Stress Points</span>
                        <ul style="margin:5px 0 0 15px; padding:0; color:#555;">{''.join([f'<li>{x}</li>' for x in plaus.get('stress_points', [])])}</ul>
                    </div>
                </div>
            </div>
            """
        html += "</div></details>"

    # --- 3. Info Limits & Agency ---
    s3 = scenario.get('3_information_limits', {})
    s4 = scenario.get('4_structure_vs_agency', {}) # 如果还需要展示 Structure，可以在这里接着处理
    
    if s3:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">3. Fog of War & Hindsight</summary>
            <div class="rf-section-content">
        """
        
        # Fog Matrix
        knowable = s3.get('what_was_knowable', {})
        if knowable:
            # Helper to generate list html
            def mk_li(items): return "".join([f"<li>{x}</li>" for x in items])
            
            html += f"""
            <div style="font-weight:700; color:#555; margin-bottom:10px;">🌫️ What Was Knowable Then?</div>
            <div class="rf-fog-grid">
                <div class="rf-fog-cell rf-fog-avail">
                    <div class="rf-fog-title">✅ Available Info</div>
                    <ul class="rf-fog-list">{mk_li(knowable.get('available_information', []))}</ul>
                </div>
                <div class="rf-fog-cell rf-fog-gaps">
                    <div class="rf-fog-title">🚫 Information Gaps</div>
                    <ul class="rf-fog-list">{mk_li(knowable.get('information_gaps', []))}</ul>
                </div>
                <div class="rf-fog-cell rf-fog-qual">
                    <div class="rf-fog-title">📶 Info Quality</div>
                    <ul class="rf-fog-list">{mk_li(knowable.get('info_quality_notes', []))}</ul>
                </div>
                <div class="rf-fog-cell rf-fog-chance">
                    <div class="rf-fog-title">🎲 Chance Factors</div>
                    <ul class="rf-fog-list">{mk_li(knowable.get('chance_and_fog_factors', []))}</ul>
                </div>
            </div>
            """

        # Hindsight Flags (Card List)
        hindsight = s3.get('hindsight_flags', [])
        if hindsight:
            html += "<div style='font-weight:700; color:#c0392b; margin:15px 0 10px 0;'>🚩 Anachronism Alerts</div>"
            html += '<div class="rf-grid">' # Grid for multiple flags
            for f in hindsight:
                html += f"""
                <div class="rf-card" style="border-left-color:#e17055; background:#fff5f5;">
                    <div style="font-weight:bold; color:#c0392b; font-size:0.95em; margin-bottom:5px;">
                        Alert: {f.get('flag')}
                    </div>
                    <div style="font-size:0.9em; color:#555; margin-bottom:8px;">
                        <b>Reason:</b> {f.get('why_unrealistic_then')}"
                    </div>
                    <div style="background:#fff; border:1px solid #fadbd8; padding:6px; border-radius:4px; font-size:0.85em; color:#2d3436;">
                        <span style="font-weight:bold; color:#27ae60;">💡 Historic Reframe:</span> 
                        {f.get('period_consistent_reframe')}
                    </div>
                </div>
                """
            html += "</div>" # End grid
            
        html += "</div></details>"
        
    s4 = scenario.get('4_structure_vs_agency', {})
    if s4:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">5. Structure vs Agency</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        # Agency
        for lev in s4.get('effective_leverage_points', []):
            html += f"""
            <div class="rf-card" style="border-left-color:#00b894;">
                <div style="font-weight:bold;">💪 Your Agency: {lev.get('action_summary')}</div>
                <div style="font-size:0.9em; margin-top:3px;"><b>Impact:</b> {lev.get('why_it_mattered')}</div>
            </div>
            """
        # Constraints
        for const in s4.get('structural_constraints', []):
            html += f"""
            <div class="rf-card" style="border-left-color:#2d3436; background:#f1f2f6;">
                <div style="font-weight:bold;">🧱 Constraint: {const.get('constraint')}</div>
                <div style="font-size:0.9em; margin-top:3px;"><b>Reason:</b> {const.get('why_binding')}</div>
            </div>
            """
        html += "</div></div></details>"

    # --- 5. Alternatives ---
    s5 = scenario.get('5_alternative_paths', {})
    if s5:
        unchosen = s5.get('unchosen_options_likely_rollouts', [])
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">6. Alternative Paths</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for u in unchosen:
             for opt in u.get('unchosen_options', []):
                risk = opt.get('risk_level', 'medium').lower()
                risk_tag = "rf-tag-risk-high" if risk == 'high' else "rf-tag-risk-low" if risk == 'low' else "rf-tag-risk-med"
                html += f"""
                 <div class="rf-card" style="border-left-color:#a29bfe;">

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                     <div style="font-weight:bold; color:#6c5ce7;">🔮 What If: {u.get('checkpoint_node')}</div>
                     <div><span class="rf-tag {risk_tag}">Risk: {risk}</span></div>
                    </div>
                     <div style="margin:5px 0;">Option: <b>{opt.get('option_label')}</b></div>
                     <div style="font-style:italic; font-size:0.9em; color:#555;">"{opt.get('most_likely_rollout')}"</div>
                 </div>
                 """
                
        html += "</div>"
        
        # Next Experiment (5. Visualized)
        nxt = s5.get('recommended_next_experiment', {})
        if nxt:
            html += f"""
            <div style="margin-top:15px; border:2px dashed #00b894; background:#f0fdfa; padding:10px; border-radius:6px; display:flex; gap:10px; align-items:center;">
                <div style="font-size:2em;">🎟️</div>
                <div>
                    <div style="font-weight:700; color:#009432;">Recommended: Try Node <b>{nxt.get('recommended_checkpoint')}</b> playing as <b>{nxt.get('recommended_perspective')}</b></div>
                    <div style="font-size:0.85em; opacity:0.8;">Reason: {nxt.get('rationale')}</div>
                </div>
            </div>
            """
        html += "</div></details>"

    # ==========================================================================
    # II. Learner-Level (Green Theme)
    # ==========================================================================
    html += '<div class="rf-chapter-banner rf-bg-green">🧠 II. Learner Profile</div>'

    l1 = learner.get('decision_profile_blind_spots', {})
    l2 = learner.get('personalized_learning_suggestions', {})

    html += """
    <details class="rf-section" open>
        <summary class="rf-section-header">1. Profile & Blind Spots</summary>
        <div class="rf-section-content">
    """
    
    # Archetype
    archs = l1.get('historical_archetype_matching', [])
    if archs:
        a = archs
        html += f"""
        <div style="text-align:center; padding:10px; background:#f0fdfa; border:1px solid #b2f2bb; border-radius:8px; margin-bottom:15px;">
            <div style="font-size:0.8em; text-transform:uppercase; color:#00b894; font-weight:bold;">Historical Archetype</div>
            <div style="font-size:1.6em; font-weight:800; color:#2d3436; margin:4px 0;">{a.get('archetype')}</div>
            <div style="font-style:italic; color:#636e72; font-size:0.9em;">"{a.get('why_fit')}"</div>
            <div class="rf-caveat">⚠️ <b>Note:</b> {a.get('caveat')}</div>
        </div>
        """
    
    html += '<div class="rf-grid">'
    for p in l1.get('decision_pattern_summary', []):
        html += f"<div class='rf-card' style='border-left-color:#00b894;'><b>🧠 Pattern: {p.get('pattern')}</b><div style='font-size:0.9em; color:#555;'>{p.get('explanation')}</div></div>"
    for b in l1.get('blind_spots', []):
        html += f"<div class='rf-card' style='border-left-color:#d63031;'><b style='color:#d63031;'>🚫 Blind Spot: {b.get('blind_spot')}</b><div style='font-size:0.9em; color:#555;'>{b.get('why_it_matters')}</div></div>"
    html += "</div></div></details>"

    # Skills Radar & Next Steps
    radar = l2.get('skill_visualization_radar', {})
    recs = l2.get('coaching_recommendations', [])
    next_steps = l2.get('next_steps', [])
    
    if radar or recs or next_steps:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">2. Skills & Next Steps</summary>
            <div class="rf-section-content">
        """
    if radar:
        html += "<div style='margin-bottom:15px;'>"
        for skill, data in radar.items():
            score = data.get('score', 0) # 0-10
            color = "#00b894" if score >= 8 else "#fdcb6e" if score >= 5 else "#ff7675"
            width = min(score * 10, 100)
            
            html += f"""
            <div class="rf-skill-row">
                <div style="display:flex; justify-content:space-between; font-size:0.9em; font-weight:600;">
                    <span>{skill}</span>
                    <span style="color:{color};">{score}/10</span>
                </div>
                <div class="rf-skill-track"><div class="rf-skill-fill" style="width:{width}%; background:{color};"></div></div>
                <div class="rf-rationale">{data.get('rationale')}</div>
            </div>
            """
        html += "</div>"

        # B. Coaching Recommendations (Quote/Tip Style)
        if recs:
            html += "<div style='font-weight:700; color:#555; margin-bottom:8px;'>💡 Coach's Advice</div>"
            html += '<div class="rf-grid">'
            for r in recs:
                html += f"""
                <div style="background:#fff; border:1px solid #b2bec3; border-left:4px solid #f1c40f; border-radius:6px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <div style="font-size:1.05em; font-weight:600; color:#2d3436; margin-bottom:6px;">
                        📝 "{r.get('recommendation')}"
                    </div>
                    <div style="font-size:0.85em; color:#636e72; background:#f9f9f9; padding:6px; border-radius:4px; margin-top:8px;">
                        <b>Why:</b> {r.get('rationale')}
                    </div>
                </div>
                """
            html += '</div>'

        # C. Next Steps (Ticket/Boarding Pass Style)
        if next_steps:
            html += "<div style='font-weight:700; color:#555; margin:20px 0 8px 0;'>🎟️ Next Experiment Tickets</div>"
            html += '<div class="rf-grid">'
            for ns in next_steps:
                html += f"""
                <div style="border:1px solid #dfe6e9; border-radius:8px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <div style="background:linear-gradient(90deg, #00b894, #55efc4); padding:8px 12px; color:#fff; font-weight:700; font-size:0.9em; display:flex; justify-content:space-between; align-items:center;">
                        <span>NEXT MISSION</span>
                        <span style="font-size:1.2em;">✈️</span>
                    </div>
                    <div style="padding:12px;">
                        <div style="margin-bottom:8px;">
                            <div style="font-size:0.75em; text-transform:uppercase; color:#b2bec3; font-weight:700;">Checkpoint & Role</div>
                            <div style="font-size:1.05em; font-weight:600; color:#2d3436;">
                                {ns.get('recommended_checkpoint')} <span style="font-weight:normal; color:#b2bec3;">as</span> {ns.get('recommended_perspective')}
                            </div>
                        </div>
                        <div style="border-top:2px dashed #dfe6e9; padding-top:8px;">
                            <div style="font-size:0.75em; text-transform:uppercase; color:#b2bec3; font-weight:700;">Learning Goal</div>
                            <div style="font-size:0.9em; color:#0984e3;">{ns.get('learning_goal')}</div>
                        </div>
                    </div>
                </div>
                """
            html += '</div>'
    html += "</div></details>"

    # ==========================================================================
    # III. Meta-Historical (Purple Theme)
    # ==========================================================================
    html += '<div class="rf-chapter-banner rf-bg-purple">🏛️ III. Meta Takeaways</div>'
    m1 = meta
    
    # 1. Anchors
    if m1.get('canonical_fact_anchors'):
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">1. Historical Anchors</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for a in m1.get('canonical_fact_anchors', []):
            html += f"""
            <div class="rf-card" style="border-left-color:#6c5ce7;">
                <div class="rf-card-head">⚓ Real History</div>
                <div style="font-weight:500;">{a.get('fact')}</div>
                <div style="margin-top:5px; font-size:0.85em; color:#555; padding-top:5px; border-top:1px solid #eee;">
                    <b>Contrast:</b> {a.get('contrast_to_branch')}
                </div>
            </div>
            """
        html += "</div></div></details>"

    # 2. Disclaimer & Lessons
    lessons = m1.get('meta_lessons', [])
    disclaimers = m1.get('simulation_disclaimer', [])
    
    if lessons or disclaimers:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">2. Philosophy & Limitations</summary>
            <div class="rf-section-content">
        """
        
        # Part A: Meta Lessons (The "Wisdom")
        if lessons:
            html += '<div class="rf-section-subtitle">🎓 Historical Wisdom</div>'
            html += '<div class="rf-grid">'
            for l in lessons:
                html += f"""
                <div class="rf-lesson-card">
                    <div class="rf-lesson-content">“{l}”</div>
                </div>
                """
            html += "</div>"
            
        # Part B: Disclaimers (The "Constraints")
        if disclaimers:
            # 如果上面有 Lessons，加个分割线或者间距
            margin_top = "20px" if lessons else "0px"
            html += f'<div class="rf-section-subtitle" style="margin-top:{margin_top};">⚠️ Model Limitations</div>'
            html += '<div class="rf-grid">'
            for d in disclaimers:
                html += f"""
                <div class="rf-card" style="border-left-color:#e17055; background:#fff5f5;">
                    <div style="font-weight:bold; color:#c0392b; margin-bottom:4px;">❗ {d.get('assumption')}</div>
                    <div style="font-size:0.9em; color:#7f8c8d; line-height:1.4;">{d.get('why_uncertain')}</div>
                </div>
                """
            html += "</div>"
            
        html += "</div></details>"
    

    # 3. Transfer (Visualized as Split Card)
    if m1.get('transferable_patterns'):
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">3. Transferable Patterns</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for t in m1.get('transferable_patterns', []):
            html += f"""
            <div class="rf-card" style="border-left-color:#6c5ce7;">
                <div style="font-weight:800; color:#6c5ce7; font-size:1.1em; text-align:center; margin-bottom:8px;">🗝️ {t.get('pattern')}</div>
                <div class="rf-transfer-row">
                    <div class="rf-transfer-box rf-trans-hist">
                        <b>📜 Then (In Episode):</b><br>{t.get('in_episode')}
                    </div>
                    <div class="rf-transfer-box rf-trans-mod">
                        <b>🌍 Now (Modern Parallel):</b><br>{t.get('modern_parallel')}
                    </div>
                </div>
            </div>
            """
        html += "</div></div></details>"

    html += "</div>" # End Root
    
    minified_html = re.sub(r'\s+', ' ', html)
    
    return minified_html