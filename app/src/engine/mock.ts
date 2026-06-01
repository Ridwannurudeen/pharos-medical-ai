// Self-contained, React-Native-safe mock of the Lead's engine. Mirrors the fixtures in
// repo-root `core/index.ts` EXACTLY so the app behaves identically before/after the swap to
// the real engine. The canonical source of these fixtures is core/index.ts; if the Lead
// changes them, mirror here (or flip to the real ../core import — see ./index.ts).
import type { Interaction, ScanResult, ShelfItem, AuditEvent } from "./contract";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ---- minimal RN-safe audit (the real core/ logs the pipeline; the app should NOT double-log) ----
const _lines: string[] = [];
const _t0 = Date.now();
export const audit = {
  log(event: string | AuditEvent, fields: Record<string, unknown> = {}): void {
    const base = typeof event === "string" ? { event } : event;
    _lines.push(
      JSON.stringify({ ...base, ...fields, t: Date.now() - _t0 }),
    );
  },
};
/** test/inspection only: the raw JSONL lines written so far */
export const auditLines = _lines;

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
    scan: { rawText: "ASPIRIN 81 mg", generic: "acetylsalicylic acid", matched: true },
    interactions: [WARFARIN_ASA],
    explanation:
      "Taking aspirin together with warfarin (a blood thinner) can raise the risk of bleeding. DDInter grades this combination as Major. Don't stop or change either medication on your own — talk to a pharmacist or doctor.",
    abstained: false,
    delegated: false,
    latencyMs: 1850,
  },
  none: {
    scan: { rawText: "ASCORBIC ACID 500 mg", generic: "ascorbic acid", matched: true },
    interactions: [],
    explanation:
      "No documented interaction was found between this medication and the drugs on your shelf in DDInter. This is not a guarantee of safety — keep your list current and check with a professional.",
    abstained: false,
    delegated: false,
    latencyMs: 1400,
  },
  abstain: {
    scan: { rawText: "UNRECOGNISED BRAND 10 mg", generic: null, matched: false },
    interactions: [],
    explanation: "",
    abstained: true,
    abstainReason: "not_in_dataset",
    delegated: false,
    latencyMs: 900,
  },
  delegated: {
    scan: { rawText: "ASPIRIN 81 mg", generic: "acetylsalicylic acid", matched: true },
    interactions: [WARFARIN_ASA],
    explanation:
      "A larger model on a nearby device reviewed this combination: aspirin plus warfarin increases bleeding risk (DDInter: Major). Seek pharmacist advice before combining them.",
    abstained: false,
    delegated: true,
    latencyMs: 5200,
  },
};

export type ScenarioName = keyof typeof mockScenarios;

let _scenario: ScenarioName = "major";

/** Build/demo helper: flip which scenario scanPipeline returns. Mirrors core/__setMockScenario. */
export function __setMockScenario(name: ScenarioName): void {
  _scenario = name;
}

// ---- the API surface (all mocked, signatures identical to core/index.ts) ----

export async function loadEngines(): Promise<{ ready: true }> {
  audit.log("model_load", { mock: true });
  return { ready: true };
}

export async function ocrLabel(
  _image: string | Uint8Array,
): Promise<{ text: string; latencyMs: number }> {
  return { text: mockScenarios.major.scan.rawText, latencyMs: 420 };
}

export async function normalize(
  text: string,
): Promise<{ raw: string; generic: string | null; matched: boolean }> {
  const { scan } = mockScenarios.major;
  return { raw: text, generic: scan.generic, matched: scan.matched };
}

export async function lookupInteractions(
  _drug: string,
  _shelf: ShelfItem[],
): Promise<Interaction[]> {
  return clone(mockScenarios.major.interactions);
}

export async function explain(_input: {
  scan: ScanResult["scan"];
  shelf: ShelfItem[];
  interactions: Interaction[];
}): Promise<{ text: string }> {
  return { text: mockScenarios.major.explanation };
}

/**
 * The one call the app makes per scan: image (+ the user's shelf) -> grounded, explained result.
 * Mock: returns the currently selected scenario; latency is simulated so the analyzing state shows.
 */
export async function scanPipeline(
  _image: string | Uint8Array,
  _shelf: ShelfItem[] = [],
): Promise<ScanResult> {
  const result = clone(mockScenarios[_scenario]);
  await new Promise((r) => setTimeout(r, Math.min(result.latencyMs, 1600)));
  audit.log("scan_result", {
    mock: true,
    severity: result.interactions[0]?.severity ?? "none",
    abstained: result.abstained,
    delegated: result.delegated,
  });
  return result;
}
