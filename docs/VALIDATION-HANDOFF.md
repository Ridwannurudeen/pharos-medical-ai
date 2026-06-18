# Validation handoff

PR #30 is merged and the final Android artifact is available. This document records what has been
validated, what is still a known limitation, and which follow-up items are owned by the device
validator versus the project submission owner.

## Current evidence

- Public repository: <https://github.com/Ridwannurudeen/pharos-medical-ai>
- Merged PR: <https://github.com/Ridwannurudeen/pharos-medical-ai/pull/30>
- Merge commit: `feb7ae9fc4da232d072a6454a35c36f02335179c`
- Validated application head: `cbc1d1fbbc260fca1ff9140c5f4510a5e6d4ba2a`
- Final APK release: <https://github.com/Ridwannurudeen/pharos-medical-ai/releases/tag/apk-pr30-final>
- Final APK asset: <https://github.com/Ridwannurudeen/pharos-medical-ai/releases/download/apk-pr30-final/pharos-s25-cbc1d1f-final.apk>
- Final APK SHA256: `c17df918e1d9908c3ac0c880a354e303e0939625c8a5773e4400a42ddc4bdd88`

## Device validation summary

The S25 validation pass completed on the validated `cbc1d1f` code path:

- Aspirin / Warfarin clean-label scan produced a `Major` interaction grounded in DDInter 2.0.
- Paracetamol / Acetaminophen clean-label scan abstained without fabricating an interaction.
- Airplane-mode cached repeat passed with the local database, local OCR cache, and staged MedPsy model.
- Final non-debuggable APK was built from the validated head after the validation-only debuggable build.

The evidence bundle is expected under Dolepee's validation machine at:

```text
/home/qdee/pharos-artifacts/
```

It should include the offline repeat screenshot, log, UI dump, summary, and clean-label pass evidence.

## Dolepee-owned follow-up

### 1. Final APK smoke proof

Install the final APK over the already staged app. Do not uninstall first, because the staged MedPsy
model should stay preserved.

```bash
adb install -r pharos-s25-cbc1d1f-final.apk
```

Expected proof:

- APK SHA256 matches `c17df918e1d9908c3ac0c880a354e303e0939625c8a5773e4400a42ddc4bdd88`.
- Install succeeds without clearing app data.
- Startup remains on the cached/no-download path.
- One known scan still reaches a result screen.

### 2. Evidence bundle access

Package or upload `/home/qdee/pharos-artifacts/` to a durable location for submission. The submission
should not depend on evidence that exists only on one local machine.

Required contents:

- Offline repeat screenshot.
- Offline repeat log.
- Offline repeat UI dump.
- Offline repeat summary.
- Clean-label Major pass evidence.
- Clean-label abstain pass evidence.

### 3. Non-blocking device observations

Confirm these remain observations rather than blockers:

- OCR can be slow on screen/proof-card labels.
- CameraX can emit surface reset or broken-pipe logs after navigating away from camera/result screens.
- Arbitrary noisy packaging can abstain when OCR/normalization cannot identify a known generic.

## Project-owned follow-up

### 1. Submission framing

Use precise language:

- Pharos is validated for clean, in-scope labels on S25 Ultra.
- It grounds interaction decisions in bundled DDInter 2.0.
- It abstains when it cannot verify a drug or interaction.
- It is educational information only, not medical advice or certified clinical software.

Avoid claiming that Pharos can reliably scan arbitrary real-world packaging today.

### 2. Documentation and limitations

Keep the public repo honest about the current scope:

- Offline operation is proven after the model, OCR assets, and database are cached.
- Fresh install still needs MedPsy staged or downloaded before fully offline use.
- S25 Ultra is the current device-validation floor; a broader Android matrix is future work.
- OCR is strongest on clean labels with visible generic names.
- Brand-name and local-trade-name coverage is limited by the current synonym/normalization layer.

### 3. Drug-label robustness roadmap

The next product-hardening track is label robustness:

- Add a larger brand-name-to-generic dictionary.
- Add fuzzy OCR matching for common recognition errors.
- Add clearer crop/retake guidance in the camera flow.
- Add multi-frame capture or best-frame selection.
- Expand aliases beyond the current small synonym set.
- Keep abstain behavior when confidence is low.

## Known limitations

1. Final non-debuggable APK still needs one last S25 smoke proof after install-over-current-app.
2. Arbitrary real-world packaging is not reliable yet; clean generic labels are the validated path.
3. Fully offline use requires cached/staged assets; fresh install is not fully offline by default.
4. Validation is currently one-device proof on S25 Ultra.
5. OCR latency can be high on screen/proof-card labels.
6. CameraX reset/broken-pipe logs remain a non-blocking watch item.
7. Drug matching is bounded by DDInter 2.0 and the current normalization/synonym set.
8. MedPsy is explanation-only and may timeout to a deterministic grounded fallback.
9. APK plus MedPsy storage footprint is large.
10. Evidence must be copied out of the local validator machine before submission.
11. Sideload APK distribution is not a production app-store channel.
12. The repository had a quick tracked-file secret scan before public release, not a deep history audit.
13. There is no clinical or regulatory validation.
14. Bad lighting, handwritten labels, multi-drug labels, non-English labels, and low-end Android devices are not broadly tested.
15. There is no live model or DDInter update pipeline yet.
