// Gate A — CONSUMER (phone / 2nd machine). Run after the provider prints its key:
//   PROVIDER_KEY=<key> MEDPSY_4B=/path node spike/gate-a-consumer.ts
// Delegates a completion to the provider's MedPsy-4B and logs time-to-connect + TTFT.
// PASS = coherent tokens arrive *from the provider* (fallbackToLocal:false, so a remote failure can't be masked).
import { loadModel, completion, unloadModel } from "@qvac/sdk";
import { MEDPSY_4B } from "./config.ts";

const providerPublicKey = process.env.PROVIDER_KEY;
if (!providerPublicKey)
  throw new Error("set PROVIDER_KEY=<provider public key>");

const tStart = Date.now();
const modelId = await loadModel({
  modelSrc: MEDPSY_4B,
  modelType: "llm",
  delegate: { providerPublicKey, timeout: 60_000, fallbackToLocal: false },
});
console.log(
  `connected + loaded in ${Date.now() - tStart}ms (first cold-DHT connect can be 15-45s)`,
);

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
    ? "GATE A: response received from PROVIDER ✓"
    : "GATE A: no tokens ✗",
);
await unloadModel({ modelId });
