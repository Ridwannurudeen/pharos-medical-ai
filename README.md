# Pharos

**Private medical AI that works alone, and gets stronger together.**

A phone reads your medication, explains it, and catches dangerous interactions — fully offline. When other devices are nearby, they form a peer-to-peer mesh so harder cases reach a bigger model and new phones can get the AI with no internet. Built entirely on Tether's QVAC SDK (`@qvac/sdk`). No cloud. Nothing leaves your devices.

> ⚕️ **Educational information only — not medical advice.** Pharos identifies medications and surfaces *documented* interactions to help you talk to a professional. It does not diagnose, prescribe, or recommend treatment. Always verify with a licensed clinician or pharmacist.

---

## The idea — one product, two tiers

- **🟢 Solo tier (works on any one phone, airplane mode):** OCR a pill bottle/label → normalize to the drug's generic name → look up interactions against your saved medication shelf → MedPsy explains the result in plain language. Everything on-device; provable with a zero-traffic network capture.
- **🔵 Mesh tier (kicks in when peers are present, still offline):** a high-risk case is delegated over the Holepunch DHT to a laptop "anchor" running a larger MedPsy model; a fresh device can pull the model from a peer with no internet; if the anchor drops mid-answer, another peer resumes.

**Tracks:** General Purpose + Psy Models (MedPsy).

## Repo structure

```
pharos/
├─ core/         # engine API + types (+ audit-log writer) — Lead. Mocks shipped; real impls June 1
├─ scripts/      # fetch-data · build-data · verify-data — data pipeline + reproducibility harness
├─ data/         # dataset sourcing + the generated pharos.db (gitignored; `npm run data`) — see data/README.md
├─ app/          # React Native (Expo) phone app — solo tier + mesh consumer      [June 1]
├─ anchor/       # Node.js laptop "anchor" — mesh provider running MedPsy-4B       [June 1]
├─ tests/fixtures/ # verified demo label images + expected outputs                 [June 1]
├─ docs/         # SDK reference, data pipeline, log schemas, lane brief, design notes
├─ NOTICE · LICENSE · ROADMAP.md · LAUNCH-CHECKLIST.md
```

`app/`, `anchor/`, and `tests/` are written during the judged build period (June 1+). `core/` (mocked), `scripts/`, and the data pipeline were built early as **disclosed prior work**.

## Stack (planned)

- React Native via Expo (bare workflow if native modules require it)
- `@qvac/sdk` — **all** inference: OCR, translation/normalization, MedPsy completion, RAG, P2P delegation, model registry
- `expo-camera` / `react-native-vision-camera`, `expo-sqlite`, `expo-network`
- Node.js for the laptop anchor node

> ✅ Verified `@qvac/sdk` signatures (v0.11.0) are recorded in [`docs/qvac-sdk-reference.md`](docs/qvac-sdk-reference.md) — including two corrections to the mesh plan (delegation is configured via `loadModel({ delegate })`, and mid-stream peer-failover is **not** an SDK feature; `fallbackToLocal` is). Confirm against the live docs (https://docs.qvac.tether.io/reference/api/) if the SDK version changes.

## Setup

**Data + verification (works today — needs only Node ≥24, zero runtime deps):**
1. `npm run data` — fetch DDInter and build `data/pharos.db`.
2. `npm run verify` — assert the grounded chain (8/8 checks).
3. `npm install` then `npm run typecheck` — type-check `core/` + `scripts/` (install is only needed for this step).

**App + mesh (June 1):**
4. `npm install @qvac/sdk` (phone dev build + laptop anchor); download the MedPsy GGUFs.
5. Run the Day-1 spike (`day1-spike.md`) to confirm the P2P + grounded-chain gates before committing the mesh tier.

## Reproducibility (required by judges)

- One-command verifier: `npm run verify` runs the full grounded chain over a fixed fixture set and asserts the expected drug class + interaction warning.
- Declared hardware specs (CPU/GPU/RAM/storage) + system-profiler screenshots.
- Structured file listing any remote API calls (target: none — all inference is local).

## Verification artifacts

- **Audit log** (JSONL) and **resource log** (CSV) — schemas in [`docs/audit-log-schema.md`](docs/audit-log-schema.md).
- **Network capture** proving zero outbound inference traffic during offline runs.

## Data & licensing

Interaction warnings are **retrieved** from real datasets (not generated). See [`NOTICE`](NOTICE) for attributions and [`data/README.md`](data/README.md) for sourcing. Note: DDInter is **CC BY-NC 4.0 (non-commercial)** — fine for this non-commercial hackathon entry with attribution, but it constrains commercial reuse.

## License

Code: **Apache-2.0** (add the official `LICENSE` file — see LAUNCH-CHECKLIST). Bundled datasets retain their own licenses (see `NOTICE`).
