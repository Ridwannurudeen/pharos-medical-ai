# Data — offline drug datasets

All interaction warnings are **retrieved** from these datasets and merely *explained* by MedPsy — the model never invents interactions. Everything here is bundled for **offline** use; there are **no runtime API calls**.

> Do **NOT** use NLM's RxNav drug-interaction API — it was permanently discontinued on Jan 2, 2024.

Large raw files live under `data/raw/` and are git-ignored. Commit only the processed, app-ready artifact (a compact SQLite DB or JSON) and the build script that produces it.

## 1. DDInter 2.0 — interactions + severity
- **What:** drug-drug interactions with a severity `Level`. **Verified 2026-05-31:** the public CSVs are **name + severity only** — 160,235 distinct pairs across 2,496 generic drugs, `Level` ∈ Major/Moderate/Minor/**Unknown**; **no** mechanism/management text and **no** RxCUI/DrugBank mapping (the earlier description overstated this). Full grounding design: [`../docs/data-pipeline.md`](../docs/data-pipeline.md).
- **License:** CC BY-NC 4.0 (non-commercial, attribution). See `NOTICE`.
- **Get it:** download the CSVs from https://ddinter2.scbdd.com (no login).
- **Use:** the core interaction table.

## 2. RxNorm — Current Prescribable Content
- **What:** offline mapping from drug names/brands/synonyms → RxCUI canonical id.
- **License:** public domain (US Gov work). **Note (verified 2026-05-31):** the download now **redirects to UTS login — a free UMLS/UTS account + API key is required** (the old "no login" note was outdated). Not on the critical path: DDInter matches on generic names, so the solo MVP works without RxNorm; it only widens brand/foreign-name coverage.
- **Get it:** https://www.nlm.nih.gov/research/umls/rxnorm/docs/prescribe.html
- **Use:** normalize OCR'd text to a canonical drug for lookup.

## 3. DrugBank Vocabulary (CC0 subset ONLY)
- **What:** extra brand / international synonyms to widen name matching.
- **License:** CC0 (public domain). Use **only** the open Vocabulary/Structures files — NOT the CC BY-NC interaction XML.
- **Get it:** https://go.drugbank.com/releases/latest#open-data

## Normalization approach (handles the multilingual gap)
RxNorm is US/English-centric, so an OCR'd foreign **brand** name may not resolve. Strategy:
1. Use translation to reduce the label to the **generic / active-ingredient** name (more consistent across languages: "Ibuprofeno" → ibuprofen).
2. Match the generic name → RxCUI via RxNorm (+ DrugBank synonyms).
3. If no confident match → **abstain** ("can't verify this one, consult a pharmacist"). Never guess.

## Build artifact
`scripts/build-data.*` (written at build start) should join DDInter + RxNorm into a single indexed `data/pharos.db` (SQLite) keyed by RxCUI, with severity and a source-row id for provenance/citation.
