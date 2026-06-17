// The whole app imports the engine ONLY from here. Swapping mock -> real engine is one line.
export * from "./contract";

// ── Engine surface ───────────────────────────────────────────────────────────
// Default: the self-contained mock (RN-safe, runs on the first `expo run:android`).
//
// IMPORT RULE: import the engine ONLY from this barrel (../core in the repo). NEVER import
// ../core/adapters-node or ../core/engine-qvac. Those two have real node:/@qvac imports and
// will break the Metro bundle. The ../core barrel re-exports only types/grounding/audit/
// pipeline/normalize/text, none of which import node:/@qvac, so the barrel is bundle-safe
// (confirmed with the Lead).
//
// To use the Lead's REAL engine, change the export below to `from "../../../core"`. The Lead is
// delivering a verified Metro-safe entrypoint (extensionless specifiers / compiled .js) so the
// `.ts`-specifier resolution is a sure thing before the swap; metro.config.js already watches
// the repo root. Until that entrypoint lands, this faithful mock stays the default (the Lead
// confirmed that is the right call).
// REAL engine (loads OCR + MedPsy on device; see ./real.ts):
export { loadEngines, scanPipeline } from "./real";
// demo strip + unused stubs stay on the mock:
export {
  mockScenarios,
  __setMockScenario,
  scanPipeline as scanMockPipeline,
  audit,
  auditLines,
  ocrLabel,
  normalize,
  lookupInteractions,
  explain,
} from "./mock";
export type { ScenarioName } from "./mock";
