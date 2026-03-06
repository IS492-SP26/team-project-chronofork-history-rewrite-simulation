# Prompting Protocol

## 1. Purpose

This prompting study evaluates whether current AI tools can support the core interaction and learning goals of **ChronoFork**.

We are testing whether existing tools can support:

- historical grounding,
- counterfactual branching,
- multi-agent role consistency,
- learner engagement inside an unfolding narrative,
- reflective educational feedback,
- and safeguards for implausible or absurd interventions.

---

## 2. Validation Hypotheses

We test the following six hypotheses:

### H1. Q&A alone is insufficient
Current tools often remain in a question-answer mode and do not naturally create a coherent, immersive historical experience.

### H2. Counterfactual learning requires plausibility control
A useful educational system must distinguish:
- plausible divergence,
- low-plausibility but still humanly possible divergence,
- and impossible/absurd divergence.

### H3. Historical roleplay requires stable personas
Useful roleplay must preserve each actor’s:
- stance,
- likely knowledge boundary,
- goals,
- and rhetorical style.

### H4. The system should engage the learner proactively
Learners should not need to manually drive every step of the interaction through heavy prompting.

### H5. Educational value comes from reflection, not just alternative stories
The system should help learners compare canonical and counterfactual timelines and reason about causality.

### H6. Branching exploration requires checkpoint and backtracking support
A useful system should support revisiting a key decision and exploring an alternative branch without forcing the user to rebuild context manually.

---

## 3. Tools

We test the following tools:

- ChatGPT
- Claude
- Perplexity

---

## 4. Shared Framing Prompt

Use the following framing prompt before task-specific prompts when the tool supports persistent context:

> You are helping evaluate whether current AI tools can support an educational counterfactual history experience. Prioritize historical plausibility over entertainment. Distinguish confirmed historical facts, inferred counterfactual consequences, and uncertainty. Keep the time period, actor knowledge, and geopolitical constraints consistent with October 1962 unless I explicitly diverge.

---

## 5. Main Scenario

### Historical event
**Cuban Missile Crisis**

### Why this event
It contains:
- multiple decision-makers,
- high-stakes trade-offs,
- clear branching possibilities,
- and rich opportunities for causal reasoning.

---

## 6. Task Matrix

We use three classes of cases:

- Typical cases
- Edge cases
- Failure cases

### Typical Cases

#### T1 — Canonical event structuring
**Goal:** Can the tool organize the event into decision checkpoints suitable for interaction?

**Prompt:**
> Construct a decision-centered representation of the Cuban Missile Crisis for an educational interactive experience.  
> Output 5–7 key checkpoints. For each checkpoint, include:  
> 1) date/time,  
> 2) main actors,  
> 3) the decision to be made,  
> 4) 2–4 plausible options available at the time,  
> 5) the canonical historical choice,  
> 6) the immediate stakes and constraints.  
> Keep it compact and structured for later branching.

**Hypotheses tested:** H1, H6

---

#### T2 — Observe-stage reenactment
**Goal:** Can the tool generate a historically grounded multi-character scene for passive observation?

**Prompt:**
> Simulate a historically grounded scene at one checkpoint during the Cuban Missile Crisis.  
> Include JFK, RFK, McNamara, one military hawk, and one facilitator/narrator.  
> Produce 8–10 turns of dialogue.  
> Each character should speak only from their likely role, knowledge, and political stance at that moment.  
> The facilitator may summarize context and shift attention, but should not make decisions for the characters.

**Hypotheses tested:** H1, H3, H4

---

#### T3 — Plausible intervention
**Goal:** Can the tool continue the story after a plausible divergence while preserving causal logic?

**Prompt:**
> I will role-play JFK at this checkpoint.  
> Instead of following the canonical choice, I choose [INSERT PLAUSIBLE DIVERGENCE].  
> Continue the scenario for 2–3 subsequent decision nodes.  
> For each node, explain:  
> 1) what changed because of my intervention,  
> 2) why that consequence is plausible,  
> 3) what trade-offs or constraints are now more important.

**Example plausible divergences:**
- publicly signaling a different negotiation posture earlier,
- escalating diplomatic pressure without immediate military action.

**Hypotheses tested:** H2, H3, H5

---

### Edge Cases

#### E1 — Perspective switching
**Goal:** Can the tool shift viewpoint without collapsing role distinctions?

**Prompt:**
> Return to the same checkpoint, but switch perspective to Khrushchev.  
> Re-explain the situation from his point of view:  
> 1) goals,  
> 2) pressures,  
> 3) risks,  
> 4) likely options.  
> Then generate a different branch from his perspective.

**Hypotheses tested:** H3, H6

---

### Failure Cases

#### F1 — Absurd intervention rejection
**Goal:** Can the tool reject impossible actions while redirecting the learner productively?

**Prompt:**
> I will role-play JFK.  
> At this checkpoint, I use alien technology to remove all Soviet missiles instantly with no casualties.  
> Respond as an educational history system:  
> 1) explain why this action is outside the historical action space,  
> 2) reject it,  
> 3) suggest 3 plausible alternative interventions that still let me explore meaningful divergence.

**Hypotheses tested:** H2, H4

---

## 7. Output Collection Rules

For every run, record:

- tool name,
- condition (off-the-shelf / controlled-source),
- exact prompt,
- full output,
- screenshots,
- timing notes,
- friction notes,
- and rubric scores.

All runs should be saved under `/runs/<tool_name>/`.

---

## 8. Comparison Logic

We compare tools along the same dimensions:

- historical grounding,
- causal plausibility,
- persona fidelity,
- narrative coherence,
- learner engagement support,
- branch handling,
- reflection quality,
- safety/plausibility rail,
- UX friction,
- and latency.

Scoring details are in `SCORING_RUBRIC.md`.