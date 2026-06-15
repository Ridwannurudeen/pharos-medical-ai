// Node platform adapters — wire the platform-agnostic core to node:sqlite + node:fs.
// Used by the anchor, the CLI, and tests. NOT imported by the RN app (it uses expo-sqlite /
// expo-file-system equivalents) and NOT re-exported from core/index.ts, so it never reaches the
// mobile bundle. Implements the QueryRunner / Sink / Clock interfaces from grounding.ts / audit.ts.
import { DatabaseSync } from "node:sqlite";
import { appendFileSync } from "node:fs";
import type { QueryRunner } from "./grounding.ts";
import type { Sink, Clock } from "./audit.ts";
import type { ResourceSample } from "./resource-log.ts";

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

/** A resource sampler for Node (anchor/CLI): process CPU% (of one core) since the last sample +
 *  resident memory. Battery is -1 (Node has no battery API; the RN app supplies it via expo-battery). */
export function nodeResourceSampler(): () => ResourceSample {
  let lastCpu = process.cpuUsage();
  let lastNs = process.hrtime.bigint();
  return () => {
    const nowCpu = process.cpuUsage();
    const nowNs = process.hrtime.bigint();
    const cpuMicros =
      nowCpu.user - lastCpu.user + (nowCpu.system - lastCpu.system);
    const wallMicros = Number(nowNs - lastNs) / 1000;
    lastCpu = nowCpu;
    lastNs = nowNs;
    const cpuPct =
      wallMicros > 0 ? Math.round((cpuMicros / wallMicros) * 1000) / 10 : -1;
    const ramMb = Math.round(process.memoryUsage().rss / 1_048_576);
    return { cpuPct, ramMb, batteryPct: -1 };
  };
}
