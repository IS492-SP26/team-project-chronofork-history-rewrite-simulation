# 07 — Final (CP4 Pilot User Study)

Within-subject pilot (N = 6) comparing **ChronoFork-Web** against an **IDN-Twine** baseline across six historical episodes (The Battle of Red Cliffs / The Opium Wars / The Hundred Days' Reform / The Titanic / The Cuban Missile Crisis / The Attack on Pearl Harbor).

## Quick links

- 📄 **Final report:** [`docs/FINAL_REPORT.md`](docs/FINAL_REPORT.md) — ~4.2 k words, APA, six appendices
- 📦 **Artifact package:** [`docs/ARTIFACT_PACKAGE.md`](docs/ARTIFACT_PACKAGE.md) — full reproducibility index
- 🎤 **Presentation:** [`../00-presentation/cp4_pre_eval.pdf`](../00-presentation/cp4_pre_eval.pdf)

## One-command analysis

From the repo root:

```bash
python3 07-final/result/analysis_v2.py     # Wilcoxon + 8 charts + per-participant table
python3 07-final/scripts/build_cp4_deck.py # regenerates 00-presentation/presentation_cp4.pptx
```

## Folder layout

| Folder | Contents |
| --- | --- |
| `docs/` | `FINAL_REPORT.md` (4.2 k words) + `ARTIFACT_PACKAGE.md` (reproducibility index) |
| `study_design/` | Pilot Guide, Pilot Questionnaire (NES / ESS / PENS / UMUX-Lite / Paas / IMI), Event Library |
| `raw_data/` | `questionaire.xlsx` (anonymized numeric Likert) + `README.md`. Interview transcripts are kept private to honor consent scope; see `raw_data/README.md`. |
| `result/` | `analysis_v2.py`, `wilcoxon_results.json`, `per_participant_v2.md`, quantitative + qualitative reports, 8 charts in `charts/` |
| `scripts/` | `build_cp4_deck.py` — reproducibility script for the CP4 deck |

## Headline numbers

- **Sense of Agency:** ChronoFork +3.11 / 7 (PENS Core, *r* = 0.90, *p* = .063)
- **Narrative Presence:** +2.28 (*r* = 0.77, *p* = .094)
- **Interest / Enjoyment:** +2.67 (*r* = 0.81, *p* = .063)
- **Mental Effort:** +3.50 / 9 (Paas, framed as germane load — UMUX-Lite is a tie)
- **6 / 6** participants moved in the same direction on every key dimension
- **6 inductive themes** from interview transcripts (Reader → Author, Embodied Understanding, Showing vs. Telling, Character Fidelity, Convergence Forces, Onboarding)

## Related folders elsewhere in the repo

- [`../06-app/`](../06-app/) — deployable system (Chrono-Server / WebNext / WebUI / Twine baseline)
- [`../05-design/DESIGN_SPEC.md`](../05-design/DESIGN_SPEC.md) — CP3 design spec this evaluation tested
- [`../04-validation/03-analysis/GAP_ANALYSIS.md`](../04-validation/03-analysis/GAP_ANALYSIS.md) — CP2 prompting study that motivated the orchestration thesis
- [`../03-proposal/PROPOSAL.md`](../03-proposal/PROPOSAL.md) — CP1 proposal
