# Device setup — solo on-device (the floor + the prerequisite for mesh)

Get the REAL engine running on the phone: camera → on-device OCR → DDInter grounding → MedPsy
explanation, fully offline after first launch. The core is already run-validated on WSL2; this is the
platform build. Mesh comes after (see [`MESH-RUNBOOK.md`](MESH-RUNBOOK.md)).

> Runs on **your** hardware (Pixel 10 Pro XL / S25). The Lead can't drive an Android build remotely —
> follow these, paste any error back. Every command/path below was checked against the repo.

> ⚠️ **Read [`EXPO54-BUILD.md`](EXPO54-BUILD.md) first — it supersedes this for the build environment.**
> This guide predates the verified finding that QVAC 0.12.2 **requires Expo SDK 54 / RN 0.81** (on Expo 51
> the QVAC native runtime cannot be packaged at all) and needs **NDK 27.0.12077973** + the babel-preset
> pin. `EXPO54-BUILD.md` is the current, end-to-end-verified recipe (build → APK with the full runtime →
> runs on a Pixel 10 Pro XL). The camera/scan/flip steps below still apply once you're on Expo 54.

## 0. Prereqs (dev machine)
- Node 24, the Android SDK + JDK 17 (Android Studio), and `adb`. A **physical** Android phone (no
  emulator) with **Developer options + USB debugging** on, plugged in (`adb devices` shows it).
- The QVAC SDK needs a **dev build** (`expo run:android`), **not** Expo Go.

## 1. Build the Metro-safe engine (repo root)
`@qvac/sdk` must be at the **root** too so `build:engine` can compile `core/engine-qvac.ts`.
```bash
cd <repo root>
npm install
npm install @qvac/sdk@0.12.2     # for the build:engine compile only
npm run build:engine             # emits core/dist/engine-qvac.js (clean .js specifiers, Metro-safe)
npm run data                     # builds data/pharos.db (~18 MB)
```

## 2. App deps (Expo-SDK-correct versions)
```bash
cd app
npm install
npx expo install expo-sqlite expo-asset expo-file-system expo-build-properties expo-device
```
(`@qvac/sdk@0.12.2` + `react-native-bare-kit@^0.14.0` are already in app/package.json. `app.json`
already has the `expo-build-properties` minSdk 29 + `@qvac/sdk/expo-plugin` plugins.)

## 3. Bundle the interaction DB as an asset
`ensureDatabase()` copies `app/assets/pharos.db` into the on-device SQLite dir on first launch.
```bash
mkdir -p app/assets
cp data/pharos.db app/assets/pharos.db    # from the repo root's npm run data
```
(The MedPsy-1.7B GGUF is **not** bundled — `ensureModel()` downloads it once on first launch from
Hugging Face into the app's document dir, then it's offline. ~1.28 GB; first launch needs WAN + a
minute. For a no-wait demo, pre-place the file at `MEDPSY_MODEL_SRC` via a filesystem-capable dev build.)

## 4. Flip the engine from mock → real
In `app/src/engine/index.ts`, move **only** `loadEngines` + `scanPipeline` to the real module; keep
the demo helpers + types on the mock (verified: screens import only `scanPipeline`, `__setMockScenario`,
and types). Replace the `from "./mock"` export block with:
```ts
// REAL engine (loads OCR + MedPsy on device; see ./real.ts):
export { loadEngines, scanPipeline } from "./real";
// demo strip + unused stubs stay on the mock:
export {
  mockScenarios,
  __setMockScenario,
  audit,
  auditLines,
  ocrLabel,
  normalize,
  lookupInteractions,
  explain,
} from "./mock";
export type { ScenarioName } from "./mock";
```
(`export * from "./contract";` at the top stays.) To fall back to the pure-mock build, revert this one block.

## 5. Prebuild + run on the phone
```bash
cd app
npx expo prebuild --clean
npx expo run:android        # phone plugged in; first build is slow
```
First launch: app downloads the model + copies the DB (one-time, online), loads OCR (pulls the ~15 MB
recognizer/detector from S3 once), then is fully offline.

## Expected (the solo demo)
- Scan an **aspirin** label with **Warfarin** on the shelf → severity **Major**, cited "DDInter 2.0",
  plain-language explanation streams in (no `<think>` leakage — stripped in engine-qvac).
- Scan a **paracetamol** label → **abstain** card ("can't verify this one") — never a fabricated result.
- Toggle **airplane mode** after the one-time model/OCR fetch → a scan still works end-to-end; capture
  the zero-traffic network trace for the evidence bundle.

## Troubleshooting
- **`RPC_INIT_TIMEOUT`** is a *Windows/desktop* failure; it should NOT occur on the phone (the SDK uses
  the `react-native-bare-kit` worklet there). If it does, confirm the dev build (not Expo Go) and arm64.
- **Metro can't resolve `core/engine-qvac`** → you skipped `npm run build:engine` (step 1) or its
  `core/dist/engine-qvac.js` is stale; rebuild it. `metro.config.js` already watches the repo root.
- **`Cannot find module @qvac/sdk` during build:engine** → run `npm install @qvac/sdk@0.12.2` at the
  **repo root** (step 1), not just in app/.
- **`pharos.db asset has no localUri` / DB open fails** → the file isn't at `app/assets/pharos.db` (step 3).
- **GPU**: the Pixel uses Vulkan/OpenCL automatically (QVAC ships those backends for android-arm64); no flag needed.
