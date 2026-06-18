// Real QVAC-backed Engine for createScanPipeline: OCR via @qvac/sdk `ocr()`, explanation via MedPsy
// `completion()`. The model-free normalize step reuses createNormalizer (vocab match).
//
// Type-verified against @qvac/sdk v0.11.0's installed .d.ts (2026-05-31):
//   ocr() -> { blocks: Promise<OCRTextBlock[]> } (block.text); completion() -> { tokenStream, text }.
// RUN-VERIFIED 2026-06-14 on WSL2 (Ubuntu 24.04) against @qvac/sdk 0.12.2 via spike/validate-engine.ts:
//   real ocr() read an aspirin label, real explain() streamed a coherent MedPsy answer, grounded Major.
//   The worker does NOT start on native Windows (RPC_INIT_TIMEOUT, packaging gap); on Linux it only
//   needs the libatomic1 system lib (see spike/WSL-SETUP.md). This file is EXCLUDED from
//   `npm run typecheck` / CI because @qvac/sdk is a heavy native app-runtime dependency not in CI.
//
// Wiring (at app/anchor startup):
//   const grounding = createGrounding(queryRunner);                 // expo-sqlite or node:sqlite
//   const engine    = await createQvacEngine({ grounding, medpsyModelSrc });
//   const audit     = createAuditLog({ deviceId, sink, clock });
//   const scan      = createScanPipeline({ engine, grounding, audit, clock });
import { loadModel, ocr, completion, unloadModel } from "@qvac/sdk";
// OCR_LATIN_RECOGNIZER_1 is a real runtime export but is missing from @qvac/sdk v0.11.0's .d.ts
// (verified 2026-05-31 — runtime `typeof` = object). Suppress the single type-level gap.
// @ts-expect-error - runtime export absent from v0.11.0 type declarations
import { OCR_LATIN_RECOGNIZER_1 } from "@qvac/sdk";
import type { Engine } from "./pipeline.ts";
import type { Grounding } from "./grounding.ts";
import { createNormalizer } from "./normalize.ts";

const EXPLAIN_TIMEOUT_MS = 30_000;
const EXPLAIN_TIMEOUT = Symbol("explain-timeout");

// MedPsy is a reasoning model: it emits a <think>...</think> chain-of-thought before its answer.
// Return only the content after the (final) </think>; while a think block is still open, return "".
// Non-reasoning output (no tags) passes through unchanged.
function stripThinking(s: string): string {
  let out = s.replace(/<think>[\s\S]*?<\/think>/g, "");
  const open = out.indexOf("<think>");
  return open === -1 ? out : out.slice(0, open);
}

function groundedFallbackExplanation(
  interactions: {
    drugA: string;
    drugB: string;
    severity: string;
  }[],
): string {
  if (!interactions.length) {
    return "No documented interaction was found in DDInter 2.0 between this medication and the medicines on your shelf. This is not a guarantee of safety, so confirm with a pharmacist.";
  }

  const facts = interactions
    .map((ix) => `${ix.drugA} and ${ix.drugB}: ${ix.severity}`)
    .join("; ");
  return `DDInter 2.0 documents the following interaction: ${facts}. Treat this as a medication-safety flag and confirm with a pharmacist before combining these medicines.`;
}

async function nextTokenWithTimeout<T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number,
): Promise<IteratorResult<T> | typeof EXPLAIN_TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<typeof EXPLAIN_TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(EXPLAIN_TIMEOUT), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface QvacEngineConfig {
  /** for the model-free normalize step (vocabulary match against DDInter) */
  grounding: Grounding;
  /** path or pear:// key to the MedPsy GGUF (e.g. medpsy-1.7b-q4_k_m-imat.gguf) */
  medpsyModelSrc: string;
  /** optional: run explain() on a mesh peer (Gate A) instead of locally.
   *  Delegation resolves `modelSrc` on the PROVIDER's filesystem (verified cross-device 2026-06-16),
   *  so `modelSrc` here is the path to the model ON THE ANCHOR (e.g. its MedPsy-4B GGUF), NOT the
   *  phone's local path. cfg.medpsyModelSrc is used only for the non-delegated (solo) path. */
  delegate?: {
    providerPublicKey: string;
    /** path to the MedPsy GGUF ON THE ANCHOR (provider-side), e.g. ~/anchor/models/medpsy-4b-...gguf */
    modelSrc: string;
    timeout?: number;
    /** Keep false for mesh: true would try the anchor path locally (paths differ → fails). Handle
     *  anchor-down at the app level by running without a delegate (the solo on-device model). */
    fallbackToLocal?: boolean;
  };
}

export interface QvacEngine extends Engine {
  /** unload both models */
  close(): Promise<void>;
}

export async function createQvacEngine(
  cfg: QvacEngineConfig,
): Promise<QvacEngine> {
  const ocrModelId = await loadModel({
    modelSrc: OCR_LATIN_RECOGNIZER_1,
    modelType: "onnx-ocr",
  });
  // Solo: load the phone's local MedPsy. Mesh: delegate explain to the anchor — load the ANCHOR's
  // model by its provider-side path (delegation resolves modelSrc on the provider's disk, so the
  // phone's local path would be wrong; verified cross-device 2026-06-16).
  let llmModelId: Awaited<ReturnType<typeof loadModel>>;
  if (cfg.delegate) {
    const { modelSrc, ...delegate } = cfg.delegate;
    llmModelId = await loadModel({ modelSrc, modelType: "llm", delegate });
  } else {
    llmModelId = await loadModel({
      modelSrc: cfg.medpsyModelSrc,
      modelType: "llm",
    });
  }
  const normalize = createNormalizer(cfg.grounding);

  return {
    async ocr(image) {
      const t0 = Date.now();
      const result = ocr({
        modelId: ocrModelId,
        image,
        options: { paragraph: false },
      });
      const blocks = await result.blocks;
      const text = blocks
        .map((b: { text: string }) => b.text)
        .join(" ")
        .trim();
      return { text, latencyMs: Date.now() - t0 };
    },

    async normalize(text) {
      return normalize(text);
    },

    async explain({ interactions }, opts) {
      const facts = interactions.length
        ? interactions
            .map(
              (ix) =>
                `${ix.drugA} + ${ix.drugB} = ${ix.severity} (source: DDInter 2.0)`,
            )
            .join("; ")
        : "No documented interaction was found in DDInter 2.0.";
      const prompt =
        "You are a medication-safety assistant. In 2-3 plain sentences for a patient, explain ONLY " +
        "the following retrieved fact(s); do not add any interaction that is not listed. End by " +
        "advising they confirm with a pharmacist. This is educational information, not medical " +
        `advice. Facts: ${facts}`;
      const run = completion({
        modelId: llmModelId,
        history: [{ role: "user", content: prompt }],
        stream: true,
      });
      let text = "";
      let emitted = 0;
      const tokenIterator = run.tokenStream[Symbol.asyncIterator]();
      const deadline = Date.now() + EXPLAIN_TIMEOUT_MS;

      while (true) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          void Promise.resolve(tokenIterator.return?.()).catch(() => undefined);
          const fallback = groundedFallbackExplanation(interactions);
          if (emitted === 0) opts?.onToken?.(fallback);
          console.warn(
            `[Pharos] MedPsy explanation timed out after ${EXPLAIN_TIMEOUT_MS}ms; using grounded fallback`,
          );
          return { text: fallback };
        }

        const next = await nextTokenWithTimeout(tokenIterator, remaining);
        if (next === EXPLAIN_TIMEOUT) {
          void Promise.resolve(tokenIterator.return?.()).catch(() => undefined);
          const fallback = groundedFallbackExplanation(interactions);
          if (emitted === 0) opts?.onToken?.(fallback);
          console.warn(
            `[Pharos] MedPsy explanation timed out after ${EXPLAIN_TIMEOUT_MS}ms; using grounded fallback`,
          );
          return { text: fallback };
        }
        if (next.done) break;

        text += String(next.value ?? "");
        const cleaned = stripThinking(text);
        if (cleaned.length > emitted) {
          opts?.onToken?.(cleaned.slice(emitted));
          emitted = cleaned.length;
        }
      }

      const cleaned = stripThinking(text).trim();
      if (cleaned) return { text: cleaned };
      return { text: groundedFallbackExplanation(interactions) };
    },

    async close() {
      await unloadModel({ modelId: ocrModelId });
      await unloadModel({ modelId: llmModelId });
    },
  };
}
