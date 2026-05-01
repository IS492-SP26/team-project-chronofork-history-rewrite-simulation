# Raw Data

This folder contains the anonymized data needed to reproduce the quantitative analysis of the CP4 pilot study.

## Contents

| File | Description |
| --- | --- |
| `questionaire.xlsx` | All 12 questionnaire rows (6 participants × 2 systems), 48 numeric Likert items per row. Fully anonymized — no free-text or PII. Required input for [`../result/analysis_v2.py`](../result/analysis_v2.py). |

## What is intentionally **not** included

**Interview transcripts** are not released publicly. Participants signed an informed-consent form that scoped audio and screen recordings to *research analysis*, not to public-data release. Releasing the verbatim Mandarin transcripts of a small (N = 6) study from a single university would create a non-trivial re-identification risk that the original consent did not cover.

What we *do* publish:

- The full **thematic analysis** with 6 inductively-derived themes, a cross-system comparison matrix, and representative anonymized quotes attributed to P1–P6 — see [`../result/qualitative_analysis.md`](../result/qualitative_analysis.md).
- The **questionnaire** (this folder) — fully numeric, low re-identification risk.
- The **study materials** ([`../study_design/`](../study_design/)) — protocol, instruments, and event library.

## Requesting transcripts for replication

Researchers seeking access to the raw transcripts for replication or secondary analysis may contact the author. Such requests will be honored on a case-by-case basis, subject to (i) a written data-sharing agreement that mirrors the original consent terms and (ii) a description of the intended use.
