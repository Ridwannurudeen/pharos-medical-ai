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
├─ app/          # React Native (Expo) phone app — solo tier + mesh consumer   [created at build start, June 1]
├─ anchor/       # Node.js laptop "anchor" — mesh provider running MedPsy-4B    [created at build start]
├─ shared/       # shared types, audit-log writer, delegation protocol contract [created at build start]
├─ data/         # dataset bundling (DDInter, RxNorm, DrugBank Vocabulary) — see data/README.md
├─ tests/fixtures/ # verified demo label images + expected outputs              [created at build start]
├─ scripts/      # `npm run verify` reproducibility harness                     [created at build start]
├─ docs/         # log schemas, data prep, design notes
├─ NOTICE        # third-party data/model license attributions
└─ LAUNCH-CHECKLIST.md
```

The `app/`, `anchor/`, `shared/`, `scripts/` and `tests/` code is written during the judged build period (June 1+). This scaffold holds only setup, data, and verification groundwork.

## Stack (planned)

- React Native via Expo (bare workflow if native modules require it)
- `@qvac/sdk` — **all** inference: OCR, translation/normalization, MedPsy completion, RAG, P2P delegation, model registry
- `expo-camera` / `react-native-vision-camera`, `expo-sqlite`, `expo-network`
- Node.js for the laptop anchor node

> ✅ Verified `@qvac/sdk` signatures (v0.11.0) are recorded in [`docs/qvac-sdk-reference.md`](docs/qvac-sdk-reference.md) — including two corrections to the mesh plan (delegation is configured via `loadModel({ delegate })`, and mid-stream peer-failover is **not** an SDK feature; `fallbackToLocal` is). Confirm against the live docs (https://docs.qvac.tether.io/reference/api/) if the SDK version changes.

## Setup

_To be filled in during the build. High level:_
1. `npm install @qvac/sdk` (phone dev build + laptop anchor).
2. Stage datasets and models — see [`data/README.md`](data/README.md).
3. Run the Day-1 spike (`day1-spike.md`) to confirm the P2P + grounded-chain gates before committing the mesh tier.

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
