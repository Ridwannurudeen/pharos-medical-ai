// Canonical name normalization. The SINGLE source of truth — the data build (scripts/build-data.ts)
// inlines an identical norm(); the build key and the runtime lookup key MUST match exactly.
export const norm = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, " ");
