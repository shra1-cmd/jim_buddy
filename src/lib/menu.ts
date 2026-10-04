// Weekly mess / PG menu helpers. Pure (unit-tested), no React Native imports.

export type MenuSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export const MENU_SLOTS: MenuSlot[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const; // dow 1 … 7

/** Portion levels on the quantity bar, relative to the menu's medium serving. */
export type Portion = 'low' | 'medium' | 'high';
export const PORTIONS: { id: Portion; label: string; factor: number }[] = [
  { id: 'low', label: 'Low', factor: 0.5 },
  { id: 'medium', label: 'Medium', factor: 1 },
  { id: 'high', label: 'High', factor: 1.5 },
];
export const portionFactor = (p: Portion) => PORTIONS.find((x) => x.id === p)?.factor ?? 1;

/** Monday = 1 … Sunday = 7 for a YYYY-MM-DD key. */
export function dowOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return ((new Date(y, m - 1, d, 12).getDay() + 6) % 7) + 1;
}

const DAY_WORDS: [RegExp, number][] = [
  [/^mo(n(day)?)?$/, 1],
  [/^tu(e(s(day)?)?)?$/, 2],
  [/^we(d(s|nesday)?)?$/, 3],
  [/^th(u(r(s(day)?)?)?)?$/, 4],
  [/^fr(i(day)?)?$/, 5],
  [/^sa(t(urday)?)?$/, 6],
  [/^su(n(day)?)?$/, 7],
];

function oneDay(word: string): number | null {
  const w = word.trim().toLowerCase().replace(/\.$/, '');
  for (const [re, n] of DAY_WORDS) if (re.test(w)) return n;
  return null;
}

/**
 * Days from a cell like "Mon", "Monday", "Mon-Fri", "Mon, Wed & Fri", "Daily" or "All days".
 * Returns [] when nothing is recognised.
 */
export function parseDays(cell: string): number[] {
  const c = cell.trim().toLowerCase();
  if (!c) return [];
  if (/^(daily|every ?day|all( days)?|mon\s*[-–to]+\s*sun)$/.test(c)) return [1, 2, 3, 4, 5, 6, 7];
  if (/^weekdays?$/.test(c)) return [1, 2, 3, 4, 5];
  if (/^weekends?$/.test(c)) return [6, 7];
  const range = c.match(/^([a-z]+)\.?\s*(?:-|–|to)\s*([a-z]+)\.?$/);
  if (range) {
    const a = oneDay(range[1]);
    const b = oneDay(range[2]);
    if (a && b) {
      const out: number[] = [];
      for (let d = a; ; d = (d % 7) + 1) {
        out.push(d);
        if (d === b || out.length > 7) break;
      }
      return out;
    }
  }
  const parts = c.split(/[,/&+]|\band\b/).map((p) => oneDay(p)).filter((n): n is number => n != null);
  return [...new Set(parts)];
}

/** "Breakfast", "Tiffin", "Evening snacks", "Supper"… → a journal meal, or null. */
export function parseSlot(cell: string): MenuSlot | null {
  const c = cell.trim().toLowerCase();
  if (/break ?fast|tiffin|morning/.test(c)) return 'breakfast';
  if (/lunch|afternoon/.test(c)) return 'lunch';
  if (/snack|evening|tea|high tea/.test(c)) return 'snacks';
  if (/dinner|supper|night/.test(c)) return 'dinner';
  return null;
}
