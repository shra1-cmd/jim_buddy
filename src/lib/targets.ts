// Daily targets from body stats. Pure functions, no React Native imports (unit-tested).

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'recomp' | 'maintain' | 'gain';

export interface BodyStats {
  sex: Sex;
  age: number; // years
  heightCm: number;
  weightKg: number;
  /** Activity factor for daily life WITHOUT workouts (workouts are counted separately). */
  activity: number;
  goal: Goal;
}

export interface Targets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Desk job', hint: 'mostly sitting' },
  { value: 1.375, label: 'On my feet', hint: 'part of the day' },
  { value: 1.55, label: 'Physical job', hint: 'most of the day' },
] as const;

export const GOALS: { value: Goal; label: string; kcalAdjust: number; proteinPerKg: number }[] = [
  { value: 'lose', label: 'Lose fat', kcalAdjust: -0.175, proteinPerKg: 2.1 },
  { value: 'recomp', label: 'Recomposition', kcalAdjust: -0.075, proteinPerKg: 2.1 },
  { value: 'maintain', label: 'Maintain', kcalAdjust: 0, proteinPerKg: 1.6 },
  { value: 'gain', label: 'Gain muscle', kcalAdjust: 0.075, proteinPerKg: 1.8 },
];

/** Mifflin–St Jeor basal metabolic rate, kcal/day. */
export function bmr({ sex, age, heightCm, weightKg }: Pick<BodyStats, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function computeTargets(stats: BodyStats): Targets {
  const goal = GOALS.find((g) => g.value === stats.goal) ?? GOALS[2];
  const maintenance = bmr(stats) * stats.activity;
  const kcal = Math.round((maintenance * (1 + goal.kcalAdjust)) / 10) * 10;
  const proteinG = Math.round(stats.weightKg * goal.proteinPerKg);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round((kcal / 1000) * 14);
  return { kcal, proteinG, carbsG, fatG, fiberG };
}

/** Calories implied by a macro split (4 / 4 / 9 kcal per g of protein / carbs / fat). */
export function macroKcal(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}

/** Calories left on the ring: target − eaten + burned × eat-back share. */
export function caloriesLeft(target: number, eaten: number, burned: number, eatBackPct: number): number {
  return Math.round(target - eaten + burned * (eatBackPct / 100));
}

/** "+350", "−120" or "0": calories with an explicit sign, using a real minus sign. */
export function signedKcal(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : r < 0 ? `\u2212${-r}` : '0';
}

/** Net workout kcal from METs (resting 1 MET is already inside the daily target). */
export function workoutKcal(met: number, weightKg: number, minutes: number): number {
  const hours = Math.min(minutes, 120) / 60;
  return Math.round(Math.max(0, met - 1) * weightKg * hours);
}

/** Epley estimated one-rep max. */
export function e1rm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
