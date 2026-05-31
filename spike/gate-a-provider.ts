// Gate A — PROVIDER (laptop / anchor). Run on the bigger machine:
//   MEDPSY_4B=/path/to/model node spike/gate-a-provider.ts
// Loads MedPsy-4B, starts a QVAC provider, and prints the public key for the consumer.
// Prereq: npm install @qvac/sdk  ·  signatures per ../docs/qvac-sdk-reference.md (v0.11.0).
import { loadModel, startQVACProvider } from "@qvac/sdk";
import { MEDPSY_4B } from "./config.ts";

const modelId = await loadModel({
  modelSrc: MEDPSY_4B,
  modelType: "llm",
  onProgress: (p) => console.log("load:", p),
});
console.log("Provider model loaded:", modelId);

// Optional firewall to restrict consumers: { mode: "allow", publicKeys: [consumerKey] }
const res = await startQVACProvider({});
if (!res.success) throw new Error(`startQVACProvider failed: ${res.error}`);

console.log("\n=== PROVIDER PUBLIC KEY (paste into the consumer) ===");
console.log(res.publicKey);
console.log("\nProvider running — leave this open. Ctrl-C to stop.");
