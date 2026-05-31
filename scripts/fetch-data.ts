// Download the DDInter 2.0 CSVs into data/raw/ddinter/. Run: npm run fetch-data
// (Raw data + the built pharos.db are gitignored; regenerate locally with: npm run data)
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "raw", "ddinter");
const CODES = ["A", "B", "D", "H", "L", "P", "R", "V"];
const BASE =
  "https://ddinter2.scbdd.com/static/media/download/ddinter_downloads_code_";

mkdirSync(OUT, { recursive: true });
for (const c of CODES) {
  const url = `${BASE}${c}.csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(OUT, `ddinter_${c}.csv`), buf);
  console.log(`  fetched code ${c} (${(buf.length / 1024).toFixed(0)} KB)`);
}
console.log(`DDInter 2.0 staged in ${OUT}\nNext: npm run build-data`);
