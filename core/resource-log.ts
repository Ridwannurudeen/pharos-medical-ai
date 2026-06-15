// Resource log — sampled system metrics for the verification bundle (docs/audit-log-schema.md).
// CSV: ts_iso,monotonic_ms,device_id,cpu_pct,ram_mb,battery_pct,network_state — one row per tick,
// sampled ~1/sec by the caller (the platform layer drives the interval; core stays timer-free and
// testable). Pure + platform-agnostic: inject a Sink, Clock, and a sampler (Node: process/os;
// RN: expo-battery/expo-device). A metric that isn't available is reported as -1.
import type { Sink, Clock, NetworkState } from "./audit.ts";

export interface ResourceSample {
  /** process CPU usage 0-100 (% of one core), or -1 if unknown */
  cpuPct: number;
  /** resident memory in MB, or -1 if unknown */
  ramMb: number;
  /** battery 0-100, or -1 if unknown / on AC power */
  batteryPct: number;
}

/** The CSV header, exactly the columns in docs/audit-log-schema.md. */
export const RESOURCE_CSV_HEADER =
  "ts_iso,monotonic_ms,device_id,cpu_pct,ram_mb,battery_pct,network_state";

export interface ResourceLogOptions {
  deviceId: string;
  /** writes one finished CSV line. Node: append to resources.csv; RN: expo-file-system. */
  sink: Sink;
  clock: Clock;
  /** platform metric sampler (see adapters-node.ts nodeResourceSampler) */
  sample: () => ResourceSample;
  /** current network state, sampled per row; defaults to "offline" */
  networkState?: () => NetworkState;
}

export interface ResourceLog {
  /** write the CSV header line (call once, before the first tick) */
  header(): void;
  /** sample now and write one CSV row */
  tick(): void;
}

export function createResourceLog(opts: ResourceLogOptions): ResourceLog {
  const netState = opts.networkState ?? (() => "offline" as NetworkState);
  return {
    header(): void {
      opts.sink(RESOURCE_CSV_HEADER);
    },
    tick(): void {
      const s = opts.sample();
      opts.sink(
        [
          opts.clock.isoNow(),
          opts.clock.monotonicMs(),
          opts.deviceId,
          s.cpuPct,
          s.ramMb,
          s.batteryPct,
          netState(),
        ].join(","),
      );
    },
  };
}
