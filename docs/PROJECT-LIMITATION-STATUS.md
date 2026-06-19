# Project limitation status

This page tracks the limitations owned by the project owner rather than Dolepee's S25 validation lane.

## Status table

| Limitation                          | Current handling                                                                                                                                          | Status                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| DDInter and synonym coverage bounds | Submission copy now frames coverage as DDInter 2.0 plus the current synonym layer. Label robustness remains a roadmap item.                               | Disclosed, roadmap defined.      |
| Sideload APK distribution           | Submission copy must call the APK a hackathon sideload artifact, not Play Store production readiness.                                                     | Disclosed.                       |
| Git-history secret audit            | `npm run scan:history` performs a redacted reachable-history scan without printing matched values. Latest local run on 2026-06-19 passed with 0 findings. | Check added and passing locally. |
| Clinical or regulatory validation   | Submission copy keeps the educational-only boundary and avoids clinical/regulatory claims.                                                                | Disclosed.                       |
| Static DDInter/model assets         | `docs/ASSET-UPDATE-PLAN.md` records the staged-asset boundary and future live-update requirements.                                                        | Disclosed, update plan defined.  |
| Broader Android coverage            | `docs/ANDROID-VALIDATION-MATRIX.md` tracks second-device and low-end-device evidence separately from Dolepee's S25 proof.                                 | Not validated; not claimed.      |

## Safe submission wording

Use:

> Pharos is a hackathon proof of an on-device drug-interaction workflow. It is validated on S25 Ultra
> with bundled DDInter grounding and staged local model assets. It is educational information only,
> not medical advice or regulated clinical software.

Avoid:

> Pharos is clinically validated, app-store ready, broadly Android compatible, or continuously updated.

## Pre-submission project checklist

- Rerun `npm run scan:history` if any new commits land before final submission.
- Link or cite the durable S25 evidence bundle once Dolepee provides it.
- Keep the Android matrix at S25-only unless project-owned device evidence exists.
- Keep live-update claims out of submission copy.
- Keep clinical/regulatory claims out of submission copy.
