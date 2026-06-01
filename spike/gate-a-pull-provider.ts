// Gate A · TIER 2 — SEED PROVIDER (laptop / anchor). Run on the bigger machine:
//   MEDPSY_4B=/path/to/model node spike/gate-a-pull-provider.ts
// Loads MedPsy-4B with seed:true (shares the weights over Hyperdrive) AND starts a QVAC
// provider, then prints the public key the consumer pulls from.
//
// WHAT THIS PROVES (with the pull-consumer): a fresh device with NO model pulls MedPsy over
// the LAN with WAN off — the project's one true unknown (spike/README.md, ../docs ... "offline
// model pull"). TIER 1 (delegation) is the separate gate-a-provider.ts / gate-a-consumer.ts.
//
// VERIFIED vs @qvac/sdk v0.11.0 .d.ts: loadModel has `seed?: boolean`; startQVACProvider returns
//   { success, error?, publicKey? }; modelSrc accepts `pear://<key>/<file>` (load-model JSDoc).
// NOT VERIFIED (this is the hypothesis under test): that the startQVACProvider publicKey is ALSO
//   the Hyperdrive key to pull the seeded model from. The .d.ts exposes no "seed -> drive key"
//   return, and getLoadedModelInfo carries no drive key. If the pull fails with this key, the
//   seed/share key is surfaced elsewhere (registry) — report that and we adjust.
import { loadModel, startQVACProvider } from "@qvac/sdk";
import type { ModelProgressUpdate } from "@qvac/sdk";
import { basename } from "node:path";
import { MEDPSY_4B } from "./config.ts";

// seed:true => share the loaded weights over Hyperdrive so a peer can pull them.
const modelId = await loadModel({
  modelSrc: MEDPSY_4B,
  modelType: "llm",
  seed: true,
  onProgress: (p: ModelProgressUpdate) => console.log("load:", p),
});
console.log("Provider model loaded + seeding:", modelId);

const res = await startQVACProvider({});
if (!res.success) throw new Error(`startQVACProvider failed: ${res.error}`);

console.log("\n=== PROVIDER PUBLIC KEY (candidate pull key) ===");
console.log(res.publicKey);
console.log(
  `\nConsumer command:\n  PULL_KEY=${res.publicKey} PULL_FILE=${basename(
    MEDPSY_4B,
  )} node spike/gate-a-pull-consumer.ts`,
);
console.log("\nSeeding — leave this open. Ctrl-C to stop.");
