// Gate B — GROUNDED CHAIN (phone, offline). Run with a real label photo:
//   MEDPSY_1_7B=/path node spike/gate-b-grounded.ts <label-image.jpg>
// OCR -> normalize + DDInter lookup (the REAL pharos.db we built) -> MedPsy explains the retrieved fact.
// PASS = a textbook pair (e.g. aspirin label + Warfarin shelf) returns a correct, severity-graded,
// cited warning; an out-of-dataset drug hits the ABSTAIN path. Run in airplane mode after models cache.
import { loadModel, ocr, completion, unloadModel } from "@qvac/sdk";
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MEDPSY_1_7B, OCR_MODEL } from "./config.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const imagePath = process.argv[2];
if (!imagePath)
  throw new Error("usage: node spike/gate-b-grounded.ts <label-image>");

const SHELF = ["Warfarin"]; // pretend this is the user's saved medication shelf
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// --- the grounding layer: identical logic to scripts/verify-data.ts, against the real DB ---
const db = new DatabaseSync(join(ROOT, "data", "pharos.db"), {
  readOnly: true,
});
function resolve(name: string): string | null {
  const n = norm(name);
  const d = db
    .prepare("SELECT normalized FROM drugs WHERE normalized=?")
    .get(n) as { normalized: string } | undefined;
  if (d) return d.normalized;
  const s = db
    .prepare("SELECT normalized FROM synonyms WHERE synonym=?")
    .get(n) as { normalized: string } | undefined;
  return s ? s.normalized : null;
}
function lookup(x: string, y: string) {
  const a0 = resolve(x),
    b0 = resolve(y);
  if (!a0 || !b0) return null;
  const [a, b] = a0 < b0 ? [a0, b0] : [b0, a0];
  return db
    .prepare(
      "SELECT severity, ddinter_id_a, ddinter_id_b FROM interactions WHERE drug_a=? AND drug_b=?",
    )
    .get(a, b) as
    | { severity: string; ddinter_id_a: string; ddinter_id_b: string }
    | undefined;
}

// 1) OCR the label
const t0 = Date.now();
const ocrModel = await loadModel({ modelSrc: OCR_MODEL, modelType: "ocr" });
const ocrRes = ocr({
  modelId: ocrModel,
  image: imagePath,
  options: { paragraph: false },
});
const blocks = await ocrRes.blocks;
const text = blocks.map((b: { text: string }) => b.text).join(" ");
console.log(`OCR (${Date.now() - t0}ms): "${text}"`);
await unloadModel({ modelId: ocrModel });

// 2) normalize (spike: try the whole string + each token) and look up vs the shelf
let resolved: string | null = null;
for (const c of [text, ...text.split(/\s+/)]) {
  if (resolve(c)) {
    resolved = c;
    break;
  }
}
if (!resolved) {
  console.log(
    "GATE B: scanned drug did not resolve → ABSTAIN ✓ (correct when the label isn't in DDInter)",
  );
  process.exit(0);
}
const hits = SHELF.map((s) => ({ shelf: s, row: lookup(resolved!, s) })).filter(
  (h) => h.row,
);
console.log(
  `resolved "${resolved}" · shelf ${JSON.stringify(SHELF)} · interactions:`,
  hits.map((h) => `${h.shelf}=${h.row!.severity}`),
);

// 3) MedPsy explains ONLY the retrieved fact (it must not invent interactions)
const fact = hits.length
  ? `DDInter 2.0 documents an interaction between ${resolved} and ${hits[0].shelf} with severity "${hits[0].row!.severity}".`
  : `No documented interaction between ${resolved} and the shelf was found in DDInter 2.0.`;
const prompt = `You are a medication-safety assistant. In 2-3 plain sentences for a patient, explain ONLY this retrieved fact. Do not add any interaction not stated. End by advising they confirm with a pharmacist. Fact: ${fact}`;

const llm = await loadModel({ modelSrc: MEDPSY_1_7B, modelType: "llm" });
const r = completion({
  modelId: llm,
  history: [{ role: "user", content: prompt }],
  stream: true,
});
let ttft = 0;
for await (const tok of r.tokenStream) {
  if (!ttft) ttft = Date.now() - t0;
  process.stdout.write(tok);
}
console.log(
  `\n\nTTFT ${ttft}ms · total ${Date.now() - t0}ms · source: DDInter 2.0`,
);
console.log(
  hits.length
    ? "GATE B: cited interaction explained ✓"
    : "GATE B: no-interaction path ✓",
);
await unloadModel({ modelId: llm });
