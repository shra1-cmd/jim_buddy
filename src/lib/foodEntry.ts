// Quick add (manual food entry) validation. Pure (unit-tested), no React Native imports.
import type { Nutrients } from './nutrition.ts';

export type EntryField = 'name' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';
export type EntryInput = Record<EntryField, string>;

/** "12", "12.5", "12,5" → number; blank → null; anything else → NaN. */
export function parseAmount(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  return /^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : NaN;
}

/** Calories are required; protein, carbs, fat and fiber may be left blank (counted as 0). A name is required only to save the food. */
export function validateFoodEntry(
  input: EntryInput,
  opts: { requireName?: boolean } = {},
): { value: Nutrients & { name: string } | null; errors: Partial<Record<EntryField, string>> } {
  const errors: Partial<Record<EntryField, string>> = {};
  const name = input.name.trim();
  if (opts.requireName && !name) errors.name = 'Add a name to save this food';

  const n = {} as Nutrients;
  for (const f of ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const) {
    const v = parseAmount(input[f]);
    if (v === null) {
      if (f === 'kcal') errors.kcal = 'Enter the calories';
      n[f] = 0;
    } else if (!Number.isFinite(v)) {
      errors[f] = 'Use a number like 12 or 12.5';
    } else {
      n[f] = v;
    }
  }
  if (!errors.kcal && n.kcal <= 0) errors.kcal = 'Calories must be more than 0';
  if (!errors.kcal && n.kcal > 10000) errors.kcal = 'That’s over 10,000 kcal. Check the number';

  return { value: Object.keys(errors).length ? null : { name, ...n }, errors };
}
