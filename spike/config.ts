// Model handles for the Day-1 spike. THROWAWAY code (see docs ../day1-spike.md / Downloads).
// Fill these after downloading the GGUFs, or pass via env vars at run time.
//
// ⚠️ The MedPsy model constant / path / pear:// key is NOT yet confirmed — grab the exact handle
// from the Hugging Face model card (https://huggingface.co/qvac) when you download the models.
// Signatures below are doc-verified (../docs/qvac-sdk-reference.md, SDK v0.11.0) but NOT yet run —
// proving they run cross-device/offline is the whole point of the spike.

export const MEDPSY_4B =
  process.env.MEDPSY_4B ?? "FILL_ME:/path/or/pear-key/to/MedPsy-4B";
export const MEDPSY_1_7B =
  process.env.MEDPSY_1_7B ?? "FILL_ME:/path/or/pear-key/to/MedPsy-1.7B";

// OCR model identifier from the OCR example. Confirm it's a string id vs an imported SDK constant.
export const OCR_MODEL = process.env.OCR_MODEL ?? "OCR_LATIN_RECOGNIZER_1";
