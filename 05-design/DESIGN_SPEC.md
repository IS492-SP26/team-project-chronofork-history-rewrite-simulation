# ChronoFork Design Spec

**ChronoFork** is an immersive learner–multi-agent co-roleplay system for divergent historical experiences.  
Its goal is not simply to let users chat with historical figures, but to help them **observe**, **intervene**, and **reflect** on historically grounded counterfactual branches.

This design spec summarizes:
- the refined design direction after validation and concept feedback,
- the primary user journeys,
- the task flows,
- and the key screens / interactions in the current prototype.

---

## 1. Design Goal

ChronoFork is designed to support **historical thinking** rather than only historical recall.

Instead of treating history as a fixed sequence of facts, the system helps learners:
- understand a historical situation from multiple perspectives,
- intervene at pivotal moments,
- observe how consequences unfold,
- and compare their counterfactual branch with canonical history.

The central design challenge identified in Checkpoint 2 is that current off-the-shelf AI tools can already perform many **individual subtasks** well—such as roleplay, plausible continuation, and reflection—but they do not naturally compose those capabilities into an engaging **learner-in-the-loop** experience.

ChronoFork therefore focuses on the missing layer:
- explicit checkpoint-based branching,
- proactive learner guidance,
- backtracking and perspective switching,
- plausibility-aware action handling,
- and structured reflection.

---

## 2. Refined Concept Direction

Based on prompt-based validation and concept feedback, our design evolved in five important ways.

### 2.1 From freeform chat to a structured learning loop
Rather than relying on unconstrained roleplay, the system now follows a clear:

**Observe → Intervene → Reflect**

workflow.

This makes the experience easier to follow, more engaging, and more educationally grounded.

### 2.2 From hidden branching to explicit divergence
The system should clearly indicate:
- when the learner is still following canonical history,
- when a branch diverges,
- and how the counterfactual path differs from the historical one.

### 2.3 From generic roleplay to constraint-aware roleplay
Historical actors should not be treated as omniscient or unconstrained.  
The system should surface:
- actor-specific knowledge,
- political and military pressures,
- alliance constraints,
- and uncertainty at the moment of decision.

### 2.4 From open-ended prompting to scaffolded intervention
Users should not need to invent every next step themselves.  
The system should provide lightweight support through:
- stage framing,
- explicit checkpointing,
- example interventions,
- and tips for plausible actions.

### 2.5 From one-off outputs to iterative reflection
The experience should end with a reflection layer that compares:
- canonical history,
- the learner’s divergent branch,
- plausibility,
- and what alternative branches remain worth exploring.

---

## 3. System Overview

ChronoFork contains two main components:

### 3.1 ChronoEngine (Backend)
ChronoEngine manages the logic of branching historical experience.

Its core functions are:
- **Checkpoint management**  
  represents pivotal historical decisions as branchable nodes,
- **Interaction interpretation**  
  interprets learner actions and routes them into the narrative engine,
- **Narrative inference**  
  generates scene progression, character responses, and causal consequences,
- **Backtracking / stance switching**  
  lets the learner revisit earlier checkpoints or switch to another role,
- **Story progression**  
  maintains the active path through canonical or divergent history.

### 3.2 ChronoViz (Frontend)
ChronoViz presents the experience through an immersive interaction layer.

Its core functions are:
- **interaction encoding** from user voice / text / gesture inputs,
- **embodied agent presentation**,
- **adaptive environment rendering**,
- **information visualization** for context, state, and consequences,
- **visualization decoding** of backend state into learner-facing interface elements.

Together, ChronoEngine and ChronoViz turn branching historical simulation into an interactive co-roleplay experience.

---

## 4. Primary Users

### 4.1 Primary User: History Learner
A student or curious learner who wants to explore:
- what happened,
- why it happened,
- what constraints historical actors faced,
- and how different decisions might have changed outcomes.

### 4.2 Secondary User: Educator / Research Evaluator
An instructor or researcher who wants to:
- inspect how the system structures historical events,
- observe how learners make decisions,
- and evaluate whether the system supports causal reasoning and reflection.

---

## 5. Core User Journey

## Journey A — Learner explores a historical episode

### Phase I. Configure
The learner selects a theme, receives historically grounded episode options, reviews the canonical storyline and cast, and chooses a role perspective.

### Phase II. Co-Roleplay Experience
The learner first observes a canonical reenactment to understand the situation.  
Then the learner intervenes at a checkpoint, creates a divergent branch, and explores consequences with the AI cast.

### Phase III. Reflection
The learner receives a reflection report comparing:
- canonical history,
- their divergent branch,
- plausibility,
- and other meaningful alternatives.

### Success Criteria
The learner should leave the experience able to say:
- what constraints shaped the original event,
- how their intervention changed the trajectory,
- and why different branches produce different consequences.

---

## 6. Task Flows

## 6.1 Flow A — Configuration

### Step 1. Theme Input
The learner enters a historical topic, such as:
- nation,
- time period,
- conflict,
- or event theme.

### Step 2. Fact Retrieval and Episode Seeding
The system proposes candidate episodes relevant to the input.

### Step 3. Canonical Storyline and Cast Setup
The learner reviews:
- a canonical storyline,
- key decision points,
- and the relevant cast of historical actors.

### Step 4. Perspective Selection
The learner chooses one or more roles to inhabit later in the experience.

**Design rationale:**  
This configuration flow reduces cold-start burden and makes the subsequent roleplay legible.

---

## 6.2 Flow B — Observe Stage

### Step 1. Background Brief
The system introduces the historical moment:
- current stakes,
- key actors,
- and immediate tensions.

### Step 2. Canonical Scene Co-Roleplay
AI agents enact the canonical interaction while the learner watches.

### Step 3. StoryGraph Activation
As the canonical story progresses, key checkpoints become visible and activated.

**Design rationale:**  
This stage gives learners context before action.  
Rather than intervening blindly, they first understand:
- who wants what,
- what trade-offs are active,
- and where meaningful intervention is possible.

---

## 6.3 Flow C — Intervene and Branch

### Step 1. Key Decision Detection
The system identifies a pivotal checkpoint and signals that a decision is now live.

### Step 2. Learner Intervention
The learner:
- selects a perspective,
- chooses or states an action,
- and departs from canonical history.

### Step 3. Plausibility-Aware Interpretation
The system analyzes whether the learner’s action is:
- plausible,
- stretch,
- unlikely,
- or impossible.

### Step 4. Branch Creation
If the action remains within the historical action space, the system creates a new branch and updates the story graph.

### Step 5. Causal Inference and Narrative Generation
The backend generates:
- new consequences,
- updated character responses,
- new constraints,
- and subsequent checkpoints.

### Step 6. Continue / Backtrack / Switch Perspective
The learner may:
- continue forward,
- return to a prior checkpoint,
- or re-enter from another actor’s stance.

**Design rationale:**  
This flow is the core of ChronoFork.  
It turns “talking about alternatives” into an explicit, navigable counterfactual experience.

---

## 6.4 Flow D — Reflection

### Step 1. Decision Analysis
The system analyzes:
- what the learner changed,
- what outcome dimensions shifted,
- and what causal chain followed.

### Step 2. Alternative Reflection
The system compares:
- canonical history,
- the learner’s branch,
- and other plausible alternatives that were not taken.

### Step 3. Learning Report
The system generates a report that may include:
- decision profile,
- plausibility assessment,
- missed constraints,
- multi-dimensional consequences,
- and recommended next branches.

**Design rationale:**  
Reflection makes the experience educational rather than merely entertaining.

---

## 7. Key Screens and Interactions

## 7.1 Screen 1 — Configuration Interface
**Purpose:** Set up the episode and learner perspective.

### Key elements
- theme input
- event recommendation cards
- canonical storyline preview
- cast setup panel
- perspective selection

### Key interaction
The learner narrows a broad topic into one concrete episode and prepares for roleplay.

### Why it matters
This screen transforms a vague topic into a structured, branchable historical scenario.

---

## 7.2 Screen 2 — Co-Roleplay Interface
**Purpose:** Support the two-stage live experience.

### Key elements
- **StoryGraph / checkpoint graph**
  - shows decision nodes and branch state
- **stage indicator**
  - Observe vs Intervene
- **episode overview**
  - summarizes current scene and stakes
- **dialogue / scene panel**
  - displays the ongoing multi-agent interaction
- **input area**
  - where the learner speaks or types
- **facilitator layer**
  - gives summaries, hints, transitions, and challenge framing
- **tips**
  - suggests plausible interventions when the learner is unsure
- **divergence / plausibility cues**
  - indicate whether the learner has departed from canonical history and how plausible the action is

### Key interactions
- start canonical scene
- watch agents progress through the scene
- select checkpoint
- intervene as a chosen actor
- switch perspective
- backtrack to earlier checkpoint
- request tips

### Why it matters
This screen is where ChronoFork differs from current tools:  
it makes the interaction **stateful**, **branch-aware**, and **learner-centered**.

---

## 7.3 Screen 3 — Reflection Report
**Purpose:** Compare what happened with what might have happened.

### Key elements
- divergence summary
- canonical vs counterfactual comparison
- plausibility assessment
- consequence dimensions / outcome attributes
- causal chain
- decision profile / behavior summary
- next-branch recommendations

### Key interactions
- inspect branch outcomes
- compare against canonical history
- download report
- export save
- jump back to a prior checkpoint to retry another branch

### Why it matters
This screen closes the loop between action and learning.

---

## 8. Critical Interaction Patterns

### 8.1 Two-Stage Interaction
ChronoFork uses a two-stage mode:

- **Stage 1: Observe**  
  Learners watch a canonical reenactment to understand the event.
- **Stage 2: Intervene**  
  Learners enter the scene and alter a key decision.

This reduces confusion and improves historical grounding before divergence.

### 8.2 Checkpoint-Based Branching
Rather than treating the session as pure chat, the system maintains explicit checkpoints.  
This supports:
- replay,
- comparison,
- and controlled divergence.

### 8.3 Perspective Switching
Learners can switch to another actor’s role to explore the same situation from a different vantage point.

### 8.4 Guided Intervention
The **Tips** mechanism and facilitator reduce prompt burden by offering:
- plausible response examples,
- different strategic directions,
- and reminders of risks and trade-offs.

### 8.5 Reflection as a Core Loop Component
Reflection is not an optional afterthought; it is a built-in stage of the interaction.

---

## 9. Feedback-Driven Design Changes

The current design reflects both prompting-based validation and speed-dating feedback.

### Changes reinforced by validation
- existing tools are already strong at subtasks,
- but they fail to compose those subtasks into a coherent learner-in-the-loop flow,
- so ChronoFork should focus on orchestration, not raw generation.

### Changes reinforced by concept feedback
- make divergence from actual history more explicit,
- include a debrief / reflection report,
- surface actor-specific knowledge and constraints,
- reduce dependence on unconstrained freeform chat,
- support plausibility-aware intervention,
- provide tips for guidance,
- and make outcomes legible across multiple dimensions.