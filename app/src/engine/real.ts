// REAL engine — composes the Lead's core/ pipeline with React-Native platform adapters and exposes
// the SAME surface the app already imports from "./index": `loadEngines()` + `scanPipeline()`.
//
// ── VERIFICATION STATUS (2026-06-14) ────────────────────────────────────────────────────────────
//  VERIFIED (read from source + run-validated end-to-end on WSL2 via spike/validate-engine.ts,
//  @qvac/sdk 0.12.2 — real OCR → grounded DDInter Major → MedPsy answer, PASS):
//    • createQvacEngine({ grounding, medpsyModelSrc })           core/engine-qvac.ts
//    • createGrounding(QueryRunner)  — QueryRunner is SYNC        core/grounding.ts
//    • createScanPipeline({ engine, grounding, audit, clock })   core/pipeline.ts
//    • createAuditLog({ deviceId, sink, clock })                 core/audit.ts
//    • expo-sqlite db.getAllSync(sql, params) → rows             (Expo docs; matches QueryRunner)
//
//  NOT verified here — MUST be validated on the S25 dev build (no RN runtime in this sandbox):
//    1. @qvac/sdk 0.12.2 on Expo SDK 51 / RN 0.74.5 native build (prebuild + autolinking).
//    2. MedPsy-1.7B GGUF delivery on-device (see config.ts → MEDPSY_MODEL_SRC).
//    3. pharos.db (~18 MB) shipped as an asset and opened by expo-sqlite (see ensureDatabase()).
//
//  RESOLVED — the Metro `.ts`-specifier risk: we import the COMPILED `core/dist/engine-qvac.js`
//  (emitted with clean `.js` specifiers + a bare `@qvac/sdk` import — verified on WSL). It's
//  gitignored, so run `npm run build:engine` at the REPO ROOT once (where @qvac is installed,
//  i.e. after the app's `npm install`) before `expo prebuild`. `build:core` (the prepare/CI build)
//  still omits engine-qvac, so CI stays @qvac-free.
//
// ── HOW TO SWITCH THE APP TO THIS (when ready to prebuild) ───────────────────────────────────────
//  In app/src/engine/index.ts, change the two engine entry points from the mock to this module,
//  but KEEP the demo helpers from the mock so the dev scenario-strip still works:
//      export { loadEngines, scanPipeline } from "./real";
//      export { mockScenarios, __setMockScenario } from "./mock";   // demo strip stays
//      export type { ScenarioName } from "./mock";
//  App.tsx already calls `loadEngines()` once at startup and ScanScreen calls `scanPipeline(image, shelf)`
//  — both signatures below match, so no screen changes are needed.
import * as SQLite from "expo-sqlite";
// Import the COMPILED engine (Metro-safe clean .js specifiers; built by `npm run build:engine`).
// Everything else comes from the compiled barrel ("../core" → core/dist) so the mock screens
// stay @qvac/node-free.
import { createQvacEngine } from "../../../core/dist/engine-qvac.js";
import {
  createGrounding,
  createScanPipeline,
  createAuditLog,
  type QueryRunner,
  type ExplainOptions,
} from "../../../core";
import type { ScanResult, ShelfItem } from "./contract";
import {
  DB_NAME,
  MEDPSY_MODEL_SRC,
  DEVICE_ID,
  MESH_DELEGATE,
  ensureDatabase,
} from "./config";

// expo-sqlite's getAllSync is synchronous and returns every row — exactly the QueryRunner shape.
const expoQueryRunner =
  (db: SQLite.SQLiteDatabase): QueryRunner =>
  (sql, params) =>
    db.getAllSync(sql, params as SQLite.SQLiteBindValue[]) as Record<
      string,
      unknown
    >[];

type Pipeline = (
  image: string | Uint8Array,
  shelf?: ShelfItem[],
  opts?: ExplainOptions,
) => Promise<ScanResult>;

// JSONL audit lines, exposed for the About/evidence screen. Stable reference: the sink pushes here.
export const auditLines: string[] = [];

let _pipeline: Pipeline | null = null;
let _loading: Promise<void> | null = null;

async function init(): Promise<void> {
  await ensureDatabase(); // copy the bundled DB into the writable SQLite dir on first run
  const db = SQLite.openDatabaseSync(DB_NAME);
  const grounding = createGrounding(expoQueryRunner(db));
  // Loads the OCR recognizer (+ CRAFT detector, ~15 MB from S3 on first run, then cached) and MedPsy.
  // When MESH_DELEGATE is set, MedPsy explanation runs on the nearby anchor (OCR + grounding stay local).
  const engine = await createQvacEngine({
    grounding,
    medpsyModelSrc: MEDPSY_MODEL_SRC,
    ...(MESH_DELEGATE ? { delegate: MESH_DELEGATE } : {}),
  });
  const t0 = Date.now();
  const clock = {
    isoNow: () => new Date().toISOString(),
    monotonicMs: () => Date.now() - t0,
  };
  const audit = createAuditLog({
    deviceId: DEVICE_ID,
    sink: (line) => auditLines.push(line),
    clock,
  });
  _pipeline = createScanPipeline({ engine, grounding, audit, clock });
}

/** Idempotent: load OCR + MedPsy and build the pipeline. Called once from App.tsx at startup. */
export function loadEngines(): Promise<void> {
  if (!_loading) _loading = init();
  return _loading;
}

/** The one call per scan — same signature as the mock, plus the optional onToken stream. */
export async function scanPipeline(
  image: string | Uint8Array,
  shelf: ShelfItem[] = [],
  opts?: ExplainOptions,
): Promise<ScanResult> {
  await loadEngines(); // safe if already loaded; awaits the in-flight load otherwise
  if (!_pipeline) throw new Error("engine failed to initialize");
  return _pipeline(image, shelf, opts);
}
