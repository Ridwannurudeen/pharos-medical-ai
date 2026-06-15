// Pharos core — the engine API the app (Lane B) calls.
//
// THIS IS A MOCK. Every function returns canned, contract-shaped data so the app can be built
// end-to-end before the real QVAC-backed engine lands. Real implementations land behind these
// EXACT signatures (OCR -> normalize -> DDInter lookup -> MedPsy explain). Do not change a
// signature without announcing it (see docs/lane-app.md).
import type { ScanResult, Interaction, ShelfItem } from "./types.ts";
import type { ExplainOptions } from "./pipeline.ts";
import { createAuditLog, memorySink } from "./audit.ts";

export * from "./types.ts";
export * from "./grounding.ts";
export * from "./audit.ts";
export * from "./pipeline.ts";
export * from "./normalize.ts";
export * from "./resource-log.ts";
export { norm } from "./text.ts";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ---- audit: the REAL writer (core/audit.ts) with an in-memory sink for the mock engine.
// The app/anchor swap in a file sink (fs / expo-file-system) at wiring time. ----
const _mem = memorySink();
const _t0 = Date.now();
export const audit = createAuditLog({
  deviceId: "mock",
  sink: _mem.sink,
  clock: {
    isoNow: () => new Date().toISOString(),
    monotonicMs: () => Date.now() - _t0,
  },
});
/** test/inspection only: the raw JSONL lines written so far */
export const auditLines = _mem.lines;

// ---- canned fixtures so every screen has data: result card, no-interaction, abstain, delegated ----
const WARFARIN_ASA: Interaction = {
  drugA: "Aspirin",
  drugB: "Warfarin",
  severity: "Major",
  source: "DDInter 2.0",
  ddinterIdA: "DDInter20",
  ddinterIdB: "DDInter1951",
};

export const mockScenarios: Record<
  "major" | "none" | "abstain" | "delegated",
  ScanResult
> = {
  major: {
    scan: {
      rawText: "ASPIRIN 81 mg",
      generic: "acetylsalicylic acid",
      matched: true,
    },
    interactions: [WARFARIN_ASA],
    explanation:
      "Taking aspirin together with warfarin (a blood thinner) can raise the risk of bleeding. DDInter grades this combination as Major. Don't stop or change either medication on your own — talk to a pharmacist or doctor.",
    abstained: false,
    delegated: false,
    latencyMs: 1850,
  },
  none: {
    scan: {
      rawText: "ASCORBIC ACID 500 mg",
      generic: "ascorbic acid",
      matched: true,
    },
    interactions: [],
    explanation:
      "No documented interaction was found between this medication and the drugs on your shelf in DDInter. This is not a guarantee of safety — keep your list current and check with a professional.",
    abstained: false,
    delegated: false,
    latencyMs: 1400,
  },
  abstain: {
    scan: {
      rawText: "UNRECOGNISED BRAND 10 mg",
      generic: null,
      matched: false,
    },
    interactions: [],
    explanation: "",
    abstained: true,
    abstainReason: "not_in_dataset",
    delegated: false,
    latencyMs: 900,
  },
  delegated: {
    scan: {
      rawText: "ASPIRIN 81 mg",
      generic: "acetylsalicylic acid",
      matched: true,
    },
    interactions: [WARFARIN_ASA],
    explanation:
      "A larger model on a nearby device reviewed this combination: aspirin plus warfarin increases bleeding risk (DDInter: Major). Seek pharmacist advice before combining them.",
    abstained: false,
    delegated: true,
    latencyMs: 5200,
  },
};

// ---- the API surface (all mocked) ----

/** Load OCR + LLM engines (local or, in mesh mode, delegated). Mock: instant. */
export async function loadEngines(): Promise<{ ready: true }> {
  audit.log("model_load", { mock: true });
  return { ready: true };
}

/** OCR a label image. Mock: returns canned text. Real: QVAC ocr(). */
export async function ocrLabel(
  _image: string | Uint8Array,
): Promise<{ text: string; latencyMs: number }> {
  return { text: mockScenarios.major.scan.rawText, latencyMs: 420 };
}

/** Resolve OCR text to a canonical generic name (synonym layer + DDInter drug list), or abstain. */
export async function normalize(
  text: string,
): Promise<{ raw: string; generic: string | null; matched: boolean }> {
  const { scan } = mockScenarios.major;
  return { raw: text, generic: scan.generic, matched: scan.matched };
}

/** Look up the scanned drug vs the shelf in DDInter. Mock: the warfarin/aspirin Major pair. */
export async function lookupInteractions(
  _drug: string,
  _shelf: ShelfItem[],
): Promise<Interaction[]> {
  return clone(mockScenarios.major.interactions);
}

/** MedPsy explains the retrieved interaction in plain language. Mock: canned string. */
export async function explain(_input: {
  scan: ScanResult["scan"];
  shelf: ShelfItem[];
  interactions: Interaction[];
}): Promise<{ text: string }> {
  return { text: mockScenarios.major.explanation };
}

/**
 * The one call the app makes per scan: image (+ the user's shelf) -> grounded, explained result.
 * Mock: returns the `major` scenario. Override via `__setMockScenario` to build other screens.
 */
let _scenario: keyof typeof mockScenarios = "major";
export function __setMockScenario(name: keyof typeof mockScenarios): void {
  _scenario = name;
}

export async function scanPipeline(
  _image: string | Uint8Array,
  _shelf: ShelfItem[] = [],
  opts?: ExplainOptions,
): Promise<ScanResult> {
  const result = clone(mockScenarios[_scenario]);
  audit.log("scan_result", {
    mock: true,
    severity: result.interactions[0]?.severity ?? "none",
    abstained: result.abstained,
    delegated: result.delegated,
  });
  // mirror the real pipeline's streaming handle so the app can build the typewriter on the mock
  if (opts?.onToken && result.explanation) {
    for (const token of result.explanation.match(/\S+\s*/g) ?? []) {
      opts.onToken(token);
    }
  }
  return result;
}
