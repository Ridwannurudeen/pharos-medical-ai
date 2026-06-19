# Android validation matrix

This matrix is the project-owned Android coverage tracker. Dolepee owns the S25 evidence path only;
broader Android coverage is not claimed until a project owner validates it on additional hardware.

## Current status

| Device class                | Owner         | Status                                                                                                          | Evidence                                                        | Submission claim                             |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Galaxy S25 Ultra            | Dolepee       | Validated on final APK for clean labels, cached offline repeat, final APK smoke, and S25 retail-label evidence. | PR #30 and PR #35 comments plus `/home/qdee/pharos-artifacts/`. | Safe to claim as the completed device proof. |
| Second modern Android phone | Project owner | Not tested.                                                                                                     | None yet.                                                       | Do not claim broad Android compatibility.    |
| Low-end Android phone       | Project owner | Not tested.                                                                                                     | None yet.                                                       | Do not claim low-end-device readiness.       |
| Older Android version       | Project owner | Not tested.                                                                                                     | None yet.                                                       | Do not claim OS-version matrix coverage.     |

## Required project-side evidence before widening claims

- Install the final APK with `adb install -r` or a clean install, depending on the test goal.
- Record device model, Android version, CPU/ABI, and available storage.
- Confirm startup reaches the Scan screen.
- Run one clean generic label with Warfarin on the shelf.
- Run one abstain case.
- If assets must be staged before offline use, record that boundary explicitly.
- Save screenshot, UI dump, filtered logcat, and a one-line result summary.

## Current submission wording

Use:

> Pharos has completed S25 Ultra validation. Broader Android coverage remains future work.

Do not use:

> Pharos works across Android devices.
