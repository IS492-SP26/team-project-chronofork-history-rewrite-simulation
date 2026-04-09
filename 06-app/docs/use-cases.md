# ChronoFork — Use Cases

## Actors

| Actor | Description |
|-------|-------------|
| **User** | A learner/player exploring a historical scenario |
| **Facilitator** | AI narrator providing meta-commentary (automated) |
| **Historical Agent** | LLM-embodied historical figure (automated) |
| **Config Operator** | Person setting up a new scenario via the config UI |

---

## UC-01: Generate a New Scenario (Config Phase)

**Actor:** Config Operator  
**Precondition:** Server running, `OPENAI_API_KEY` set  
**Trigger:** Operator opens Config UI (`config.chronofork.me` or localhost:5007)

**Flow:**
1. Operator enters a historical theme or event (e.g., "Cuban Missile Crisis" or "Cold War")
2. If a broad theme: system returns 5 candidate episodes; operator selects one  
   If a specific event: system proceeds immediately with that event
3. System generates 4–5 key decision-making historical figures (cast)
4. System generates a 4–6 node linear storyline JSON
5. Config is saved to `config/{timestamp}.json` and used by the backend on next connection

**Outcome:** A new playable scenario is ready.

**Edge cases:**
- LLM returns malformed JSON → system retries or shows error
- Operator navigates back and changes selection → previous LLM call results are cached; re-selection is instant

---

## UC-02: Observe the Canonical History (Stage 1)

**Actor:** User  
**Precondition:** Config loaded; server running; user connected via frontend  
**Trigger:** User clicks "Start Experience"

**Flow:**
1. Frontend sends `start_experience` to server
2. Facilitator streams opening narration for the first node
3. Historical agents exchange dialogue (streamed token by token)
4. Node advances: graph updates, next node begins
5. Process repeats through all storyline nodes
6. After final node: server sends `stage_update(stage=2)`

**Outcome:** User has watched the canonical historical sequence play out. Story graph shows full path. Intervention stage unlocked.

**Edge cases:**
- Connection dropped mid-stream → reconnect and re-send `start_experience`; LLM cache ensures same dialogue is replayed
- User requests "Tip" during observation → `tip_data` returned with 3–4 suggested intervention strategies

---

## UC-03: Request a Strategic Tip

**Actor:** User  
**Precondition:** Experience started (Stage 1 or Stage 2)  
**Trigger:** User clicks "Get Tip" button

**Flow:**
1. Frontend sends `request_tip`
2. Server calls LLM with current node context + cast state
3. Returns `tip_data` with:
   - One-line situation analysis
   - 3–4 strategic options (each with label, target agent, example line, rationale, risk, intent type)
4. Frontend displays tips in TacticalHUDDock

**Outcome:** User understands their strategic options before acting.

**Intent types:** Escalation | De-escalation | Alliance Building | Info Gathering

---

## UC-04: Backtrack to a Previous Node (Stage 2)

**Actor:** User  
**Precondition:** Stage 2 active (canonical story complete)  
**Trigger:** User clicks a past node in the story graph

**Flow:**
1. Frontend sends `backtrack_to` with `target_id` and `perspective_agent`
2. Server resets `StoryEngine._current_path` to the target node
3. Server responds with `action_update(backtrack_complete, new_node_id, new_role)`
4. Server replays the historical dialogue up to that node (for context)
5. Server sends `complete_history_review` to signal replay end
6. User is now in intervention mode at the selected node

**Outcome:** User has rewound to a historical decision point and can now act as a chosen figure.

---

## UC-05: Intervene and Create a Divergent Timeline

**Actor:** User  
**Precondition:** Backtracked to a node; Stage 2 active  
**Trigger:** User sends a message (`user_message`) to a historical agent

**Flow:**
1. Frontend sends `user_message` with content and target agent name
2. Server's `CastEngine` routes message to target agent's LLM
3. Agent responds (streamed); server checks if user's intervention deviates from canonical path
4. LLM evaluates **historical plausibility** of the divergence
5. If plausible:
   - New branch node created in `StoryGraph` (e.g., `3.1` alongside canonical `3.0`)
   - `action_update(divergence_in_progress)` sent
   - LLM generates new branch narrative
   - `action_update(divergence_complete, report)` sent with HTML analysis
   - `graph_update` reflects new variant node
6. If not plausible (agent stays in character, ignores deviation): no branch created

**Outcome:** User has created an alternate historical branch. The story graph now shows both the canonical and divergent paths.

---

## UC-06: Request a Reflection Report

**Actor:** User  
**Precondition:** Divergence has occurred; `enable_reflection` signal received  
**Trigger:** User clicks "Generate Reflection"

**Flow:**
1. Frontend sends `request_reflection`
2. Server's `ReflectionWorker` calls LLM with full session context (choices, outcomes, divergences)
3. Returns `reflection_report` with HTML-rendered strategic analysis comparing user choices to historical outcomes
4. Frontend renders HTML in report panel
5. User can export/save the report

**Outcome:** User receives a structured assessment of their decisions vs. historical reality.

---

## UC-07: Export and Save a Session

**Actor:** User  
**Precondition:** Session in progress  
**Trigger:** User clicks "Save"

**Flow:**
1. Frontend sends `export_save`
2. Server serializes full game state (graph, chat history, config) to JSON
3. Returns `save_complete` with filename and JSON content
4. Frontend triggers browser download of `saves/{timestamp}.json`

**Outcome:** Complete session archived for replay or analysis.

---

## Summary Table

| Use Case | Stage | Key Message | Output |
|----------|-------|-------------|--------|
| UC-01: Generate Scenario | Config | (Panel UI) | `config/*.json` |
| UC-02: Observe History | Stage 1 | `start_experience` | `stream_token`, `graph_update`, `stage_update` |
| UC-03: Get Tip | Any | `request_tip` | `tip_data` |
| UC-04: Backtrack | Stage 2 | `backtrack_to` | `action_update(backtrack_complete)` |
| UC-05: Intervene | Stage 2 | `user_message` | `stream_token`, `action_update(divergence_*)`, `graph_update` |
| UC-06: Reflection | Stage 2 | `request_reflection` | `reflection_report` |
| UC-07: Export | Any | `export_save` | `save_complete` |
