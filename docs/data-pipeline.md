# Data pipeline — grounding design (`pharos.db`)

> Design for the Lead's data lane. Implementation (`scripts/build-data.*` → `data/pharos.db`) is **June 1+** (judged). The datasets and these verified facts are pre-build prior work (disclose as such).
>
> **Verified 2026-05-31** by downloading and inspecting the real files — not from memory.

## What we actually have (verified, not assumed)

### DDInter 2.0 — staged in `data/raw/ddinter/` (gitignored)
8 CSVs by ATC class (A, B, D, H, L, P, R, V), ~13.6 MB, downloaded directly (no login) from `https://ddinter2.scbdd.com/static/media/download/ddinter_downloads_code_<X>.csv`.

**Real columns (header):** `DDInterID_A, Drug_A, DDInterID_B, Drug_B, Level`

| Metric | Value |
|---|---|
| Raw rows (all files) | 222,383 |
| **Distinct unordered drug pairs** | **160,235** |
| Distinct drug names (generic) | 2,496 |
| Severity `Level` values | Major 33,896 · Moderate 130,367 · Minor 10,938 · **Unknown 47,182** |

**⚠️ Plan corrections (this changes the grounding design):**
- The public CSVs have **NO mechanism / management text** and **NO RxCUI or DrugBank ID mapping** — only the pair + a severity `Level`. The earlier plan ("~302k interactions, mechanism + management, mapped to DrugBank IDs + ATC") overstated what the download contains.
- `Drug_A` / `Drug_B` are **generic English names** (e.g. `Warfarin`, `Aspirin`). The join key is the **normalized name**, not an RxCUI.
- `Level` includes **`Unknown`** (47k pairs) — treat as "documented interaction, severity uncharacterized," distinct from "no interaction found." Do **not** show `Unknown` as a clean bill of health.

### RxNorm Current Prescribable Content — **needs auth (user action)**
- Latest release: `RxNorm_full_prescribe_05042026.zip` (May 4, 2026). Files: RXNCONSO (names/codes), RXNSAT (attributes), RXNREL (relationships).
- **The download now redirects to `uts.nlm.nih.gov/uts/login`** — a free **UMLS/UTS account + API key** is required. (`data/README.md`'s "no UMLS login required" was outdated — corrected.)
- **Not on the critical path.** RxNorm's job is brand/foreign-name → generic normalization. DDInter already matches on generic names, so the solo MVP works without it; RxNorm widens coverage. Acquire via a UTS API key when convenient: see https://documentation.uts.nlm.nih.gov/automating-downloads.html

### DrugBank Vocabulary (CC0) — optional, deferred
Extra brand/international synonyms. The open-data download typically requires a free DrugBank account. Same role as RxNorm (widen name matching), same "enhancement, not blocker" status.

## `pharos.db` schema (SQLite, built June 1)

```sql
-- 160,235 rows. Pair stored normalized + ordered (a < b) for stable lookup.
CREATE TABLE interactions (
  drug_a       TEXT NOT NULL,          -- normalized: lowercase, trimmed; a < b lexicographically
  drug_b       TEXT NOT NULL,
  severity     TEXT NOT NULL,          -- 'Major' | 'Moderate' | 'Minor' | 'Unknown'
  ddinter_id_a TEXT NOT NULL,          -- e.g. 'DDInter1' — provenance/citation
  ddinter_id_b TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'DDInter 2.0'
);
CREATE UNIQUE INDEX idx_pair ON interactions(drug_a, drug_b);

-- 2,496 rows. The known-drug vocabulary: shelf autocomplete + "is this drug in scope?" gate.
CREATE TABLE drugs (
  name        TEXT NOT NULL,           -- display name, e.g. 'Warfarin'
  normalized  TEXT NOT NULL,           -- lowercase, trimmed
  ddinter_id  TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_drug_norm ON drugs(normalized);

-- Optional, added with RxNorm/DrugBank later: brand/foreign synonym -> canonical generic.
CREATE TABLE synonyms ( synonym TEXT NOT NULL, normalized TEXT NOT NULL, src TEXT );
CREATE INDEX idx_syn ON synonyms(synonym);
```

**Normalization rule (one function, both sides):** `norm(s) = s.trim().toLowerCase()` (extend later: strip salts/forms like "hydrochloride", collapse whitespace). The build script and the runtime lookup MUST use the **same** `norm()`.

## Build steps (`scripts/build-data.*`, June 1)
1. Read all 8 DDInter CSVs; for each row, `norm(Drug_A)`, `norm(Drug_B)`; order the pair so `a < b`.
2. De-dup pairs (160,235 expected). On conflict, keep the **most severe** Level (Major > Moderate > Minor > Unknown) so a pair never under-reports.
3. Populate `interactions` + `drugs`. Write `data/pharos.db`.
4. Emit a build report (row counts, severity histogram) to assert against the verified numbers above — this is a reproducibility artifact.

## Runtime lookup (backs `core/lookupInteractions`)
```
lookupInteractions(scannedDrug, shelf[]):
  s = norm(scannedDrug)
  if s not in drugs.normalized  -> ABSTAIN ('not_in_dataset')   // never guess
  for each item in shelf:
    (a,b) = ordered(s, norm(item))
    row = SELECT * FROM interactions WHERE drug_a=a AND drug_b=b
    if row -> emit { severity: row.severity, drugA, drugB, ddinterIds, source:'DDInter 2.0' }
  return matches   // [] = no documented interaction (NOT proof of safety — say so in the card)
```

## Grounding & honesty (given no mechanism text)
The retrieved **hard fact** is: *"DDInter 2.0 documents an interaction between A and B at severity `Level`."* That — and only that — is what we assert and cite. MedPsy then explains the **general** clinical context in plain language, clearly framed as background, never as a retrieved DDInter field (because the CSV has none). The result card shows: severity chip + "Source: DDInter 2.0" + the model's plain-language context + the standing "educational only" disclaimer. `Unknown` severity → "a documented interaction exists; its severity isn't characterized — ask a pharmacist." No match → "no documented interaction found in DDInter — this is not a guarantee of safety."

## `npm run verify` fixtures (from real data)
Pick pre-verified pairs straight from the staged CSVs, e.g. **Warfarin + Aspirin** (confirm the exact Level in `data/raw/ddinter/` before filming), and an out-of-dataset drug to exercise the abstain path. The verifier asserts the returned severity matches the DB row.
