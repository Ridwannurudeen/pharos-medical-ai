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
### Tier 2 — offline model pull (the one true unknown)
A device with **no model on disk** pulls MedPsy from a peer over Hyperdrive with WAN off, then runs it locally. This is the mesh's actual differentiator (distinct from Tier 1 delegation, which runs inference remotely).
```bash
# seed provider (laptop with the 4B):
MEDPSY_4B=/path node spike/gate-a-pull-provider.ts        # loadModel(seed:true) + prints pull key
# pull consumer (fresh device, NO model):
PULL_KEY=<key> PULL_FILE=medpsy-4b-q4_k_m-imat.gguf node spike/gate-a-pull-consumer.ts
```
**PASS:** `onProgress` climbs to 100% over the LAN (bytes really transfer) AND a coherent local completion follows, WAN off.
**Verified vs SDK v0.11.0:** `loadModel` has `seed?:boolean`; `modelSrc` accepts `pear://<key>/<file>` (load-model JSDoc). **Hypothesis under test (NOT in the .d.ts):** that the `startQVACProvider` publicKey is also the Hyperdrive pull key — no "seed → drive key" return exists in the types, so if the pull fails with that key, the share key is surfaced elsewhere (registry: `modelRegistryList/Search/GetModel`) — report it and we adjust the consumer.

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
