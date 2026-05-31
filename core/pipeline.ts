// scanPipeline — the real orchestration of a scan: OCR -> normalize -> DDInter lookup -> MedPsy explain,
// emitting audit events at every step (docs/audit-log-schema.md). The engine pieces (OCR + MedPsy) are
// INJECTED, so this is fully testable with fakes and the real QVAC-backed Engine drops in unchanged.
// The model only ever EXPLAINS the retrieved interaction — grounding decides whether one exists.
import type { ScanResult, ShelfItem, Interaction } from "./types.ts";
import type { Grounding } from "./grounding.ts";
import type { AuditLog, Clock } from "./audit.ts";

/** OCR + MedPsy — QVAC-backed in production, fakes in tests. */
export interface Engine {
  ocr(image: string | Uint8Array): Promise<{ text: string; latencyMs: number }>;
  /** extract the generic/active-ingredient name from OCR text (translation etc.); null = couldn't extract */
  normalize(text: string): Promise<{ generic: string | null }>;
  /** MedPsy explains ONLY the retrieved interactions in plain language */
  explain(input: {
    scan: ScanResult["scan"];
    shelf: ShelfItem[];
    interactions: Interaction[];
  }): Promise<{ text: string }>;
}

export interface PipelineDeps {
  engine: Engine;
  grounding: Grounding;
  audit: AuditLog;
  clock: Clock;
  /** true when explain() ran on a mesh peer; defaults to local */
  delegated?: () => boolean;
}

export function createScanPipeline(deps: PipelineDeps) {
  return async function scanPipeline(
    image: string | Uint8Array,
    shelf: ShelfItem[] = [],
  ): Promise<ScanResult> {
    const t0 = deps.clock.monotonicMs();

    // 1) OCR the label
    deps.audit.log("ocr_start");
    const ocr = await deps.engine.ocr(image);
    deps.audit.log("ocr_end", {
      text_len: ocr.text.length,
      latency_ms: ocr.latencyMs,
    });

    // 2) extract a generic name, then check it against DDInter's vocabulary (the authoritative scope check)
    const { generic } = await deps.engine.normalize(ocr.text);
    const resolved = generic ? deps.grounding.resolve(generic) : null;
    const matched = resolved !== null;
    const scan = { rawText: ocr.text, generic, matched };
    deps.audit.log("normalize_result", {
      raw_text: ocr.text,
      generic,
      matched,
    });

    // 3) abstain rather than guess when the drug doesn't resolve
    if (!matched || !generic) {
      const abstainReason = generic ? "not_in_dataset" : "unresolved_drug";
      deps.audit.log("abstain", { reason: abstainReason });
      deps.audit.log("scan_result", {
        abstained: true,
        severity: "none",
        delegated: false,
      });
      return {
        scan,
        interactions: [],
        explanation: "",
        abstained: true,
        abstainReason,
        delegated: false,
        latencyMs: deps.clock.monotonicMs() - t0,
      };
    }

    // 4) retrieve documented interactions vs the shelf
    const interactions = deps.grounding.lookupInteractions(generic, shelf);
    for (const ix of interactions) {
      deps.audit.log("ddinter_lookup", {
        drug_a: ix.drugA,
        drug_b: ix.drugB,
        severity: ix.severity,
        ddinter_id_a: ix.ddinterIdA,
        ddinter_id_b: ix.ddinterIdB,
      });
    }

    // 5) MedPsy explains the retrieved fact (never invents)
    const delegated = deps.delegated?.() ?? false;
    deps.audit.log("medpsy_start", { delegated });
    const explanation = await deps.engine.explain({
      scan,
      shelf,
      interactions,
    });
    deps.audit.log("medpsy_end", { delegated });

    deps.audit.log("scan_result", {
      abstained: false,
      severity: interactions[0]?.severity ?? "none",
      delegated,
    });
    return {
      scan,
      interactions,
      explanation: explanation.text,
      abstained: false,
      delegated,
      latencyMs: deps.clock.monotonicMs() - t0,
    };
  };
}
