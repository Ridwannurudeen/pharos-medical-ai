# Pharos real-engine build — the verified Expo 54 recipe (for dolepee)

Written 2026-06-15 by Lead, from a full build done this session: app upgraded to Expo 54 / RN 0.81,
a release APK built that **packages the entire QVAC native runtime**, installed and **running on a
Pixel 10 Pro XL**. Every command/version below was actually run; "pending" items are called out.

> TL;DR — three things in your last message are now out of date:
> 1. **Use `@qvac/sdk@0.12.2`, NOT 0.11.0.** Your ETARGET was transient npm lag, not an unpublished dep (proof below).
> 2. **The app must be on Expo SDK 54 / RN 0.81, not 51.** QVAC 0.12.2 literally cannot package its native libs on RN 0.74.
> 3. **There is no "one-line `./mock`→`../core` swap."** The real engine is the app-side composition `app/src/engine/real.ts` (already in the repo), and it's wired + building.

---

## 0. Your install blocker (ETARGET on @qvac/transcription-whispercpp@0.7.0) — RESOLVED

It's **transient npm-registry propagation**, not a missing package. Verified today:
- `npm view @qvac/transcription-whispercpp@0.7.0` → version `0.7.0`, tarball present on registry.npmjs.org.
- `@qvac/sdk@0.12.2` declares it as `^0.7.0`; it installed cleanly in our app + repo root multiple times today.

Fix on your clean machine: just retry. If it recurs, `npm cache clean --force` then reinstall, and use
`--no-audit --no-fund --maxsockets 3` (the npm audit phase ECONNRESETs on flaky networks — unrelated to the dep).
**Do NOT pin 0.11.0** — 0.12.2 is required for the Expo-54 native packaging below.

## 1. The hard requirement: Expo SDK 54 / RN 0.81 / Node ≥ 22.17

QVAC's `react-native-bare-kit` only gets its native libs (`libbare-kit.so` + the manifest addons
`libqvac-ggml-*`, `libqvac__ocr-onnx`, …) into the APK via **C++ TurboModule autolinking
(`cxxModuleCMakeListsPath`), which only exists in RN ≥ 0.76.** On Expo 51 / RN 0.74 those keys are
ignored, bare-kit never becomes a Gradle module, its `link.mjs` never runs, and the APK ships with
**zero** QVAC `.so`. No babel/gradle/metro hack backports this. (Source: QVAC docs require Expo ≥54;
`@qvac/sdk` package.json pins `expo ^54`, `expo-file-system ^19`, `expo-device ^8` = SDK 54.)

Upgrade (from the app dir):
```bash
npm install expo@^54 --no-audit --no-fund
npx expo install --fix          # bumps RN→0.81.5, React→19, expo-* to SDK 54
# If --fix ERESOLVEs on @types/react: set devDependencies."@types/react" to ~19.1.0, then
# rm node_modules + package-lock.json and `npm install --no-audit` (clean tree).
```
Verified resulting versions: expo 54.0.35, react 19.1.0, react-native 0.81.5, @types/react 19.1.x,
react-native-bare-kit 0.14.3, @qvac/sdk 0.12.2, expo-camera 17.0.10, expo-sqlite 16.0.10,
expo-build-properties 1.0.10, expo-asset 12.0.13, expo-file-system 19.0.23, expo-device 8.0.10.

## 2. app.json (already correct in repo, confirm)
`expo.plugins` includes `"@qvac/sdk/expo-plugin"` and `["expo-build-properties", { "android": {
"minSdkVersion": 29, "newArchEnabled": true } }]`. New Architecture is required (bare-kit is a
codegen TurboModule); on SDK 54 it's the default, but set it explicitly via expo-build-properties.

## 3. Android toolchain (install once)
- **JDK 17** (Temurin/Android Studio JBR). Set `JAVA_HOME`.
- **Android SDK**: platform-tools, **platforms;android-36** + build-tools;36.0.0 (RN 0.81 compileSdk 36).
- **NDK `27.0.12077973`** — bare-kit pins this exact NDK; `:react-native-bare-kit` fails to configure
  without it (`[CXX1101] NDK … did not have a source.properties file` = it's missing/corrupt — install it).
  Install: `sdkmanager "ndk;27.0.12077973" "platforms;android-36" "build-tools;36.0.0"`.
  (Do NOT pipe sdkmanager through `| tail` — a broken pipe masks the real exit code and you get a 1 KB stub.)

## 4. Build
```bash
cd app
npx expo prebuild --platform android --clean
cd android
./gradlew :app:assembleRelease --no-daemon      # release buildType is debug-keystore-signed → installable
```
Expected: `BUILD SUCCESSFUL`, APK at `app/android/app/build/outputs/apk/release/app-release.apk` (~530 MB,
arm64-only). Verify the runtime actually packaged:
```bash
unzip -l app-release.apk | grep -E "libbare-kit|libqvac"   # must list libbare-kit.so + libqvac-ggml-*/ocr-onnx
```

## 5. The real engine — it is NOT a one-line mock swap
`core/index.ts`'s `scanPipeline` is itself a mock; the bundle-safe `../core` barrel can't pull in
`@qvac/sdk`/`expo-sqlite`. The real engine is an **app-side composition**, already in the repo at
`app/src/engine/real.ts`: `createGrounding(expoQueryRunner(db))` + `await createQvacEngine({grounding,
medpsyModelSrc})` + `createAuditLog` + `createScanPipeline`, exposing the same `loadEngines()` +
`scanPipeline(image, shelf, opts?)` the screens already call. The flip in `app/src/engine/index.ts`
moves **only** `loadEngines` + `scanPipeline` to `./real` and keeps `__setMockScenario`/`mockScenarios`/
`ScenarioName` on `./mock`. `config.ts` handles first-launch model download + DB asset copy (now with
progress logging). It compiles `core/dist/engine-qvac.js` via `npm run build:engine` at the repo root.

## 6. Errors we already hit + fixes (so you don't re-discover them)
- **`hermesc: private properties are not supported`** on RN's own `EventEmitter`: caused by `babel.config.js`'s
  bare `presets:["babel-preset-expo"]` resolving to a **v56** copy in a parent `node_modules` instead of the
  app's v54 (v56's `hermes-stable` profile leaves `#private` unlowered for RN 0.86's Hermes; RN 0.81 rejects).
  Fix = pin the preset to the app-local copy:
  `require.resolve("babel-preset-expo", { paths:[path.dirname(require.resolve("expo/package.json"))] })`.
  **You likely won't hit this on a clean machine** — it was an artifact of a polluted repo-root `node_modules`
  here. If your repo root has no `@qvac/sdk`/`babel-preset-expo`, the bare preset string resolves correctly.
- **Metro can't resolve `#polyfill-bare-globals`/`#rpc`**: that was an SDK-51 (Metro 0.80) issue — Metro 0.83
  (SDK 54) resolves package `imports` natively. No metro.config hack needed on 54.
- **NDK 29 vs folly `char_traits<unsigned char>`**: only an RN 0.74 problem; RN 0.81 compiles fine. Moot on 54.

## 7. What's verified vs pending (honest status)
- **VERIFIED today:** 0.12.2 installs; Expo 54 upgrade; APK builds with the full QVAC runtime
  (`libbare-kit.so` 63 MB + `libqvac-ggml-{vulkan,opencl,cpu}`, `libqvac__ocr-onnx`, `libqvac__onnx`,
  speech/diffusion); APK installs + launches on a Pixel 10 Pro XL — native libs load, Hermes runs the JS,
  camera initializes, **no crash**.
- **VERIFIED earlier (WSL2, memory):** `engine-qvac` run-validated on `@qvac/sdk 0.12.2` — real OCR →
  DDInter Major + abstain + no-fabrication. Gate A tier-1 delegation works (loopback).
- **PENDING (the actual gate):** a full end-to-end scan on the phone. First launch silently downloads
  MedPsy-1.7B (~1.28 GB); until it finishes, a scan just waits (no result). We've added download progress
  logging to `config.ts` to make this visible. Your `spike/worker-start-test.mjs` probe is a good
  worker-only check, but on-device the worker starts inside the bare worklet (not the desktop path).

## 8. Coordination note
The Expo 54 upgrade above is currently **uncommitted on Ridwan's machine**. Until it's committed to `main`,
`main` is still Expo 51 (won't package the runtime). Either Lead commits the upgrade and you pull, or you
replicate §1–§3 on your box. Ping before both of us run parallel upgrades on `main`.
