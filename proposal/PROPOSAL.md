# Project Proposal: ChronoFork (Draft)

## Problem & Importance
History education is not merely about memorizing dates, but developing **historical thinking skills**—specifically reasoning about causality, contingency, and how individual decisions intertwine with larger forces. While HCI researchers have explored interactive historical narratives to provide "situated context", most existing systems deliver fixed storylines where "history" remains predetermined.

The core problem is the **"Authoring Bottleneck"**. Traditional interactive narratives rely on hand-authored scripts or branching graphs. Because writing alternative scenes and maintaining consistency across divergent paths is combinatorially expensive, designers are forced to constrain user agency. Even recent tools using AI to fill "storylets" still center on a scriptwriter's predefined plot. Consequently, learners cannot meaningfully explore "what if" scenarios, limiting their ability to practice critical thinking.

## Prior Systems & Gaps
We identify three key gaps preventing scalable counterfactual history experiences:

1.  **Operationalization Gap in Education:** Educators advocate for **counterfactual history** ("what if" scenarios) to help learners grasp causality. However, this is difficult to implement in digital systems. Most experiences remain linear or have few pre-scripted branches, restricting learners to passive observation rather than iterative hypothesis testing.
2.  **Interaction Gap in LLM Tools:** While LLMs can simulate infinite character personas, current HCI applications largely remain in a **Question-Answer paradigm**. Users interview an avatar chatbot (e.g., "Chat with Cleopatra") in a fragmented dialogue without a larger, cohesive narrative context.
3.  **Application Gap in NLP:** Multi-agent LLM frameworks for long-form narrative generation exist, but they focus on *automated story writing*, not *interactive, learner-involved experiences*.

## Proposed Approach
To bridge these gaps, we propose **ChronoFork**, an immersive learner–multi-agent co-roleplay system. It addresses the authoring bottleneck by generating consistent, branching narratives on the fly.

**1. ChronoEngine (Counterfactual Narrative Engine):**
Instead of pre-scripted trees, this backend uses a multi-agent ensemble to drive story progression.
* **Git-Style Branching:** Structured around "decision checkpoints." Each learner decision creates a new timeline branch that maintains causal continuity.
* **Active Guidance:** Agents not only role-play historical figures but proactively guide the learner (e.g., suggesting dilemmas) to encourage initiative.
* **Perspective Switching:** Allows learners to re-examine scenarios from different characters' viewpoints.

**2. ChronoViz (Immersive Visualization):**
A front-end designed to minimize cognitive load so learners can focus on decision-making.
* **Adaptive Environment:** Constructs 3D settings and embodied avatars representing the historical context.
* **Natural Interaction:** Supports face-to-face dialogue and object manipulation rather than complex UI controls.

## Plan for Checkpoint 2 (Validation via Prompting)
We will validate the **ChronoEngine** logic via prompting experiments (without the full UI):
1.  **Causal Consistency:** Test if the multi-agent ensemble can generate logically sound consequences for a specific "divergent" decision (e.g., "What if JFK ordered a strike?").
2.  **Persona Fidelity:** Validate if agents maintain historical stances when faced with user interventions that contradict the canonical timeline.
3.  **Guidance Mechanism:** Test the "Facilitator" agent's ability to drive the narrative forward when the user is passive.

## Initial Risks & Mitigation
* **Hallucination:** LLMs may generate false historical details. *Mitigation:* We will implement a RAG (Retrieval-Augmented Generation) layer to ground the "canonical" timeline in verified sources.
* **Narrative Incoherence:** Long interactions may lose focus. *Mitigation:* The "Facilitator" agent will act as a director, managing scene transitions and summarizing context.
* **Absurd Divergence:** Users may try to break the simulation (e.g., "aliens"). *Mitigation:* A plausibility check module will reject absurd inputs and guide users toward feasible historical alternatives.