# ChronoFork — Architecture

## System Overview

ChronoFork is an interactive historical "what-if" simulation. Users explore canonical history, then rewind and intervene to create divergent timelines. The system is split into three deployable components communicating over WebSocket.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │   Chrono-WebNext     │    │       Chrono-WebUI           │  │
│  │  (Next.js / React)   │    │    (Panel / Python)          │  │
│  │                      │    │                              │  │
│  │  FlowHeader          │    │  ChatInterface               │  │
│  │  CenterStage         │    │  StoryGraph                  │  │
│  │  TimeRiverDock       │    │  EpisodeCastInfo             │  │
│  │  TacticalHUDDock     │    │                              │  │
│  │  TimeWarpOverlay     │    │                              │  │
│  └──────────┬───────────┘    └─────────────┬────────────────┘  │
│             │  WebSocket (JSON)             │ WebSocket (JSON)  │
└─────────────┼─────────────────────────────-┼───────────────────┘
              │                              │
              └──────────────┬───────────────┘
                             │  ws://host:8000/ws
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Chrono-Server (FastAPI)                     │
│                                                                 │
│  ┌──────────────┐   ┌───────────────┐   ┌──────────────────┐  │
│  │ConnectionMgr │   │  CastEngine   │   │  StoryEngine     │  │
│  │              │──▶│               │──▶│  (Story Graph)   │  │
│  │ WebSocket    │   │  Agent[]      │   │                  │  │
│  │ routing      │   │  input_queue  │   │  nodes/edges     │  │
│  │              │   │  output_queue │   │  current_path    │  │
│  └──────────────┘   └──────┬────────┘   └──────────────────┘  │
│                            │                                   │
│              ┌─────────────┼─────────────┐                    │
│              ▼             ▼             ▼                     │
│  ┌─────────────────┐  ┌─────────┐  ┌──────────────────┐      │
│  │  LLM Cache      │  │Facilittr│  │  EventLogger     │      │
│  │  (diskcache)    │  │         │  │  logs/*.tsv      │      │
│  └────────┬────────┘  └────┬────┘  └──────────────────┘      │
│           │               │                                   │
└───────────┼───────────────┼───────────────────────────────────┘
            │               │
            ▼               ▼
    ┌──────────────┐   ┌─────────┐
    │  OpenAI API  │   │  OpenAI │
    │  (GPT-5.1)   │   │  API    │
    └──────────────┘   └─────────┘

┌──────────────────────────────────────────────────────────────────┐
│                  Chrono-Server (Config UI)                       │
│                                                                  │
│  panel serve config_app.py --args --lang en                      │
│                                                                  │
│  Step 1: Theme input  →  LLM generates Episodes                 │
│  Step 2: Episode      →  LLM generates Cast (4-5 figures)       │
│  Step 3: Cast         →  LLM generates Storyline (4-6 nodes)    │
│                                      ↓                          │
│                            config/{timestamp}.json               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### Chrono-Server

**Entry points:**
- `server_app.py` — FastAPI WebSocket server (port 8000)
- `config_app.py` — Panel wizard for generating scenario configs

**Key modules:**

| Module | Responsibility |
|--------|---------------|
| `server/cast_engine.py` | Orchestrates agents, node progression, backtracking, divergence |
| `server/story_engine.py` | DAG-based story graph: nodes, edges, paths, variant tracking |
| `server/facilitator.py` | Parallel "meta narrator" providing strategic commentary |
| `server/reflection_worker.py` | Generates post-session HTML reflection report |
| `server/prompts/catalog.py` | All LLM prompt templates (zh/en) |
| `server/utilities/llm_cache.py` | OpenAI wrapper with MD5-keyed diskcache persistence |
| `server/utilities/logger.py` | TSV event logger for all system events |

**Concurrency model:** Each WebSocket connection spawns an `asyncio.Task` (`output_worker`) that drains `CastEngine.output_generator()`. User messages are pushed into `input_queue`. All LLM calls are `async`; streaming responses yield tokens incrementally.

### Story Graph (DAG)

```
Node 0.0 (start)
    │
    ▼
Node 1.0 ──[backtrack]──▶ Node 1.1 (divergent branch)
    │                           │
    ▼                           ▼
Node 2.0                    Node 2.1
    │
    ▼
Node 3.0 (end)
```

- Nodes are identified by `depth.variant` (e.g., `2.1` = depth 2, variant 1)
- Canonical path: all `.0` variants
- Divergent branches: created when user's intervention is historically plausible

### WebSocket Message Flow

```
Frontend                            Server
   │                                   │
   │── connect ─────────────────────▶  │
   │◀─ system_init ──────────────────  │  (config + status)
   │◀─ graph_update ─────────────────  │  (initial DAG snapshot)
   │                                   │
   │── start_experience ────────────▶  │
   │◀─ stream_token (×N) ────────────  │  (agent dialogue)
   │◀─ graph_update ─────────────────  │  (on node advance)
   │◀─ stage_update (stage=2) ───────  │  (observation complete)
   │                                   │
   │── backtrack_to ────────────────▶  │
   │◀─ action_update(backtrack_complete)│
   │                                   │
   │── user_message ────────────────▶  │
   │◀─ stream_token (×N) ────────────  │  (LLM agent response)
   │◀─ action_update(divergence_*) ──  │  (if branch created)
   │                                   │
   │── request_reflection ──────────▶  │
   │◀─ reflection_report ────────────  │  (HTML report)
```

### Chrono-WebNext (Frontend)

**Layered architecture:**

```
app/page.tsx
  └─ ChronoForkProvider (React Context)
       ├─ useWebSocket()       — WS connect/message routing
       ├─ state/reducer.ts     — RunState management
       └─ components/
            ├─ FlowHeader      — Status bar & controls
            ├─ CenterStage     — Main narrative/dialogue area
            ├─ TimeRiverDock   — Story graph visualization
            ├─ TacticalHUDDock — Cast info & tactical display
            ├─ TimeWarpOverlay — Divergence animation
            └─ HelpPanel       — In-app help
```

**State machine phases:**

```
observe_idle
  → observe_playing  (start_experience)
  → stage2_idle      (stage_update stage=2)
  → intervene_active (backtrack_to)
  → divergence_running (user_message triggers plausibility check)
  → divergence_complete
```

---

## Data Flows

### Config Generation

```
User types theme
  → LLM: theme_to_episodes prompt
  → User selects episode
  → LLM: episode_to_cast prompt
  → LLM: cast_to_storyline prompt
  → Saved: config/{timestamp}.json
```

### Scenario Execution

```
server_app.py reads config/*.json (latest by mtime)
  → CastEngine loads StoryEngine (graph) + Agent instances
  → start_experience received
  → Per node: facilitator streams intro
  → Agents exchange dialogue via LLM (streaming tokens)
  → node advance → graph_update pushed
  → Stage 1 complete → stage_update(2)
```

### Divergence

```
User sends message in Stage 2
  → CastEngine checks if response deviates from canonical path
  → LLM evaluates historical plausibility
  → If plausible: new branch node created in StoryGraph
  → action_update(divergence_complete) + HTML report
  → graph_update with new variant node
```

---

## Deployment

| Service | URL | Stack |
|---------|-----|-------|
| Chrono-WebNext | https://app.chronofork.me/ | Next.js |
| Chrono-WebUI (legacy) | https://webui.chronofork.me/ | Panel |
| Config UI | https://config.chronofork.me/ | Panel |
| Backend WS | wss://app.chronofork.me/ws (proxied) | FastAPI + Uvicorn |

The backend is a single `uvicorn` process. The Next.js frontend connects via `NEXT_PUBLIC_WS_URL`. In production the WebSocket is typically reverse-proxied through nginx with `proxy_pass` and `upgrade` headers.

---

## Technology Choices

| Decision | Rationale |
|----------|-----------|
| WebSocket over REST | Story dialogue is streaming and bidirectional; REST polling would add unnecessary latency |
| diskcache for LLM results | Deterministic prompts → identical responses; cache cuts cost and latency during development |
| Story graph as DAG | Enables arbitrary backtracking and branching without duplicating state |
| Panel for config UI | Rapid Python-native prototyping; no separate API needed for config generation |
| Next.js App Router | Server components, streaming, clean feature layering |
