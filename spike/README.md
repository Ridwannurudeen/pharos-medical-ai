# Day-1 Spike harness (throwaway)

The go/no-go gate that decides **solo-only vs the unified mesh product**. Full rationale and pass/fail criteria: `day1-spike.md` (in Downloads). This is **throwaway code** — prove a yes/no, don't polish.

> Signatures are doc-verified (`../docs/qvac-sdk-reference.md`, SDK v0.11.0) but **not yet run** — running them cross-device/offline is exactly what this proves.

## Prerequisites
1. `npm install @qvac/sdk` (laptop + phone dev build).
2. Download MedPsy GGUFs (1.7B phone / 4B laptop). Set their handles in `spike/config.ts` or via env (`MEDPSY_4B`, `MEDPSY_1_7B`).
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
**Offline model pull (the one true unknown):** a device with no model loads MedPsy from a peer (`loadModel({ modelSrc: "pear://<key>" })`) with WAN off — the remaining thing docs can't confirm.

## Gate B — grounded chain, offline (decides grounding)
```bash
MEDPSY_1_7B=/path node spike/gate-b-grounded.ts <label-photo.jpg>
```
Runs OCR → normalize + **real DDInter lookup (`data/pharos.db`)** → MedPsy explains the retrieved fact.
**PASS:** a textbook pair (aspirin label + `Warfarin` shelf → **Major**, cited) returns a correct severity-graded warning; an out-of-dataset drug hits the **ABSTAIN** path; network stays offline. (The lookup half is already verified by `npm run verify`.)

## The verdict
One line in the team channel: **A: pass/fail · B: pass/fail → decision.** That unblocks the whole build.
