// Node platform adapters — wire the platform-agnostic core to node:sqlite + node:fs.
// Used by the anchor, the CLI, and tests. NOT imported by the RN app (it uses expo-sqlite /
// expo-file-system equivalents) and NOT re-exported from core/index.ts, so it never reaches the
// mobile bundle. Implements the QueryRunner / Sink / Clock interfaces from grounding.ts / audit.ts.
import { DatabaseSync } from "node:sqlite";
import { appendFileSync } from "node:fs";
import type { QueryRunner } from "./grounding.ts";
import type { Sink, Clock } from "./audit.ts";

type SqlParam = string | number | bigint | null | Uint8Array;

/** A QueryRunner backed by an open node:sqlite database. */
export function nodeQueryRunner(db: DatabaseSync): QueryRunner {
  return (sql, params) =>
    db.prepare(sql).all(...(params as SqlParam[])) as Record<string, unknown>[];
}

/** An audit Sink that appends one JSON line per call to a file. */
export function fileSink(path: string): Sink {
  return (line) => appendFileSync(path, line + "\n");
}

/** A Clock: wall-clock ISO + monotonic ms since this clock was created. */
export function nodeClock(): Clock {
  const t0 = Date.now();
  return {
    isoNow: () => new Date().toISOString(),
    monotonicMs: () => Date.now() - t0,
  };
}
