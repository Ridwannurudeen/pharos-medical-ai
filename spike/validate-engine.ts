// Run-validation for the REAL shipping engine — core/engine-qvac.ts wired through createScanPipeline.
// Unlike gate-b-grounded.ts (which inlines its own SDK + lookup calls), this imports the EXACT code
// that ships in the app, so a PASS here proves engine-qvac.ts's ocr()/explain() actually run.
//
//   MEDPSY_1_7B=/path/to/medpsy-1.7b-q4_k_m-imat.gguf node spike/validate-engine.ts [label-image]
//
// Defaults: image = models/label-aspirin.png, MedPsy = models/medpsy-1.7b-q4_k_m-imat.gguf.
// PASS = aspirin label + Warfarin shelf returns NOT-abstained with severity "Major", a non-empty
// streamed explanation, and a live audit trail. Run on a NON-Windows host (Linux/Mac/WSL) or the
// phone — the QVAC worker will not start on Windows (RPC_INIT_TIMEOUT). First run downloads the OCR
// recognizer + CRAFT detector from S3 (~15MB, registry models); MedPsy is local. Cache them once,
// then this runs offline.
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createQvacEngine } from "../core/engine-qvac.ts";
import { createScanPipeline } from "../core/pipeline.ts";
import { createGrounding } from "../core/grounding.ts";
import { createAuditLog, memorySink } from "../core/audit.ts";
import { nodeQueryRunner, nodeClock } from "../core/adapters-node.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const image = process.argv[2] ?? join(ROOT, "models", "label-aspirin.png");
const medpsyModelSrc =
  process.env.MEDPSY_1_7B ??
  join(ROOT, "models", "medpsy-1.7b-q4_k_m-imat.gguf");
const SHELF = [{ name: "Warfarin" }];

const db = new DatabaseSync(join(ROOT, "data", "pharos.db"), {
  readOnly: true,
});
const grounding = createGrounding(nodeQueryRunner(db));
const clock = nodeClock();
const { sink, lines } = memorySink();
const audit = createAuditLog({ deviceId: "validate-engine", sink, clock });

console.log(
  "loading engine (OCR recognizer+detector from S3 on first run, MedPsy local)...",
);
const engine = await createQvacEngine({ grounding, medpsyModelSrc, audit });
const scanPipeline = createScanPipeline({ engine, grounding, audit, clock });

console.log(
  `\nscanning ${image} against shelf ${JSON.stringify(SHELF.map((s) => s.name))}\n`,
);
process.stdout.write("explanation: ");
const result = await scanPipeline(image, SHELF, {
  onToken: (t) => process.stdout.write(t),
});

console.log("\n\n--- result ---");
console.log("OCR rawText :", JSON.stringify(result.scan.rawText));
console.log(
  "generic     :",
  result.scan.generic,
  "· matched:",
  result.scan.matched,
);
console.log("abstained   :", result.abstained, result.abstainReason ?? "");
for (const ix of result.interactions)
  console.log(
    `interaction : ${ix.drugA} + ${ix.drugB} = ${ix.severity} (${ix.source}, ${ix.ddinterIdA}/${ix.ddinterIdB})`,
  );
console.log("latencyMs   :", result.latencyMs);
console.log(`\naudit trail (${lines.length} events):`);
for (const l of lines) console.log("  " + l);

const pass =
  result.abstained === false &&
  result.interactions[0]?.severity === "Major" &&
  result.explanation.trim().length > 0;
console.log(
  `\nVALIDATE ENGINE: ${pass ? "PASS ✓ — engine-qvac ocr()+explain() ran, grounded Major returned" : "FAIL ✗"}`,
);

await engine.close();
db.close();

// Persist the full run (model_load … scan … model_unload) as a committed demo-run artifact.
const auditOut = join(ROOT, "docs", "sample-audit-run.jsonl");
writeFileSync(auditOut, lines.join("\n") + "\n");
console.log(`\nwrote ${auditOut} (${lines.length} events)`);

process.exit(pass ? 0 : 1);
