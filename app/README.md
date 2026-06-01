# Pharos — `app/` (Lane B, the phone app)

The Expo phone app. It reads a medication label, explains it in plain language, and flags
documented interactions with the user's shelf — **fully on-device**. UI is built against the
Lead's typed `core/` engine contract; this app never touches the QVAC SDK, the datasets, or the mesh.

## Status: Phase 1 scaffold (built before the build window)

Working now, against a self-contained mock of `core/`:

- Bottom-tab navigation: **Scan**, **Shelf**, **About**; Scan pushes to a **Result** screen.
- **Scan**: `expo-camera` capture, plus a "Demo scenarios" strip that drives all four engine
  states (`major` / `none` / `abstain` / `delegated`) so every screen is reachable without real OCR.
- **Result**: the cited DDInter fact (drug pair, severity chip incl. **Unknown**, `Source: DDInter 2.0`,
  DDInter ids) is rendered **separately** from the model's plain-language `explanation`, which is
  labeled "background only, not a DDInter field" — the grounding rule from `core/types.ts`.
- **Abstain card**, **no-interaction** state, **delegated badge**, persistent **disclaimer**.
- **Shelf**: add/remove meds, persisted **encrypted** via `expo-secure-store` (OS keystore).
- **About**: offline indicator (`expo-network`), data sources + license, privacy.

## Run it (needs a wired Android phone)

QVAC is native, so this needs a **dev build, not Expo Go**.

```bash
cd app
npm install
npx expo install --fix     # align native module versions to the installed Expo SDK
npx expo run:android       # builds + installs the dev build on a USB-connected phone
```

Node: match the Lead's major version (v24). First `run:android` also generates `android/`
(git-ignored). After that, `npm start` (dev client) for the fast JS reload loop.

## The engine swap (one line)

The whole app imports the engine only from `src/engine/index.ts`. It defaults to a local mock
(`src/engine/mock.ts`) that mirrors the fixtures in repo-root `core/index.ts` exactly, so it runs
on the first build. To use the Lead's real engine, change the re-export in `src/engine/index.ts`
to `from "../../../core"`. `metro.config.js` already watches the repo root, and `core/index.ts`
is RN-safe (no runtime `node:`/`@qvac` deps in its import graph — verified). The only thing to
confirm on-device is Metro resolving `core`'s `.ts`-extension ESM specifiers.

## Open questions for the Lead (flagged, not blocking)

1. **Importing `../core` in RN:** the brief shows `import { scanPipeline } from "../core"`. The graph
   is node-free, but `core` uses explicit `.ts` ESM specifiers under a `type:module` root; if Metro
   balks on-device, a plain RN entrypoint to `core` would settle it. Until then the mock is faithful.
2. **Shelf storage:** brief says `expo-sqlite`; I used `expo-secure-store` instead, because the shelf
   is a short list and secure-store gives **real OS-keystore encryption at rest** rather than a
   hand-rolled cipher over sqlite. Easy to move to sqlite + field encryption if the shelf goes relational.
3. **Explanation streaming:** built against the string with a typewriter render; will wire the real
   token stream when `core/` exposes the handle.

## Rules kept from the brief

No network calls, no analytics, no remote fonts or images (offline is the whole claim; the demo runs
in airplane mode). The disclaimer is always on screen in medical views. The abstain path is never
bypassed. Engine signature changes are a conversation with the Lead first.
