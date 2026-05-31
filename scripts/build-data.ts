// Build data/pharos.db from the staged DDInter 2.0 CSVs.
// Run: npm run build-data   (Node >= 24 — uses built-in node:sqlite + TS type-stripping)
// Design + verified data facts: docs/data-pipeline.md
import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(ROOT, "data", "raw", "ddinter");
const DB_PATH = join(ROOT, "data", "pharos.db");

// MUST stay identical to core's norm() (core/text.ts) — the build key and the runtime lookup key must match.
const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

const SEVERITY_RANK: Record<string, number> = {
  Major: 4,
  Moderate: 3,
  Minor: 2,
  Unknown: 1,
};
const isSeverity = (s: string): boolean => s in SEVERITY_RANK;

// Curated colloquial/brand -> INN synonyms. Each target is validated against the real drug list below;
// any whose target isn't in DDInter is dropped and reported (so this list can never inject a bad mapping).
const SYNONYM_SEED: Array<[syn: string, targetInn: string]> = [
  ["aspirin", "Acetylsalicylic acid"],
  ["asa", "Acetylsalicylic acid"],
  ["coumadin", "Warfarin"],
  ["tylenol", "Paracetamol"],
  ["acetaminophen", "Paracetamol"],
  ["panadol", "Paracetamol"],
  ["advil", "Ibuprofen"],
  ["nurofen", "Ibuprofen"],
  ["motrin", "Ibuprofen"],
  ["nexium", "Esomeprazole"],
  ["prilosec", "Omeprazole"],
  ["glucophage", "Metformin"],
  ["ventolin", "Salbutamol"],
  ["albuterol", "Salbutamol"],
  ["lipitor", "Atorvastatin"],
  ["zoloft", "Sertraline"],
];

type DrugRec = { name: string; id: string };
type PairRec = {
  a: string;
  b: string;
  severity: string;
  idA: string;
  idB: string;
};

const drugs = new Map<string, DrugRec>(); // normalized -> {display name, ddinter id}
const pairs = new Map<string, PairRec>(); // "normA|normB" (ordered) -> record
let rawRows = 0;
let skipped = 0;

// Minimal RFC-4180 line parser: handles quoted fields with embedded commas and "" escapes.
// ~1,252 DDInter rows quote names like "Thyroid, porcine" — a naive split(",") corrupts them.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const files = readdirSync(RAW_DIR).filter((f) => f.endsWith(".csv"));
if (files.length === 0)
  throw new Error(
    `No DDInter CSVs in ${RAW_DIR} — see data/README.md to stage them.`,
  );

for (const file of files) {
  const text = readFileSync(join(RAW_DIR, file), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("DDInterID_A")) continue;
    const parts = parseCsvLine(line);
    if (parts.length !== 5) {
      skipped++;
      continue;
    }
    const [idA, drugA, idB, drugB, level] = parts;
    if (!isSeverity(level)) {
      skipped++;
      continue;
    }
    rawRows++;

    const na = norm(drugA),
      nb = norm(drugB);
    if (!drugs.has(na)) drugs.set(na, { name: drugA.trim(), id: idA });
    if (!drugs.has(nb)) drugs.set(nb, { name: drugB.trim(), id: idB });
    if (na === nb) continue; // a drug can't interact with itself in our model

    // order the pair so the key is stable regardless of row direction
    const [a, b, aId, bId] = na < nb ? [na, nb, idA, idB] : [nb, na, idB, idA];
    const key = `${a}|${b}`;
    const existing = pairs.get(key);
    if (!existing || SEVERITY_RANK[level] > SEVERITY_RANK[existing.severity]) {
      pairs.set(key, { a, b, severity: level, idA: aId, idB: bId });
    }
  }
}

// ---- write the database (idempotent: rebuild from scratch each run) ----
if (!existsSync(join(ROOT, "data")))
  mkdirSync(join(ROOT, "data"), { recursive: true });
rmSync(DB_PATH, { force: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE interactions (
    drug_a TEXT NOT NULL, drug_b TEXT NOT NULL, severity TEXT NOT NULL,
    ddinter_id_a TEXT NOT NULL, ddinter_id_b TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'DDInter 2.0'
  );
  CREATE TABLE drugs (name TEXT NOT NULL, normalized TEXT NOT NULL, ddinter_id TEXT NOT NULL);
  CREATE TABLE synonyms (synonym TEXT NOT NULL, normalized TEXT NOT NULL, src TEXT NOT NULL);
`);

db.exec("BEGIN");
const insPair = db.prepare(
  "INSERT INTO interactions (drug_a, drug_b, severity, ddinter_id_a, ddinter_id_b) VALUES (?, ?, ?, ?, ?)",
);
for (const p of pairs.values()) insPair.run(p.a, p.b, p.severity, p.idA, p.idB);

const insDrug = db.prepare(
  "INSERT INTO drugs (name, normalized, ddinter_id) VALUES (?, ?, ?)",
);
for (const [n, rec] of drugs) insDrug.run(rec.name, n, rec.id);

const insSyn = db.prepare(
  "INSERT INTO synonyms (synonym, normalized, src) VALUES (?, ?, 'curated')",
);
const synKept: string[] = [],
  synDropped: string[] = [];
for (const [syn, target] of SYNONYM_SEED) {
  const nt = norm(target);
  if (drugs.has(nt)) {
    insSyn.run(norm(syn), nt);
    synKept.push(syn);
  } else synDropped.push(`${syn}->${target}`);
}
db.exec("COMMIT");

db.exec("CREATE UNIQUE INDEX idx_pair ON interactions(drug_a, drug_b)");
db.exec("CREATE UNIQUE INDEX idx_drug_norm ON drugs(normalized)");
db.exec("CREATE INDEX idx_syn ON synonyms(synonym)");

// ---- build report (reproducibility artifact: compare against docs/data-pipeline.md) ----
const hist: Record<string, number> = {
  Major: 0,
  Moderate: 0,
  Minor: 0,
  Unknown: 0,
};
for (const p of pairs.values()) hist[p.severity]++;
db.exec("VACUUM");
db.close();

console.log("Pharos data build ─ pharos.db");
console.log(`  source files     : ${files.length} CSVs`);
console.log(`  raw rows parsed  : ${rawRows}  (skipped malformed: ${skipped})`);
console.log(`  distinct pairs   : ${pairs.size}`);
console.log(`  distinct drugs   : ${drugs.size}`);
console.log(
  `  severity         : Major ${hist.Major} · Moderate ${hist.Moderate} · Minor ${hist.Minor} · Unknown ${hist.Unknown}`,
);
console.log(`  synonyms kept    : ${synKept.length} (${synKept.join(", ")})`);
if (synDropped.length)
  console.log(`  synonyms dropped : ${synDropped.join(", ")}`);
console.log(`  wrote            : ${DB_PATH}`);

// guardrails so a broken/empty extract fails loudly instead of shipping a bad DB.
// Verified-correct extract (2026-05-31): 0 skipped, 160,235 pairs, 1,939 drugs.
if (skipped > 0)
  throw new Error(
    `${skipped} rows failed to parse — the CSV parser is dropping quoted-comma rows. Fix before shipping.`,
  );
if (pairs.size < 150_000)
  throw new Error(
    `Only ${pairs.size} pairs — expected ~160k. Check the raw CSVs.`,
  );
if (drugs.size < 1_500)
  throw new Error(
    `Only ${drugs.size} drugs — expected ~1.9k. Check the raw CSVs.`,
  );
