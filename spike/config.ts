// Model handles for the Day-1 spike. THROWAWAY code (see ../day1-spike.md, spike/README.md).
//
// Verified 2026-05-31 against @qvac/sdk v0.11.0 (unpacked tarball):
//  - completion()/ocr()/loadModel()/startQVACProvider() are real exports; completion() returns
//    { tokenStream, text, ... } (our usage is correct).
//  - OCR_LATIN_RECOGNIZER_1 is a model-descriptor OBJECT exported by the SDK — import it, don't
//    pass the string name.
//  - MedPsy is NOT a built-in SDK constant: download the GGUF and pass its LOCAL path as modelSrc
//    (local path keeps Gate B offline). HF repos: qvac/MedPsy-1.7B-GGUF, qvac/MedPsy-4B-GGUF.
import { OCR_LATIN_RECOGNIZER_1 } from "@qvac/sdk";

// Downloaded GGUF paths — recommended quant Q4_K_M (see spike/README.md to fetch). Override via env.
//   1.7B: medpsy-1.7b-q4_k_m-imat.gguf  (~1.28 GB, phone)
//   4B:   medpsy-4b-q4_k_m-imat.gguf    (~2.72 GB, laptop anchor)
export const MEDPSY_4B =
  process.env.MEDPSY_4B ?? "FILL_ME:/abs/path/to/medpsy-4b-q4_k_m-imat.gguf";
export const MEDPSY_1_7B =
  process.env.MEDPSY_1_7B ??
  "FILL_ME:/abs/path/to/medpsy-1.7b-q4_k_m-imat.gguf";

// OCR: the SDK's model descriptor object (not a string id).
export const OCR_MODEL = OCR_LATIN_RECOGNIZER_1;
