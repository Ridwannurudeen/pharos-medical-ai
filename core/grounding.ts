// Grounding — the "no hallucination" core: resolve a drug name to DDInter's vocabulary and
// retrieve documented interactions. Pure and platform-agnostic: inject a QueryRunner so the same
// logic runs in Node tests/anchor (node:sqlite) and on-device (expo-sqlite). The model never
// decides whether an interaction exists — this does, from data.
import type { Interaction, ShelfItem, Severity } from "./types.ts";
import { norm } from "./text.ts";

/** Runs a parametrized read query and returns rows. Backed by node:sqlite or expo-sqlite. */
export type QueryRunner = (
  sql: string,
  params: unknown[],
) => Record<string, unknown>[];

export interface Grounding {
  /** canonical normalized name (via synonym layer, then the drug list), or null = not in scope (abstain) */
  resolve(name: string): string | null;
  /** documented interactions between the scanned drug and the shelf; [] = none found (NOT a safety guarantee) */
  lookupInteractions(scanned: string, shelf: ShelfItem[]): Interaction[];
}

export function createGrounding(query: QueryRunner): Grounding {
  function resolve(name: string): string | null {
    const n = norm(name);
    const drug = query("SELECT normalized FROM drugs WHERE normalized = ?", [
      n,
    ])[0];
    if (drug) return drug.normalized as string;
    const syn = query("SELECT normalized FROM synonyms WHERE synonym = ?", [
      n,
    ])[0];
    return syn ? (syn.normalized as string) : null;
  }

  function lookupInteractions(
    scanned: string,
    shelf: ShelfItem[],
  ): Interaction[] {
    const a0 = resolve(scanned);
    if (!a0) return []; // scanned drug not in scope — caller shows the abstain card
    const out: Interaction[] = [];
    for (const item of shelf) {
      const b0 = resolve(item.name);
      if (!b0 || a0 === b0) continue;
      const [a, b] = a0 < b0 ? [a0, b0] : [b0, a0];
      const row = query(
        "SELECT severity, ddinter_id_a, ddinter_id_b FROM interactions WHERE drug_a = ? AND drug_b = ?",
        [a, b],
      )[0];
      if (row) {
        out.push({
          drugA: scanned,
          drugB: item.name,
          severity: row.severity as Severity,
          source: "DDInter 2.0",
          ddinterIdA: row.ddinter_id_a as string,
          ddinterIdB: row.ddinter_id_b as string,
        });
      }
    }
    return out;
  }

  return { resolve, lookupInteractions };
}
