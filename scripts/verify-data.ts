// Reproducibility check for data/pharos.db. Run: npm run verify
// Asserts the grounded chain returns the right severity for known fixtures and abstains on unknowns.
// Exits non-zero on any failure (CI-friendly).
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = join(ROOT, "data", "pharos.db");
const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

const db = new DatabaseSync(DB_PATH, { readOnly: true });

// resolve a free-text drug name to a canonical normalized name (synonym layer, then the drug list); null = not in scope.
function resolve(name: string): string | null {
  const n = norm(name);
  const drug = db
    .prepare("SELECT normalized FROM drugs WHERE normalized = ?")
    .get(n) as { normalized: string } | undefined;
  if (drug) return drug.normalized;
  const syn = db
    .prepare("SELECT normalized FROM synonyms WHERE synonym = ?")
    .get(n) as { normalized: string } | undefined;
  return syn ? syn.normalized : null;
}

function lookup(drugX: string, drugY: string): string | null {
  const a0 = resolve(drugX),
    b0 = resolve(drugY);
  if (!a0 || !b0) return null; // abstain — at least one drug not in scope
  const [a, b] = a0 < b0 ? [a0, b0] : [b0, a0];
  const row = db
    .prepare(
      "SELECT severity FROM interactions WHERE drug_a = ? AND drug_b = ?",
    )
    .get(a, b) as { severity: string } | undefined;
  return row ? row.severity : "NONE"; // NONE = both known, no documented interaction
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}  (got: ${JSON.stringify(actual)}${ok ? "" : `, expected: ${JSON.stringify(expected)}`})`,
  );
}

console.log("Pharos data verify ─ pharos.db");

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
  lookup("Warfarin", "Acetylsalicylic acid"),
  "Major",
);
check(
  "Aspirin (synonym) + Warfarin = Major",
  lookup("Aspirin", "Warfarin"),
  "Major",
);
check(
  "Coumadin (synonym) + Aspirin (synonym) = Major",
  lookup("Coumadin", "aspirin"),
  "Major",
);
check(
  "order-independent: Acetylsalicylic acid + Warfarin = Major",
  lookup("Acetylsalicylic acid", "Warfarin"),
  "Major",
);

// abstain path: an unknown drug must resolve to null (never guessed)
check(
  "unknown drug resolves to null (abstain)",
  resolve("definitely-not-a-real-drug-xyz"),
  null,
);
check(
  "lookup with an unknown drug abstains",
  lookup("definitely-not-a-real-drug-xyz", "Warfarin"),
  null,
);

db.close();
console.log(
  failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
