// Audit-log writer — the verification backbone (docs/audit-log-schema.md). Every pipeline step logs
// one JSON line. Pure and platform-agnostic: inject a Sink (Node fs / expo-file-system) and a Clock,
// so the same writer runs on phone, anchor, and in tests. Build this first; have it writing live
// during every demo recording.

export type NetworkState = "offline" | "lan_only" | "online";

/** Writes one finished JSONL line. Node: append to audit.jsonl; RN: expo-file-system. */
export type Sink = (line: string) => void;

export interface Clock {
  /** ISO-8601 UTC timestamp */
  isoNow(): string;
  /** monotonic ms since app start (immune to wall-clock changes) */
  monotonicMs(): number;
}

export interface AuditLog {
  log(event: string, fields?: Record<string, unknown>): void;
}

export interface AuditOptions {
  deviceId: string;
  sink: Sink;
  clock: Clock;
  /** current network state, sampled per event; defaults to "offline" */
  networkState?: () => NetworkState;
}

export function createAuditLog(opts: AuditOptions): AuditLog {
  const netState = opts.networkState ?? (() => "offline" as NetworkState);
  return {
    log(event: string, fields: Record<string, unknown> = {}): void {
      const record = {
        ts_iso: opts.clock.isoNow(),
        monotonic_ms: opts.clock.monotonicMs(),
        device_id: opts.deviceId,
        event,
        network_state: netState(),
        ...fields,
      };
      opts.sink(JSON.stringify(record));
    },
  };
}

/** In-memory sink — keeps every line; for tests and the mock engine. */
export function memorySink(): { sink: Sink; lines: string[] } {
  const lines: string[] = [];
  return { sink: (line) => lines.push(line), lines };
}
