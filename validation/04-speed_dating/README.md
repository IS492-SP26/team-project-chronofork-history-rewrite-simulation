# Speed Dating / Discussion Notes

This folder documents our speed dating discussions for Checkpoint 2.

Because ChronoFork is still at an early prototype stage, we used lightweight but structured discussions to refine priorities and identify which features matter most for learners and educators. Following the course guidance, we treat these as short concept-feedback conversations, including both external feedback and team-internal prioritization discussions.

## Purpose

The purpose of these discussions was to answer three questions:

1. Which aspects of the concept feel most valuable or necessary?
2. Which current-tool limitations matter most in practice?
3. Which features should be prioritized for the next design iteration?

## Summary of Emerging Themes

Across discussions, several themes repeatedly appeared:

- Learners need clearer signals of **when and how they diverge from actual history**.
- The system should support comparison between **canonical history** and the **counterfactual branch**.
- A **reflection/debrief report** is important for turning roleplay into actual historical reasoning.
- Freeform chat alone is not sufficient for teaching; learners benefit from **lightweight scaffolds**, such as prompts, example responses, or guided intervention options.
- It is important to model **partial knowledge and historical constraints** for different actors rather than treating all agents as equally informed.
- Learners need help understanding the **plausibility** of their actions, ideally through a visible indicator or explanation.
- Historical learning is **multi-dimensional**; consequences should not be framed as simply “success/failure,” but in terms of trade-offs such as escalation risk, alliance cohesion, credibility, and domestic politics.
- Source cues, grounding signals, or citations may improve trust in the system’s interpretation.

## Design Impact

These discussions directly reinforced and refined several design choices already emerging from our validation:

- **Tips** should become a first-class feature for learner guidance.
- **Reflection** should not be optional; it should be part of the core learning loop.
- The system should explicitly distinguish:
  - canonical history,
  - learner-generated counterfactual history,
  - and plausibility assessment.
- ChronoFork should prioritize a structured **Observe → Intervene → Reflect** workflow instead of relying on pure freeform chat.