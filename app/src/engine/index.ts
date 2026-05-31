// The whole app imports the engine ONLY from here. Swapping mock -> real engine is one line.
export * from "./contract";

// ── Engine surface ───────────────────────────────────────────────────────────
// Default: the self-contained mock (RN-safe, runs on the first `expo run:android`).
//
// To use the Lead's REAL engine at repo-root core/ (its mock fixtures + real impls land behind
// the SAME signatures), change the export below to:  export { ... } from "../../../core";
// Prereqs are already prepared: metro.config.js watchFolders includes the repo root, and
// core/index.ts is RN-safe (its import graph has no runtime node:/@qvac deps — verified).
// The one thing to confirm on-device is Metro resolving core's `.ts`-extension ESM specifiers;
// if it complains, keep this mock line and ask the Lead for a plain RN entrypoint to core.
export {
  scanPipeline,
  mockScenarios,
  __setMockScenario,
  audit,
  auditLines,
  loadEngines,
  ocrLabel,
  normalize,
  lookupInteractions,
  explain,
} from "./mock";
export type { ScenarioName } from "./mock";
