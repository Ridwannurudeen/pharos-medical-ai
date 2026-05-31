# Pharos — Build Roadmap (QVAC Hackathon I)

**Build period:** June 1 – June 21, 2026 (judged work only). **Winners:** July 3.
**Target early-bird submission:** **June 14** (official rules list both June 14 and June 17 — hit the earlier to be safe). Hard deadline June 21, 23:59 UTC.
**Team:** 2 — **Lead** (core/data/mesh/verification) + **App Dev** (the phone app). Tracks: General Purpose + Psy Models.

> **Ambition statement:** ship the *bulletproof* solo tier (one phone, airplane mode, grounded, cited) as the guaranteed floor — then reach for the podium with the mesh ceiling (P2P delegation + a fresh phone pulling the model from a peer with the internet physically off) and a voice-driven stretch. The staging means the ambitious version adds **zero risk to the floor**.

---

## The split (who owns what)

| Area | Owner | What it covers |
|---|---|---|
| **`core/`** — the engine | **Lead** | All `@qvac/sdk` calls (OCR, MedPsy completion, embeddings), the grounded pipeline, the audit/resource-log writer. This is the API the app codes against. |
| **`data/`** — grounding | **Lead** | DDInter + RxNorm + DrugBank → `pharos.db`; normalization (text → generic → RxCUI); interaction lookup + provenance. |
| **`anchor/` + mesh** | **Lead** | Laptop anchor running MedPsy-4B (`startQVACProvider`), consumer delegation via `loadModel({delegate})`, offline model-registry pull, `fallbackToLocal`. |
| **Verification** | **Lead** | `npm run verify` harness, reproducibility, network-capture evidence, demo fixtures. |
| **`app/`** — the phone app | **App Dev (B)** | Expo app: camera capture, OCR wiring, **result card UI** (severity-graded, cited), encrypted **medication shelf** (add/remove), disclaimer + abstain UX, navigation, settings, mesh status indicator. |

**The contract seam (the most important thing in this doc).** Lane B never touches the QVAC SDK or the datasets directly — B builds the UI against a typed `core/` API. The Lead has shipped **`core/` as mocks** (canned fixtures, real signatures — in `core/`, types in `core/types.ts`) so B can build the *entire* app immediately; the Lead swaps real implementations in behind the same signatures. Integration is continuous, not a big-bang merge.

```ts
// core/ — the contract both lanes agree on (Lead implements; B consumes). Types in core/types.ts.
scanPipeline(image, shelf): Promise<ScanResult>            // the one call B makes per scan; emits audit events
// ScanResult  = { scan{rawText,generic,matched}, interactions[], explanation, abstained, abstainReason?, delegated, latencyMs }
// Interaction = { drugA, drugB, severity: Major|Moderate|Minor|Unknown, source:"DDInter 2.0", ddinterIdA, ddinterIdB }
loadEngines(): Promise<...>                                // load OCR + LLM (local or delegated)
ocrLabel(image): Promise<{ text; latencyMs }>             // QVAC ocr()
normalize(text): Promise<{ raw; generic; matched }>        // synonym + DDInter drug-list match, or abstain
lookupInteractions(drug, shelf): Promise<Interaction[]>    // DDInter lookup by normalized name
explain({ scan, shelf, interactions }): Promise<{ text }>  // MedPsy explains the retrieved fact
audit.log(event): void                                     // append to audit.jsonl per docs/audit-log-schema.md
```
B renders `ScanResult` and calls `scanPipeline(image, shelf)`; B owns the user's shelf store (`expo-sqlite`), Lead owns the read-only bundled `pharos.db`. (DDInter has no mechanism text — see [`docs/data-pipeline.md`](docs/data-pipeline.md).)

> **Hand this to teammate B:** [`docs/lane-app.md`](docs/lane-app.md) — a self-contained brief of their entire scope (contract, screens, per-phase deliverables, rules of the road).

---

## Gate 0 — Day-1 Spike (June 1, before anything else)

Run `day1-spike.md`. **This decides the scope below.** (Gate A = P2P delegation + offline pull; Gate B = grounded chain on phone.)
- **A pass + B pass →** build the unified product (Phases 1→2→3→4).
- **A fail + B pass →** ship solo only; skip Phase 2; reinvest that time into Phase 4 polish. **No wasted work.**
- **B fail →** stop and fix grounding before building.

Lead runs Gate A (anchor + delegation + offline pull). App Dev pairs on Gate B (real phone OCR on Spanish labels) so they learn the device pipeline early. One-line verdict in the team channel ends Day 1.

---

## Phase 1 — Solo tier MVP (June 2–7) · *the guaranteed floor*

**Goal:** a phone in airplane mode reads a pill bottle and catches a dangerous interaction, grounded and cited, in <8s.

**Lead lane**
- Build the **audit-log + resource-log writer first** (`docs/audit-log-schema.md`) — every later step writes to it.
- `scripts/build-data.*`: join DDInter + RxNorm Prescribable + DrugBank Vocabulary → indexed `data/pharos.db` keyed by RxCUI (severity, mechanism, management, `source_row_id` for citation).
- Implement `core/`: `ocrLabel` (QVAC `ocr`, `OCR_LATIN_RECOGNIZER_1`), `normalize` (generic-name → RxCUI + abstain gate), `lookupInteractions`, `explain` (MedPsy-1.7B, strict "explain the retrieved fact, do not invent" template), `scanPipeline` orchestration.
- **Ship `core/` mocks on Day 2** so B is unblocked; replace with real impls through the week.

**App Dev lane (B)**
- Scaffold the Expo app; navigation (Scan / Shelf / Result / Settings).
- Camera capture → `scanPipeline(image)`; loading/streaming states.
- **Result card:** severity-graded (Major/Moderate/Minor), plain-language explanation, **"Source: DDInter" citation**, the streamed MedPsy text.
- **Abstain state** ("can't verify this one — consult a pharmacist") and the **persistent educational-only disclaimer** banner.
- Encrypted **shelf** CRUD (`expo-sqlite`): add/remove meds, used as the lookup set.

**✅ Phase-1 checkpoint (June 7):** warfarin + an NSAID → correct severity-graded, cited warning, fully offline, with `audit.jsonl` writing live. This alone is a shippable submission.

---

## Phase 2 — Mesh tier (June 8–11) · *the ceiling — only if Gate A passed*

**Goal:** the three mesh moments — delegate a hard case to a bigger model, fall back gracefully, and pull the model peer-to-peer with no internet.

**Lead lane**
- `anchor/`: Node laptop node — `loadModel(MedPsy-4B)` → `startQVACProvider({firewall})`; print/share public key.
- Consumer delegation in `core/`: a "hard/high-risk case" path calls `loadModel({ delegate: { providerPublicKey, timeout: 60_000, fallbackToLocal: true }})` → `explain` runs on the 4B model, streamed back. (Warm the connection — cold-DHT bootstrap is 15–45s.)
- **Graceful degradation** (the real, demoable resilience): provider drop → `fallbackToLocal` runs the on-device model. *(Note: mid-stream auto peer-failover is NOT an SDK feature — see `docs/qvac-sdk-reference.md`. Don't promise it.)*
- **Offline model-registry pull:** a fresh device with no model loads MedPsy from a peer (`loadModel({ modelSrc: "pear://…" })` / `modelRegistryGetModel`) with WAN off.

**App Dev lane (B)**
- **Mesh status indicator** (local / delegating-to-anchor / falling-back) on the result card.
- "This case is being analyzed by a larger model nearby…" delegation UX + the streamed answer.
- Onboarding screen for the **"get the AI from a nearby device"** flow (drives the model-pull demo).

**✅ Phase-2 checkpoint (June 11):** a hard case escalates to the anchor and streams back; killing the anchor degrades to on-device; a fresh phone pulls the model from a peer with the internet physically off.

---

## Phase 3 — Hardening + Reproducibility (June 12–14) · *early-bird submission-ready*

**Lead lane**
- `npm run verify`: runs the full grounded chain over a fixed fixture set, asserts expected drug class + interaction + severity (pre-verified against authoritative sources). Wire it into CI on every push.
- Reproducibility README: hardware specs (CPU/GPU/RAM/storage), system-profiler screenshots, structured remote-API-call file (target: **none — all inference local**).
- Capture the **network proof** (zero outbound inference traffic) for each offline run; bundle audit + resource logs.

**App Dev lane (B)**
- Polish all states: empty shelf, OCR-fail, abstain, low-confidence, no-peer-available.
- Accessibility pass; ensure the disclaimer is visible in every demo-relevant screen.
- Build the **fixed, pre-verified demo-case set** (drug pairs confirmed against authoritative sources — no live improvisation).

**✅ Phase-3 checkpoint (June 14):** flip a snapshot to **submission-ready** and bank the early-bird slot. From here everything is upside.

---

## Phase 4 — Polish + Stretch (June 15–19) · *reach for the podium*

Pick from, in priority order:
- **Voice tier (high-impact stretch):** STT intake ("I also take aspirin") + TTS read-back of the warning — hands-free, accessibility story, still 100% on-device. (QVAC `transcribe` + TTS.)
- **Multilingual OCR depth:** widen tested label languages; lean on generic-name matching; document coverage honestly.
- **MedPsy tool-calling:** let the model call `lookupInteractions` as a tool so multi-drug shelves are reasoned over cleanly.
- **Result-card craft:** the 15-second "this clashes with your blood thinner" clarity a non-technical judge gets instantly.
- **Household/multi-shelf mode** (only if time): manage meds for an elderly parent.

**Discipline:** every stretch must serve the one line — *works alone, stronger together.* Cut anything that doesn't.

---

## Phase 5 — Demo + Submission (June 20–21)

- **≤5-min demo video** (YouTube unlisted): airplane mode visible · interaction caught & cited · the mesh escalation · the fresh-phone model pull with internet off · logs writing live.
- Final reproducibility check; logs + network captures bundled as evidence.
- **Flip repo public + confirm Apache-2.0 `LICENSE`** (already in repo); `NOTICE` attributions correct (DDInter CC BY-NC).
- Submit on DoraHacks (all teammates on the project page) — **only after explicit go-ahead.**

---

## Risk register (live)

| Risk | Mitigation |
|---|---|
| Gate A (P2P/offline pull) fails | Solo tier is the floor — drop Phase 2, reinvest in Phase 4. Decided Day 1, zero sunk cost. |
| OCR misses foreign brand names | Generic-name matching + abstain gate; narrow demo languages; disclose coverage. |
| MedPsy invents interactions | Retrieve-then-explain + strict output template; `npm run verify` asserts grounding. |
| Cold-DHT connect (15–45s) reads as "broken" on camera | Warm the connection before recording; show the warm sub-second path. |
| Integration drift between lanes | `core/` contract frozen Day 2; B builds on mocks; continuous integration, no big-bang merge. |
| DDInter is CC BY-NC | Fine for this non-commercial entry with attribution (`NOTICE`); flagged for any future commercial path. |

## Cross-lane sync points
- **Daily:** one-line status in the team channel (what shipped / what's blocked).
- **Contract changes:** any change to `core/index.ts` signatures is announced before merging.
- **End of each phase:** a working, demo-able checkpoint — recorded, so we always have a fallback demo.
