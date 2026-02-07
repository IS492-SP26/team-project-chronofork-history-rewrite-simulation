# ChronoFork ⏳🔀
**Immersive Learner–Multi-Agent Co-Roleplay for Divergent Historical Experiences**

> **One-liner:** ChronoFork lets learners *diverge from real historical decisions* and then *experience the consequences* through an immersive, multi-agent co-roleplay with branching timelines and reflective analysis.

## 1. Problem Statement & Why It Matters 🎯
History education is not merely about memorizing dates, but developing **historical thinking skills**—reasoning about causality, contingency, and how individual decisions intertwine with larger social forces. However, most existing interactive historical narratives rely on fixed storylines due to the **"authoring bottleneck"**—the exponential cost of manually scripting branching paths. This limits learners' ability to explore "what if" scenarios (counterfactuals), which are crucial for grasping why history actually unfolded as it did.

Our project is guided by two research questions:
* **RQ1:** How can interaction and narrative mechanisms be designed to support an LLM-powered counterfactual history experience, and how does such an experience impact learners’ engagement and historical thinking?
* **RQ2:** What immersive visualization and embodiment designs can provide an engaging, credible, and low-cognitive-burden interface for exploring branching historical timelines?

**Why it matters:** By enabling scalable, interactive counterfactuals, we can transform history education from passive reception to active hypothesis testing, fostering deeper critical thinking about the complexity of historical events.

## 2. Target Users and Core Tasks 👥
Our primary target users are **history learners** (undergraduate level or enthusiasts) and **educators** seeking interactive case study tools.

**Core User Tasks:**
1.  **Observe (Contextualization):** Users enter a "Stage 1" observation mode where they witness a canonical (real-history) reenactment by AI agents to understand the stakes, stances, and tensions.
2.  **Intervene (Divergence):** Users enter "Stage 2," taking over a specific historical figure (e.g., JFK) to make pivotal decisions that diverge from recorded history.
3.  **Reflect (Analysis):** Users review a generated "Reflection Report" that contrasts their counterfactual timeline with real history, analyzing feasibility and consequences.

## 3. Competitive Landscape ⚔️
| Approach | Description | Shortcomings |
| :--- | :--- | :--- |
| **Traditional Interactive Narratives** | Hand-authored branching stories or decision trees. | **Authoring Bottleneck:** Exponential content burden limits divergence; learners face a "fixed" history or illusion of choice. |
| **Current Counterfactual EdTech** | Classroom discussions or speculative readings. | **Hard to Operationalize:** Limited to teacher-led scenarios; lacks interactive simulation or scalability for individual exploration. |
| **LLM-based History Tools** | Chatbots impersonating historical figures (e.g., "Chat with Einstein"). | **Fragmented Q&A:** Lacks a cohesive narrative context; relies on the student to drive the interaction via interrogation rather than situated experience. |
| **Automated Story Gen (NLP)** | Multi-agent frameworks for writing stories. | **Not Learner-Centric:** Focused on automated content generation rather than interactive, embodied educational experiences. |

**ChronoFork** bridges these gaps by combining a multi-agent narrative engine with an immersive interface, allowing for *dynamic* story generation that maintains causal consistency while situating the learner inside the historical moment.

## 4. Initial Concept and Value Proposition 💡
**ChronoFork** is an *Immersive Learner–Multi-Agent Co-Roleplay system*. It uses a backend (**ChronoEngine**) to manage a graph of narrative events and a frontend (**ChronoViz**) for immersive visualization.

### Concept overview

ChronoFork enables learners to:
- **Step into** a historically grounded scenario,
- **Co-roleplay** with multiple AI-driven historical characters,
- **Make pivotal decisions** that diverge from recorded history,
- Then **witness consequences unfold** through a coherent, branching narrative.

### Key Innovations

**ChronoEngine (counterfactual narrative engine) 🔀**: A multi-agent system driven by a Directed Acyclic Graph (DAG) that manages narrative state. It ensures causal continuity during divergence (using Git-style branching) and employs a "Facilitator" agent to guide the learner and manage scene transitions dynamically.

**ChronoViz (immersive visualized front-end) 🎬**: An adaptive 3D interface that minimizes cognitive load by visualizing the branching timeline and providing embodied avatars for face-to-face interaction. It includes a "Tips" mechanism for decision support and visual highlights for key historical information.

### Value proposition

- **For learners:** A story-centric, immersive “what-if” experience that supports historical thinking through causally grounded branching and multi-perspective role-play.
- **For educators:** A scalable way to operationalize counterfactual exploration beyond a small set of pre-scripted branches.
- **For HCI research:** Design insights on interaction mechanisms, multi-agent prompting/coordination, and immersive visualization for branching timeline exploration (RQ1/RQ2).

## 5. Milestones & Roles 📅

**Project Milestones:**
* **Checkpoint 1:** Proposal, Literature Review, and Initial Architecture.
* **Checkpoint 2:** Validation of "ChronoEngine" via prompting (testing historical logic and agent consistency).
* **Checkpoint 3:** Functional Prototype (Web interface with DAG visualization and basic Multi-agent chat).
* **Checkpoint 4:** User Evaluation & Final Polish (Focus on the Reflection Report and "Tips" mechanism).

| Role | Team Member | Responsibilities |
| :--- | :--- | :--- |
| **Interaction & Architecture Design** | Ziyi | Defining the "Observe-Intervene-Reflect" loop, StoryGraph logic, and system components integration. |
| **Backend (ChronoEngine)** | Ziyi | Developing the multi-agent orchestration, prompt engineering for historical persona fidelity, and the divergence inference logic. |
| **Frontend (ChronoViz)** | Ziyi & External Collaborator | Implementing the WebSocket protocol, 3D/Web interface visualization, and the dynamic DAG rendering. |
| **User Study Design** | Ziyi | Designing a Formative interview with history teachers, and 3 distinct Evaluation Studies to ablate and verify the contribution of specific system components. |
| **User Study Execution & Analysis** | Ziyi & External Collaborator | Recruiting participants, conducting sessions, and analyzing qualitative/quantitative data for the final paper. |
| **Paper Writing** | Ziyi | Drafting the CHI technique paper, including Introduction, Related Work, System Implementation, and Discussion. |

---
*See `/proposal/PROPOSAL.md` for detailed technical approach and validation plans.*