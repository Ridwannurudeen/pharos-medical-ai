// Reproducibility + unit check. Run: npm run verify
// Exercises the REAL core modules (grounding + audit) against data/pharos.db, asserts known
// fixtures, and checks the abstain path. Exits non-zero on any failure (CI-friendly).
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGrounding } from "../core/grounding.ts";
import { createAuditLog, memorySink } from "../core/audit.ts";
import { createScanPipeline } from "../core/pipeline.ts";
import { createNormalizer } from "../core/normalize.ts";
import {
  createResourceLog,
  RESOURCE_CSV_HEADER,
} from "../core/resource-log.ts";
import { nodeQueryRunner, nodeResourceSampler } from "../core/adapters-node.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(join(ROOT, "data", "pharos.db"), {
  readOnly: true,
});

// the real Node adapter (also used by the anchor/CLI) — exercises core/adapters-node.ts
const query = nodeQueryRunner(db);
const g = createGrounding(query);

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}  (got: ${JSON.stringify(actual)}${ok ? "" : `, expected: ${JSON.stringify(expected)}`})`,
  );
}

// severity of the scanned drug vs one shelf drug: severity | "NONE" (both known, no interaction) | null (abstain)
function sev(scanned: string, shelfName: string): string | null {
  const ix = g.lookupInteractions(scanned, [{ name: shelfName }]);
  if (ix.length) return ix[0].severity;
  return g.resolve(scanned) && g.resolve(shelfName) ? "NONE" : null;
}

console.log("Pharos verify ─ grounding + audit against pharos.db");

const pairCount = (
  db.prepare("SELECT COUNT(*) c FROM interactions").get() as { c: number }
).c;
const drugCount = (
  db.prepare("SELECT COUNT(*) c FROM drugs").get() as { c: number }
).c;
console.log(`  pairs=${pairCount}  drugs=${drugCount}`);
check(
  "pair count is in the expected range",
  pairCount > 150_000 && pairCount < 200_000,
  true,
);
check(
  "drug count is in the expected range",
  drugCount > 1_500 && drugCount < 2_500,
  true,
);

// grounded-chain fixtures (verified against the real CSVs 2026-05-31)
check(
  "Warfarin + Acetylsalicylic acid = Major",
  sev("Warfarin", "Acetylsalicylic acid"),
  "Major",
);
check(
  "Aspirin (synonym) + Warfarin = Major",
  sev("Aspirin", "Warfarin"),
  "Major",
);
check(
  "Coumadin (synonym) + aspirin (synonym) = Major",
  sev("Coumadin", "aspirin"),
  "Major",
);
check(
  "order-independent: Acetylsalicylic acid + Warfarin = Major",
  sev("Acetylsalicylic acid", "Warfarin"),
  "Major",
);

// citation provenance is populated
const asaIx = g.lookupInteractions("Aspirin", [{ name: "Warfarin" }])[0];
check("interaction carries DDInter source", asaIx?.source, "DDInter 2.0");
check("interaction carries a ddinter id", typeof asaIx?.ddinterIdA, "string");

// abstain path: an unknown drug resolves to null and yields no interactions (never guessed)
check(
  "unknown drug resolves to null (abstain)",
  g.resolve("definitely-not-a-real-drug-xyz"),
  null,
);
check(
  "lookup with an unknown drug yields no interactions",
  g.lookupInteractions("definitely-not-a-real-drug-xyz", [{ name: "Warfarin" }])
    .length,
  0,
);

// audit-log writer round-trip (fixed clock + in-memory sink)
const { sink, lines } = memorySink();
const audit = createAuditLog({
  deviceId: "test-1",
  sink,
  clock: { isoNow: () => "2026-06-01T00:00:00.000Z", monotonicMs: () => 42 },
});
audit.log("ddinter_lookup", {
  drug_a: "warfarin",
  drug_b: "acetylsalicylic acid",
  severity: "Major",
  ddinter_id_a: "DDInter1951",
  ddinter_id_b: "DDInter20",
});
const rec = JSON.parse(lines[0]) as Record<string, unknown>;
check("audit writes exactly one line", lines.length, 1);
check("audit record event", rec.event, "ddinter_lookup");
check("audit record device_id", rec.device_id, "test-1");
check(
  "audit record network_state defaults offline",
  rec.network_state,
  "offline",
);
check("audit record carries custom fields", rec.severity, "Major");

// --- scanPipeline orchestration: real pipeline + real grounding + a fake OCR/MedPsy engine ---
const fakeClock = {
  isoNow: () => "2026-06-01T00:00:00.000Z",
  monotonicMs: () => 0,
};
const makeEngine = (generic: string | null) => ({
  ocr: async () => ({ text: "ASPIRIN 81 mg", latencyMs: 10 }),
  normalize: async () => ({ generic }),
  explain: async () => ({
    text: "Aspirin with warfarin raises bleeding risk.",
  }),
});
async function runPipeline(generic: string | null) {
  const mem = memorySink();
  const a = createAuditLog({
    deviceId: "pipe",
    sink: mem.sink,
    clock: fakeClock,
  });
  const scanPipeline = createScanPipeline({
    engine: makeEngine(generic),
    grounding: g,
    audit: a,
    clock: fakeClock,
  });
  const result = await scanPipeline("img", [{ name: "Warfarin" }]);
  const events = mem.lines.map(
    (l) => (JSON.parse(l) as { event: string }).event,
  );
  return { result, events };
}

// happy path: aspirin label + warfarin shelf -> Major, cited, explained
const hp = await runPipeline("Aspirin");
check("pipeline: not abstained on known drug", hp.result.abstained, false);
check(
  "pipeline: returns Major interaction",
  hp.result.interactions[0]?.severity,
  "Major",
);
check(
  "pipeline: explanation populated",
  hp.result.explanation.length > 0,
  true,
);
check(
  "pipeline: emits scan_result event",
  hp.events.includes("scan_result"),
  true,
);
check(
  "pipeline: emits ddinter_lookup event",
  hp.events.includes("ddinter_lookup"),
  true,
);

// streaming handle: explain emits tokens via onToken; the final explanation still assembles fully
{
  const mem = memorySink();
  const a = createAuditLog({
    deviceId: "pipe",
    sink: mem.sink,
    clock: fakeClock,
  });
  const tokens = [
    "Aspirin ",
    "with ",
    "warfarin ",
    "raises ",
    "bleeding ",
    "risk.",
  ];
  const sp = createScanPipeline({
    engine: {
      ocr: async () => ({ text: "ASPIRIN 81 mg", latencyMs: 5 }),
      normalize: async () => ({ generic: "Aspirin" }),
      explain: async (_input, opts) => {
        let text = "";
        for (const t of tokens) {
          text += t;
          opts?.onToken?.(t);
        }
        return { text };
      },
    },
    grounding: g,
    audit: a,
    clock: fakeClock,
  });
  const received: string[] = [];
  const r = await sp("img", [{ name: "Warfarin" }], {
    onToken: (t) => received.push(t),
  });
  check(
    "stream: onToken fired for every token",
    received.length,
    tokens.length,
  );
  check(
    "stream: final explanation equals the joined tokens",
    r.explanation,
    tokens.join(""),
  );
}

// abstain — generic not extracted from OCR text
const ab1 = await runPipeline(null);
check(
  "pipeline: abstains when no generic extracted",
  ab1.result.abstained,
  true,
);
check(
  "pipeline: reason = unresolved_drug",
  ab1.result.abstainReason,
  "unresolved_drug",
);

// abstain — generic extracted but not in DDInter
const ab2 = await runPipeline("notarealdrugxyz");
check(
  "pipeline: abstains when drug not in DDInter",
  ab2.result.abstained,
  true,
);
check(
  "pipeline: reason = not_in_dataset",
  ab2.result.abstainReason,
  "not_in_dataset",
);

// --- normalizer: extract a known drug name from label text (model-free, against real vocab) ---
const normalizer = createNormalizer(g);
check(
  "normalize: 'ASPIRIN 81 mg' -> acetylsalicylic acid (synonym)",
  normalizer("ASPIRIN 81 mg").generic,
  "acetylsalicylic acid",
);
check(
  "normalize: multi-word 'Acetylsalicylic acid 100mg'",
  normalizer("Acetylsalicylic acid 100mg").generic,
  "acetylsalicylic acid",
);
check(
  "normalize: 'Take Warfarin 5mg daily' -> warfarin",
  normalizer("Take Warfarin 5mg daily").generic,
  "warfarin",
);
check(
  "normalize: no known drug -> null (abstain)",
  normalizer("just some random label text").generic,
  null,
);

// --- full solo chain with the REAL normalizer + real grounding (only OCR/MedPsy faked) ---
{
  const mem = memorySink();
  const fixedClock = {
    isoNow: () => "2026-06-01T00:00:00.000Z",
    monotonicMs: () => 0,
  };
  const a = createAuditLog({
    deviceId: "pipe",
    sink: mem.sink,
    clock: fixedClock,
  });
  const engine = {
    ocr: async () => ({ text: "ASPIRIN 81 mg tablets", latencyMs: 5 }),
    normalize: async (t: string) => normalizer(t),
    explain: async () => ({
      text: "Aspirin with warfarin raises bleeding risk.",
    }),
  };
  const sp = createScanPipeline({
    engine,
    grounding: g,
    audit: a,
    clock: fixedClock,
  });
  const r = await sp("img", [{ name: "Warfarin" }]);
  check("pipeline+real normalize: not abstained", r.abstained, false);
  check(
    "pipeline+real normalize: Major interaction",
    r.interactions[0]?.severity,
    "Major",
  );
}

// --- resource-log writer (CSV, docs/audit-log-schema.md) ---
{
  const mem = memorySink();
  const rl = createResourceLog({
    deviceId: "res-1",
    sink: mem.sink,
    clock: { isoNow: () => "2026-06-01T00:00:00.000Z", monotonicMs: () => 7 },
    sample: () => ({ cpuPct: 12.5, ramMb: 345, batteryPct: 88 }),
  });
  rl.header();
  rl.tick();
  rl.tick();
  check(
    "resource: header is the documented CSV columns",
    mem.lines[0],
    RESOURCE_CSV_HEADER,
  );
  check("resource: one row per tick", mem.lines.length, 3);
  check(
    "resource: row = clock + device + sample + network_state",
    mem.lines[1],
    "2026-06-01T00:00:00.000Z,7,res-1,12.5,345,88,offline",
  );
}

// node resource sampler (exercises core/adapters-node.ts on the real process)
{
  const s = nodeResourceSampler()();
  check("node sampler: ram_mb is positive", s.ramMb > 0, true);
  check(
    "node sampler: cpu_pct is a number >= -1",
    typeof s.cpuPct === "number" && s.cpuPct >= -1,
    true,
  );
  check("node sampler: battery is -1 on Node", s.batteryPct, -1);
}

db.close();
console.log(
  failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
