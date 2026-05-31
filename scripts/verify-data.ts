// Reproducibility + unit check. Run: npm run verify
// Exercises the REAL core modules (grounding + audit) against data/pharos.db, asserts known
// fixtures, and checks the abstain path. Exits non-zero on any failure (CI-friendly).
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGrounding, type QueryRunner } from "../core/grounding.ts";
import { createAuditLog, memorySink } from "../core/audit.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(join(ROOT, "data", "pharos.db"), {
  readOnly: true,
});

// node:sqlite adapter for the platform-agnostic QueryRunner the core expects.
// Cast at the driver boundary: our params are always SQLite scalars.
type SqlParam = string | number | bigint | null | Uint8Array;
const query: QueryRunner = (sql, params) =>
  db.prepare(sql).all(...(params as SqlParam[])) as Record<string, unknown>[];
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

db.close();
console.log(
  failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
