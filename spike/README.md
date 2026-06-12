# Day-1 Spike harness (throwaway)

The go/no-go gate that decides **solo-only vs the unified mesh product**. Full rationale and pass/fail criteria: `day1-spike.md` (in Downloads). This is **throwaway code** — prove a yes/no, don't polish.

> Signatures are doc-verified (`../docs/qvac-sdk-reference.md`, SDK v0.11.0) but **not yet run** — running them cross-device/offline is exactly what this proves.

## Prerequisites
1. `npm install @qvac/sdk` (laptop + phone dev build).
2. Download the MedPsy GGUFs (recommended quant **Q4_K_M**, verified filenames):
   ```bash
   pip install -U "huggingface_hub[cli]"
   huggingface-cli download qvac/MedPsy-1.7B-GGUF medpsy-1.7b-q4_k_m-imat.gguf --local-dir ./models  # ~1.28 GB (phone)
   huggingface-cli download qvac/MedPsy-4B-GGUF   medpsy-4b-q4_k_m-imat.gguf   --local-dir ./models  # ~2.72 GB (anchor)
   export MEDPSY_1_7B="$PWD/models/medpsy-1.7b-q4_k_m-imat.gguf"
   export MEDPSY_4B="$PWD/models/medpsy-4b-q4_k_m-imat.gguf"
   ```
   (Or hardcode the paths in `spike/config.ts`. OCR uses the SDK's built-in `OCR_LATIN_RECOGNIZER_1` — no download.)
3. `npm run data` once so `data/pharos.db` exists (Gate B reads it).
4. A LAN/hotspot with **WAN disabled** for the offline runs.

## Gate A — P2P delegation (decides the mesh)
```bash
# laptop (anchor):
MEDPSY_4B=/path/to/MedPsy-4B node spike/gate-a-provider.ts      # prints PROVIDER PUBLIC KEY
# phone / 2nd machine:
PROVIDER_KEY=<key> MEDPSY_4B=/path node spike/gate-a-consumer.ts # delegates a completion
```
**PASS:** coherent tokens arrive *from the provider* (consumer uses `fallbackToLocal:false`, so a remote failure can't be masked) with WAN off. Log time-to-connect (cold 15-45s, warm sub-second) + TTFT.
**Not tested here (not an SDK feature):** mid-stream auto peer-failover — see the SDK reference. Resilience = `fallbackToLocal`.

> **On mobile, the consumer is the app, not a node script.** `@qvac/sdk` runs on Android via a `react-native-bare-kit` worklet wired by `@qvac/sdk/expo-plugin` (needs `expo prebuild` + a dev client; not Expo Go). The provider/anchor stays a Node process on a **non-Windows** laptop. So Gate A tier-1 = phone app (consumer, `loadModel({delegate})`) ↔ laptop anchor (`gate-a-provider.ts`).

### Tier 2 — offline model pull: NOT SUPPORTED by stock @qvac/sdk (verified 2026-06-12)
The original plan — a fresh device pulls **our** MedPsy GGUF from a peer over Hyperdrive with WAN off — is **not achievable with the published SDK**, so the `gate-a-pull-*.ts` scripts were removed (they would have thrown). Evidence, all in the installed v0.11.0:
- `loadModel({ modelSrc: <local path>, seed: true })` throws **`SEEDING_NOT_SUPPORTED`** — *"Seeding is only supported for hyperdrive models"* (`dist/server/rpc/handlers/load-model/resolve.js`: `if (seed && !hyperdriveKey) throw …`). `seed:true` only **re-shares** a model you are *already* pulling from a `pear://` source; it cannot originate a drive from a local file.
- There is **no SDK or CLI API to publish a local GGUF to a hyperdrive.** SDK surface is read-only registry access (`modelRegistryList/Search/GetModel`); the bundled registry's `registrySource` is only `"hf"` / `"s3"` (HTTP, needs internet), and MedPsy isn't in it. `@qvac/cli@0.6.0` commands are `doctor / bundle sdk / verify / serve openai` — no `seed`/`publish`/`share`.
- The earlier hypothesis (the `startQVACProvider` publicKey doubles as a Hyperdrive pull key) is also false — that key is the **delegation RPC** key, unrelated to Hyperdrive.

**Net:** the mesh = **tier-1 delegation only** (above), which is real and demoable. Offline peer model-pull is out unless Tether ships a publish/seed API.

## Gate B — grounded chain, offline (decides grounding)
```bash
MEDPSY_1_7B=/path node spike/gate-b-grounded.ts <label-photo.jpg>
```
Runs OCR → normalize + **real DDInter lookup (`data/pharos.db`)** → MedPsy explains the retrieved fact.
**PASS:** a textbook pair (aspirin label + `Warfarin` shelf → **Major**, cited) returns a correct severity-graded warning; an out-of-dataset drug hits the **ABSTAIN** path; network stays offline. (The lookup half is already verified by `npm run verify`.)

## Runtime note (verified 2026-05-31)
`@qvac/sdk` v0.11.0 **installs and imports cleanly in Node** (194 pkgs; `loadModel`/`ocr`/`completion`/`startQVACProvider` are real; `OCR_LATIN_RECOGNIZER_1` is an object), and the MedPsy GGUF downloads + validates. BUT on a sandboxed **Windows dev box the inference worker would not start** — `loadModel()` fails with `RPC_INIT_TIMEOUT` (code 50204, 30s, not configurable). So **run the spike on the real target (mobile dev build / a normal laptop), not in a restricted CI/sandbox.** The grounding half (OCR→normalize→DDInter→explain *minus* the two model calls) is already proven by `npm run verify` (30/30).

## The verdict
One line in the team channel: **A: pass/fail · B: pass/fail → decision.** That unblocks the whole build.
