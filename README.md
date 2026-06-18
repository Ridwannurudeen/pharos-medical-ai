# Pharos

**Private medical AI that works alone, and gets stronger together.**

A phone reads your medication, explains it, and catches dangerous interactions — fully offline. When other devices are nearby, they form a peer-to-peer mesh so harder cases reach a bigger model and new phones can get the AI with no internet. Built entirely on Tether's QVAC SDK (`@qvac/sdk`). No cloud. Nothing leaves your devices.

> ⚕️ **Educational information only — not medical advice.** Pharos identifies medications and surfaces *documented* interactions to help you talk to a professional. It does not diagnose, prescribe, or recommend treatment. Always verify with a licensed clinician or pharmacist.

---

## The idea — one product, two tiers

- **🟢 Solo tier (works on any one phone, airplane mode):** OCR a pill bottle/label → normalize to the drug's generic name → look up interactions against your saved medication shelf → MedPsy explains the result in plain language. Everything on-device; provable with a zero-traffic network capture.
- **🔵 Mesh tier (kicks in when a peer anchor is present):** a case is delegated over the Holepunch DHT to a laptop "anchor" running the larger MedPsy-4B; OCR + grounding stay on the phone. If the anchor is unreachable, it falls back to the on-device model (`fallbackToLocal`). *Verified against the SDK: peer-to-peer model **pull** and mid-stream peer-failover are **not** supported — mesh is tier-1 delegation only, and peer discovery uses the DHT, which needs WAN to bootstrap (so the mesh tier is local-network, not airplane-mode; the solo tier is the offline story).*

**Tracks:** General Purpose + Psy Models (MedPsy).

## Current standing

- **Merged phone app:** PR #30 upgraded the app to Expo SDK 54 / RN 0.81 and packages the QVAC native runtime.
- **Validated on hardware:** Samsung S25 Ultra completed the real solo-tier gate: Aspirin + Warfarin → **Major** DDInter warning, Paracetamol → abstain/no fabrication, and an airplane-mode cached repeat.
- **Final APK:** non-debuggable `pharos-s25-cbc1d1f-final.apk` is published under the `apk-pr30-final` release with SHA256 `c17df918e1d9908c3ac0c880a354e303e0939625c8a5773e4400a42ddc4bdd88`.
- **Public validation notes:** see [`docs/S25-VALIDATION.md`](docs/S25-VALIDATION.md).

The important product boundary: Pharos is a **documented interaction warning tool**, not a safety approval tool. "No documented interaction found" and abstain states are safe failures, not a claim that a medicine is safe for a specific patient.

## Repo structure

```
pharos/
├─ core/         # engine API + types, grounded pipeline, audit + resource-log writers, QVAC engine — Lead
├─ scripts/      # fetch-data · build-data · verify-data — data pipeline + reproducibility harness
├─ data/         # dataset sourcing + the generated pharos.db (gitignored; `npm run data`) — see data/README.md
├─ app/          # React Native (Expo SDK 54 / RN 0.81) phone app — solo scanner + mesh consumer
├─ spike/        # run-validation harnesses (engine, safety) + Gate A mesh provider/consumer scripts
├─ docs/         # SDK reference, reproducibility, EXPO54-BUILD + device + mesh runbooks, log schemas
├─ NOTICE · LICENSE · ROADMAP.md · LAUNCH-CHECKLIST.md
```

`scripts/` and the data pipeline were built early as **disclosed prior work**; the real engine (`core/`), the phone app (`app/`), and the mesh provider/consumer (`spike/`) are judged build-period work. The mesh anchor currently runs from the `spike/` scripts (a dedicated `anchor/` package is a possible later extraction).

## Stack

- React Native via Expo SDK 54 / RN 0.81
- `@qvac/sdk` — **all** inference: OCR, translation/normalization, MedPsy completion, RAG, P2P delegation, model registry
- `expo-camera`, `expo-sqlite`, `expo-network`, `expo-secure-store`
- Node.js for the laptop anchor node

> ✅ The engine is **run-validated on `@qvac/sdk@0.12.2`** (real OCR + MedPsy, grounded Major + abstain + no-fabrication; see [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md)). Signatures + mesh-plan corrections are in [`docs/qvac-sdk-reference.md`](docs/qvac-sdk-reference.md) (delegation via `loadModel({ delegate })`; no mid-stream failover — `fallbackToLocal` instead). Confirm against the live docs (https://docs.qvac.tether.io/reference/api/) if the SDK version changes.

## Setup

**Data + verification (works today — needs only Node ≥24, zero runtime deps):**
1. `npm run data` — fetch DDInter and build `data/pharos.db`.
2. `npm run verify` — assert the grounded chain + abstain + audit + resource log (38 checks).
3. `npm install` then `npm run typecheck` — type-check `core/` + `scripts/` (install is only needed for this step).

**Phone app (Expo SDK 54 / RN 0.81 — requires `@qvac/sdk@0.12.2`):**
4. Build + run on a device: see [`docs/EXPO54-BUILD.md`](docs/EXPO54-BUILD.md) — the full verified recipe (toolchain incl. NDK 27, the build, every error + fix), plus [`docs/DEVICE-SETUP.md`](docs/DEVICE-SETUP.md) for the on-device camera/scan steps.

**Mesh (optional upside):**
5. Cross-device Gate A delegation (phone ↔ anchor running MedPsy-4B): see [`docs/MESH-RUNBOOK.md`](docs/MESH-RUNBOOK.md). The delegation mechanism is verified in loopback on `@qvac/sdk@0.12.2`.

## Reproducibility (required by judges)

Full, verified reproduce-the-results guide: **[`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md)** — environment/versions, exact commands + expected outputs at three levels (grounding chain · real engine on real inference · P2P mesh delegation), the offline/network claims, and the gotchas.

- One-command verifier: `npm run verify` runs the grounded chain + abstain + audit + resource-log (38 checks).
- Real-inference harnesses: `spike/validate-engine.ts` (grounded Major), `spike/validate-safety.ts` (abstain + no-fabrication) — both PASS on `@qvac/sdk@0.12.2` (non-Windows).
- S25 app validation: [`docs/S25-VALIDATION.md`](docs/S25-VALIDATION.md) records the merged PR head, final APK, clean-label gates, and offline repeat.
- Remote API calls for inference: **none** (all OCR + MedPsy local; see REPRODUCIBILITY.md for the two network touchpoints).

## Verification artifacts

- **Audit log** (JSONL) and **resource log** (CSV) — schemas in [`docs/audit-log-schema.md`](docs/audit-log-schema.md).
- **Network capture** proving zero outbound inference traffic during offline runs.

## Data & licensing

Interaction warnings are **retrieved** from real datasets (not generated). See [`NOTICE`](NOTICE) for attributions and [`data/README.md`](data/README.md) for sourcing. Note: DDInter is **CC BY-NC 4.0 (non-commercial)** — fine for this non-commercial hackathon entry with attribution, but it constrains commercial reuse.

## License

Code: **Apache-2.0** (see [`LICENSE`](LICENSE)). Bundled datasets retain their own licenses (see `NOTICE`).
