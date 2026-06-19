# Asset update plan

The submission build uses bundled/static assets. There is no live model or DDInter update pipeline in
the final APK, so submission copy must describe the current build as a staged offline proof.

## Current boundary

- DDInter 2.0 is bundled into `pharos.db`.
- OCR assets are cached by the QVAC runtime after first use.
- MedPsy is staged in the app sandbox before the validated offline path.
- The app does not pull live DDInter updates at runtime.
- The app does not pull live MedPsy updates at runtime.

## Manual update process

When the dataset or model changes:

1. Rebuild the database with `npm run data`.
2. Copy the rebuilt database into the app asset path used by the Android build.
3. Rebuild the APK.
4. Rerun `npm run verify`.
5. Rerun S25 smoke, clean-label Major, abstain, and offline-boundary evidence before widening claims.
6. Record the new APK SHA256 and asset versions in the evidence manifest.

## Future live-update requirements

A production update pipeline would need:

- Signed asset manifest with model/database versions and SHA256 digests.
- Explicit user-visible download/staging state.
- Rollback to the last known-good database/model pair.
- Offline behavior when an update is unavailable or incomplete.
- Revalidation of DDInter grounding and abstain behavior after every update.

Until that exists, say:

> Pharos uses bundled DDInter data and staged local model assets for the validated build. Live model
> and DDInter update delivery is future work.
