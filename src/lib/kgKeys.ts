import { KgExperiment } from '@/lib/types';

/** Scope used in kg_curations for paper-part verdicts (global, not per tech-tree node). */
export const PAPER_PART_SCOPE = '*';

const EXP_KEY_RE = /^paper:[^\s,]+:exp:[0-9a-f]{8}(-\d+)?$/;
export const isExperimentKey = (k: unknown): k is string =>
  typeof k === 'string' && EXP_KEY_RE.test(k);

// FNV-1a 32-bit — tiny, deterministic, identical on server and client.
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Stable vote/curation keys for a paper's experiments, derived from content
 * (name + device) rather than array position, so they survive dossier rebuilds.
 * Duplicate name/device pairs within one paper get a -2, -3 … suffix.
 */
export function experimentKeys(
  paperId: string,
  experiments: Pick<KgExperiment, 'name' | 'device'>[],
): string[] {
  const seen = new Map<string, number>();
  return experiments.map((e) => {
    const base = `paper:${paperId}:exp:${fnv1a(`${e.name ?? ''}|${e.device ?? ''}`)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}
