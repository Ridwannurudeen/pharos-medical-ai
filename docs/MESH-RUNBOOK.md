# Mesh cross-device runbook (Gate A tier-1 delegation)

The make-or-break cross-device run for the **unified product**: the phone (consumer) delegates the
MedPsy explanation to a nearby anchor running the bigger **MedPsy-4B**, fully on your own network.
The SDK delegation mechanism is already PROVEN in loopback on WSL2 (provider+consumer, 1.7B and 4B,
`GATE A: response received from PROVIDER ✓`). What this runbook covers is the only remaining unknown:
two *physical* devices over a real network.

## Roles for this hardware

| Device | Role | Model | GPU? |
|---|---|---|---|
| **Pixel 10 Pro XL** | consumer (the app) | on-device MedPsy-1.7B + OCR; delegates explain to anchor | **Yes** — QVAC ships `android-arm64` Vulkan/OpenCL backends |
| **RTX 5060 box (32 GB)** | anchor (provider) | MedPsy-4B | **No** (see caveat) — stock QVAC `linux-x64` build has no CUDA/Vulkan backend → CPU-only |

### Verified hardware caveats
- **The RTX 5060 will NOT accelerate the anchor with the stock SDK.** The `linux-x64` prebuild ships
  only `qvac__llm-llamacpp.bare` (no `ggml-cuda`/`ggml-vulkan` `.so`; only `android-arm64` has GPU
  backends). Expect the 4B to run on CPU (~minutes/response, measured ~213s on WSL2). 32 GB RAM is
  ample for the 4B on CPU. The win is **capability (4B > 1.7B), not speed.**
- **The anchor MUST run on a non-Windows runtime.** Native Windows fails with `RPC_INIT_TIMEOUT`
  (packaging gap). Use **WSL2/Ubuntu** or native Linux on the RTX box.
- **Mesh discovery uses the Holepunch DHT, which bootstraps over the internet.** The *solo* tier is
  the airplane-mode story; the *mesh* tier runs inference locally but likely needs WAN for peer
  discovery. Pure-LAN-with-WAN-off is UNVERIFIED — test it.

## A. Anchor setup (RTX 5060 box, under WSL2/Ubuntu or Linux)
One-time (mirrors spike/WSL-SETUP.md):
```bash
sudo apt-get install -y libatomic1            # else the Bare worker dies as a misleading RPC_INIT_TIMEOUT
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs
mkdir -p ~/pharos && cd ~/pharos              # copy the repo here (git clone or tar), then:
npm install && npm install @qvac/sdk@0.12.2
# Put the 4B GGUF at ~/pharos/models/medpsy-4b-q4_k_m-imat.gguf (2,716,068,640 bytes):
wget -c -O models/medpsy-4b-q4_k_m-imat.gguf \
  "https://huggingface.co/qvac/MedPsy-4B-GGUF/resolve/main/medpsy-4b-q4_k_m-imat.gguf?download=true"
```
Run the provider (USE ABSOLUTE PATHS — `$PWD`/`~` can resolve to the Windows mount under WSL):
```bash
cd /root/pharos && MEDPSY_4B=/root/pharos/models/medpsy-4b-q4_k_m-imat.gguf node spike/gate-a-provider.ts
# → prints PROVIDER PUBLIC KEY. Leave it running. Warm it with one consumer call before recording.
```

## B. Consumer — two ways

### B1. Quick proof (a 2nd Linux/Mac machine, or this WSL box)
On the same network as the anchor:
```bash
cd /root/pharos && PROVIDER_KEY=<key from A> \
  MEDPSY_4B=/root/pharos/models/medpsy-4b-q4_k_m-imat.gguf node spike/gate-a-consumer.ts
# PASS = coherent tokens stream FROM the provider (fallbackToLocal:false), TTFT logged.
# Cold cross-device DHT connect can be 15-45s; warm is sub-second.
```

### B2. The real app on the Pixel 10 Pro XL
After the solo on-device build works (see docs/lane-app.md "Wiring the REAL engine"):
1. Set the anchor key in `app/src/engine/config.ts`:
   ```ts
   export const MESH_DELEGATE = {
     providerPublicKey: "<key from A>",
     timeout: 60_000,
     fallbackToLocal: true,   // degrade to on-device 1.7B if the anchor is unreachable
   };
   ```
   (`real.ts` already passes this to `createQvacEngine` — OCR + DDInter grounding stay on the phone;
   only the MedPsy explanation delegates to the 4B anchor.)
2. Rebuild the dev client (`npx expo run:android`), phone + anchor on the same Wi-Fi/hotspot.
3. Scan a label → the explanation comes from the anchor's 4B; the `delegated` flag drives the
   "analyzed by a larger model nearby" badge. Kill the anchor mid-demo to show `fallbackToLocal`
   degrading to the on-device 1.7B (note: the SDK has NO mid-stream auto-failover — fallback applies
   at load/connect, not mid-stream; see docs/qvac-sdk-reference.md).

## Pass criteria
Coherent MedPsy tokens arrive on the consumer **from the anchor** (`fallbackToLocal:false` for the
proof so a remote failure can't be masked), across two physical devices on the same network. Log
time-to-connect + TTFT. That closes the last mesh unknown; the unified product is then real end-to-end.
