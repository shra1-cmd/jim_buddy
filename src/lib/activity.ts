// Steps, sports and the ChatGPT meal hand-off. Pure (unit-tested), no React Native imports.

// ---------- steps ----------

/**
 * Steps already assumed by the activity level picked in onboarding. Only steps above this count as
 * extra burn, otherwise everyday walking is counted twice (once in the target, once here).
 */
export function stepBaseline(activity: number): number {
  if (activity >= 1.55) return 10000;
  if (activity >= 1.375) return 7500;
  return 5000;
}

/** Net walking cost ≈ 0.5 kcal per kg per km, ~1,300 steps per km → 0.00038 kcal per step per kg. */
export function stepsKcal(steps: number, weightKg: number, baseline: number): number {
  return Math.round(Math.max(0, steps - baseline) * weightKg * 0.00038);
}

// ---------- sports ----------

export type Intensity = 'medium' | 'high';
export interface Sport {
  id: string;
  name: string;
  emoji: string;
  met: Record<Intensity, number>; // 2024 Adult Compendium of Physical Activities (approx.)
  hint: Record<Intensity, string>;
}

export const SPORTS: Sport[] = [
  { id: 'cricket', name: 'Cricket', emoji: '🏏', met: { medium: 4.8, high: 6.0 }, hint: { medium: 'Casual match, fielding', high: 'Batting/bowling hard, nets' } },
  { id: 'badminton', name: 'Badminton', emoji: '🏸', met: { medium: 5.5, high: 7.0 }, hint: { medium: 'Social doubles', high: 'Competitive singles' } },
  { id: 'football', name: 'Football', emoji: '⚽', met: { medium: 7.0, high: 10.0 }, hint: { medium: 'Casual kickabout', high: 'Full match' } },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', met: { medium: 6.5, high: 8.0 }, hint: { medium: 'Shooting around', high: 'Full-court game' } },
  { id: 'table_tennis', name: 'Table tennis', emoji: '🏓', met: { medium: 4.0, high: 5.5 }, hint: { medium: 'Friendly rally', high: 'Competitive match' } },
];

/** Net kcal (resting 1 MET is already in the daily target), capped at 3 hours. */
export function sportKcal(met: number, weightKg: number, minutes: number): number {
  const hours = Math.min(Math.max(0, minutes), 180) / 60;
  return Math.round(Math.max(0, met - 1) * weightKg * hours);
}

// ---------- ChatGPT hand-off ----------

export type ScanKind = 'photo' | 'text' | 'label';

const TABLE_RULES = `Reply ONLY with a table in exactly this format, one food per line, no other text:
item | grams | kcal | protein | carbs | fat | fiber
Use plain numbers (no units). If the food looks oily, add cooking oil/ghee as its own line.`;

export function chatGptPrompt(kind: ScanKind, o: { slot: string; place?: string; hint?: string; text?: string }): string {
  if (kind === 'label') {
    return `Read the nutrition label in the attached photo.
Reply ONLY with ONE line for one serving, in exactly this format, no other text:
item | grams | kcal | protein | carbs | fat | fiber
(item = product name, grams = one serving in grams, numbers only)`;
  }
  const where = o.place ? ` (${o.place.toLowerCase()} food)` : '';
  const extra = o.hint?.trim() ? `\nContext: ${o.hint.trim()}.` : '';
  const what = kind === 'photo'
    ? `Look at the attached photo of my ${o.slot}${where}. List every separate food you can see and estimate each portion in grams.`
    : `This is what I ate for ${o.slot}${where}: ${o.text?.trim()}\nList each food and estimate the portion in grams.`;
  return `You are a careful nutrition estimator who knows Indian home, mess and restaurant food well.
${what}${extra}
Then give the nutrition for that portion (not per 100 g).
${TABLE_RULES}`;
}

export interface EstimatedItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

const num = (s: string | undefined): number => {
  const m = (s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/** Parses ChatGPT's "item | grams | kcal | protein | carbs | fat | fiber" lines (markdown tables are fine). */
export function parseChatGptReply(reply: string): EstimatedItem[] {
  const out: EstimatedItem[] = [];
  for (const raw of reply.split(/\r?\n/)) {
    const line = raw.trim().replace(/^\|/, '').replace(/\|$/, '');
    if (!line.includes('|')) continue;
    const cols = line.split('|').map((c) => c.trim().replace(/\*\*/g, ''));
    if (cols.length < 6) continue;
    const name = cols[0];
    if (!name || /^[-:\s]+$/.test(name) || /^(item|food|total)s?$/i.test(name)) continue;
    const [grams, kcal, protein, carbs, fat] = cols.slice(1, 6).map(num);
    const fiber = cols.length > 6 ? num(cols[6]) : 0;
    if (![grams, kcal, protein, carbs, fat].every(Number.isFinite) || kcal < 0 || grams <= 0) continue;
    out.push({ name, grams, kcal, protein, carbs, fat, fiber: Number.isFinite(fiber) ? fiber : 0 });
  }
  return out;
}

/** Scale an estimate to a new gram amount. */
export function scaleItem(it: EstimatedItem, grams: number): EstimatedItem {
  const f = it.grams > 0 ? grams / it.grams : 0;
  const r = (v: number) => Math.round(v * f * 10) / 10;
  return { ...it, grams, kcal: Math.round(it.kcal * f), protein: r(it.protein), carbs: r(it.carbs), fat: r(it.fat), fiber: r(it.fiber) };
}
