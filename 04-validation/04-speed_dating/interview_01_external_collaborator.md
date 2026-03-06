# Speed Dating / Discussion Record 01

## Basic Info
- **Interviewer:** Ziyi
- **Participant:** External collaborator (Shuning Zhang, Xin Yi)
- **Format:** online discussion

---

## Purpose
This discussion aimed to identify:
- which parts of the ChronoFork concept feel most necessary from a teaching and design perspective,
- what kinds of scaffolding or interface support might be needed beyond freeform roleplay,
- and how the system should better support historical reasoning rather than only “interesting interaction.”

---

## Quick Context Given to Participant
ChronoFork is an early prototype for an immersive learner–multi-agent co-roleplay system for divergent historical experiences. Learners first observe a historically grounded scene, then intervene by role-playing a historical figure and making a different decision, and finally review consequences and reflection. We wanted feedback on what kinds of structure, guidance, and comparison mechanisms would make this experience more useful for learning.

---

## Questions Asked

1. What feels missing if the experience is only freeform roleplay?
2. How should users understand whether they are still aligned with real history or have diverged from it?
3. What kinds of feedback or debrief would make the system more educational?
4. How important is it to model what different actors know or do not know?
5. Would users need more structure, such as prompts, examples, or guidance?
6. What would increase trust in the system’s interpretation of history?

---

## Key Responses

### Most desired features
- The system should more clearly signal **when and how the experience diverges from actual history**.
- Users should be able to compare what happened historically with what happened in their counterfactual run.
- A **debrief / reflection report** at the end of a run would be valuable, especially if it distinguishes:
  - the canonical historical timeline,
  - the counterfactual timeline,
  - and the plausibility of what occurred.
- It would be useful to model **what each actor knows or does not know at a given moment**, rather than assuming all actors share the same information.
- The system should surface important **constraints**, such as domestic politics, military considerations, and alliance dynamics.
- A **consequences panel** could help users track multiple dimensions of outcomes, such as:
  - nuclear risk,
  - alliance cohesion,
  - domestic political cost,
  - and credibility.
- A visible **plausibility indicator** (e.g., plausible / stretch / unlikely / impossible) could help learners understand whether their actions are historically grounded.
- Some signal of **historical grounding**, such as sources or citations, may improve trust.

### Biggest concerns
- Freeform chat may be engaging, but it may not be sufficient in a teaching context.
- Students may choose actions based on what seems interesting rather than what is historically reasoned.
- Without structure, the experience could drift away from historical thinking and become entertainment-first.
- Encouraging plausible actions is important, but over-constraining exploration could reduce the sense of agency.

### Most important failure of current tools
- Current tools can generate strong roleplay, but they do not provide enough structure to help learners reason about:
  - why an action is plausible,
  - what trade-offs it creates,
  - and how it differs from real history.
- Current tools also do not naturally make historical constraints and information asymmetries visible to the learner.

---

## Design Implications

- ChronoFork should explicitly indicate the moment of divergence from canonical history.
- Reflection should become a core part of the learning loop, not an optional extra.
- The system should support side-by-side or clearly structured comparison between:
  - canonical history,
  - learner-generated counterfactual history,
  - and plausibility assessment.
- The facilitator should not only summarize scenes, but also surface hidden constraints and likely knowledge boundaries.
- The interface should include lightweight scaffolding for learners, such as:
  - example interventions,
  - prompts to explain rationale,
  - risks,
  - and possible consequences.
- A consequences panel and plausibility indicator may help learners reason about trade-offs beyond simple “winning” or “losing.”
- Source cues or citations could strengthen trust and make the extrapolation feel more grounded.

---

## Priority Update

After this discussion, our priorities changed in the following ways:

### Higher priority
- Reflection / debrief report
- Explicit divergence signaling
- Plausibility assessment and explanation
- Guidance mechanisms such as Tips
- Modeling actor-specific knowledge and constraints

### Newly emphasized
- A consequences panel for multi-dimensional trade-offs
- Source grounding / citation cues for trust

### Lower priority
- Fully unconstrained freeform chat as the primary interaction mode

---

## Notes
This discussion was framed as brainstorming rather than formal requirements gathering, but it was especially valuable because it highlighted a recurring tension in our design: we want learners to feel agency and openness, but we also need enough structure to keep the experience educational, historically grounded, and interpretable.