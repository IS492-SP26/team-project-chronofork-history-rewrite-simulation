# Project Proposal: ChronoFork 📜
**Immersive Learner–Multi-Agent Co-Roleplay for Divergent Historical Experiences**

## Problem & Importance 🎯
History education involves more than the rote memorization of dates and events; it requires cultivating **historical thinking skills**, such as reasoning about causality, contingency, and the complex interplay between individual decisions and larger social forces [1][2]. To support these deeper skills, Human-Computer Interaction (HCI) research has increasingly explored interactive narratives, operating on the premise that "being there" makes learning more concrete [3]. Specifically, immersive Virtual Reality (VR) has been shown to boost student engagement and comprehension by providing a situated context for embodied exploration [4].

However, a critical problem remains: **The Authoring Bottleneck**. Most existing digital history experiences deliver fixed storylines where the learner's actions have little effect on the outcome [5]. This rigidity stems from the reliance on hand-authored scripts or branching story graphs. In these traditional structures, every possible choice must be explicitly written by designers. As a result, the content burden grows exponentially with every added branch—a phenomenon Jones (2021) describes as "authorial burden" [6]. Even recent systems that combine human-authored "storylets" with AI generation still result in a static storylines (automated creative writing), and can not effectively introduce the user in the loop [7].

This bottleneck prevents the operationalization of **Counterfactual History** ("What if?" scenarios). Educational theorists argue that asking how events might have unfolded differently is crucial for understanding historical causality [8]. Yet, because designers cannot pre-script infinite outcomes, these activities are currently limited to classroom discussions or static readings, lacking the interactive simulation required for students to iteratively test hypotheses [9].

## Prior Systems & Gaps ⚔️
We identify three specific gaps that prevent the realization of scalable, interactive counterfactual history:

- Operationalization Gap in Education: Because no existing system can support open-ended narrative divergence, counterfactual learning is difficult to operationalize digitally. As a result, many counterfactual activities remain teacher-led or discussion-based—such as classroom exercises or speculative readings—rather than interactive simulations [9]. This reliance on human facilitation constrains scalability and limits learners' opportunities to iteratively test their own hypotheses about historical causality (e.g., trying different decisions to see different consequences) [9].

- Interaction Gap in LLM Tools: Current LLM applications in history education are predominantly passive [3] [10]. They typically employ a Question-Answer (Q&A) paradigm, where a student interviews a chatbot impersonating a historical figure (e.g., "Chat with Einstein"). While useful for fact-retrieval, this mode lacks a cohesive, engaging narrative context. The interaction is driven entirely by the student's interrogation, resulting in fragmented dialogue rather than an immersive, story-driven experience where the learner feels "inside" the history.

- User-in-the-Loop Gap in Narrative Generation: While the NLP community has developed LLM-powered story generation, these systems are currently limited to generating static storylines (automated creative writing) [7]. They do not effectively introduce the user "in the loop." There is a gap in how to construct a narrative system that not only generates coherent stories but actively invites the user to intervene the narrative trajectory in real-time, transforming static generation into a dynamic co-roleplay experience.

## Proposed Approach 💡
To bridge these gaps, we propose **ChronoFork**, an immersive learner–multi-agent co-roleplay system. ChronoFork moves beyond pre-scripted trees by using a multi-agent LLM backend to generate consistent, divergent historical narratives on the fly.

Our approach consists of two core components:

1.  **ChronoEngine (The Backend):** A counterfactual narrative engine driven by a multi-agent ensemble (including a Historian, Scene Director, and Character Agents).
    * **Git-Style Branching:** The engine structures the narrative around "decision checkpoints." When a learner intervenes (e.g., "I, as JFK, choose to strike"), the engine calculates the causal consequences and generates a new timeline branch.
    * **Causal Consistency:** Unlike simple chatbots, the agent ensemble coordinates to ensure that the divergence follows logical historical causality (e.g., considering political constraints and military readiness).
    * **Active Guidance:** To solve the "fragmented dialogue" issue, agents proactively drive the plot—suggesting dilemmas or asking for orders—rather than waiting for user prompts.

2.  **ChronoViz (The Interface):** An immersive front-end (Web/VR) that visualizes the branching history.
    * **Observe & Intervene:** The system implements a two-stage flow. First, learners **Observe** a canonical reenactment to understand the real history. Then, they **Intervene** at specific nodes to diverge the timeline.
    * **Embodied Interaction:** Users interact via face-to-face dialogue and object manipulation with 3D avatars, reducing the cognitive load of text-based interfaces.

**Improvement over Prior Art:** ChronoFork solves the *Authoring Bottleneck* by using GenAI to write branches in real-time, and it solves the *LLM Context Gap* by using multi-agent coordination to maintain a coherent story world, rather than a stateless chat.

## Plan for Checkpoint 2 (Validation via Prompting) 🧪
Before implementing the full visualization, we will validate the core logic of **ChronoEngine** through rigorous prompting experiments:

1.  **Causal Logic Validation:** We will feed the system key historical divergence points (e.g., "The Cuban Missile Crisis turns hot") and evaluate if the multi-agent consensus mechanism generates logically sound and historically plausible consequences compared to expert analyses.
2.  **Persona Fidelity Check:** We will test if agents (e.g., Khrushchev, JFK) maintain their specific rhetorical styles and political stances when faced with user interventions that contradict the canonical timeline.
3.  **Safety & Feasibility Rails:** We will validate the "Facilitator" agent's ability to reject absurd inputs (e.g., "use alien technology") and guide the user back to feasible historical constraints using the "Tips" generation pipeline.

## Initial Risks & Mitigation 🛡️
* **Hallucination/Inaccuracy:** LLMs may invent false historical details.
    * *Mitigation:* We will implement a **RAG (Retrieval-Augmented Generation)** layer to ground the "Canonical" timeline in verified historical texts and provide a "Confidence Score" for divergent branches.
* **Narrative Drift:** Long interactions may lose coherence.
    * *Mitigation:* A dedicated "Director Agent" will be prompted to explicitly manage scene transitions and summarize context to the other agents to maintain focus.
* **Bias & Sensitivity:** Models may reflect training data biases regarding sensitive historical figures.
    * *Mitigation:* We will use diverse "Observer" agents to provide multiple perspectives on events and include a "Reflection Report" that encourages users to critically analyze the AI's depiction of history.

---
**References**

[1] Seixas, P., & Peck, C. (2004). Teaching historical thinking. Challenges and prospects for Canadian social studies, 109-117.

[2] Seixas, P. (2017). A model of historical thinking. Educational philosophy and theory, 49(6), 593-605.

[3] Zhao, J., Jingru, Z., & Lu, Y. (2025). Enhancing Design Historical Education Through AI Virtual Characters Role-Playing Narratives in Serious Games. International Journal of Gaming and Computer-Mediated Simulations (IJGCMS), 17(1), 1-20.

[4] Zhao, Y., Li, Y., Dai, T., Sedini, C., Wu, X., Jiang, W., ... & Lc, R. A. Y. (2025). Virtual reality in heritage education for enhanced learning experience: a mini-review and design considerations. Frontiers in Virtual Reality, 6, 1560594.

[5] Papadopoulou, A., Mystakidis, S., & Tsinakos, A. (2024). Immersive storytelling in social virtual reality for human-centered learning about sensitive historical events. *Information*, 15(5), 244.

[6] Jones, J. D. (2023). Authorial burden. In The Authoring Problem: Challenges in Supporting Authoring for Interactive Digital Narratives (pp. 47-63). Cham: Springer International Publishing.

[7] Mishra, A., Brudy, F., Zhou, Q., Fitzmaurice, G., & Anderson, F. (2025, June). WhatIF: Branched Narrative Fiction Visualization for Authoring Emergent Narratives using Large Language Models. In Proceedings of the 2025 Conference on Creativity and Cognition (pp. 590-605).

[8] Huijgen, T., & Holthuis, P. (2014). Towards bad history? A call for the use of counterfactual historical reasoning in history education. Historical Encounters: A journal of historical consciousness, historical cultures, and history education, 1(1), 103-110.

[9] Roberts, S. L. (2011). Using counterfactual history to enhance students’ historical understanding. The Social Studies, 102(3), 117-123.

[10] Zhu, Z., Yu, A., Tong, X., & Hui, P. (2025, April). Exploring LLM-Powered Role and Action-Switching Pedagogical Agents for History Education in Virtual Reality. In Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems (pp. 1-19).