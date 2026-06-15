# Pharos

**Private medical AI that works alone, and gets stronger together.**

A phone reads your medication, explains it, and catches dangerous interactions — fully offline. When other devices are nearby, they form a peer-to-peer mesh so harder cases reach a bigger model and new phones can get the AI with no internet. Built entirely on Tether's QVAC SDK (`@qvac/sdk`). No cloud. Nothing leaves your devices.

> ⚕️ **Educational information only — not medical advice.** Pharos identifies medications and surfaces *documented* interactions to help you talk to a professional. It does not diagnose, prescribe, or recommend treatment. Always verify with a licensed clinician or pharmacist.

---

## The idea — one product, two tiers

- **🟢 Solo tier (works on any one phone, airplane mode):** OCR a pill bottle/label → normalize to the drug's generic name → look up interactions against your saved medication shelf → MedPsy explains the result in plain language. Everything on-device; provable with a zero-traffic network capture.
- **🔵 Mesh tier (kicks in when a peer anchor is present):** a case is delegated over the Holepunch DHT to a laptop "anchor" running the larger MedPsy-4B; OCR + grounding stay on the phone. If the anchor is unreachable, it falls back to the on-device model (`fallbackToLocal`). *Verified against the SDK: peer-to-peer model **pull** and mid-stream peer-failover are **not** supported — mesh is tier-1 delegation only, and peer discovery uses the DHT, which needs WAN to bootstrap (so the mesh tier is local-network, not airplane-mode; the solo tier is the offline story).*

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

> ✅ The engine is **run-validated on `@qvac/sdk@0.12.2`** (real OCR + MedPsy, grounded Major + abstain + no-fabrication; see [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md)). Signatures + mesh-plan corrections are in [`docs/qvac-sdk-reference.md`](docs/qvac-sdk-reference.md) (delegation via `loadModel({ delegate })`; no mid-stream failover — `fallbackToLocal` instead). Confirm against the live docs (https://docs.qvac.tether.io/reference/api/) if the SDK version changes.

## Setup

**Data + verification (works today — needs only Node ≥24, zero runtime deps):**
1. `npm run data` — fetch DDInter and build `data/pharos.db`.
2. `npm run verify` — assert the grounded chain + abstain + audit + resource log (38 checks).
3. `npm install` then `npm run typecheck` — type-check `core/` + `scripts/` (install is only needed for this step).

**App + mesh (June 1):**
4. `npm install @qvac/sdk` (phone dev build + laptop anchor); download the MedPsy GGUFs.
5. Run the Day-1 spike (`day1-spike.md`) to confirm the P2P + grounded-chain gates before committing the mesh tier.

## Reproducibility (required by judges)

Full, verified reproduce-the-results guide: **[`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md)** — environment/versions, exact commands + expected outputs at three levels (grounding chain · real engine on real inference · P2P mesh delegation), the offline/network claims, and the gotchas.

- One-command verifier: `npm run verify` runs the grounded chain + abstain + audit + resource-log (38 checks).
- Real-inference harnesses: `spike/validate-engine.ts` (grounded Major), `spike/validate-safety.ts` (abstain + no-fabrication) — both PASS on `@qvac/sdk@0.12.2` (non-Windows).
- Remote API calls for inference: **none** (all OCR + MedPsy local; see REPRODUCIBILITY.md for the two network touchpoints).

## Verification artifacts

- **Audit log** (JSONL) and **resource log** (CSV) — schemas in [`docs/audit-log-schema.md`](docs/audit-log-schema.md).
- **Network capture** proving zero outbound inference traffic during offline runs.

## Data & licensing

Interaction warnings are **retrieved** from real datasets (not generated). See [`NOTICE`](NOTICE) for attributions and [`data/README.md`](data/README.md) for sourcing. Note: DDInter is **CC BY-NC 4.0 (non-commercial)** — fine for this non-commercial hackathon entry with attribution, but it constrains commercial reuse.

## License

Code: **Apache-2.0** (see [`LICENSE`](LICENSE)). Bundled datasets retain their own licenses (see `NOTICE`).
