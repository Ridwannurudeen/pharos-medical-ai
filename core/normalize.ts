// Normalize — extract a known drug's generic name from OCR/label text by matching word n-grams
// against the DDInter vocabulary (drugs + synonyms). Model-free baseline for Latin-script labels:
// deterministic, and it can only ever return a drug that actually exists in the dataset (so it
// abstains rather than guesses). Translation of foreign brand names (QVAC nmt) is a later add.
import type { Grounding } from "./grounding.ts";

export function createNormalizer(grounding: Grounding, maxWords = 4) {
  return function normalize(text: string): { generic: string | null } {
    const words = text.split(/[^A-Za-z]+/).filter(Boolean);
    let best: string | null = null;
    // scan every start position; at each, prefer the LONGEST matching n-gram
    // (so "acetylsalicylic acid" wins over "acetylsalicylic" alone), then keep the longest overall.
    for (let i = 0; i < words.length; i++) {
      for (let n = Math.min(maxWords, words.length - i); n >= 1; n--) {
        const candidate = words.slice(i, i + n).join(" ");
        const resolved = grounding.resolve(candidate);
        if (resolved) {
          if (!best || resolved.length > best.length) best = resolved;
          break; // longest match at this start position found
        }
      }
    }
    return { generic: best };
  };
}
