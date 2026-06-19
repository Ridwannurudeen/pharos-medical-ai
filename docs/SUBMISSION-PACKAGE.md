# Submission package

Use this page as the source of truth for final submission copy, links, evidence, and limitation
framing. It is intentionally conservative: it claims only what was validated or statically verified.

## Primary links

- Public repository: <https://github.com/Ridwannurudeen/pharos-medical-ai>
- Merged implementation PR: <https://github.com/Ridwannurudeen/pharos-medical-ai/pull/30>
- Validation handoff PR: <https://github.com/Ridwannurudeen/pharos-medical-ai/pull/33>
- Final APK release: <https://github.com/Ridwannurudeen/pharos-medical-ai/releases/tag/apk-pr30-final>
- Final APK asset: <https://github.com/Ridwannurudeen/pharos-medical-ai/releases/download/apk-pr30-final/pharos-s25-cbc1d1f-final.apk>
- Final APK SHA256: `c17df918e1d9908c3ac0c880a354e303e0939625c8a5773e4400a42ddc4bdd88`
- Project limitation status: [`docs/PROJECT-LIMITATION-STATUS.md`](PROJECT-LIMITATION-STATUS.md)
- Android validation matrix: [`docs/ANDROID-VALIDATION-MATRIX.md`](ANDROID-VALIDATION-MATRIX.md)
- Asset update plan: [`docs/ASSET-UPDATE-PLAN.md`](ASSET-UPDATE-PLAN.md)

## Validated claims

These are safe to use in submission materials:

- Pharos runs the solo scan pipeline on-device using QVAC, bundled DDInter 2.0 data, and a local MedPsy model.
- S25 Ultra validation passed for the clean-label Aspirin / Warfarin Major interaction path.
- S25 Ultra validation passed for the clean-label Paracetamol / Acetaminophen abstain path.
- Airplane-mode cached repeat passed after the local database, OCR assets, and MedPsy model were present.
- The final APK is non-debuggable, arm64-only, and includes the QVAC native runtime and bundled `pharos.db`.
- MedPsy explains retrieved interaction facts; DDInter grounding decides the interaction.
- When the system cannot verify a drug or interaction, it should abstain instead of inventing a result.

## Do not claim

Avoid these claims until further evidence exists:

- Do not claim Pharos reliably scans arbitrary real-world packaging.
- Do not claim fresh installs are fully offline before MedPsy and OCR assets are present.
- Do not claim Play Store production readiness.
- Do not claim clinical or regulatory validation.
- Do not claim broad Android compatibility beyond the current S25 proof.
- Do not claim peer-to-peer model pull or mid-stream mesh failover unless separately revalidated against the SDK.

## Evidence checklist

Submission should include or link to:

- Final APK release and SHA256.
- Merged PR #30 and merge commit `feb7ae9fc4da232d072a6454a35c36f02335179c`.
- Final non-debuggable APK build note.
- Dolepee's S25 validation comments on PR #30.
- Evidence bundle from `/home/qdee/pharos-artifacts/`, once copied to a durable location.
- Screenshots/logs for Aspirin / Warfarin Major pass.
- Screenshots/logs for Paracetamol / Acetaminophen abstain pass.
- Screenshots/logs for airplane-mode cached repeat pass.
- Any watch-item notes for OCR latency and CameraX reset logs.
- Redacted git-history scan result from `npm run scan:history`.
- Android validation matrix if any device beyond S25 is tested.

## Limitation framing

Use this wording for the most important limitation:

> Pharos is validated on clean, in-scope labels where OCR can see a known generic name. For noisy
> packaging, unfamiliar brand names, glare, clutter, damaged labels, or labels without a recognizable
> generic, Pharos may abstain instead of guessing.

This is the correct safety framing. The limitation is not "Pharos cannot scan labels"; the validated
S25 flow did scan clean labels. The limitation is that arbitrary real-world packaging coverage is not
yet reliable enough to advertise as universal.

## Current limitations

1. Final non-debuggable APK smoke proof is tracked in PR #35 and should be cited from the durable evidence bundle.
2. Clean generic labels are validated; arbitrary real-world packaging remains limited.
3. Offline mode is proven after cache/staging, not on a completely fresh install.
4. S25 Ultra is the only completed device validation.
5. OCR can be slow on screen/proof-card labels.
6. CameraX reset or broken-pipe logs can appear after result navigation.
7. Drug coverage is bounded by DDInter 2.0 and the current normalization/synonym layer.
8. MedPsy is explanation-only and may timeout to a deterministic fallback explanation.
9. The APK and MedPsy model have a large storage footprint.
10. Evidence must be moved from the validator's local machine to a durable submission location.
11. Sideload APK distribution is not a production app-store channel.
12. A redacted reachable-history secret scan is available through `npm run scan:history`; record the latest local result before submission.
13. There is no clinical or regulatory validation.
14. Bad lighting, handwritten labels, multi-drug labels, non-English labels, and low-end Android devices are not broadly tested.
15. There is no live model or DDInter update pipeline yet.

## Project-owned limitation handling

- Sideload APK distribution is disclosed as a hackathon artifact, not app-store readiness.
- Clinical/regulatory validation is explicitly out of scope; the app is educational information only.
- Broader Android coverage is tracked separately in [`ANDROID-VALIDATION-MATRIX.md`](ANDROID-VALIDATION-MATRIX.md).
- Static DDInter/model asset boundaries and future update requirements are tracked in [`ASSET-UPDATE-PLAN.md`](ASSET-UPDATE-PLAN.md).
- The repo includes a redacted history scan command: `npm run scan:history`.

## Robustness roadmap

The next implementation track should focus on label robustness before expanding claims:

- Expand brand-name-to-generic mappings for common market names.
- Add fuzzy OCR correction for common recognition errors.
- Add confidence thresholds that distinguish "recognized generic" from "uncertain label".
- Add camera crop and retake guidance for glare, clutter, and small print.
- Add multi-frame capture or best-frame selection before OCR.
- Add a small regression fixture set for noisy labels and local trade names.
- Keep abstain as the fallback when confidence is low.

## Submission wording

Short version:

> Pharos is an on-device drug interaction scanner. On a validated S25 Ultra build, it read clean
> medication labels, grounded interactions in bundled DDInter 2.0 data, explained the result locally
> with MedPsy, and repeated the Major interaction path in airplane mode after assets were cached.
> Unknown or unclear labels abstain instead of producing unsupported medical claims.

Longer version:

> Pharos demonstrates a privacy-preserving medical AI workflow that runs on the phone: camera OCR,
> generic-name normalization, DDInter-grounded interaction lookup, and local MedPsy explanation. The
> S25 validation pass covers the core safety cases: Aspirin plus Warfarin returns a Major DDInter
> interaction, Paracetamol abstains without fabricating an interaction, and a cached airplane-mode
> repeat still works with the local model/database/OCR assets. The current build is a hackathon proof,
> not clinical software: arbitrary noisy packaging, broad device coverage, app-store distribution, and
> regulatory validation remain future work.
