# ChronoFork CP4 — Artifact Package

This document indexes everything needed to (a) inspect ChronoFork as a deployed system and (b) reproduce the pilot user-study results from raw data through to charts and statistics.

> **Companion to:** [`FINAL_REPORT.md`](./FINAL_REPORT.md) · [`cp4_pre_eval.pdf`](../../00-presentation/cp4_pre_eval.pdf)

---

## 1. Deployed System

| Component | URL | Notes |
|---|---|---|
| Frontend (production, Next.js) | https://app.chronofork.me | Default entry point for end-users |
| Frontend (legacy, Panel) | https://webui.chronofork.me | Original prototype, preserved for reproducibility |
| Configuration UI (Panel wizard) | https://config.chronofork.me | Three-step scenario authoring (Theme → Cast → Storyline) |
| Baseline IDN | https://twine.chronofork.me | Baseline interactive digital narrative system used for user study |

**To reproduce a study session locally:**

```bash
# 1. Start the backend
cd 06-app/Chrono-Server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # add OPENAI_API_KEY
python server_app.py --lang en

# 2. Start the production frontend (in a new terminal)
cd 06-app/Chrono-WebNext
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
npm run dev                  # http://localhost:3000

# 3. (Optional) generate a new scenario
cd 06-app/Chrono-Server
panel serve config_app.py --args --lang en --port 5007 --show
```

Full installation guide in [`06-app/INSTALL.md`](../../06-app/INSTALL.md).

---

## 2. Source Code

```
06-app/
├── Chrono-Server/           ← FastAPI WebSocket backend (Python 3.10)
│   ├── server_app.py
│   ├── config_app.py
│   ├── server/
│   │   ├── cast_engine.py        # multi-agent orchestration
│   │   ├── story_engine.py       # DAG branching + backtracking
│   │   ├── facilitator.py        # parallel meta-narrator
│   │   ├── reflection_worker.py  # post-branch reflection report
│   │   ├── prompts/catalog.py    # all LLM prompts (en + zh)
│   │   └── utilities/
│   │       ├── llm_cache.py      # MD5-keyed diskcache for OpenAI calls
│   │       └── logger.py         # TSV event logger
│   └── requirements.txt
├── Chrono-WebNext/          ← Next.js production frontend
│   ├── app/                       # App Router pages
│   ├── src/features/chronofork/   # domain logic
│   └── components/                # UI primitives
├── Chrono-WebUI/            ← Legacy Panel frontend
└── docs/
    ├── architecture.md
    ├── safety.md
    ├── telemetry.md
    └── use-cases.md
```

**Key architectural docs:** [`architecture.md`](../../06-app/docs/architecture.md), [`safety.md`](../../06-app/docs/safety.md), [`telemetry.md`](../../06-app/docs/telemetry.md).

---

## 3. Prompts

All LLM prompts are version-controlled in:

```
06-app/Chrono-Server/server/prompts/catalog.py
```

The catalog is keyed by `(lang, prompt_id)`; the operator selects language at server start with `python server_app.py --lang en|zh`. Key prompt families:

| Prompt id | Used by | What it does |
|---|---|---|
| `cast.agent_system` | `CastEngine` | Per-character system prompt (persona, knowledge boundary, stance) |
| `cast.agent_response` | `CastEngine` | Per-turn user-facing response generation |
| `facilitator.intervention_classify` | `Facilitator` | Plausibility rail (plausible / stretch / unlikely / impossible) |
| `facilitator.scene_summary` | `Facilitator` | Stage transitions and recap |
| `facilitator.tips` | `Facilitator` | Hint generation when learner requests guidance |
| `reflection.report_generate` | `ReflectionWorker` | Final HTML reflection report |
| `config.theme_to_episodes` | Config wizard | Step 1 of scenario authoring |
| `config.episode_to_cast` | Config wizard | Step 2 |
| `config.cast_to_storyline` | Config wizard | Step 3 |

**Earlier versions (CP2 prompting study)** are archived in [`04-validation/02-runs/`](../../04-validation/02-runs/) under `chatgpt/`, `claude/`, and `perplexity/`, with full task transcripts.

---

## 4. Pilot Data — Cleaned & Reproducible

### 4.1 Raw data

| Path | Contents |
|---|---|
| `../raw_data/questionaire.xlsx` | All 12 questionnaire rows (6 participants × 2 systems), 48 items per row. Fully anonymized — numeric Likert only. |
| `../raw_data/README.md` | Notes on what is and is not released, and how to request transcripts. |

**Interview transcripts are not released publicly** to honor the original consent scope (research analysis only, not public-data release). The published thematic analysis in [`../result/qualitative_analysis.md`](../result/qualitative_analysis.md) includes representative anonymized quotes from all six participants. Transcripts are available on reasonable request — see [`../raw_data/README.md`](../raw_data/README.md).

### 4.2 Reproducible analysis

```bash
# All in one command — regenerates Wilcoxon results + 8 charts + per-participant table
cd 07-final
python3 result/analysis_v2.py
```

This produces:

| Output | What it is |
|---|---|
| `../result/wilcoxon_results.json` | Wilcoxon W, p, effect-size r for all 15 subscales |
| `../result/per_participant_v2.md` | Full per-participant Δ table with W/p/r |
| `../result/charts/A1_narrative_engagement.png` | NES — 4 subscales + Overall |
| `../result/charts/A2_explanation_plausibility.png` | Explanation Quality + Plausibility |
| `../result/charts/B1_agency.png` | PENS Core + Extended |
| `../result/charts/B2_usability.png` | UMUX-Lite + Perspective Switching |
| `../result/charts/B2_mental_effort.png` | Paas Mental Effort with per-participant scatter |
| `../result/charts/D_motivation.png` | IMI — Interest, Value, Pressure |
| `../result/charts/headline_radar.png` | 5-dimension headline radar |
| `../result/charts/slope_agency_effort.png` | Per-participant paired slopes for Agency + Mental Effort |

### 4.3 Quantitative analysis report

`../result/quantitative_analysis.md` — descriptive statistics by subscale, per-participant scores, paired-difference summary, UMUX-Lite 0–100 conversion, and key findings narrative.

### 4.4 Qualitative analysis

`../result/qualitative_analysis.md` — Braun & Clarke (2006) reflexive thematic analysis with six themes, cross-system comparison matrix, representative anonymized quotes (P1–P6), and 6-participant summary. Original transcripts are not committed; see `../raw_data/README.md` for the consent-scope rationale.

---

## 5. Study Materials

| File | Contents |
|---|---|
| `../study_design/Pilot Guide.md` | Full study protocol, tutorial-video scripts, interview guide, and embedded consent script |
| `../study_design/Pilot Questionnaire.md` | All instrument items (Chinese + English back-translation), reverse-scoring keys, subscale aggregation rules |
| `../study_design/Event Library.md` | Six historical events used in the pilot, with canonical setup and divergence framing |

---

## 6. Slide Decks

| File | Use |
|---|---|
| `../../00-presentation/cp1_pre_proposal.pdf` | CP1 — concept + literature framing |
| `../../00-presentation/cp2_pre_validation.pdf` | CP2 — prompting validation + gap analysis |
| `../../00-presentation/cp3_pre_impl.pdf` | CP3 — built system + study plan |
| `../../00-presentation/cp4_pre_eval.pdf` | **CP4 — pilot evaluation & findings** (8 min + 2 min Q&A) |

CP4 speaker scripts (per-slide) are embedded in the chat transcript that produced the deck.

---

## 7. Reference / Literature

| Path | Contents |
|---|---|
| `../../01-literature/citations.bib` | Full BibTeX (35+ entries) covering counterfactual history pedagogy, LLM roleplay, IDN authorial burden, multi-agent narrative, VR for history education, and measurement instruments |
| `../../01-literature/counter_factual/` | PDFs for Roberts (2011), Seixas (2017), Huijgen & Holthuis (2014), and the Historical Encounters journal piece |
| `../../01-literature/llm_roleplay/` | Zhu et al. (2025), Park et al. (2025), Su et al. (2025), Taheri et al. (2026), 2025 *Enhancing Design Historical Education* |
| `../../01-literature/storytelling/` | Jones (2022, 2024), Mishra et al. (2025), Cheng et al. (2025), Yu et al. (2025), Xia et al. (2025), Arif et al. (2026), Papadopoulou et al. (2024) |
| `../../01-literature/vr_for_education/` | Barbara (2022), MacDowell et al. (2024), Theodoropoulos & Antoniou (2022), Zhao et al. (2025) |

APA-formatted reference list also appears in `FINAL_REPORT.md` § References.

---

## 8. Prior Checkpoints — Provenance

| Folder | Checkpoint | Key artifacts |
|---|---|---|
| `../../03-proposal/PROPOSAL.md` | CP1 | Problem framing, target users, prior systems, proposed approach |
| `../../04-validation/01-methodology/` | CP2 | Prompting protocol, scoring rubric, run-log template |
| `../../04-validation/02-runs/{chatgpt,claude,perplexity}/` | CP2 | Full prompt transcripts for all three off-the-shelf tools |
| `../../04-validation/03-analysis/GAP_ANALYSIS.md` | CP2 | Cross-tool gap analysis (orchestration not generation) |
| `../../04-validation/03-analysis/OPPORTUNITY_FRAMING.md` | CP2 | Six product requirements R1–R6 |
| `../../04-validation/04-speed_dating/` | CP2 | External-collaborator and team-prioritization interviews |
| `../../05-design/DESIGN_SPEC.md` | CP3 | Refined concept, primary user journey, task flows, key screens |
| `../../05-design/PROTOTYPE_DEMO.md` | CP3 | Sandbox demo description |
| `../../05-design/img/` | CP3 | Architecture and process diagrams |
| `06-app/` | CP3 → CP4 | Full deployable system (this report's evaluation target) |

---

## 9. Optional Figures (Future Work)

The pilot did not capture conventional learning-curve, cost, or latency metrics, but the supporting infrastructure is in place if they are needed for a follow-up study:

- **LLM cost / call volume** — derivable from `06-app/Chrono-Server/cache/` cache statistics; MD5-keyed entries make it possible to count unique vs. repeated requests.
- **Latency distribution** — `06-app/Chrono-Server/logs/{MM-DD_HH-MM}.tsv` records `LLM_Input` and `LLM_Output` timestamps for every agent turn.
- **Branch-exploration patterns** — `StoryEngine` records each `backtrack_to` and branch creation event; the same TSV log can be replayed to reconstruct each participant's traversal.

These analyses are out of scope for the CP4 pilot but are noted as low-effort follow-ups.

---

## 10. Quick Reproduction Checklist

To verify the pilot end-to-end on a fresh machine:

```bash
# Run from the repo root.

# 1. Statistical analysis
python3 -m pip install scipy openpyxl matplotlib numpy --break-system-packages
python3 07-final/result/analysis_v2.py
# Expect: Wilcoxon table to console + 8 PNGs in 07-final/result/charts/ + JSON + per-participant.md
```

Expected outputs are bit-identical to the version committed in this submission, modulo image PNG metadata timestamps.
