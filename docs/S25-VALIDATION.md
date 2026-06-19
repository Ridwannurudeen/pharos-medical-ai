# Samsung S25 Ultra validation

This is the device validation standing for the Expo 54 / React Native 0.81 QVAC app merged in PR
#30.

## Build under test

- PR: `#30` — `app: Expo SDK 54 / RN 0.81 upgrade — packages the QVAC native runtime`
- Validated head: `cbc1d1f` (`core: bound MedPsy explanation latency`)
- Merge commit: `feb7ae9`
- Final APK release: <https://github.com/Ridwannurudeen/pharos-medical-ai/releases/tag/apk-pr30-final>
- Final APK asset: `pharos-s25-cbc1d1f-final.apk`
- Expected SHA256: `c17df918e1d9908c3ac0c880a354e303e0939625c8a5773e4400a42ddc4bdd88`

## What passed

The S25 Ultra completed the full solo-tier gate with the real QVAC runtime:

- APK installed and launched on the physical S25 Ultra.
- Bundled `pharos.db` was present.
- MedPsy-1.7B was staged in the app sandbox and loaded from the raw filesystem path.
- QVAC worker, OCR models, and MedPsy model all initialized on-device.
- Real camera capture passed a raw image path into QVAC OCR.
- Clean Aspirin / Warfarin label produced:
  - scanned generic: `acetylsalicylic acid`
  - shelf match: `Warfarin`
  - severity: `Major`
  - source: `DDInter 2.0`
  - cited ids: `DDInter20` / `DDInter1951`
- Clean Paracetamol / Acetaminophen label abstained instead of fabricating an interaction.
- Airplane-mode repeat passed after models and database were cached locally.

## Product boundary

Pharos is a warning tool, not a safety-approval tool.

- A documented interaction result means: DDInter contains a matching interaction between the scanned
  drug and something on the user's shelf.
- An abstain or "no documented interaction found" result does not mean the medicine is safe for that
  user.
- Dose, allergies, pregnancy, age, conditions, and clinical context still require a pharmacist or
  clinician.

## Watch items

- MedPsy explanation is bounded to 30 seconds; if the model does not respond in time, Pharos returns
  a deterministic DDInter-grounded fallback explanation.
- OCR on full laptop-screen proof cards can take roughly one minute. Cleaner printed labels or tighter
  camera framing are faster.
- CameraX may emit surface reset noise after navigation, but it did not block successful capture or
  result recovery during validation.

## Mesh status

The validated S25 gate is the solo phone mode: camera OCR, DDInter lookup, and MedPsy explanation on
the phone, with airplane-mode repeat after setup.

The QVAC mesh/delegate path remains the upside mode: the phone keeps OCR and DDInter grounding local
while delegating heavier MedPsy explanation to a configured nearby anchor. See
[`MESH-RUNBOOK.md`](MESH-RUNBOOK.md) for the anchor path and caveats.
