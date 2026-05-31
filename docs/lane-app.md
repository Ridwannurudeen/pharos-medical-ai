# Lane B — The Phone App (handoff brief)

You own **`app/`**: the entire Expo phone app for Pharos. You do **not** touch the QVAC SDK, the datasets, or the mesh — you build the UI/UX against a typed `core/` API the Lead provides. This brief is everything you need to start.

> **One-line product:** a phone reads a medication label, explains it, and catches dangerous interactions — fully offline. Same app scales up over a P2P mesh when peers are present, but the **mesh is invisible to you** — `core/` handles it; you just show its status.
>
> ⚕️ **Non-negotiable framing:** educational information only, **not** medical advice. The disclaimer is always visible. The app **identifies → explains → surfaces documented interactions → tells the user to see a professional.** It never diagnoses, doses, or says "start/stop taking."

## Getting access & setting up your machine (do this first)

### 1. Repo access (it's a private repo)
1. Send the Lead your **GitHub username** — you'll be added as a collaborator and get an email invite. **Accept it.**
2. Clone:
   ```bash
   git clone https://github.com/Ridwannurudeen/pharos-medical-ai.git
   cd pharos-medical-ai
   ```
3. **Workflow — feature branches + PRs** (team convention; don't push straight to `main`):
   ```bash
   git checkout -b app/<short-description>
   # ...make changes, commit...
   git push -u origin app/<short-description>
   gh pr create --base main
   ```

### 2. Install before June 1
- **Git** and **Node.js LTS** — the Lead's machine runs Node **v24.15.0 / npm 11.12.1**; match the major version to avoid surprises.
- The **Expo toolchain** (used from build start: `npx create-expo-app`, `npx expo`).
- A **physical Android phone** for testing (demo target: **Galaxy S25 Ultra**), USB debugging on. Note: the QVAC SDK needs a **dev build**, **not** Expo Go.
- A code editor (VS Code recommended) + the GitHub CLI (`gh`) for PRs.

### 3. What you do NOT download
The MedPsy models, the DDInter/RxNorm/DrugBank datasets, and the QVAC SDK setup are the **Lead's** lane. You build entirely against `core/` — don't pull models or data onto your machine.

### 4. First 30 minutes
- Accept the invite, clone, then confirm your toolchain: `node -v`, `git --version`, `gh auth status`.
- Read this brief end-to-end.
- Skim [`../ROADMAP.md`](../ROADMAP.md) (timeline + checkpoints) and [`qvac-sdk-reference.md`](qvac-sdk-reference.md) (what the SDK can/can't do — note: there is **no** auto peer-failover; resilience is `fallbackToLocal`).

## The contract you code against (`core/`)

The Lead ships this as **mocks (already in `core/`)** — real signatures, canned fixtures — so you can build the whole app immediately; real implementations land behind the **same signatures**. Treat it as a stable interface. (Types live in `core/types.ts`.)

```ts
import { scanPipeline, mockScenarios, __setMockScenario, audit } from "../core";

// One call per scan: image + the user's shelf -> grounded, explained result.
scanPipeline(image: string | Uint8Array, shelf: ShelfItem[]): Promise<ScanResult>

type Severity = "Major" | "Moderate" | "Minor" | "Unknown"; // DDInter includes "Unknown" = documented but uncharacterized (NOT safe)

type ScanResult = {
  scan:        { rawText: string; generic: string | null; matched: boolean };
  interactions: Interaction[];          // [] = none found (NOT a safety guarantee)
  explanation: string;                  // MedPsy plain-language context (also streamable — see below)
  abstained:   boolean;                 // true → show the abstain card, NOT a result
  abstainReason?: "unresolved_drug" | "not_in_dataset";
  delegated:   boolean;                 // true → answered by the mesh anchor (show the badge)
  latencyMs:   number;
};

type Interaction = {
  drugA: string; drugB: string;
  severity: Severity;
  source: "DDInter 2.0";                // citation to show on every interaction
  ddinterIdA: string; ddinterIdB: string;
};
// NOTE: DDInter has NO mechanism/management text. The human-readable context is `explanation` (from MedPsy), not a dataset field.
```
- **Importing core (Metro) — confirmed swap:** `import { scanPipeline, mockScenarios, __setMockScenario, audit } from "../core"` resolves to the **compiled** `core/dist/index.js` (plain ESM, `.js` specifiers, zero Node/SDK deps) via `core/package.json` `main` — Metro-safe (verified: CommonJS `main` resolution, which Metro uses, → `core/dist/index.js`). Run `npm install` (or `npm run build:core`) **at the repo root** once to generate `core/dist` (gitignored; auto-built on install via `prepare`). **Only import from `../core`** — never `../core/adapters-node` or `../core/engine-qvac` (those are Node/anchor-only, real `node:`/`@qvac` imports, and will break the bundle). If your Metro doesn't honour `main`, use the explicit `"../core/dist"`.
- **Build every screen NOW:** the mock exposes `mockScenarios` (`major` / `none` / `abstain` / `delegated`) and `__setMockScenario(name)` to flip what `scanPipeline` returns — wire all four states before the real engine exists.
- **Streaming the explanation:** the real `scanPipeline` will also expose a token stream for the MedPsy text (typewriter render). Exact handle TBD when the real `core/` lands; build against the string first, wire streaming second.
- **Audit:** the signature is `audit.log(event, fields?)` (e.g. `audit.log("scan_result", { ... })`) — call only at the UI boundary if asked; the Lead's `core/` already logs the pipeline. Don't double-log.

You own the **user's medication shelf** storage yourself — **`expo-secure-store`** (OS-keystore encryption at rest; approved over `expo-sqlite` for this short list). Caveat: ~2 KB/value limit on Android — fine for a short shelf as a JSON blob; move to SQLite/SQLCipher if it goes relational. Add/remove meds; pass the shelf into the scan. The Lead owns the read-only bundled interaction DB; you never read it directly.

## Screens to build

1. **Scan** — camera capture (`expo-camera` or `react-native-vision-camera`) → `scanPipeline(image)`. Show capture → analyzing → result.
2. **Result card** — the hero screen:
   - Big **severity chip** (Major = red / Moderate = amber / Minor = grey).
   - The plain-language **explanation** (streamed).
   - **"Source: DDInter"** citation on every interaction (provenance is a scoring point).
   - **Delegated badge** when `delegated === true` ("analyzed by a larger model nearby").
   - The persistent **educational-only disclaimer**.
3. **Abstain card** — when `abstained === true`: *"I can't verify this one — consult a pharmacist."* Never show a fabricated result. This path is a feature, demo it.
4. **Shelf** — list + add/remove meds (encrypted via `expo-secure-store`); this is the set every scan is checked against.
5. **Settings / About** — disclaimer, data sources + licenses (DDInter CC BY-NC), offline indicator.
6. **Mesh status indicator** (Phase 2) — a small chip: `on-device` / `delegating to anchor` / `fell back to on-device`. Driven entirely by `ScanResult.delegated` + a `core/` status hook the Lead exposes.

## Per-phase deliverables (mirrors `ROADMAP.md`)

- **Phase 1 (Jun 2–7):** app scaffold + navigation; camera → `scanPipeline`; result card (severity, explanation, citation); abstain card; disclaimer banner; shelf CRUD. Build on the `core/` mocks from Day 2.
- **Phase 2 (Jun 8–11, only if the mesh gate passed):** mesh status indicator; delegation UX ("analyzing on a larger model nearby…"); onboarding for the **"get the AI from a nearby device"** flow.
- **Phase 3 (Jun 12–14):** polish every state (empty shelf, OCR-fail, low-confidence, no-peer); accessibility; help build the fixed pre-verified demo-case set.
- **Phase 4 (Jun 15–19):** stretch — voice intake/read-back UX (STT/TTS via `core/`), result-card craft, optional multi-shelf "household" mode.

## Rules of the road

- **Don't call `@qvac/sdk` directly, and don't read the datasets.** Everything goes through `core/`. If you need something `core/` doesn't expose, ask the Lead to add it to the contract — don't reach around it.
- **Any change you'd want to `core/index.ts` signatures = a conversation first.** The contract is frozen Day 2; changes are announced before merging.
- **Offline is the whole point.** No network calls, no analytics, no remote fonts/images, no crash reporters that phone home. The demo runs in airplane mode with a packet capture proving zero traffic — anything you add that talks to the network breaks the core claim.
- **The disclaimer is always on screen** in any medical-content view. The abstain path must never be bypassed by UI.
- **Daily:** one-line status in the team channel (shipped / blocked).

## Stack (planned — confirm with Lead before adding native modules)
Expo (bare workflow if a native module needs it) · `expo-camera` / `react-native-vision-camera` · `expo-secure-store` (encrypted shelf) · `expo-network` (to show/prove offline). All inference is via `core/` → `@qvac/sdk`; you never add a model or an API client.
