# ChronoFork — Installation & Run Guide

## Overview

ChronoFork is a three-component application:

| Component | Description | Start Command |
|-----------|-------------|---------------|
| **Chrono-Server** | FastAPI WebSocket backend + Panel config UI | `python server_app.py --lang en` |
| **Chrono-WebUI** | Legacy Panel-based web frontend | `panel serve web_app.py --args --lang en` |
| **Chrono-WebNext** | Modern Next.js frontend (production) | `npm start` |

Live deployments:
- Frontend (new): https://app.chronofork.me/
- Config UI: https://config.chronofork.me/
- Frontend (legacy): https://webui.chronofork.me/

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | For backend and legacy UI |
| Node.js | 18+ | For Chrono-WebNext |
| npm / pnpm | latest | pnpm preferred for WebNext |

---

## 1. Chrono-Server (Backend)

### Install

```bash
cd 06-app/Chrono-Server
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Configure

Copy the environment template and fill in your key:

```bash
cp ../.env.example .env
# edit .env and set OPENAI_API_KEY
```

### Generate a config session first (required before running server)

```bash
# English config UI
panel serve config_app.py --args --lang en --port 5007 --show

# Chinese config UI
panel serve config_app.py --args --lang zh --port 5007 --show
```

Open http://localhost:5007 → complete the 3-step wizard (Theme → Cast → Storyline).  
A timestamped JSON will be saved to `config/`. This must exist before starting the server.

### Run the WebSocket server

```bash
# English prompts
python server_app.py --lang en

# Chinese prompts
python server_app.py --lang zh
```

Server listens on `http://0.0.0.0:8000`. WebSocket endpoint: `ws://localhost:8000/ws`.

---

## 2. Chrono-WebNext (New Frontend — recommended)

```bash
cd 06-app/Chrono-WebNext
npm install          # or: pnpm install
```

Copy the environment file:

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_WS_URL to point at your server
```

### Development

```bash
npm run dev
```

Open http://localhost:3000.

### Production build

```bash
npm run build
npm start
```

---

## 3. Chrono-WebUI (Legacy Frontend)

```bash
cd 06-app/Chrono-WebUI
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

```bash
# English
panel serve web_app.py --args --lang en --port 5006 --show

# Chinese
panel serve web_app.py --args --lang zh --port 5006 --show
```

Open http://localhost:5006.

---

## Typical Local Stack (all components)

Run each in a separate terminal:

```bash
# Terminal 1 — backend
cd 06-app/Chrono-Server && python server_app.py --lang en

# Terminal 2 — new frontend
cd 06-app/Chrono-WebNext && npm run dev

# Terminal 3 — config UI (only when you need to regenerate a scenario)
cd 06-app/Chrono-Server && panel serve config_app.py --args --lang en --port 5007
```

---

## File & Directory Reference

```
06-app/
├── Chrono-Server/
│   ├── server_app.py          # FastAPI WebSocket entry point
│   ├── config_app.py          # Panel config wizard entry point
│   ├── requirements.txt
│   ├── .env                   # (create from .env.example — not committed)
│   ├── config/                # Generated scenario JSON files (auto-created)
│   ├── cache/                 # LLM response disk cache (auto-created)
│   └── logs/                  # TSV event logs (auto-created)
├── Chrono-WebUI/
│   ├── web_app.py             # Legacy Panel frontend entry point
│   └── requirements.txt
├── Chrono-WebNext/
│   ├── app/                   # Next.js App Router pages
│   ├── src/features/chronofork/  # Domain logic
│   ├── .env.local             # (create from .env.example — not committed)
│   └── package.json
└── docs/
    ├── architecture.md
    ├── use-cases.md
    ├── telemetry.md
    └── safety.md
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing required '--lang'` | No `--lang` flag passed | Add `--lang en` or `--lang zh` |
| `Missing OPENAI_API_KEY` | `.env` not set up | Copy `.env.example` → `.env` and fill key |
| `error_no_config` on connect | No config JSON in `config/` | Run config wizard first |
| WebSocket `ws://localhost:8000` refused | Server not running | Start `server_app.py` first |
| `npm run dev` port conflict | Port 3000 in use | `npm run dev -- -p 3001` |
