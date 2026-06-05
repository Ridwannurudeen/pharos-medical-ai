// Real QVAC-backed Engine for createScanPipeline: OCR via @qvac/sdk `ocr()`, explanation via MedPsy
// `completion()`. The model-free normalize step reuses createNormalizer (vocab match).
//
// Type-verified against @qvac/sdk v0.11.0's installed .d.ts (2026-05-31):
//   ocr() -> { blocks: Promise<OCRTextBlock[]> } (block.text); completion() -> { tokenStream, text }.
// NOT yet run-verified: the SDK's native inference worker would not start on this Windows box
// (packaging gap — ggml backend module fails to load). Validate on the first real-runtime run
// (phone dev build / Linux / WSL). This file is EXCLUDED from `npm run typecheck` / CI because
// @qvac/sdk is a heavy native app-runtime dependency not installed in CI.
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

export interface QvacEngineConfig {
  /** for the model-free normalize step (vocabulary match against DDInter) */
  grounding: Grounding;
  /** path or pear:// key to the MedPsy GGUF (e.g. medpsy-1.7b-q4_k_m-imat.gguf) */
  medpsyModelSrc: string;
  /** optional: run explain() on a mesh peer (Gate A) instead of locally */
  delegate?: {
    providerPublicKey: string;
    timeout?: number;
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
  const llmModelId = await loadModel({
    modelSrc: cfg.medpsyModelSrc,
    modelType: "llm",
    ...(cfg.delegate ? { delegate: cfg.delegate } : {}),
  });
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
      for await (const token of run.tokenStream) {
        text += token;
        opts?.onToken?.(token);
      }
      return { text: text.trim() };
    },

    async close() {
      await unloadModel({ modelId: ocrModelId });
      await unloadModel({ modelId: llmModelId });
    },
  };
}
