# Speed Dating / Discussion Record 02

## Basic Info
- **Interviewer:** Ziyi
- **Format:** self reflection based on validation results

---

## Purpose
This discussion aimed to prioritize ChronoFork’s features after our off-the-shelf validation of ChatGPT, Claude, and Perplexity.

Specifically, we wanted to discuss:
- which assumptions from CP1 were confirmed,
- which parts of the concept current tools already do well,
- which failures actually matter for our user experience,
- and what should be prioritized in the next iteration.

---

## Quick Context Given to Participant
Our prompt-based validation showed that existing tools are already strong at individual sub-tasks such as historical grounding, plausible continuations, perspective shifts, and rejecting impossible actions. However, they do not naturally combine these modules into a coherent learner-in-the-loop experience. The goal of this discussion was to decide which missing layer ChronoFork should prioritize.

---

## Questions Asked

1. If existing tools already perform well on many historical subtasks, what is still missing?
2. Which failures matter most for learners and educators?
3. Which planned features now seem essential, and which seem secondary?
4. What should be our strongest design claim going into Checkpoint 3?
5. How should the system balance openness with structure?

---

## Key Responses

### Most desired features
- A clear **Observe → Intervene → Reflect** flow is more important than maximizing freeform openness.
- The system should support **checkpoint-based branching** rather than leaving the learner to reconstruct context manually.
- **Tips / guided interventions** are important because learners should not have to invent all possible actions themselves.
- A structured **reflection report** is essential for turning generated narrative into historical reasoning.
- The system should explicitly support **backtracking and comparison** between canonical and divergent paths.
- The system should make the learner’s current status legible:
  - where they are in the event,
  - whether they are still on the canonical path,
  - what has changed,
  - and what options are currently available.

### Biggest concerns
- Existing tools feel capable but not especially engaging as a sustained experience.
- The learner still has to do too much orchestration:
  - track the state,
  - decide what to ask,
  - imagine branches,
  - remember what changed,
  - and interpret whether an action is plausible.
- Without built-in structure, the experience becomes fragmented and can easily collapse into ordinary chat.
- Branching without explicit state representation is hard to follow and hard to compare.
- Long interactions risk drifting because current tools do not manage branch state as persistent objects.

### Most important failure of current tools
- The most important limitation is not generation quality, but **experience composition**.
- ChatGPT and Claude were broadly similar: both were strong at the sub-task level, but neither turned those sub-tasks into a coherent learner-centered interaction flow.
- Perplexity’s use of search and references improved factual traceability, but it still did not solve the problem of engagement, branching, or learner guidance.
- Across all tools, the learner remains outside the system logic and must manually stitch the experience together.

---

## Design Implications

- ChronoFork should frame its contribution around **system-level orchestration**, not raw model capability.
- The main opportunity is not to build another history chatbot, but to combine already-strong modules into an engaging historical simulation loop.
- **ChronoEngine** should prioritize:
  - explicit checkpoints,
  - branch generation,
  - backtracking,
  - plausibility-aware action handling,
  - and proactive multi-agent prompting.
- **ChronoViz** should prioritize:
  - clear state visibility,
  - divergence signaling,
  - option scaffolding,
  - and low-cognitive-load interaction.
- Reflection should be tightly integrated with branching, so learners can compare canonical and counterfactual paths and decide what to try next.

---

## Priority Update

### High priority
- Explicit checkpoint / branch representation
- Tips and proactive learner guidance
- Reflection report
- Divergence signaling
- Plausibility assessment
- Backtracking and branch comparison

### Medium priority
- Multi-dimensional consequences panel
- Source/citation support
- Stronger modeling of actor-specific knowledge boundaries

### Lower priority for the next iteration
- Maximally open freeform chat
- Large-scale open-ended event selection before the core branching loop is stable

---

## Notes
This discussion clarified that our design direction should shift from “Can LLMs do historical roleplay well enough?” to “How do we orchestrate strong but separate capabilities into an experience that is interactive, legible, and educationally useful?” This reframing also gives us a clearer contribution: ChronoFork is not mainly about better generation, but about better learner-centered structure.