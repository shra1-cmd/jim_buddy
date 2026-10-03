// Portion maths. Pure functions (unit-tested).

export interface Per100 {
  k: number; // kcal per 100 g
  p: number; // protein g
  c: number; // carbs g
  f: number; // fat g
  fb: number; // fiber g
}

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const r1 = (x: number) => Math.round(x * 10) / 10;

export function forGrams(food: Per100, grams: number): Nutrients {
  const m = grams / 100;
  return {
    kcal: Math.round(food.k * m),
    protein: r1(food.p * m),
    carbs: r1(food.c * m),
    fat: r1(food.f * m),
    fiber: r1(food.fb * m),
  };
}

export function sum(items: Nutrients[]): Nutrients {
  return items.reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: r1(a.protein + b.protein),
      carbs: r1(a.carbs + b.carbs),
      fat: r1(a.fat + b.fat),
      fiber: r1(a.fiber + b.fiber),
    }),
    ZERO,
  );
}

/** "1.5 roti" / "120 g" */
export function quantityLabel(qty: number, unit: string | null): string {
  const q = Number.isInteger(qty) ? String(qty) : qty.toFixed(1).replace(/\.0$/, '');
  return unit ? `${q} ${unit}` : `${q} g`;
}
