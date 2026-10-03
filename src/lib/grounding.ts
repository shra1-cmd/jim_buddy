// Match what the vision model names ("chicken biryani") to rows in our food database. Pure (unit-tested).

const STOP = new Set(['with', 'and', 'of', 'the', 'a', 'in', 'ka', 'ki', 'ke', 'curry', 'sabzi', 'sabji', 'subji', 'plain', 'fresh']);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[()/,.-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(es|s)$/, '')) // crude singular: rotis → roti, eggs → egg
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** 0–1 score: share of the query's tokens found in the candidate, with a small bonus for short candidates. */
export function matchScore(query: string, candidate: string): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const c = new Set(tokens(candidate));
  const hits = q.filter((t) => c.has(t) || [...c].some((x) => x.startsWith(t) || t.startsWith(x))).length;
  const coverage = hits / q.length;
  const brevity = 1 / (1 + Math.max(0, c.size - q.length) * 0.15);
  return Math.round(coverage * brevity * 1000) / 1000;
}

export function rankCandidates<T extends { name: string; source?: string }>(query: string, foods: T[], limit = 5): (T & { score: number })[] {
  return foods
    .map((f) => ({ ...f, score: matchScore(query, f.name) + (f.source === 'custom' ? 0.05 : f.source === 'basic' ? 0.03 : 0) }))
    .filter((f) => f.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Oil is logged as its own editable line item: Low / Normal / High ≈ 0 / 5 / 15 g per plate. */
export const OIL_GRAMS: Record<'low' | 'normal' | 'high', number> = { low: 0, normal: 5, high: 15 };
