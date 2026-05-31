# Lane B — The Phone App (handoff brief)

You own **`app/`**: the entire Expo phone app for Pharos. You do **not** touch the QVAC SDK, the datasets, or the mesh — you build the UI/UX against a typed `core/` API the Lead provides. This brief is everything you need to start.

> **One-line product:** a phone reads a medication label, explains it, and catches dangerous interactions — fully offline. Same app scales up over a P2P mesh when peers are present, but the **mesh is invisible to you** — `core/` handles it; you just show its status.
>
> ⚕️ **Non-negotiable framing:** educational information only, **not** medical advice. The disclaimer is always visible. The app **identifies → explains → surfaces documented interactions → tells the user to see a professional.** It never diagnoses, doses, or says "start/stop taking."

## The contract you code against (`core/`)

The Lead ships this as **mocks on Day 2** (real signatures, canned fixtures) so you can build the whole app immediately, then swaps in real implementations behind the **same signatures**. Treat it as a stable interface.

```ts
import { scanPipeline, audit } from "../core";

// You mostly call ONE function and render its result:
scanPipeline(image): Promise<ScanResult>

type ScanResult = {
  scan:        { rawText: string; generic: string | null; rxcui: string | null; matched: boolean };
  interactions: Interaction[];          // [] when none found
  explanation: string;                  // MedPsy plain-language text (also streamable — see below)
  abstained:   boolean;                 // true → show the abstain card, NOT a result
  abstainReason?: "unresolved_drug" | "not_in_dataset";
  delegated:   boolean;                 // true → answer came from the mesh anchor (show the badge)
  source:      "DDInter";               // citation to show on every interaction
  latencyMs:   number;
};

type Interaction = {
  drugA: string; drugB: string;
  severity: "Major" | "Moderate" | "Minor";
  mechanism: string; management: string; sourceRowId: string;
};
```
- **Streaming the explanation:** `scanPipeline` also exposes a token stream for the MedPsy text so you can render it live (typewriter). The Lead will confirm the exact streaming handle when the real `core/` lands; build against the string first, wire streaming second.
- **Audit:** call `audit.log({ event: "scan_result", ... })`-style events at the UI boundary only if asked — the Lead's `core/` already logs the pipeline. Don't double-log.

You own the **user's medication shelf** storage yourself (`expo-sqlite`) — add/remove meds; pass the shelf into the scan. The Lead owns the read-only bundled interaction DB; you never read it directly.

## Screens to build

1. **Scan** — camera capture (`expo-camera` or `react-native-vision-camera`) → `scanPipeline(image)`. Show capture → analyzing → result.
2. **Result card** — the hero screen:
   - Big **severity chip** (Major = red / Moderate = amber / Minor = grey).
   - The plain-language **explanation** (streamed).
   - **"Source: DDInter"** citation on every interaction (provenance is a scoring point).
   - **Delegated badge** when `delegated === true` ("analyzed by a larger model nearby").
   - The persistent **educational-only disclaimer**.
3. **Abstain card** — when `abstained === true`: *"I can't verify this one — consult a pharmacist."* Never show a fabricated result. This path is a feature, demo it.
4. **Shelf** — list + add/remove meds (encrypted `expo-sqlite`); this is the set every scan is checked against.
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
Expo (bare workflow if a native module needs it) · `expo-camera` / `react-native-vision-camera` · `expo-sqlite` · `expo-network` (to show/prove offline). All inference is via `core/` → `@qvac/sdk`; you never add a model or an API client.
