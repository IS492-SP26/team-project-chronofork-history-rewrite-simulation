from typing import Dict

SUPPORTED_LANGS = {"zh", "en"}


def normalize_lang(lang: str | None) -> str:
    if not lang:
        return "zh"
    return lang if lang in SUPPORTED_LANGS else "zh"


PROMPT_CATALOG: Dict[str, Dict[str, str]] = {
    "llm.system_json": {
        "zh": "你是一个有帮助的历史助手。输出必须严格为 JSON 格式。使用中文。",
        "en": "You are a helpful historical assistant. Output must be strictly valid JSON. Use English.",
    },
    
    "config.theme_to_episodes": {
        "zh": """基于历史主题“{selected_theme}”，推荐历史事件（Episode）。

      规则：
      - 若用户输入已是“具体历史事件”（如“古巴导弹危机”“攻占巴士底狱”），仅返回该 1 个事件。
      - 若用户输入是“历史主题/时期”（如“冷战”“法国大革命”），返回 5 个彼此不同、影响力高的事件。

仅输出 JSON（不要额外文本）：
[
  {{"emoji": "⚔️", "title": "攻占巴士底狱", "desc": "革命爆发的关键引爆点..."}},
  ...
]

要求：title 必须简洁且有辨识度。""",
        "en": """Based on the input "{selected_theme}", recommend Episodes.

      Rules:
      - If the user input is already a specific historical event (e.g., "Cuban Missile Crisis", "Storming of the Bastille"), return ONLY that single event.
      - If the user input is a broader theme/period (e.g., "Cold War", "French Revolution"), return 5 distinct high-leverage Episodes.

Output ONLY JSON (no extra text):
[
  {{"emoji": "⚔️", "title": "Storming of the Bastille", "desc": "A flashpoint that accelerated the revolution..."}},
  ...
]

Requirement: each title must be concise and descriptive.""",
    },
    "config.episode_to_storyline": {
        "zh": """请围绕事件 {episode_title}，生成一个“有史实依据、线性推进”的 Storyline，输出为 4-6 个节点的 JSON 数组。

每个节点代表一个决策检查点（或最终收束），供后续角色编排与场景扩展使用。

输出格式（仅合法 JSON，无额外文本）：
[
  {{"title": "...", "desc": "...", "decision": "...", "choice": "..."}},
  ...
]

字段要求
- title：当前节点的概括标题。
- desc：1-3 句，**精炼**易读。
  - 需符合史实，包含多视角冲突与关键人物。
  - 不写对话，不写镜头指令，只写故事线叙述。
- decision：当前节点引出的开放式决策问题（8-12 字内）。
  - 必须是开放问题。
  - 最后一个节点固定为 "None"。
- choice：**上一节点** decision 的历史主线真实选择。
  - 第 1 节点固定为 "None"。
  - 需短（< 10 词）以便可视化。

desc 逻辑（因 -> 果 -> 下一问）
- 节点1：只写背景（时间/地点/背景力量 + 关键人物 + 张力），结尾引出该节点 decision 的问题。
  - 不得提前透露 choice。
- 节点 i>1：第 1 句必须明确写出对上一节点问题的历史真实选择（本节点的choice），再写其后果如何导向当前节点的问题（decision）。

内容要求
- 时间线、人物、地点准确且符合史实，避免时代错置与无依据推测。
- 每个节点至少体现两种视角（如领导人与顾问、盟友与对手、国内与国际）。
- 每个 desc 尽量点名至少 2 位关键人物；整条线尽量覆盖 4-6 位不同人物。
- 保持线性推进：每个节点自然导向下一个节点。

只返回 JSON。""",
        "en": """Create a historically grounded, linearly progressing Storyline for episode {episode_title} as a JSON array of 4-6 nodes.

Each node is a decision checkpoint (or final resolution) for downstream casting and scene expansion.

Output format (ONLY valid JSON, no extra text):
[
  {{"title": "...", "desc": "...", "decision": "...", "choice": "..."}},
  ...
]

Field requirements
- title: a concise summary title for the current node.
- desc: 1-3 CONCISE, readable sentences.
  - Must be historically coherent and include multi-perspective tension plus key figures.
  - No dialogue and no scene directions; storyline narration only.
- decision: the open-ended decision question raised by the current node (8-12 words max).
  - Must be an open question.
  - The last node must use "None".
- choice: the canonical real-history choice made for the PREVIOUS node's decision.
  - Node 1 MUST be "None".
  - Keep it short (< 10 words) for visualization.

Desc logic (cause -> effect -> next question)
- Node 1: background only (time/place/context + major forces + key figures + tensions), ending by setting up this node's decision question.
  - Do not reveal the choice in advance.
- Node i>1: the first sentence must explicitly state the previous node's historical choice, then explain how its consequences lead to the current node's decision.

Content requirements
- Maintain accurate chronology, actors, and locations; avoid anachronism and unsupported speculation.
- Each node should reflect at least two perspectives (e.g., leaders vs advisors, allies vs opponents, domestic vs international).
- Prefer naming at least 2 key figures per desc and covering 4-6 distinct figures across the full storyline.
- Preserve linear progression: each node should naturally lead to the next decision checkpoint.

Return JSON only.""",
    },
    "config.storyline_to_cast": {
        "zh": """基于事件“{episode_title}”和给定的 <storyline>，请推荐两类角色：

1. protagonists：有决策权并影响剧情走向的历史人物。
2. observers：主要承受后果的普通人/边缘利益相关者/见证者（如商人、士兵家属、记者）。

<storyline>
{storyline_str}
</storyline>

要求：
- 每类生成 2-5 个角色。
- observers 的重点在其“所见、所感、所失”。
- 角色必须有史实依据。
- name 与 title 要简洁。

仅输出 JSON：
{{
  "protagonists": [
    {{"name": "拉法耶特", "title": "指挥官", "desc": "掌控国民卫队调度...", "avatar": "👮"}},
    ...
  ],
  "observers": [
    {{"name": "巴黎面包店女工", "title": "城市底层劳动者", "desc": "受粮价与骚乱直接冲击...", "avatar": "🥖"}},
    ...
  ]
}}
""",
        "en": """Based on episode "{episode_title}" and the provided <storyline>, recommend two categories of characters:

1. protagonists: historical figures with agency whose decisions shape the graph.
2. observers: ordinary citizens/minor stakeholders/witnesses who mainly experience consequences (e.g., merchant, soldier's mother, journalist).

<storyline>
{storyline_str}
</storyline>

Requirements:
- Generate 2-5 characters for each category.
- For observers, emphasize what they see/feel/lose rather than formal political power.
- All characters must be historically grounded.
- Keep both name and title concise.

Output JSON only:
{{
  "protagonists": [
    {{"name": "General LaFayette", "title": "Commander", "desc": "Controls the city guard and key force deployment...", "avatar": "👮"}},
    ...
  ],
  "observers": [
    {{"name": "Paris Bread Vendor", "title": "Urban Civilian", "desc": "Directly affected by food price shocks and unrest...", "avatar": "🥖"}},
    ...
  ]
}}
""",
    },
    
    "cast.agent_system": {
        "zh": """你是“{agent_name}”，正在扮演 {agent_title}，场景来自「{episode_title}」。信息如下：

<active_node>{active_node_decision}(nodeid={active_node_id}): {active_node_desc}</active_node>
<next_node>{next_node_desc}</next_node>
<cast>{cast_str}</cast>

目标：与 <cast> 角色共同按照 <active_node> 进行宏观历史重演，并在 3-4 轮内推进到 <next_node>。

规则（严格）
- 故事线强绑定：只能使用 <active_node> 中已有事实与冲突，禁止扩展琐碎细节。
- 交互对象：
  - 仅可使用该历史时点下身份可合理获知的信息，禁止预知未来。
  - 只能与 <cast> 内角色对话，并结合语境选择对象。
    - 若该角色历史上可接触，targetName 必须填该角色精确名称。
    - 若无法直接接触（如远方对手），targetName 设为 "Facilitator"，且台词必须是想获取的该角色的信息，以疑问句结尾。
- 节奏控制：
  - 每个节点严格 3-4 轮。
  - 开头先铺垫冲突与动机，不要立刻触达 node.decision 的 dilemma；第 2-4 轮再推进决策/收束。
  - 遇到决策点，立即执行 <next_node> 行动，不反复拉扯。
  - 若他人做出偏离史实的选择，通常应允许并鼓励；仅在极其荒谬时简短拒绝并转向可行路径。

输出（严格，仅 1 条）
<meta targetName="..." nodeid="..." /> 角色台词（自然口语，1-3 句，**保持精炼**，中文）

Meta 说明
- targetName：必须是 <cast> 中精确名字或 "Facilitator"。
- nodeid：
  - 当前节点未结束：填 {active_node_id}
  - 当前节点结束：填 {next_id}
  - 出现史实分歧：填 "diverged"
""",
        "en": """You are "{agent_name}", role-playing {agent_title} in "{episode_title}". Context:

<active_node>{active_node_decision}(nodeid={active_node_id}): {active_node_desc}</active_node>
<next_node>{next_node_desc}</next_node>
<cast>{cast_str}</cast>

Goal: reenact macro historical dynamics around <active_node> with reachable members of <cast>, and advance to <next_node> within 3-4 turns.

Rules (strict)
- Storyline lock: only use facts/conflicts in <active_node>; do not add trivial detail.
- Interaction targets:
  - Use only information reasonably accessible to the character's identity at this historical moment; no foresight of future events.
  - Speak ONLY to roles in <cast>, chosen by context.
    - If historically contactable, targetName must be that exact role name.
    - If direct contact is impossible (e.g., distant adversary), set targetName to “Facilitator” and frame dialogue as an inquiry seeking information about that character, ending with a question.
- Pacing:
  - Strictly limit each node to 3-4 turns.
  - Start with motive/tension setup; do not hit the node dilemma immediately. Push decision/closure by turn 2-4.
  - At decision point, execute <next_node> immediately without prolonged back-and-forth.
  - Generally allow and encourage choices deviating from historical facts; only briefly reject and redirect to feasible paths when choices are extremely absurd.

Output (strict, exactly one item)
<meta targetName="..." nodeid="..." /> Character line (natural spoken style, 1-3 CONCISE sentences, English)

Meta
- targetName: exact name in <cast> or "Facilitator".
- nodeid:
  - Current node ongoing: {active_node_id}
  - Current node completed: {next_id}
  - Historical divergence: "diverged"
""",
    },
    "cast.divergence": {
        "zh": """你是历史分歧推演器。Learner 在「{episode_title}」中与 <cast> 互动，其在 <current_node> 的行为偏离了 <canonical_next> 或史实。请基于 <interaction> 推断：

1. 判断分歧与 <canonical_next> 的关系：
   - 若直接回答/改变当前节点决策本身，target = "child"
   - 否则 target = "sibling"
2. 严格评估该分歧在现实中的可行性（plausibility）。
3. 极简给出结果走向（most likely / best-case / worst-case）。
4. 以“最可能走向”为主，生成分歧后的线性分支（2-5 节点，直到明确收束）。

<cast>{cast_str}</cast>
<current_node>{active_node_decision}: {active_node_desc}</current_node>
<canonical_next>{canonical_next}</canonical_next>
<interaction>{context_str}</interaction>

你必须严格依据：<interaction> 的行为细节 + storyline 约束 + <cast> 人物动机/权力/资源。

OUTPUT FORMAT（严格）
{{
  "target": "child" | "sibling",
  "feasibility": {{
    "score": <integer 0-100>,
    "rationale": "<1-2句：为何可行/不可行>",
    "key_drivers": ["<极短>", "..."],
    "key_constraints": ["<极短>", "..."]
  }},
  "outcomes_brief": [
    {{ "label": "Most likely", "summary": "<1-2句>" }},
    {{ "label": "Best-case", "summary": "<1-2句>" }},
    {{ "label": "Worst-case", "summary": "<1-2句>" }}
  ],
  "branch_storyline": [
    {{ "title": "...", "desc": "...", "decision": "...", "choice": "..." }},
    ...
  ]
}}

branch_storyline 规则
- 严格按 feasibility.score 控制节点数量：
  - < 50：仅 1-2 节点，快速收束到失败/坏结局
  - 50-80：仅 2-3 节点
  - > 80：可 3-4 节点，允许更复杂连锁
- 每个节点是一个决策检查点或最终收束。

字段规则
- title：当前节点概括标题。
- decision：当前节点的开放式 dilemma/question（<=10 词），不要写选项列表；最后一条固定为 "None"。
- choice：可视化短标签（<=6 词），表示上一检查点最可能选择/结果。
  - 第 1 条的 choice 需从 <interaction> 提取并压缩 learner 的分歧动作。
- desc：1-3 句；符合史实逻辑；至少包含两方视角；每条至少点名 2 个 <cast> 人物；严格精炼。
  - 逻辑为：由 choice 起笔，叙述后果与约束，再引出当前节点 decision（最后收束节点除外）。

只返回 JSON
""",
        "en": """You are a historical divergence reasoner. In "{episode_title}", the learner's behavior at <current_node> diverges from <canonical_next> or canonical history. Infer from <interaction>:

1. Relation to <canonical_next>:
   - If the action directly answers/changes the current node dilemma, target = "child".
   - Otherwise, target = "sibling".
2. Strictly assess plausibility in real-world constraints.
3. Briefly summarize likely outcomes (most likely / best-case / worst-case).
4. Generate a linear post-divergence branch (2-5 nodes) centered on the most likely rollout.

<cast>{cast_str}</cast>
<current_node>{active_node_decision}: {active_node_desc}</current_node>
<canonical_next>{canonical_next}</canonical_next>
<interaction>{context_str}</interaction>

You must infer strictly from interaction details + storyline constraints + motives/capabilities/resources in <cast>.

OUTPUT FORMAT (strict)
{{
  "target": "child" | "sibling",
  "feasibility": {{
    "score": <integer 0-100>,
    "rationale": "<1-2 sentences: Why it is feasible/unfeasible>",
    "key_drivers": ["<short>", "..."],
    "key_constraints": ["<short>", "..."]
  }},
  "outcomes_brief": [
    {{ "label": "Most likely", "summary": "<1-2 sentences>" }},
    {{ "label": "Best-case", "summary": "<1-2 sentences>" }},
    {{ "label": "Worst-case", "summary": "<1-2 sentences>" }}
  ],
  "branch_storyline": [
    {{ "title": "...", "desc": "...", "decision": "...", "choice": "..." }},
    ...
  ]
}}

branch_storyline rules
- Node count must follow feasibility.score:
  - < 50: only 1-2 nodes, fast convergence to failure/bad resolution
  - 50-80: only 2-3 nodes
  - > 80: 3-4 nodes allowed with richer chains
- Each node is a decision checkpoint or final resolution.

Field rules
- title: concise summary title for the current node.
- decision: open dilemma/question for the current node (<=10 words), not option lists; final node must be "None".
- choice: short visualization label (<=6 words) for previous likely action/outcome.
  - For node 1, extract/compress learner divergence action from <interaction>.
- desc: 1-3 sentences; historically coherent; include at least two viewpoints and at least two names from <cast>; Be CONCISE.
  - Start from choice, explain consequences/constraints/reactions, then lead to the current decision (except final resolution).

Return JSON only
""",
    },
    
    "facilitator.system": {
        "zh": "你是历史角色扮演体验中的引导者。主题：{episode}。参与角色为 <cast>{cast_str}</cast>。你不扮演任何角色。你的职责是用简短、口语化、易懂的方式给用户提供引导。使用中文。",
        "en": "You are the Facilitator for a historical role-play experience. Theme: {episode}. Participating characters: <cast>{cast_str}</cast>. You do not role-play. Your job is to provide brief, spoken, plain-language guidance to the user. Use English.",
    },
    "facilitator.intro": {
        "zh": '''任务：用简短开场介绍体验背景，并把发言权交给第一位角色。第一幕脚本：<first_scene>{start_node_desc}</first_scene>

输出格式（严格）：
- 第1行：<meta targetName=\"<cast> 中第一位被引入角色的精确名字，且不能是用户（{user_role}）\"/>
- 第2行起：简要介绍背景；简要介绍关键角色及其立场；最后一句把对话交给 targetName。用简洁口语短句，保持精炼。''',
        "en": '''Task: Open the experience with a short intro and hand the spotlight to the first character. First-scene script: <first_scene>{start_node_desc}</first_scene>

Output format (strict):
- Line 1: <meta targetName=\"exact name of the first introduced member in <cast>, except the user ({user_role})\"/>
- Line 2+: Briefly introduce the background, key cast members, and their stances. End with a final sentence that hands the conversation to targetName. Use concise spoken short sentences.''',
    },
    "facilitator.reflection": {
        "zh": '''任务：基于这段对话，选择 1-2 个合适的关注点给用户做简短分析：回顾（刚发生了什么关键事件）、定位（是否出现关键张力）、因果线（行动是否带来后果）、分歧引导（是否存在可探索的替代路径）、微反思（引导用户表达立场/策略/权衡）。<messages>{msgs_str}</messages>

输出：1-2 句口语短句，单行，以一个 emoji 开头。不要列清单，必要时用开放式提问。''',
        "en": '''Task: Based on the dialogue snippet, give a brief analysis by selecting 1-2 suitable focuses: recap (what just happened), orientation (whether key tension emerged), causal thread (whether an action led to consequences), divergence nudges (plausible alternatives to explore), and micro-reflection (light prompt on stance/strategy/tradeoffs). <messages>{msgs_str}</messages>

Output: 1-2 short spoken sentences in one line, starting with an emoji. Do not list options. Ask open-endedly if needed.''',
    },
    "facilitator.bridge": {
        "zh": """任务：你需要作为导演切换镜头，目标是在最少轮次内推进 <active_node> 收束并进入 <next_node>。

<active_node>{active_node_decision}: {active_node_desc}</active_node>
<next_node>{next_node_desc}</next_node>
<cast>{cast_str}</cast>

角色“{agent_name}”请求切换镜头，上下文如下：「{context_str}」。

决策逻辑（严格遵守）
- 剧情推进：
  - 若角色表现出对某角色的兴趣，则切向该角色。
  - 若开始聊细节或跑题，立即拉回 <active_node> 并最大化推进。
  - 尽快推动 <active_node> 结束并过渡到 <next_node>。
  - 若 <active_node> 已接近结束，在旁白中简短总结并说明进入 <next_node>。
- 旁白风格：
  - 极简（1-2句），第三人称。

输出格式（严格）:
<meta targetName="下一个对话对象，必须是 <cast> 中的精确名字"/> [旁白：描述切换后的画面/氛围，并引出下一位角色行动]
""",
        "en": """Task: As the scene director, switch the camera so <active_node> closes in as few turns as possible and transitions into <next_node>.

<active_node>{active_node_decision}: {active_node_desc}</active_node>
<next_node>{next_node_desc}</next_node>
<cast>{cast_str}</cast>

Character "{agent_name}" requests a scene switch. Context: "{context_str}".

Decision logic (strict)
- Narrative progression:
  - If a character shows interest in another character, switch to that character.
  - If conversation drifts into detail/off-topic, pull back to <active_node> and maximize progress.
  - Push to close <active_node> and enter <next_node> quickly.
  - If <active_node> is near completion, summarize briefly and signal transition.
- Narration style:
  - Minimal (1-2 sentences), third-person.

Output format (strict):
<meta targetName="exact name in <cast>"/> [Narration: describe the new scene/atmosphere and cue the next actor]
""",
    },
    "facilitator.tips": {
        "zh": """你是用户的“历史战略顾问”。Learner 正在进行「{episode_title}」的历史模拟。已进行故事线为 <context>，参与角色在 <cast>，最近对话在 <logs>（重点关注最后一句提问）。你需要根据局势给出 2 或 4 个行动选项 `options`，用于探索不同历史可能性或改写历史。要求**严格精炼**，目标是训练历史思维（权衡利弊、预判后果）。

<context>{history_prefix_str}</context>
<cast>{cast_str}</cast>
<logs>{recent_logs_str}</logs>

输出严格 JSON：
{{
  "situation_analysis": "1 句话概述当前危机/决策点与核心矛盾。",
  "options": [
    {{
      "label": "短标签（如：强硬拒绝 / 妥协换时间）",
      "target_agent": "建议对话目标角色（必须是 <cast> 内精确名字，且不能是用户 {user_role_name}）",
      "example_response": "用户可直接说的一句口语化短台词",
      "rationale": "这么做的收益/动机",
      "risks": "潜在风险或代价",
      "intent_type": "Escalation | De-escalation | Alliance Building | Info Gathering"
    }},
    ...
  ]
}}
""",
        "en": """You are the user's historical strategy advisor. The learner is running the simulation "{episode_title}". Completed storyline is <context>, participants are <cast>, and recent dialogue is <logs> (focus on the final question). Provide 2 or 4 concise action options in `options` to explore alternative trajectories or rewrite outcomes. Goal: strengthen historical thinking (tradeoffs and consequence forecasting). BE STRICTLY CONCISE.

<context>{history_prefix_str}</context>
<cast>{cast_str}</cast>
<logs>{recent_logs_str}</logs>

Output strict JSON:
{{
  "situation_analysis": "One sentence on the current crisis/decision point and core tension.",
  "options": [
    {{
      "label": "Short label (e.g., Hard Refusal / Delay via Compromise)",
      "target_agent": "Suggested target role (EXACT name in <cast>, excluding user {user_role_name})",
      "example_response": "One short, natural line the user can say",
      "rationale": "Why this move helps (benefit/motivation)",
      "risks": "Potential risks or costs",
      "intent_type": "Escalation | De-escalation | Alliance Building | Info Gathering"
    }},
    ...
  ]
}}
""",
    },
    
    "reflection.worker_a": {
        "zh": """你是 Scenario Analyst。Learner 完成了「{episode}」历史模拟，已走过路径见 <history>，分歧重点在 {divergence_node_id}。请生成 Reflection 报告中的 Decision Context 部分，要求**严格精炼**。

<history>{history_prefix}</history>

内容要求：
- Trade-off Map：提炼关键权衡维度（如安全升级、联盟信誉、国内政治、时间压力、信息可靠性、伦理约束）。
- Stakeholders & Constraints：提炼关键角色/群体的目标、底线、杠杆、约束。

输出严格 JSON。字段需极简以降低阅读负担，列表元素不超过4个：
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
""",
        "en": """You are Scenario Analyst. The learner completed the "{episode}" simulation. The traversed path is <history>, with key divergence at {divergence_node_id}. Generate the Decision Context section of the Reflection report. Be strictly concise.

<history>{history_prefix}</history>

Requirements:
- Trade-off Map: extract key pre-decision tensions (e.g., escalation risk, alliance credibility, domestic politics, time pressure, information reliability, ethics).
- Stakeholders & Constraints: extract goals, red lines, levers, and constraints for key actors/groups.

Output strict JSON. Keep each field concise to reduce reading load. Max 4 items per list:
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
""",
    },
    "reflection.worker_b": {
        "zh": """你是 Branch Forensics。Learner 完成了「{episode}」模拟：主线前缀为 <history_prefix>，因分歧进入了 <branch_line>。结合交互记录 <branch_logs>，生成 Reflection 的 Outcome Analysis 部分，要求**严格精炼**。

<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>

内容要求：
- Outcome Dashboard：给出多维结果画像（风险/升级、联盟政治、信誉、长期稳定性等），区分 short-term 与 long-term unintended cost。
- Causal Chain：给出关键因果链与 turning points（从结果回溯到节点）。
- Plausibility：说明该路径在当时语境下为何可能/不太可能，并列出关键假设。

输出严格 JSON。字段需极简。列表元素不超过4个：
{{
  "outcome_dashboard": [
    {{
      "dimension": "String (e.g., Nuclear Risk)",
      "assessment": "String (1-2 sentences)",
      "short_term": "String",
      "long_term_unintended_cost": "String",
      "confidence": Integer (0-100)
    }}
  ],
  "causal_chain_turning_points": [
    {{
      "from_node": "id (e.g., 4.1)",
      "to_node": "id",
      "mechanism": "String",
      "turning_point": Boolean
    }}
  ],
  "plausibility_reasonableness_check": {{
    "summary": "String",
    "key_assumptions": ["String"],
    "stress_points": ["String"],
    "plausibility_score": Integer (0-100)
  }}
}}
""",
        "en": """You are Branch Forensics. In the "{episode}" simulation, canonical prefix is <history_prefix>, but divergence led to <branch_line>. Use interaction logs <branch_logs> to generate the Outcome Analysis section. Be strictly concise.

<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>

Requirements:
- Outcome Dashboard: provide multidimensional outcomes (risk/escalation, alliance politics, credibility, long-term stability), separating short-term and long-term unintended cost.
- Causal Chain: provide key causal links and turning points (backtracking from outcomes to checkpoints).
- Plausibility: explain why this path is plausible/implausible in period context and list key assumptions.

Output strict JSON. Keep fields concise. Max 4 items per list:
{{
  "outcome_dashboard": [
    {{
      "dimension": "String (e.g., Nuclear Risk)",
      "assessment": "String (1-2 sentences)",
      "short_term": "String",
      "long_term_unintended_cost": "String",
      "confidence": Integer (0-100)
    }}
  ],
  "causal_chain_turning_points": [
    {{
      "from_node": "id (e.g., 4.1)",
      "to_node": "id",
      "mechanism": "String",
      "turning_point": Boolean
    }}
  ],
  "plausibility_reasonableness_check": {{
    "summary": "String",
    "key_assumptions": ["String"],
    "stress_points": ["String"],
    "plausibility_score": Integer (0-100)
  }}
}}
""",
    },
    "reflection.worker_c": {
        "zh": """你是 Historical Thinking Coach。Learner 在「{episode}」中从 <history_prefix> 分歧到 <branch_line>。结合 <branch_logs> 生成 Reflection 的 Information Limits 与 Structure vs Agency，要求**严格精炼**。

<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>

内容要求：
- What Was Knowable Then：当时可得信息、信息缺口、信息质量、迷雾与偶然性。
- Hindsight / Anachronism Flags：识别上帝视角与时代错置，并给出当时可成立的重述方式。
- Effective Leverage Points：哪些行动真正改变轨迹。
- Structural Constraints：哪些结构性力量难以撼动。

输出严格 JSON。字段极简，且列表元素不超过 4 个：
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
""",
        "en": """You are Historical Thinking Coach. In "{episode}", the learner diverged from <history_prefix> to <branch_line>. Use <branch_logs> to produce Information Limits and Structure vs Agency. Be strictly concise .

<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>

Requirements:
- What Was Knowable Then: available information, gaps, quality, and fog/chance effects.
- Hindsight / Anachronism Flags: identify god-view or anachronistic framing and provide period-consistent reframes.
- Effective Leverage Points: which actions truly changed trajectory.
- Structural Constraints: which macro constraints were hard to move.

Output strict JSON. Keep concise. Max 4 items per list:
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
""",
    },
    "reflection.worker_d": {
        "zh": """你是 Counterfactual Analyst。Learner 在「{episode}」中由 <history_prefix> 分歧，原定未来 <original_future> 被替换为 <branch_line>。请对比“已走路径”和“未选路径”，生成 Alternative Paths，要求**严格精炼**。

<history_prefix>{history_prefix}</history_prefix>
<original_future>{original_future}</original_future>
<branch_line>{branch_line}</branch_line>

内容要求：
- Unchosen Options & Likely Rollouts：列关键未选项及其最可能后果（短 rollout）。
- Branch Contrast：指出扩散起点与扩散原因。
- Recommended Next Experiment：推荐下次最值得回溯的 checkpoint 与视角。

输出严格 JSON。字段需极简。列表元素不超过4个：
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
""",
        "en": """You are Counterfactual Analyst. In "{episode}", the learner diverged from <history_prefix>, replacing canonical future <original_future> with <branch_line>. Compare taken vs untaken paths and generate Alternative Paths. Be strictly concise.

<history_prefix>{history_prefix}</history_prefix>
<original_future>{original_future}</original_future>
<branch_line>{branch_line}</branch_line>

Requirements:
- Unchosen Options & Likely Rollouts: list key untaken options and likely consequences (short rollout).
- Branch Contrast: specify where divergence spread began and why.
- Recommended Next Experiment: suggest the best checkpoint and perspective for the next iteration.

Output strict JSON. Keep concise. Max 4 items per list:
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
""",
    },
    "reflection.worker_e": {
        "zh": """你是 Learner Profiler。Learner 在「{episode}」中由 <history_prefix> 分歧到 <branch_line>。结合 <cast>、<branch_logs> 与 <outcome_snapshot>，生成 Decision Profile 与 Personalized Learning Suggestions，要求**严格精炼**。

<cast>{cast_str}</cast>
<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>
<outcome_snapshot>{outcome_snapshot}</outcome_snapshot>

内容要求：
- Decision Pattern Summary：提炼风险偏好、妥协/对抗、短期/长期导向等。
- Blind Spots：指出被忽略角色/后果维度。
- Historical Archetype Matching：给出可启发的历史风格映射。
- Coaching Recommendations：给出下次可执行建议。
- Skill Targets：明确历史思维训练能力点。
- Skill Visualization (Radar)：给各能力点打分并给理由。
- Next Steps：推荐后续 checkpoint / perspective / learning goal。

输出严格 JSON。字段需极简，列表元素不超过4个：
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
""",
        "en": """You are Learner Profiler. In "{episode}", the learner diverged from <history_prefix> to <branch_line>. Using <cast>, <branch_logs>, and <outcome_snapshot>, generate Decision Profile and Personalized Learning Suggestions. Be strictly concise.

<cast>{cast_str}</cast>
<history_prefix>{history_prefix}</history_prefix>
<branch_line>{branch_line}</branch_line>
<branch_logs>{branch_logs}</branch_logs>
<outcome_snapshot>{outcome_snapshot}</outcome_snapshot>

Requirements:
- Decision Pattern Summary: risk posture, compromise/confrontation style, short vs long-term orientation, etc.
- Blind Spots: overlooked actors/groups/consequence dimensions.
- Historical Archetype Matching: heuristic style match with caveats.
- Coaching Recommendations: actionable next-iteration suggestions.
- Skill Targets: explicit historical-thinking capabilities.
- Skill Visualization (Radar): score each capability with rationale.
- Next Steps: recommended checkpoint/perspective/learning goal.

Output strict JSON. Keep concise. Max 4 items per list:
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
""",
    },
    "reflection.worker_f": {
        "zh": """你是 Meta-Historian。Learner 完成了「{episode}」模拟。请跳出细节，生成 Anchors, Boundaries & Transfer 部分，要求**严格精炼**。

<canonical_summary>{canonical_summary}</canonical_summary>
<branch_summary>{branch_summary}</branch_summary>
<outcome_snapshot>{outcome_snapshot}</outcome_snapshot>
<key_tradeoff>{key_tradeoff}</key_tradeoff>

内容要求：
- Canonical Fact Anchors：给出关键史实锚点及与分支对照。
- Simulation Disclaimer：指出哪些推演依赖不可证假设。
- Meta-Lessons：总结可迁移的历史洞见。
- Transferable Patterns：抽象为可迁移模式并给出现代平行场景。

输出严格 JSON。字段需极简，列表元素不超过4个：
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
""",
        "en": """You are Meta-Historian. The learner completed "{episode}". Step above the details and produce Anchors, Boundaries & Transfer. Be strictly concise.

<canonical_summary>{canonical_summary}</canonical_summary>
<branch_summary>{branch_summary}</branch_summary>
<outcome_snapshot>{outcome_snapshot}</outcome_snapshot>
<key_tradeoff>{key_tradeoff}</key_tradeoff>

Requirements:
- Canonical Fact Anchors: key historical anchors and contrasts with the branch.
- Simulation Disclaimer: assumptions that are plausible but unverifiable.
- Meta-Lessons: transferable historical insights.
- Transferable Patterns: abstract patterns with modern parallels.

Output strict JSON. Keep concise. Max 4 items per list:
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
""",
    },
}


def get_prompt(key: str, lang: str = "zh", **kwargs: str) -> str:
    normalized_lang = normalize_lang(lang)
    if key not in PROMPT_CATALOG:
        raise KeyError(f"Unknown prompt key: {key}")

    lang_map = PROMPT_CATALOG[key]
    template = lang_map.get(normalized_lang) or lang_map.get("zh")
    if template is None:
        raise KeyError(f"Prompt key '{key}' has no template for lang '{normalized_lang}'")

    return template.format(**kwargs)
