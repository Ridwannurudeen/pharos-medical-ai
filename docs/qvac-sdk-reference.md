# QVAC SDK — verified API reference (for Pharos)

> **Purpose:** the function names/signatures we will call, confirmed against the live docs and the `tetherto/qvac` source — *not* from memory. Every doc in this repo warns "confirm signatures before writing SDK code"; this is that confirmation.
>
> **Verified:** 2026-05-31 · **SDK version:** v0.11.0 (latest, per the API Summary page) · **Sources:**
> - API reference — https://docs.qvac.tether.io/reference/api/
> - Quickstart — https://docs.qvac.tether.io/sdk/getting-started/quickstart/
> - Delegated inference — https://docs.qvac.tether.io/sdk/p2p-capabilities/delegated-inference *(repo: `docs/website/content/docs/p2p-capabilities/delegated-inference.mdx`)*
> - Model download lifecycle — `docs/website/content/docs/models/download-lifecycle.mdx`
> - OCR example — https://docs.qvac.tether.io/sdk/examples/ai-tasks/ocr/
> - Repo — https://github.com/tetherto/qvac
>
> Confidence is marked per item: ✅ verified verbatim · ⚠️ verified but signature not seen in full · ❓ still a spike unknown.

## Install & import

```bash
npm install @qvac/sdk
```

```js
import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";
```

✅ The SDK exposes **constants for preconfigured models** (e.g. `LLAMA_3_2_1B_INST_Q4_0`) that resolve through the distributed registry. ❓ **The exact MedPsy-1.7B / MedPsy-4B constant names (or `pear://` keys) are NOT yet confirmed** — check the model registry / HF card during the spike.

## Load a model — `loadModel` ✅

```ts
loadModel(options: LoadModelOptions, rpcOptions?: RPCOptions): Promise<string> & { requestId: string }
```
- `modelSrc: string` — a model constant, **local path, remote URL, or `pear://` Hyperdrive key** (this is how a device-to-device / peer-pulled model is referenced).
- `modelType: "llm" | "whisper" | "embeddings" | "nmt" | "tts" | "ocr" | "parakeet" | "diffusion"`
- `modelConfig?: object` — engine-specific (e.g. `ctx_size`; for OCR, language list).
- `onProgress?: (progress) => void` — download progress.
- `delegate?: {...}` — see **Delegated inference** below.
- Returns the `modelId` string; the returned promise also carries a synchronous `.requestId` (wire a cancel before the first progress event).

Cleanup: `unloadModel({ modelId })`.

## Text completion — `completion` ✅ (canonical streaming shape)

```ts
completion(params: CompletionParams): CompletionRun
```
```js
const result = completion({ modelId, history, stream: true });
for await (const token of result.tokenStream) {
  process.stdout.write(token);
}
```
- `history: Array<{ role: string; content: string }>`
- `stream: boolean` (default true), `captureThinking?: boolean`, `tools?: [...]`
- **Consume via `result.tokenStream`** (async iterable) — confirmed in the quickstart.
- ⚠️ The API-reference page also mentions `result.events` / `result.final` (aggregated content + stats). `tokenStream` is the documented happy path; treat `.final` as **unconfirmed** until we see it in an example. For audit-log TTFT/TPS we likely need the stats object — **resolve during the spike.**

## OCR — `ocr` ✅

```js
ocr({ modelId, image: imagePath, options: { paragraph: false } })
```
- `image: string | Buffer` — **file path or in-memory buffer**.
- Returns `{ blocks: Promise<Block[]>, blockStream: AsyncGenerator, stats: Promise }`.
- `Block` = `{ text: string, bbox?: number[], confidence?: number }`.
- Load with `modelType: "ocr"`; example model constant **`OCR_LATIN_RECOGNIZER_1`** (Latin-script — matches our "any Latin-script language" scope), language list configured at load (e.g. `["en"]`). ❓ Confirm Spanish/multi-language label support during Gate B.

## Embeddings & RAG (for grounding over DDInter) ⚠️

```ts
embed({ modelId, text }, rpcOptions?): Promise<{ embedding: number[]; stats? }> & { requestId }
ragIngest({ modelId, documents: string[], workspace?, onProgress? }): Promise<{ droppedIndices, processed }>
ragSearch({ modelId, query, topK, workspace? }): Promise<RagSearchResult[]>
```
Note: our grounding is primarily a **deterministic DDInter lookup keyed by RxCUI**, not vector RAG. `ragSearch` is a secondary path (fuzzy synonym matching) — keep the authoritative interaction retrieval exact, not embedding-based.

## Delegated inference (mesh tier) — ⚠️ **plan corrections inside**

Provider:
```ts
startQVACProvider(params: ProvideParams): Promise<{ success: boolean; publicKey?: string; error?: string; type: "provide" }>
stopQVACProvider(): Promise<...>
```
```js
const response = await startQVACProvider({
  firewall: allowedConsumerPublicKey
    ? { mode: "allow", publicKeys: [allowedConsumerPublicKey] }
    : undefined,
});
console.log(`Provider Public Key: ${response.publicKey}`);
```

Consumer — **delegation is configured at model-load time, NOT via a manual `dht.connect`:**
```js
const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llm",
  delegate: {
    providerPublicKey,      // required
    timeout: 60_000,        // first call: cold-DHT bootstrap is 15–45s
    fallbackToLocal: true,  // run locally if delegation fails
    // forceNewConnection: true  // don't reuse a cached connection
  },
});
// then call completion()/transcribe()/translate() exactly like local
```

### ⚠️ Corrections to `day1-spike.md` / the mesh plan (verified today)

1. **No manual `dht.connect(publicKey)` in our code.** The docs say the consumer *internally* opens `dht.connect(providerPublicKey)`, but the **public API surface is `loadModel({ delegate: { providerPublicKey }})`**. Our Gate A step 2 should call `loadModel` with `delegate`, not a standalone connect.
2. **Mid-stream auto-failover is NOT supported.** Verbatim from the docs: *"Consumers do not handle reconnection automatically yet. If the provider restarts, restart the consumer."* The plan's "if the anchor drops mid-answer, another peer resumes automatically" is **not** an SDK feature today. What we actually have:
   - `fallbackToLocal: true` → on delegation failure, the call runs on the **local** model (graceful degradation, not peer-to-peer failover).
   - `forceNewConnection` + a manual reconnect we implement ourselves.
   → **Reframe the demo claim:** "if the bigger model drops, Pharos falls back to the on-device model" (true) instead of "another peer seamlessly takes over" (not true OOTB). Decide at the spike whether to build manual re-delegation.
3. **Cold-start latency is real:** first connect 15–45s, subsequent calls sub-second. Budget this in the demo (warm the connection before recording) and log `time-to-connect` per Gate A.

## Distributed model registry / offline pull ⚠️❓

- Registry query functions exist: `modelRegistryList()`, `modelRegistrySearch({ modelType?, engine?, quantization? })`, `modelRegistryGetModel(registryPath, registrySource)`.
- A model is **fetched and loaded by `loadModel({ modelSrc })`** where `modelSrc` is a `pear://` Hyperdrive key (peer-to-peer), URL, or path; or pre-fetched with `downloadAsset({ assetSrc })`.
- **Downloads are resumable by default** (partial files on disk; resume by re-calling the same `loadModel`/`downloadAsset`; `cancel({ requestId })` to pause, `clearCache: true` to discard).
- ❓ **Gate A unknown that remains:** that a device with **no model** pulls MedPsy from a peer with **WAN physically off** (LAN/hotspot only) and runs it. Docs confirm the mechanism exists; cross-device offline pull is exactly what the spike must prove.

## Cancellation ✅
```ts
cancel({ requestId })                 // pause one call (keeps partial file)
cancel({ requestId, clearCache: true })
cancel({ modelId })                   // broad: cancels every in-flight op on the model
```

## Net effect on Pharos
- **Solo tier (Gate B):** all signatures we need are confirmed — `loadModel(ocr)` → `ocr()` → DDInter lookup (our code) → `loadModel(llm)` → `completion().tokenStream`. No blockers from the SDK side; risk is OCR language coverage + normalization hit-rate.
- **Mesh tier (Gate A):** delegation API confirmed but **simpler and weaker than the plan assumed** — no auto peer-failover. The offline cross-device model pull is still the one true unknown the spike must settle.
