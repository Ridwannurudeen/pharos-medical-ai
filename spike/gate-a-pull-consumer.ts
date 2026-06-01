// Gate A · TIER 2 — PULL CONSUMER (fresh device, NO model on disk). Run after the seed provider
// prints its key:
//   PULL_KEY=<key> PULL_FILE=medpsy-4b-q4_k_m-imat.gguf node spike/gate-a-pull-consumer.ts
//
// Pulls MedPsy-4B from the peer over Hyperdrive (pear://) with WAN OFF, loads it LOCALLY (no
// delegate — this is NOT remote inference; the weights come to this device), then runs one
// completion to prove the pulled model actually works. This is the project's one true unknown:
// a device with no model getting one from a peer, fully offline.
//
// PASS = onProgress ticks climb to 100% over the LAN (bytes really transfer) AND a coherent
// local completion follows, with WAN physically off.
//
// VERIFIED vs @qvac/sdk v0.11.0 .d.ts: modelSrc accepts `pear://<key>/<file>` (load-model JSDoc
//   example: "pear://<hyperdrive-key>/llama-7b.gguf"); completion() -> { tokenStream }.
// NOTE: pear:// path layout (does seeding expose the file at its basename?) is part of what the
//   run proves — override PULL_FILE if the seeded path differs.
import { loadModel, completion, unloadModel } from "@qvac/sdk";
import type { ModelProgressUpdate } from "@qvac/sdk";

const key = process.env.PULL_KEY;
const file = process.env.PULL_FILE ?? "medpsy-4b-q4_k_m-imat.gguf";
if (!key) throw new Error("set PULL_KEY=<provider public/drive key>");

const modelSrc = `pear://${key}/${file}`;
console.log(
  `pulling ${modelSrc} (WAN must be OFF — this should come from the peer)`,
);

const tStart = Date.now();
let lastPct = -1;
const modelId = await loadModel({
  modelSrc,
  modelType: "llm",
  onProgress: (p: ModelProgressUpdate) => {
    // log only on whole-percent change to keep it readable.
    const pct = Math.floor(p.percentage);
    if (pct !== lastPct) {
      lastPct = pct;
      console.log(`pull: ${pct}%`);
    }
  },
});
console.log(`\npulled + loaded in ${Date.now() - tStart}ms`);

const r = completion({
  modelId,
  history: [
    {
      role: "user",
      content:
        "Name one severe drug interaction with warfarin, in one sentence.",
    },
  ],
  stream: true,
});

let ttft = 0;
let out = "";
for await (const tok of r.tokenStream) {
  if (!ttft) ttft = Date.now() - tStart;
  out += tok;
  process.stdout.write(tok);
}
console.log(`\n\nTTFT ${ttft}ms · total ${Date.now() - tStart}ms`);
console.log(
  out.length
    ? "GATE A TIER 2: model PULLED from peer + ran locally ✓"
    : "GATE A TIER 2: pulled but no tokens ✗",
);
await unloadModel({ modelId });
