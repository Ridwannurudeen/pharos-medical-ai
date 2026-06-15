# Reproducibility

Everything here was run and verified, not asserted. Three levels: (1) the data/grounding chain
(any machine, no models), (2) the real engine on real inference (non-Windows + the MedPsy GGUF),
(3) the P2P mesh delegation. Commands and expected outputs are exact.

## Environment (what we ran on)

- **Build/validation host:** WSL2 **Ubuntu 24.04** on Windows (32 vCPU / 15 GB RAM, **no GPU exposed to WSL**), **Node 24.16.0**.
- **SDK:** `@qvac/sdk@0.12.2` (npm latest at time of writing); `react-native-bare-kit@^0.14.0` (the SDK's optional peer; installed 0.14.3).
- **Models (Q4_K_M GGUF, from Hugging Face):** `qvac/MedPsy-1.7B-GGUF` `medpsy-1.7b-q4_k_m-imat.gguf` (1.28 GB, phone/solo) and `qvac/MedPsy-4B-GGUF` `medpsy-4b-q4_k_m-imat.gguf` (**2,716,068,640 bytes**, anchor). OCR uses the SDK's `OCR_LATIN_RECOGNIZER_1` (+ CRAFT detector), pulled ~15 MB from S3 on first run, cached offline after.
- **Demo hardware:** consumer = **Google Pixel 10 Pro XL** (GPU-accelerated — QVAC ships `android-arm64` Vulkan/OpenCL backends); anchor = an **RTX 5060 / 32 GB** box. Note: the stock `linux-x64` QVAC build ships **no** CUDA/Vulkan backend, so the anchor runs the 4B on **CPU** (the GPU is not used there).

> **Windows caveat:** the QVAC inference worker does **not** start on native Windows (`RPC_INIT_TIMEOUT`, code 50204). Run all model steps on **Linux / WSL2 / macOS / the phone**, not native Windows.

## Level 1 — data + grounding chain (no models, any machine, Node ≥ 24)

```bash
npm run data      # fetch DDInter 2.0 and build data/pharos.db (gitignored, ~18 MB)
npm run verify    # 38 checks: grounded chain + abstain + audit + resource-log writers
```
Expected: `ALL CHECKS PASSED` (38/38). This proves the model-free core: name resolution (incl.
synonyms), DDInter lookup with severity + provenance, the abstain logic, and the audit + resource-log
writers — all deterministic, no inference.

## Level 2 — the REAL engine on real inference (non-Windows + MedPsy-1.7B)

One-time setup (Linux/WSL2):
```bash
sudo apt-get install -y libatomic1        # REQUIRED: the Bare worker needs it; absence shows as a misleading RPC_INIT_TIMEOUT
npm install && npm install @qvac/sdk@0.12.2
# Place medpsy-1.7b-q4_k_m-imat.gguf in models/ (download with `wget -c`, NOT curl --retry — see gotchas)
```
Run the exact shipping engine (`core/engine-qvac.ts` → `createScanPipeline`):
```bash
MEDPSY_1_7B=$PWD/models/medpsy-1.7b-q4_k_m-imat.gguf node spike/validate-engine.ts
```
Expected (verified): OCR reads `"ASPIRIN 81 mg"` → resolves `acetylsalicylic acid` → DDInter
**Major** (vs a Warfarin shelf), cited (DDInter20/DDInter1951) → MedPsy streams a plain-language
explanation → `VALIDATE ENGINE: PASS ✓`, exit 0. (Latency: MedPsy-1.7B explain ≈ 113 s on this WSL2
**CPU**; the phone GPU is far faster.)

**Safety guardrails on real inference** (beyond the Level-1 fixtures):
```bash
python3 spike/make-label-paracetamol.py    # regenerate the gitignored test image (needs python3-pil/pillow)
MEDPSY_1_7B=$PWD/models/medpsy-1.7b-q4_k_m-imat.gguf node spike/validate-safety.ts
```
Expected (verified): `VALIDATE SAFETY: PASS ✓` —
1. **Abstain** — a PARACETAMOL label → `abstained=true`, 0 interactions (paracetamol isn't in DDInter; the system refuses to guess).
2. **No fabrication** — aspirin + ascorbic acid → `matched=true` but 0 interactions (never invents one).

## Level 3 — P2P mesh delegation (Gate A tier-1)

Proven in loopback on WSL2 with both models. Use **absolute** paths (under WSL, `$PWD`/`~` can resolve to the Windows mount).
```bash
# Anchor (terminal 1): loads MedPsy-4B, starts a DHT provider, prints a public key
cd /root/pharos && MEDPSY_4B=/root/pharos/models/medpsy-4b-q4_k_m-imat.gguf node spike/gate-a-provider.ts
# Consumer (terminal 2): delegates a completion to that key (fallbackToLocal:false, so a remote failure can't be masked)
cd /root/pharos && PROVIDER_KEY=<key> MEDPSY_4B=/root/pharos/models/medpsy-4b-q4_k_m-imat.gguf node spike/gate-a-consumer.ts
```
Expected (verified, 1.7B and 4B): `GATE A: response received from PROVIDER ✓`, exit 0 — coherent
tokens generated on the provider and streamed to the consumer over the Holepunch DHT (warm connect
~5 s; cold cross-device 15–45 s). Cross-device (phone ↔ anchor over a LAN): see [`MESH-RUNBOOK.md`](MESH-RUNBOOK.md).

## Offline / network claims (be precise)

- **Solo tier is fully offline.** After the one-time ~15 MB OCR-model fetch from S3, a scan does zero
  network I/O — demonstrate in airplane mode with a packet capture. MedPsy is a local GGUF.
- **Mesh tier** runs inference locally but uses the Holepunch **DHT for peer discovery, which bootstraps
  over the internet**; a pure-LAN-with-WAN-off mesh is **not yet verified**. Don't claim airplane-mode for the mesh tier.
- **Tier-2 offline model-pull is NOT supported** by the stock SDK (`SEEDING_NOT_SUPPORTED`); mesh =
  tier-1 delegation only. There is also **no mid-stream peer-failover** — resilience is `fallbackToLocal` (degrade to the on-device model at connect time). See [`qvac-sdk-reference.md`](qvac-sdk-reference.md).

## Known gotchas (all hit and resolved during validation)

- **`libatomic1`** must be installed on Linux/WSL or the worker dies as a misleading `RPC_INIT_TIMEOUT`.
- **Download the GGUFs with `wget -c`**, not `curl --retry`/`-C -` — on the flaky HF xet CDN, curl restarted from the resume point on each drop (the file went *backwards*); always verify the final byte count.
- **`npm run build:engine`** (repo root, where `@qvac` is installed) emits `core/dist/engine-qvac.js` with clean `.js` specifiers so Metro can bundle it for the app. It's separate from `build:core`/`prepare` so CI stays `@qvac`-free.
- **Coverage gap:** `acetaminophen` resolves in DDInter but `paracetamol` (the international name) does not → a paracetamol bottle abstains (safe failure, not a wrong answer).

## Remote API calls

Target: **none** for inference. All OCR + MedPsy run locally. The only network use is the one-time OCR
model fetch from S3 (Level 2) and the DHT bootstrap for the mesh tier (Level 3). The data pipeline
(`npm run data`) downloads DDInter once at build time.
```
