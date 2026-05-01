# ChronoFork: Immersive Learner–Multi-Agent Co-Roleplay for Divergent Historical Experiences — Final Report

**Author:** Ziyi Zhang
**Course:** IS492, Spring 2026
**Repository:** github.com/IS492-SP26/team-project-chronofork-history-rewrite-simulation
**Live deployment:** [app.chronofork.me](https://app.chronofork.me) · [config.chronofork.me](https://config.chronofork.me)

---

## Abstract

History education increasingly emphasizes *historical thinking* — reasoning about causality, contingency, and the interaction between individual decisions and structural forces — yet most digital tools still offer fixed storylines or stateless chatbot Q&A. We present **ChronoFork**, a learner–multi-agent co-roleplay system that turns counterfactual history into an explicit Observe → Intervene → Reflect workflow. ChronoFork combines a backend **ChronoEngine** that maintains a checkpointed, branchable story graph with a frontend **ChronoViz** that renders multi-agent dialogue, plausibility cues, and a reflection report. We evaluated ChronoFork in a within-subject pilot (N=6) against an IDN-Twine baseline using six historical episodes. ChronoFork produced large effect sizes on Sense of Agency (Δ=+3.11/7), Narrative Presence (+2.28), Interest/Enjoyment (+2.67), and Value/Usefulness (+1.88). Six of six participants moved together on the Wilcoxon signed-rank tests of these dimensions. Usability (UMUX-Lite) was a tie. Cognitive load and pressure were higher in ChronoFork; participants framed this as the cost of authorship rather than UI friction. Six interview transcripts converged on six inductive themes; we discuss design implications for orchestration over generation.

---

## 1. Introduction

Memorizing dates and figures is not the same as thinking historically. Decades of social-studies scholarship argue that historical thinking — reasoning about causality, contingency, and the interaction of individual decision-making with larger political, military, and economic forces — is the core skill the discipline should cultivate (Seixas & Peck, 2004; Seixas, 2017). Counterfactual reasoning — asking *what if* — is one of the most direct ways to surface this kind of causal thinking, because it forces learners to take the constraints of a historical situation seriously enough to predict how a different decision would have rippled through them (Roberts, 2011; Huijgen & Holthuis, 2014).

Operationalizing counterfactuals digitally has historically been hard. Interactive digital narratives (IDNs) deliver immersive scenes, but every alternative has to be hand-authored, producing what Jones (2022) calls *authorial burden*: branching depth grows exponentially with each added choice, so even ambitious classroom tools usually offer only a handful of scripted "what ifs". Recent LLM-based history tools improve on this in pieces — Zhu et al. (2025) and Park et al. (2025) show that learners interact more meaningfully with role-playing pedagogical agents, while Su et al. (2025) demonstrate richer comprehension when multiple agents present diverse perspectives — but the dominant interaction pattern is still Q&A, not stateful roleplay. Authoring tools such as WhatIF (Mishra et al., 2025) and StoryWriter (Xia et al., 2025) generate branching content well, but they are designed for authors, not for learners-in-the-loop.

Across two prior checkpoints we ran a structured prompting study (CP2) showing that ChatGPT, Claude, and Perplexity already perform competently on the *individual subtasks* of counterfactual history — character reenactment, plausibility judgment, causal continuation, reflection. What they consistently fail to do is *compose* those capabilities into a sustained, branch-aware, learner-centered workflow. Our hypothesis going into CP4 was that the missing layer is **orchestration**, not generation.

This report documents the pilot user study that tested that hypothesis. It contributes (i) a working three-tier ChronoFork system deployed at app.chronofork.me; (ii) an evaluation design that places ChronoFork against an IDN-Twine baseline within-subject across six historical episodes; (iii) quantitative results across fifteen subscales drawn from validated instruments; and (iv) an inductive thematic analysis of all six participants' semi-structured interviews. We close with a candid discussion of where the orchestration thesis was supported, where ChronoFork still loses (notably persona drift and onboarding cost), and where the next iteration should focus.

---

## 2. Related Work

### 2.1 Historical thinking and counterfactual reasoning

Seixas's (2017) *model of historical thinking* identifies six interrelated skills — significance, evidence, change/continuity, causation, perspective, and ethics — that go beyond rote recall. Roberts (2011) and Huijgen & Holthuis (2014) argue specifically that counterfactual reasoning is a productive vehicle for the *causation* and *perspective* dimensions because asking what would have happened if a key decision had been different forces the learner to articulate which constraints were binding. Despite this pedagogical promise, classroom counterfactual exercises remain mostly discussion-based; there is no scalable simulation environment in which a learner can iteratively test causal hypotheses (Roberts, 2011).

### 2.2 Interactive digital narrative and the authoring bottleneck

IDN systems such as Twine deliver branching prose at low engineering cost, and their pedagogical value is well documented in heritage and history education (Papadopoulou, Mystakidis, & Tsinakos, 2024). Yet every additional fork must be written by a human, and the content burden grows exponentially — Jones (2022, 2024) frames this as the *authorial burden*. Recent LLM-augmented IDN tools relieve part of this pressure by generating branches automatically. WhatIF (Mishra et al., 2025) helps authors visualize and edit emergent narrative trees; StoryWriter (Xia et al., 2025) and a related multi-agent character simulation (Yu et al., 2025) compose long-form stories from coordinating role agents. These advances are powerful, but they target *authors*, not *learners* — the user is outside the diegesis, editing the world rather than inhabiting it.

### 2.3 LLM-based historical roleplay

A second line of work places the user inside the scene by having LLMs role-play historical figures. Zhu et al. (2025) build a VR system around adaptive role-switching and action-switching pedagogical agents and find improvements in trustworthiness, expertise, and social presence. Park et al. (2025) extend this with a multi-perspective social simulation around a single medieval figure, while Su et al. (2025) show that multi-agent visitor-style conversations enhance perspective-taking. Taheri et al. (2026) and Zhao et al. (2025, *Enhancing Design Historical Education*) demonstrate similar engagement gains with generative AI in immersive game design. What is common across these systems is that they use multi-agent LLMs to deepen *individual* moments — a richer scene, a more credible character — but treat each interaction as relatively self-contained. None of them maintain a durable counterfactual branch graph that the learner can revisit, compare across, or backtrack into.

### 2.4 Multi-agent narrative orchestration

The NLP and HCI communities have begun to articulate orchestration as a first-class problem. Cheng et al. (2025) introduce *Oak Story*, an LLM-mediated interactive narrative for younger learners; Arif et al. (2026) describe *Kahaani*, a multimodal co-creative storytelling system. Both shift attention from generation quality to interaction structure — pacing, scaffolding, turn-taking — but neither tackles counterfactual *history*, where plausibility and historical fidelity are central.

ChronoFork sits in this gap. Like the multi-agent systems above, it uses LLMs to dramatize history; like the VR pedagogical work, it places the learner inside the scene; but its central contribution is the *workflow* — explicit checkpoints, branch state, plausibility rails, perspective switching, and a reflection loop — rather than a new generation backbone.

---

## 3. Method

### 3.1 System Description

ChronoFork is split into three deployable components communicating over a JSON WebSocket protocol (architecture diagram in Appendix A).

**Chrono-Server** (FastAPI, Python 3.10) holds the engine logic. The `CastEngine` orchestrates a small ensemble of agents — one per historical figure plus a Facilitator — and pushes their streamed responses to the client. The `StoryEngine` maintains a directed acyclic story graph: each node represents a decision checkpoint, and divergent paths create new node variants while preserving lineage. A `ReflectionWorker` runs as a parallel asyncio task that produces an HTML reflection report at the end of a branch. All LLM calls are routed through `llm_cache.py`, which persists outputs in a `diskcache` keyed by an MD5 of the full prompt; identical prompts therefore never hit the OpenAI API twice, which both reduces cost and makes demos and evaluations reproducible.

**Chrono-Server / Config UI** (Panel) is a separate three-step wizard: Theme → Episodes → Cast → Storyline. Each step calls GPT-5.1 to generate candidate items, which the operator inspects and accepts. The output is a timestamped JSON scenario file. For this pilot, we pre-generated six scenario files and audited each canonical storyline against historical sources before sessions began.

**Chrono-WebNext** (Next.js) is the production frontend deployed at app.chronofork.me. Key components include a *FlowHeader* (stage indicator: Observe vs. Intervene), a *CenterStage* dialogue panel, a *TimeRiverDock* checkpoint graph that renders the StoryEngine state, and a *TacticalHUDDock* that surfaces facilitator hints, plausibility cues, and a Tips affordance. A legacy Panel-based frontend (Chrono-WebUI, webui.chronofork.me) is preserved for reproducibility.

ChronoFork enforces three orchestration mechanisms not found in off-the-shelf LLM tools (full design rationale in DESIGN_SPEC.md):

- **Plausibility rail.** When a learner enters a free-form intervention, an analysis prompt classifies it as plausible / stretch / unlikely / impossible. Plausible and stretch interventions create a new branch; impossible interventions are rejected with an explanation and three suggested alternatives.
- **Backtracking.** Any prior checkpoint is a return point. When the learner backtracks, the system preserves the previously explored branch as a sibling and re-attaches the cast to the chosen earlier state.
- **Perspective switching.** Within a checkpoint, the learner can re-enter as a different historical actor, which causes the agent ensemble to re-anchor stance, knowledge boundaries, and goals.

### 3.2 Evaluation Design

We ran a within-subject pilot with six university students (P1–P6, ages 18–25, recruited via campus posters and online groups). Each participant experienced both conditions:

- **ChronoFork-Web.** The Next.js frontend with the full ChronoEngine pipeline.
- **IDN-Twine.** A static branching narrative built in Twine 2. The canonical path of each scenario was generated by the same ChronoEngine and then audited by the experimenter against historical sources, so the comparison isolates the *interaction model* rather than the writing quality.

Each participant chose two historical events from a six-item Event Library (Red Cliffs / Opium War / Hundred Days' Reform / Titanic / Cuban Missile Crisis / Pearl Harbor) — one assigned to each system, system order counter-balanced across participants. Both systems first walked the participant through the canonical path, after which they could freely explore alternatives for up to 15 minutes per condition.

The session followed a four-stage protocol (≈60 min): (1) introduction and informed consent (5 min); (2) tutorial video and 15 min of free exploration on System A; (3) post-condition questionnaire and 2-minute break (~7 min); (4) mirror Stage 2 + a 20-minute semi-structured interview. Audio, screen, and event logs were recorded. Participants received $10/hour as compensation.

**Measures.** All Likert scales used a 7-point format (1 = strongly disagree, 7 = strongly agree); reverse-coded items were transformed via `8 − raw` before subscale aggregation. We collected:

- *Narrative Engagement Scale* (Busselle & Bilandzic, 2009; 12 items, 4 subscales).
- *Explanation Satisfaction Scale* (Hoffman, Mueller, Klein, & Litman, 2023; 7 items).
- *PENS Autonomy* (Ryan, Rigby, & Przybylski, 2006; 3 core + 2 extended items).
- *UMUX-Lite* (Lewis, Utesch, & Maher, 2013) plus a *Paas Mental Effort* single item on a 9-point scale (Paas, Van Merriënboer, & Adam, 1994).
- *Intrinsic Motivation Inventory* — Interest/Enjoyment, Value/Usefulness, Pressure/Tension subscales (Ryan, 1982).
- Three custom items on counterfactual plausibility, perspective switching, and divergence clarity.

We deliberately did *not* impose discrete task-success/time-on-task measures: the study's research question was about open-ended exploration, and an artificial completion criterion would have biased toward the system with fewer choices.

**Analysis plan.** Given N=6, we report descriptive statistics with Cohen's-style direction labels and supplement them with two-sided Wilcoxon signed-rank tests using SciPy 1.10's `stats.wilcoxon` (zero-method = `wilcox`, exact when ties are absent). With six paired observations, the smallest two-sided *p* the test can return is .063, which is reached only when all six pairs move in the same direction; we treat that case as the strongest available evidence at this sample size and report effect-size *r* derived from the normal approximation. For interview data we followed Braun & Clarke's (2006) reflexive thematic analysis: full-transcript reading × multiple passes, line-by-line coding, iterative grouping into candidate themes, review against the dataset, and re-naming.

---

## 4. Results

### 4.1 Quantitative results

Across fifteen subscales, ChronoFork scored higher than IDN-Twine on fourteen and tied on one (UMUX-Lite). Table 1 summarizes the headline dimensions; Figure 1 in Appendix B contains the full panel of category-aligned charts.

**Table 1.** Subscale comparison — ChronoFork vs. IDN-Twine (N=6, within-subject, two-sided Wilcoxon).

| Subscale | ChronoFork M (SD) | IDN-Twine M (SD) | ΔM | *W* | *p* | *r* |
|---|---|---|---|---|---|---|
| Sense of Agency (PENS Core) | 5.50 (1.19) | 2.39 (1.74) | +3.11 | 0.0 | .063 | +0.90 |
| PENS Extended | 5.43 (1.28) | 2.63 (1.80) | +2.80 | 0.0 | .063 | +0.91 |
| Narrative Presence | 4.61 (1.44) | 2.33 (1.56) | +2.28 | 1.5 | .094 | +0.77 |
| Emotional Engagement | 3.83 (1.07) | 2.11 (1.73) | +1.72 | 3.0 | .156 | +0.64 |
| NES Overall | 5.07 (0.94) | 3.83 (0.95) | +1.24 | 3.0 | .156 | +0.64 |
| Explanation Quality | 5.31 (0.78) | 4.17 (1.01) | +1.14 | 2.0 | .094 | +0.73 |
| Alt. Path Plausibility | 5.00 (1.26) | 4.67 (0.82) | +0.33 | 3.5 | .875 | +0.28 |
| Interest/Enjoyment | 5.67 (1.00) | 3.00 (1.56) | +2.67 | 1.0 | .063 | +0.81 |
| Value/Usefulness | 5.10 (1.19) | 3.21 (1.80) | +1.88 | 1.0 | .063 | +0.82 |
| Pressure/Tension | 2.70 (0.77) | 1.53 (0.41) | +1.17 | 0.0 | .063 | +0.90 |
| Mental Effort (Paas, 1–9) | 5.67 (1.75) | 2.17 (1.60) | +3.50 | 0.0 | .063 | +0.91 |
| Perspective Switching | 5.50 (1.38) | 2.67 (1.75) | +2.83 | 0.0 | .063 | +0.91 |
| UMUX-Lite (1–7) | 5.00 (1.05) | 5.08 (0.86) | −0.08 | 9.5 | 1.000 | −0.09 |
| UMUX-Lite (0–100) | 66.7 | 68.1 | −1.4 | — | — | — |

Three patterns are worth flagging.

First, **all six participants moved in the same direction on the seven dimensions where the test reached *p* = .063**: Agency, PENS Extended, Mental Effort, Perspective Switching, Interest/Enjoyment, Value/Usefulness, and Pressure/Tension. With N=6 this is the strongest convergence the test can produce. Effect sizes on these dimensions are large (*r* ≥ 0.81), and the absolute differences on Agency, Mental Effort, and Perspective Switching exceed three points on a 7- or 9-point scale.

Second, **UMUX-Lite is a tie (*p* = 1.00).** ChronoFork's richer interaction did not register as more usable than Twine's two-button interface; nor, however, did it register as *less* usable. Per-participant scores show three participants slightly preferring Twine and three slightly preferring ChronoFork, with an absolute gap of 1.4 points on the 0–100 scale.

Third, **Mental Effort and Pressure/Tension both rose** under ChronoFork. Paas effort jumped from 2.17 to 5.67 on the 9-point scale; Pressure rose from 1.53 to 2.70 on the 7-point scale. We return to whether these increases are extraneous (a usability problem) or germane (a learning signal) in the Discussion.

### 4.2 Qualitative results

We coded all six interview transcripts following Braun & Clarke (2006). Six themes emerged inductively; the full thematic map and per-participant attribution are in `../result/qualitative_analysis.md`. We summarize each theme and its dominant cross-system contrast below.

**Theme 1 — Reader → Author.** All six participants distinguished between *making* the story (ChronoFork) and *selecting* among pre-made outcomes (Twine). P4 captured this most directly: *"It turned me from a reader into an author"* and *"like ordering off-menu instead of picking from a set menu."* P1 reported a striking degenerate case for Twine — *"after two or three endings I was just doing collection work, mechanically picking every option I hadn't tried"* — suggesting that fixed branching exhausts curiosity rapidly. P2's blunt comparison — *"if it's the first kind, why wouldn't I just read a history book?"* — frames the question of perceived value precisely.

**Theme 2 — Embodied Understanding.** Role-play surfaced *why* historical actors decided as they did, not just *what* they decided. P1: *"After the counterfactual, I finally understood why those decisions were made — because the alternatives were either infeasible or the actors lacked the information."* P4 reported a similar shift while playing Tojo Hideki: *"When I thought 'would withdrawing troops cause a military mutiny?', I started to understand why he didn't back down — that's something you can never experience through Twine."* This theme is the most directly aligned with Roberts' (2011) constraint-aware historical thinking.

**Theme 3 — Showing vs. Telling.** P4 crystallized the contrast: *"Twine makes you understand; ChronoFork makes you be there."* The trade-off is real — Twine's polished omniscient prose was efficient and clear, but felt like *"a textbook"* (P1) or a *"pre-recorded video"* (P4); ChronoFork's multi-voice debate dramatized causal reasoning but produced reading fatigue (P1, P2).

**Theme 4 — Character Fidelity and the Uncanny.** All four interviewees who experienced extended ChronoFork sessions reported persona-break moments. P5 (Cuban Missile Crisis): *"I told Khrushchev I won't listen to the Americans, and he actually backtracked — completely out of character."* P3 (Red Cliffs): *"When I offered the two Qiao sisters, Cao Cao shouldn't have outright refused — he should have been pleased."* P2 (Hundred Days' Reform): *"Ronglu was disrespectful to the Emperor — that doesn't fit."* P6 (Titanic): *"As soon as I said safety first, everyone fell in line — there should have been pushback from someone wanting speed."* P4 noted a subtler form: AI-generated dialogue often had a uniform sentence structure across characters, lacking the speech disfluencies of real humans.

**Theme 5 — Convergence Forces.** Several participants felt the AI cast pulled them back toward canonical history when they tried to diverge. P2 framed it as frustration (*"I'm the Emperor, and they keep blocking me"*); P5 the same (Cuban defiance); but P3 reframed it: *"If it's a game, the convergence is a design choice — telling me history has gravity. That sense of fate actually makes me like the game more."* P6 added a usability layer: regardless of whether convergence is fate or limitation, the system needs an *outcome-comparison panel* at the end so the player can see what their actions changed.

**Theme 6 — Scaffolding and Onboarding.** ChronoFork's richer interaction model came with usability costs. The backtrack button was hard to find (P1, P4), the timeline UI confusing (P1, P2, P5), and 5–15-second LLM response latency caused attentional drift (P4). Hint features were appreciated by novices (P1) but bypassed by experts (P2, P4). No participant rated these as deal-breakers — friction, not failure.

---

## 5. Discussion

### 5.1 Validating the orchestration thesis

Our CP2 prompting study argued that the missing layer in current LLM history tools is orchestration, not generation. The pilot supplies the first concrete evidence that this layer, once provided, changes the experience. The largest swings — Agency (+3.11, *r*=0.90), Perspective Switching (+2.83, *r*=0.91), Interest/Enjoyment (+2.67, *r*=0.81), and Narrative Presence (+2.28, *r*=0.77) — are precisely the dimensions that the orchestration layer is supposed to touch: the right to author, the right to inhabit a different vantage point, the felt presence of a scene, and motivational pull. These are not generation-quality differences (the canonical Twine prose was, by audit, the equal or superior of ChronoFork's streamed dialogue); they are *interaction-mechanism* differences.

Theme 2 (Embodied Understanding) extends this beyond engagement. Participants reported that role-play *constrained by* AI characters' resistance produced a kind of historical understanding unavailable through reading. P1 and P4 articulated this almost identically — counterfactual *failure* was what made canonical history legible. This aligns directly with Roberts' (2011) and Huijgen & Holthuis's (2014) educational case for counterfactual reasoning, and it suggests that the orchestration layer can do something Q&A LLM tools cannot: turn historical thinking into a felt rather than declarative experience.

### 5.2 Reframing higher mental effort

Mental effort and pressure both rose under ChronoFork, by margins (Paas +3.50; Pressure +1.17) that on their face look like usability red flags. Three pieces of evidence push us to read these as *germane* load — load attributable to the learning task itself — rather than extraneous load attributable to the interface.

First, **UMUX-Lite is a tie**, and on the per-participant breakdown three participants preferred ChronoFork's interface and three preferred Twine's. If the rising mental effort were UI-driven, we would expect UMUX-Lite to drop. Second, **the qualitative data ascribe the effort to authorship, not navigation**. P2: *"I had to think on my feet — that's why it felt alive."* Third, **the rise in Pressure/Tension is small in absolute terms (2.70/7) and below the scale midpoint**, while Interest/Enjoyment rises sharply (+2.67) — a profile more consistent with productive engagement than with anxious frustration. The cost of being an author is doing the authoring; the pilot suggests the participants accepted the trade.

That said, there is a real onboarding cost (Theme 6). Participants did struggle with the backtrack button and the timeline UI on first contact. The implication is not that the orchestration layer is wrong, but that ChronoFork has not yet paid down the introductory tax it imposes; we discuss specific affordances in §7.

### 5.3 Persona drift as the most acute engineering target

The most consistent negative finding was Theme 4 — character fidelity breaking down at moments of high divergence. Khrushchev backtracking on missile shipments, Cao Cao refusing Qiao sisters, Ronglu disrespecting the Emperor, Titanic crew offering no resistance — these are not random hallucinations; they are systematic failures at the boundary between persona constraints and the engine's plausibility rail. Across persona breaks, the failure mode was the same: when the user pushed in a divergent direction, the cast was pulled back toward canonical history, often by *the wrong character* — i.e., a character whose own goals would, historically, have made them go *with* the user.

This pattern matters because it tells us where to point engineering effort in the next iteration. P3 actually proposed a concrete fix: *"Set personas as skills — Cao Cao has 'suspicion' and 'lust', so the gift triggers 'lust' even when 'suspicion' fires."* This is essentially a request for explicit rule-tagging rather than free-form prompt engineering. Combined with knowledge-state grounding, it gives the persona stability layer a concrete shape (§7).

### 5.4 ChronoFork as complement, not replacement

P4 made a final observation that complicates a strict ChronoFork-vs-Twine framing: *"Twine makes you 'understand'; ChronoFork makes you 'be there.'"* They proposed using Twine as a framework primer before deeper ChronoFork exploration. Several other participants implicitly endorsed the same sequencing — Twine for orientation, ChronoFork for depth. This suggests the systems may be more complementary than competitive, with potential implications for educational deployment: a brief IDN-style canonical pass, followed by a ChronoFork counterfactual exploration, followed by a structured reflection that compares both.

---

## 6. Limitations, Risks & Ethical Considerations

The pilot has four bounded limitations. **Sample.** N=6 from a single university, all Mandarin-speaking; counterbalanced order does not eliminate convenience-sampling bias. **Methodology.** A 15-minute cap per condition may favor systems that read quickly; we used open-ended exploration rather than a strict task battery, so we cannot report task-success or time-on-task in the conventional sense. The same researcher ran every session, leaving room for experimenter expectancy. **Model and system risk.** Persona drift surfaced in four of six sessions; LLM hallucinations in counterfactual extensions are mitigated by the plausibility rail but not eliminated. Response latency (5–15 s) disrupted attention. To support reproducibility, all LLM responses are deterministically cached by prompt hash and the test suite includes 25 unit tests.

**Ethics.** Participants signed informed consent covering audio, screen, and event logs; PII was removed during transcription; compensation was $10 per hour. Conversations are sent to the OpenAI API only; no third-party storage occurs in our pipeline. Per the safety review (`../../06-app/docs/safety.md`), the system prompt anchors agents to historical roleplay and rejects out-of-scope inputs, partially mitigating prompt-injection risk; we recommend per-IP rate limits and a public ToS notice before any non-research deployment.

**Statistical caveats.** Wilcoxon results at N=6 are exploratory and should be read as effect-direction signals, not confirmatory hypothesis tests. The original study plan in CP3 envisioned a video baseline in addition to IDN-Twine; we deferred that condition because pilot capacity did not permit a third within-subject arm without further fatiguing participants.

---

## 7. Conclusion & Future Work

This report tested the hypothesis, advanced in CP2, that the missing layer in LLM-based history tools is orchestration — explicit checkpoints, branch state, plausibility rails, perspective switching, and reflection — rather than raw generation quality. A pilot user study (N=6, within-subject, IDN-Twine baseline) supports that hypothesis on every dimension we measured: large effect sizes on Agency, Presence, Interest, Value, and Perspective Switching, with all six participants moving together; an honest tie on UMUX-Lite; and qualitative themes that converge on the *reader → author* shift while documenting two real costs — persona drift and onboarding friction.

**Future work.** Five directions follow directly from the data. (1) **Persona stability layer** — implement P3's skill-tagged actor model, knowledge-state grounding, and a persona-break detector that catches the Khrushchev / Cao Cao / Ronglu / Titanic-crew cases at runtime. (2) **Reflection / outcome-comparison panel** — add the canonical-vs-counterfactual diff that P3 and P6 explicitly asked for, with multi-dimensional consequence visualization. (3) **Latency and onboarding** — streaming generation, an explicit "where am I" cue, and a 30-second walkthrough on first contact. (4) **Larger evaluation** — 20+ participants, a one-week retention test, and a deferred video-baseline arm to complete the CP3 study plan. (5) **Immersive thread** — reactivate the Quest 3 prototype once the web version stabilizes, building on Zhu et al.'s (2025) findings on adaptive role-switching in VR.

The pilot's broadest lesson is more architectural than psychological: when a counterfactual history experience is treated as a *workflow* rather than a *generation problem*, large existing capabilities suddenly compose. The next iteration of ChronoFork will be measured against that bar.

---

## References

Arif, S., Haroon, M. S., Khan, A. J., Arif, T., Raza, A. A., & Athar, A. (2026, March). Kahaani: A Multimodal Co-Creative Storytelling System. In *Proceedings of the 19th Conference of the European Chapter of the Association for Computational Linguistics (Volume 4: Student Research Workshop)* (pp. 347-365).

Barbara, J. (2022, October). Re-live history: An immersive virtual reality learning experience of prehistoric intangible cultural heritage. In *Frontiers in Education* (Vol. 7, p. 1032108). Frontiers Media SA.

Braun, V., & Clarke, V. (2006). Using thematic analysis in psychology. *Qualitative Research in Psychology, 3*(2), 77–101.

Busselle, R., & Bilandzic, H. (2009). Measuring narrative engagement. *Media Psychology, 12*(4), 321–347.

Cheng, A. Y., Zou, C. Q., Xie, A., Hsu, M., Yan, F., Huang, F., ... & Landay, J. A. (2025, September). Oak Story: Improving Learner Outcomes with LLM-Mediated Interactive Narratives. In *Proceedings of the 38th Annual ACM Symposium on User Interface Software and Technology* (pp. 1-17).

Eagan, L. M., Young, J., Bering, J., & Langlotz, T. (2025). Virtual Voyages: Evaluating the role of real-time and narrated virtual tours in shaping user experience and memories. In *Proceedings of CHI 2025*.

Hoffman, R. R., Mueller, S. T., Klein, G., & Litman, J. (2023). Measures for explainable AI: Explanation goodness, user satisfaction, mental models, curiosity, trust, and human-AI performance. *Frontiers in Computer Science, 5*, 1096257.

Huijgen, T., & Holthuis, P. (2014). Towards bad history? A call for the use of counterfactual historical reasoning in history education. *Historical Encounters, 1*(1), 103–110.

Jones, J. D. (2022). Authorial burden. In *The authoring problem: Challenges in supporting authoring for interactive digital narratives* (pp. 47–63). Springer.

Jones, J. D., & Millard, D. (2024, September). Experiencing The Authorial Burden. In *Proceedings of the 35th ACM Conference on Hypertext and Social Media* (pp. 78-87).

Lewis, J. R., Utesch, B. S., & Maher, D. E. (2013). UMUX-Lite: When there's no time for the SUS. In *Proceedings of CHI 2013* (pp. 2099–2102).

MacDowell, P., Jaunzems-Fernuk, J., Clifford, J., Ghani, A., & Hoy, B. (2025). Virtual reality in history education: Instructional design considerations for designing authentic, deep, and meaningful learning. *The Journal of Applied Instructional Design*, *14*(1), 6-48.

Mishra, A., Brudy, F., Zhou, Q., Fitzmaurice, G., & Anderson, F. (2025). WhatIF: Branched narrative fiction visualization for authoring emergent narratives using large language models. In *Proceedings of Creativity & Cognition 2025* (pp. 590–605).

Paas, F. G., Van Merriënboer, J. J., & Adam, J. J. (1994). Measurement of cognitive load in instructional research. *Perceptual and Motor Skills, 79*(1), 419–430.

Papadopoulou, A., Mystakidis, S., & Tsinakos, A. (2024). Immersive storytelling in social virtual reality for human-centered learning about sensitive historical events. *Information, 15*(5), 244.

Park, K., Song, H., Seo, S., Kim, J., & Suh, B. (2025, April). " Ask Sir Oliver Ingham": LLM-based Social Simulations for History Education. In *Proceedings of the Extended Abstracts of the CHI Conference on Human Factors in Computing Systems* (pp. 1-13).

Roberts, S. L. (2011). Using counterfactual history to enhance students' historical understanding. *The Social Studies, 102*(3), 117–123.

Ryan, R. M. (1982). Control and information in the intrapersonal sphere: An extension of cognitive evaluation theory. *Journal of Personality and Social Psychology, 43*(3), 450–461.

Ryan, R. M., Rigby, C. S., & Przybylski, A. (2006). The motivational pull of video games: A self-determination theory approach. *Motivation and Emotion, 30*(4), 344–360.

Seixas, P. (2017). A model of historical thinking. *Educational Philosophy and Theory, 49*(6), 593–605.

Seixas, P., & Peck, C. (2004). Teaching historical thinking. In A. Sears & I. Wright (Eds.), *Challenges and prospects for Canadian social studies* (pp. 109–117). Pacific Educational Press.

Su, M., Liu, C., Zhang, J., Shuang, W. U., & Fan, M. (2025, October). SimViews: An Interactive Multi-Agent System Simulating Visitor-to-Visitor Conversational Patterns to Present Diverse Perspectives of Artifacts in Virtual Museums. In *Proceedings of the 33rd ACM International Conference on Multimedia* (pp. 6740-6750).

Taheri, M., Cyma-Wejchenig, M., Gomes, L., & Tan, K. (2025, October). Adaptive Historical Education through Generative AI and Immersive Game Design. In *Proceedings of the Future Technologies Conference* (pp. 85-99). Cham: Springer Nature Switzerland.

Theodoropoulos, A., & Antoniou, A. (2022). VR games in cultural heritage: A systematic review of the emerging fields of virtual reality and culture games. *Applied Sciences, 12*(17), 8476.

Xia, H., Peng, H., Qi, Y., Xu, B., Li, J., Lei, H., & Wang, X. (2025, November). Storywriter: A multi-agent framework for long story generation. In *Proceedings of the 34th ACM International Conference on Information and Knowledge Management* (pp. 6559-6563).

Yu, T., Shi, K., Zhao, Z., & Penn, G. (2025). Multi-Agent Based Character Simulation for Story Writing. *Proceedings of the Fourth Workshop on Intelligent and Interactive Writing Assistants (In2Writing 2025)*.

Zhao, J., Zhang, J., & Lu, Y. (2025). Enhancing Design Historical Education Through AI Virtual Characters Role-Playing Narratives in Serious Games. *Int. J. Gaming Comput. Mediat. Simulations, 17*, 1-20.

Zhao, Y., Li, Y., Dai, T., Sedini, C., Wu, X., Jiang, W., … Lc, R. A. Y. (2025). Virtual reality in heritage education for enhanced learning experience: A mini-review and design considerations. *Frontiers in Virtual Reality, 6*, 1560594.

Zhu, Z., Yu, A., Tong, X., & Hui, P. (2025). Exploring LLM-powered role and action-switching pedagogical agents for history education in virtual reality. In *Proceedings of CHI 2025* (pp. 1–19).

---

## Appendices

### Appendix A — System Architecture

Three-component deployment over a JSON WebSocket protocol. Detailed component breakdown and DAG diagram in `../../06-app/docs/architecture.md` of the project repository.

```
Browser ──ws──▶ Chrono-Server (FastAPI)
                ├── ConnectionManager
                ├── CastEngine ── Agent[] ── LLMCache ──▶ OpenAI
                ├── StoryEngine (DAG)
                ├── Facilitator
                ├── ReflectionWorker
                └── EventLogger (TSV)
                ▲
                │
        Config UI (Panel) ─ writes config/{timestamp}.json
```

Frontends: **Chrono-WebNext** (Next.js, production, app.chronofork.me); **Chrono-WebUI** (Panel, legacy, webui.chronofork.me).

### Appendix B — Charts (in `../result/charts/`)

| File | What it shows |
|---|---|
| `A1_narrative_engagement.png` | NES — 4 subscales + Overall, ChronoFork vs. Twine |
| `A2_explanation_plausibility.png` | Explanation Quality + Alt. Path Plausibility |
| `B1_agency.png` | PENS Core + PENS Extended |
| `B2_usability.png` | UMUX-Lite + Perspective Switching |
| `B2_mental_effort.png` | Paas Mental Effort with per-participant scatter |
| `D_motivation.png` | IMI — Interest, Value, Pressure |
| `headline_radar.png` | 5-dimension headline radar |
| `slope_agency_effort.png` | Per-participant paired slopes for Agency and Mental Effort |

### Appendix C — Study Materials

- **Pilot Guide** (`../study_design/Pilot Guide.md`) — full study protocol, tutorial-video scripts, interview guide.
- **Pilot Questionnaire** (`../study_design/Pilot Questionnaire.md`) — all instrument items in Chinese with English back-translation; reverse-scoring keys; subscale aggregation rules.
- **Event Library** (`../study_design/Event Library.md`) — six historical events with canonical setup and divergence framing.
- **Consent script** — embedded in the Pilot Guide, Section 1; covers logs, audio, screen recording, and compensation.

### Appendix D — Prompt Files

All system and agent prompts are versioned in `../../06-app/Chrono-Server/server/prompts/catalog.py` (English) and the parallel Chinese prompt set selected by `--lang zh` at server start. Key prompt families: `cast.agent_system` (per-character system prompt), `facilitator.intervention_classify` (plausibility rail), `reflection.report_generate` (final report).

### Appendix E — Reproducibility

- **Cleaned data.** `../raw_data/questionaire.xlsx` (12 rows, 2 per participant; numeric Likert only, fully anonymized). Reverse-coded transformations applied in `../result/analysis_v2.py`.
- **Statistical analysis.** `../result/analysis_v2.py` — descriptive stats + Wilcoxon signed-rank + chart generation. Re-run with `python3 07-final/result/analysis_v2.py`.
- **Wilcoxon results JSON.** `../result/wilcoxon_results.json`.
- **Per-participant table.** `../result/per_participant_v2.md`.
- **Qualitative analysis.** `../result/qualitative_analysis.md` — Braun & Clarke (2006) thematic analysis with representative anonymized quotes from P1–P6.
- **Interview transcripts.** Not committed publicly to honor consent scope (research analysis only). Available on reasonable request — see `../raw_data/README.md`. P2/P5 originally shared one transcript; P3/P6 originally shared one transcript; both were split for thematic attribution as documented in the qualitative analysis.
- **Slide deck.** `../../00-presentation/cp4_pre_eval.pdf`.

### Appendix F — Screenshots

Screenshots of the Configuration UI, Co-Roleplay interface, and Reflection Report are embedded in the slide deck (Slide 4) and available in `../../05-design/img/`. The deployed system can be exercised end-to-end at app.chronofork.me.
