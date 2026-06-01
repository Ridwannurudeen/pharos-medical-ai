// The contract Lane B (the app) builds against — copied VERBATIM from the Lead's
// repo-root `core/types.ts`. These shapes are FROZEN; the real QVAC-backed engine lands
// behind exactly these types. Do not edit here without mirroring core/types.ts (and a
// signature change is a conversation with the Lead first — see docs/lane-app.md).
//
// Reflects the VERIFIED DDInter data (docs/data-pipeline.md): severity includes "Unknown",
// and there is no mechanism/management text in the dataset.

export type Severity = "Major" | "Moderate" | "Minor" | "Unknown";

export interface ShelfItem {
  /** drug name as the user entered it (the app owns the shelf store) */
  name: string;
}

export interface Interaction {
  /** the scanned drug (display name) */
  drugA: string;
  /** the shelf drug it clashes with (display name) */
  drugB: string;
  /** documented severity from DDInter; "Unknown" = documented but uncharacterized (NOT safe) */
  severity: Severity;
  /** citation shown on the card */
  source: "DDInter 2.0";
  /** DDInter ids for provenance */
  ddinterIdA: string;
  ddinterIdB: string;
}

export interface ScanResult {
  scan: {
    /** raw OCR text */
    rawText: string;
    /** resolved canonical/generic name, or null if it didn't resolve */
    generic: string | null;
    /** did it resolve to a known drug in DDInter? */
    matched: boolean;
  };
  /** documented interactions vs the shelf; [] = none found (NOT a safety guarantee) */
  interactions: Interaction[];
  /** MedPsy plain-language context — background only, never presented as a retrieved DDInter field */
  explanation: string;
  /** true => show the abstain card, not a result */
  abstained: boolean;
  abstainReason?: "unresolved_drug" | "not_in_dataset";
  /** true => answered by the mesh anchor (show the "larger model nearby" badge) */
  delegated: boolean;
  latencyMs: number;
}

export type AuditEvent = { event: string } & Record<string, unknown>;
