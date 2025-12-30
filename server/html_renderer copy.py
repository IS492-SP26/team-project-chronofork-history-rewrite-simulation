# html_renderer.py

import re


def render_reflection_report(report_data):
    if not report_data:
        return "<div style='color:red; padding:20px;'>⚠️ Error: No report data available.</div>"

    # Data Unpacking
    overview = report_data.get("0_report_overview", {})
    scenario = report_data.get("I_scenario_analysis", {})
    learner = report_data.get("II_learner_level_reflection", {})
    meta = report_data.get("III_meta_historical_takeaways", {})

    # ==========================
    # CSS Styles (Ultimate Version)
    # ==========================
    css = """
    <style>
        .rf-root { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            font-size: 14px; line-height: 1.5; color: #2d3436; 
            background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #dfe6e9; 
        }
        
        /* Headers */
        .rf-h1 { font-size: 1.4em; font-weight: 800; text-align: center; color: #2d3436; margin: 5px 0; }
        .rf-meta { font-size: 0.85em; color: #636e72; text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px dashed #b2bec3; }
        .rf-chapter-banner { 
            font-size: 1.1em; font-weight: 700; color: #fff; padding: 10px 12px; border-radius: 6px; 
            margin: 30px 0 15px 0; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .rf-bg-blue { background: linear-gradient(135deg, #0984e3, #74b9ff); }
        .rf-bg-green { background: linear-gradient(135deg, #00b894, #55efc4); }
        .rf-bg-purple { background: linear-gradient(135deg, #6c5ce7, #a29bfe); }

        /* Sections */
        details.rf-section { margin-bottom: 20px; background: #fff; }
        summary.rf-section-header { 
            padding: 8px 0; font-weight: 700; font-size: 1.05em; color: #2d3436; 
            cursor: pointer; list-style: none; border-bottom: 2px solid #f1f2f6; margin-bottom: 10px;
            display: flex; justify-content: space-between; align-items: center;
        }
        summary.rf-section-header::-webkit-details-marker { display: none; }
        summary.rf-section-header::after { content: '▼'; font-size: 0.8em; color: #b2bec3; transition: 0.2s; }
        details[open] > summary.rf-section-header::after { transform: rotate(180deg); }

        /* Grids */
        .rf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
        
        /* Cards */
        .rf-card { 
            background: #fff; border: 1px solid #dfe6e9; border-radius: 6px; padding: 12px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column;
        }
        .rf-card-head { font-weight: 700; margin-bottom: 8px; color: #2d3436; display: flex; justify-content: space-between; align-items: center; }
        
        /* Specialized Visuals */
        /* Stakeholder Quad */
        .rf-quad-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px; }
        .rf-quad-item { background: #f8f9fa; padding: 6px; border-radius: 4px; font-size: 0.85em; border: 1px solid #f1f2f6; }
        .rf-quad-label { display: block; font-weight: 700; font-size: 0.75em; text-transform: uppercase; margin-bottom: 2px; }
        
        /* Plausibility Report */
        .rf-plaus-box { background: #f0f3f5; padding: 12px; border-radius: 6px; border-left: 4px solid #34495e; }
        .rf-plaus-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; font-size: 0.9em; }
        
        /* Fog 2x2 */
        .rf-fog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #dfe6e9; border: 1px solid #dfe6e9; border-radius: 6px; overflow: hidden; }
        .rf-fog-cell { background: #fff; padding: 8px; }
        .rf-fog-title { font-weight: 700; font-size: 0.8em; text-transform: uppercase; color: #636e72; margin-bottom: 4px; display: block; }
        
        /* Meta Lessons */
        .rf-lesson-card { 
            background: #fef9e7; border-left: 4px solid #f1c40f; padding: 10px 15px; 
            margin-bottom: 8px; font-size: 0.95em; color: #574b08; border-radius: 4px; position: relative;
        }
        .rf-lesson-card::before { content: '💡'; position: absolute; left: 10px; top: 10px; font-size: 1.2em; opacity: 0.5; }
        .rf-lesson-content { padding-left: 25px; font-style: italic; }

        /* Timeline & Tags */
        .rf-timeline { position: relative; padding-left: 15px; border-left: 2px solid #dfe6e9; margin-left: 5px; }
        .rf-time-item { margin-bottom: 12px; position: relative; }
        .rf-time-dot { position: absolute; left: -21px; top: 2px; width: 10px; height: 10px; border-radius: 50%; background: #b2bec3; border: 2px solid #fff; box-shadow: 0 0 0 1px #dfe6e9; }
        .rf-time-dot.tp { background: #e17055; width: 12px; height: 12px; left: -22px; }
        .rf-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 700; margin-right: 4px; background: #dfe6e9; color: #636e72; }
        .rf-tag-risk-high { background: #ff7675; color: #fff; }
        .rf-tag-risk-med { background: #ffeaa7; color: #d35400; }
        .rf-tag-risk-low { background: #55efc4; color: #009432; }

        /* Disclaimer */
        .rf-disclaimer { text-align: center; margin-top: 30px; padding: 15px; background: #f1f2f6; border-radius: 8px; color: #636e72; font-size: 0.9em; border: 1px solid #e0e0e0; }
        
        /* Archetype Caveat */
        .rf-caveat { margin-top: 8px; padding: 6px; background: #fff3cd; color: #856404; font-size: 0.85em; border-radius: 4px; display: flex; gap: 5px; }
    </style>
    """
    
    html = f"{css}<div class='rf-root'>"

    # --- 0. Header ---
    snap = overview.get('timeline_snapshot', {})
    html += f"""
    <div class="rf-h1">📜 Reflection Report</div>
    <div class="rf-meta">
        🏷️ <b>Episode:</b> {overview.get('episode_id', 'N/A')} &nbsp;|&nbsp; 
        ⏳ <b>Timeline:</b> {snap.get('start', '?')} ➔ {snap.get('end', '?')}
    </div>
    """

    # ==========================================================================
    # I. Scenario Analysis
    # ==========================================================================
    html += '<div class="rf-chapter-banner rf-bg-blue">🔍 I. Scenario Analysis</div>'

    # 1. Decision Context (Trade-offs)
    s1 = scenario.get('1_decision_context', {})
    tradeoffs = s1.get('tradeoff_map', [])
    if tradeoffs:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">1. Decision Context (Trade-offs)</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for t in tradeoffs:
            html += f"""
            <div class="rf-card" style="border-left-color:#0984e3;">
                <div class="rf-card-head" style="color:#0984e3;">⚖️ {t.get('dimension')}</div>
                <div style="font-size:0.9em;"><b>Conflict:</b> {' vs '.join(t.get('tensions', []))}</div>
                <div style="font-size:0.85em; color:#636e72; margin-top:4px;">"{t.get('why_it_matters')}"</div>
            </div>
            """
        html += "</div></div></details>"

    # 2. Stakeholders (Visualized)
    stakeholders = s1.get('stakeholders_constraints', [])
    if stakeholders:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">2. Stakeholders & Constraints</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for s in stakeholders:
            def li(items): return "".join([f"<li>{x}</li>" for x in items[:2]])
            html += f"""
            <div class="rf-card" style="border-left-color:#74b9ff;">
                <div class="rf-card-head">👤 {s.get('stakeholder')}</div>
                <div class="rf-quad-grid">
                    <div class="rf-quad-item"><span class="rf-quad-label" style="color:#27ae60;">🎯 Goals</span><ul style="margin:0; padding-left:10px;">{li(s.get('goals', []))}</ul></div>
                    <div class="rf-quad-item"><span class="rf-quad-label" style="color:#c0392b;">🚫 Red Lines</span><ul style="margin:0; padding-left:10px;">{li(s.get('red_lines', []))}</ul></div>
                    <div class="rf-quad-item"><span class="rf-quad-label" style="color:#2980b9;">🔧 Levers</span><ul style="margin:0; padding-left:10px;">{li(s.get('levers', []))}</ul></div>
                    <div class="rf-quad-item"><span class="rf-quad-label" style="color:#7f8c8d;">⛓️ Constraints</span><ul style="margin:0; padding-left:10px;">{li(s.get('constraints', []))}</ul></div>
                </div>
            </div>
            """
        html += "</div></div></details>"

    # 3. Outcome Analysis
    s2 = scenario.get('2_outcome_analysis', {})
    if s2:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">3. Outcomes & Causal Chain</summary>
            <div class="rf-section-content">
        """
        # Outcomes
        html += '<div class="rf-grid">'
        for o in s2.get('outcome_dashboard', []):
            score = o.get('confidence', 50)
            score_10 = round(score / 10, 1)
            color = "#00b894" if score >= 70 else "#fdcb6e" if score >= 40 else "#ff7675"
            html += f"""
            <div class="rf-card" style="border-left-color:{color};">
                <div class="rf-card-head">
                    <span>📊 {o.get('dimension')}</span>
                    <span style="background:{color}; color:#fff; padding:1px 6px; border-radius:3px; font-size:0.8em;">{score_10}/10</span>
                </div>
                <div style="font-size:0.95em; margin-bottom:8px;">{o.get('assessment')}</div>
                <div style="background:#e3f2fd; color:#2980b9; padding:5px; border-radius:4px; font-size:0.85em; margin-bottom:4px;">
                    ⚡ <b>Short:</b> {o.get('short_term')}
                </div>
                <div style="background:#fdedec; color:#c0392b; padding:5px; border-radius:4px; font-size:0.85em;">
                    ⏳ <b>Long:</b> {o.get('long_term_unintended_cost')}
                </div>
            </div>
            """
        html += '</div>'

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

        # Plausibility (8. Comprehensive Display)
        plaus = s2.get('plausibility_check', {})
        if plaus:
            html += f"""
            <div class="rf-plaus-box" style="margin-top:20px;">
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

    # 4. Fog of War (Information Limits)
    s3 = scenario.get('3_information_limits', {})
    if s3:
        knowable = s3.get('what_was_knowable', {})
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">4. Fog of War & Hindsight</summary>
            <div class="rf-section-content">
        """
        # Fog Grid (6. Comprehensive)
        if knowable:
            html += f"""
            <div style="margin-bottom:15px;">
                <div style="font-weight:700; color:#636e72; margin-bottom:5px;">🌫️ What Was Knowable Then?</div>
                <div class="rf-fog-grid">
                    <div class="rf-fog-cell"><span class="rf-fog-title">✅ Available</span>{'; '.join(knowable.get('available_information', []))}</div>
                    <div class="rf-fog-cell"><span class="rf-fog-title">🚫 Gaps</span>{'; '.join(knowable.get('information_gaps', []))}</div>
                    <div class="rf-fog-cell"><span class="rf-fog-title">📶 Quality</span>{'; '.join(knowable.get('info_quality_notes', []))}</div>
                    <div class="rf-fog-cell"><span class="rf-fog-title">🎲 Chance</span>{'; '.join(knowable.get('chance_and_fog_factors', []))}</div>
                </div>
            </div>
            """
        
        # Hindsight Cards
        hindsight = s3.get('hindsight_flags', [])
        if hindsight:
            html += "<div class='rf-grid'>"
            for h in hindsight:
                html += f"""
                <div class="rf-card" style="border-left-color:#e17055;">
                    <div class="rf-card-head" style="color:#c0392b;">🚩 {h.get('flag')}</div>
                    <div style="font-size:0.9em; margin-bottom:5px;">{h.get('why_unrealistic_then')}</div>
                    <div style="background:#f0fdf4; color:#27ae60; padding:5px; border-radius:4px; font-size:0.85em;">
                        <b>Reframe:</b> {h.get('period_consistent_reframe')}
                    </div>
                </div>
                """
            html += "</div>"
        html += "</div></details>"

    # 5. Structure vs Agency
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
                <div class="rf-card-head">💪 Agency (Leverage)</div>
                <div style="font-weight:bold;">{lev.get('action_summary')}</div>
                <div style="font-size:0.9em; opacity:0.8; margin-top:4px;">Impact: {lev.get('why_it_mattered')}</div>
            </div>
            """
        # Constraints (7. Comprehensive)
        for const in s4.get('structural_constraints', []):
            html += f"""
            <div class="rf-card" style="border-left-color:#636e72; background:#f8f9fa;">
                <div class="rf-card-head">🧱 Constraint: {const.get('constraint')}</div>
                <div style="font-size:0.9em;">{const.get('why_binding')}</div>
                <div style="font-size:0.85em; font-style:italic; color:#636e72; margin-top:5px;">
                    Mitigation: {const.get('mitigation_if_any', 'None')}
                </div>
            </div>
            """
        html += "</div></div></details>"

    # 6. Alternative Paths
    s5 = scenario.get('5_alternative_paths', {})
    if s5:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">6. Alternative Paths</summary>
            <div class="rf-section-content">
        """
        # Unchosen Options
        if s5.get('unchosen_options_likely_rollouts'):
            html += "<div class='rf-grid'>"
            for u in s5.get('unchosen_options_likely_rollouts', []):
                checkpoint = u.get('checkpoint_node')
                for opt in u.get('unchosen_options', []):
                    risk = opt.get('risk_level', 'medium').lower()
                    risk_tag = "rf-tag-risk-high" if risk == 'high' else "rf-tag-risk-low" if risk == 'low' else "rf-tag-risk-med"
                    html += f"""
                    <div class="rf-card" style="border-left-color:#a29bfe;">
                        <div class="rf-card-head" style="color:#6c5ce7;">🔮 Fork at {checkpoint}</div>
                        <div style="font-weight:bold; margin-bottom:4px;">Not Chosen: "{opt.get('option_label')}"</div>
                        <div style="font-style:italic; font-size:0.9em; color:#555; margin-bottom:5px;">
                            "{opt.get('most_likely_rollout')}"
                        </div>
                        <div><span class="rf-tag {risk_tag}">Risk: {risk}</span></div>
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
                    <div style="font-weight:700; color:#009432;">Recommended Next Experiment</div>
                    <div style="font-size:0.95em;">Try Node <b>{nxt.get('recommended_checkpoint')}</b> playing as <b>{nxt.get('recommended_perspective')}</b></div>
                    <div style="font-size:0.85em; opacity:0.8;">Reason: {nxt.get('rationale')}</div>
                </div>
            </div>
            """
        html += "</div></details>"

    # ==========================================================================
    # II. Learner-Level
    # ==========================================================================
    html += '<div class="rf-chapter-banner rf-bg-green">🧠 II. Learner Profile</div>'
    l1 = learner.get('decision_profile_blind_spots', {})
    l2 = learner.get('personalized_learning_suggestions', {})

    # 7. Decision Profile
    html += """
    <details class="rf-section" open>
        <summary class="rf-section-header">7. Profile & Blind Spots</summary>
        <div class="rf-section-content">
    """
    # Archetype (4. Dict & Caveat)
    archs = l1.get('historical_archetype_matching', [])
    if archs:
        a = archs
        html += f"""
        <div style="text-align:center; padding:15px; background:#f1f2f6; border-radius:8px; margin-bottom:15px;">
            <div style="font-size:0.8em; text-transform:uppercase; color:#00b894; font-weight:bold;">Historical Archetype</div>
            <div style="font-size:1.6em; font-weight:800; color:#2d3436; margin:5px 0;">{a.get('archetype')}</div>
            <div style="font-style:italic; color:#636e72;">"{a.get('why_fit')}"</div>
            <div class="rf-caveat">⚠️ <b>Note:</b> {a.get('caveat')}</div>
        </div>
        """
    # Patterns & Blinds
    html += '<div class="rf-grid">'
    for p in l1.get('decision_pattern_summary', []):
        html += f"<div class='rf-card' style='border-left-color:#00b894;'><b>🧠 Pattern: {p.get('pattern')}</b><div style='font-size:0.9em; color:#555;'>{p.get('explanation')}</div></div>"
    for b in l1.get('blind_spots', []):
        html += f"<div class='rf-card' style='border-left-color:#d63031;'><b style='color:#d63031;'>🚫 Blind Spot: {b.get('blind_spot')}</b><div style='font-size:0.9em; color:#555;'>{b.get('why_it_matters')}</div></div>"
    html += "</div></div></details>"

    # 8. Suggestions
    html += """
    <details class="rf-section" open>
        <summary class="rf-section-header">8. Personalized Suggestions</summary>
        <div class="rf-section-content">
    """
    # Skill Radar (3. Rationale)
    radar = l2.get('skill_visualization_radar', {})
    if radar:
        html += "<div style='margin-bottom:15px;'>"
        for skill, data in radar.items():
            score = data.get('score', 0) # 0-10
            color = "#00b894" if score >= 8 else "#fdcb6e" if score >= 5 else "#ff7675"
            width = min(score * 10, 100)
            html += f"""
            <div style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; font-size:0.9em; font-weight:600;">
                    <span>{skill}</span><span style="color:{color};">{score}/10</span>
                </div>
                <div style="height:8px; background:#dfe6e9; border-radius:4px; margin:4px 0; overflow:hidden;">
                    <div style="width:{width}%; background:{color}; height:100%;"></div>
                </div>
                <div style="font-size:0.85em; color:#636e72;">{data.get('rationale')}</div>
            </div>
            """
        html += "</div>"
    
    # Coaching (3. Visualized)
    recs = l2.get('coaching_recommendations', [])
    if recs:
        for r in recs:
            html += f"""
            <div style="padding:10px; background:#e8f6f3; border-radius:6px; border-left:4px solid #00b894; margin-bottom:10px;">
                <div style="font-weight:bold; color:#16a085;">💡 Coach Recommendation</div>
                <div>{r.get('recommendation')}</div>
                <div style="font-size:0.85em; opacity:0.8; margin-top:2px;">{r.get('rationale')}</div>
            </div>
            """
    
    # Next Steps (3. Visualized)
    steps = l2.get('next_steps', [])
    if steps:
        html += "<div style='font-weight:700; margin-top:10px; margin-bottom:5px;'>👣 Next Learning Steps:</div><div class='rf-grid'>"
        for ns in steps:
            html += f"""
            <div style="background:#f8f9fa; border:1px solid #dfe6e9; padding:8px; border-radius:4px; font-size:0.9em;">
                <div>📍 <b>{ns.get('recommended_checkpoint')}</b> ({ns.get('recommended_perspective')})</div>
                <div style="color:#636e72;">Goal: {ns.get('learning_goal')}</div>
            </div>
            """
        html += "</div>"
    html += "</div></details>"

    # ==========================================================================
    # III. Meta-Historical
    # ==========================================================================
    html += '<div class="rf-chapter-banner rf-bg-purple">🏛️ III. Meta Takeaways</div>'
    m1 = meta

    # 9. Anchors
    anchors = m1.get('canonical_fact_anchors', [])
    if anchors:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">9. Historical Anchors</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for a in anchors:
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

    # 10. Lessons (1. Visualized)
    lessons = m1.get('meta_lessons', [])
    if lessons:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">10. Meta Lessons</summary>
            <div class="rf-section-content">
        """
        for l in lessons:
            html += f"""
            <div class="rf-lesson-card">
                <div class="rf-lesson-content">{l}</div>
            </div>
            """
        html += "</div></details>"

    # 11. Transfer
    transfers = m1.get('transferable_patterns', [])
    if transfers:
        html += """
        <details class="rf-section" open>
            <summary class="rf-section-header">11. Transferable Patterns</summary>
            <div class="rf-section-content"><div class="rf-grid">
        """
        for t in transfers:
            html += f"""
            <div class="rf-card" style="border-left-color:#a29bfe; background:#f3e5f5;">
                <div class="rf-card-head" style="color:#6c5ce7;">🗝️ {t.get('pattern')}</div>
                <div style="background:#e1bee7; padding:6px; border-radius:4px; font-size:0.9em; margin-bottom:5px;">
                    <b>📜 Then:</b> {t.get('in_episode')}
                </div>
                <div style="background:#d1c4e9; padding:6px; border-radius:4px; font-size:0.9em;">
                    <b>🌍 Now:</b> {t.get('modern_parallel')}
                </div>
            </div>
            """
        html += "</div></div></details>"

    # Disclaimer (2. Centered)
    disclaimers = m1.get('simulation_disclaimer', [])
    if disclaimers:
        html += "<div class='rf-disclaimer'><b>⚠️ Simulation Disclaimer</b><br>"
        for d in disclaimers:
            html += f"<div>{d.get('assumption')} ({d.get('why_uncertain')})</div>"
        html += "</div>"

    html += "</div>" # End Root
    
    minified_html = re.sub(r'\s+', ' ', html)
    
    # 保存html文件供调试
    with open("type8.html", "w", encoding="utf-8") as f:
        f.write(html)
    
    return minified_html