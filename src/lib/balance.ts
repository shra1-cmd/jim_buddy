// Home dashboard maths. Pure (unit-tested).
import { addDays } from './dates.ts';

/** 0–1: how far along today's fuel is, judged by the weaker of calories and protein. */
export function fuelScore(kcal: number, kcalTarget: number, protein: number, proteinTarget: number): number {
  if (kcalTarget <= 0 || proteinTarget <= 0) return 0;
  return Math.max(0, Math.min(1, Math.min(kcal / kcalTarget, protein / proteinTarget)));
}

/** 0–1: workouts done this week against the plan (default 3 a week). */
export function trainingScore(sessionsThisWeek: number, plannedPerWeek: number): number {
  const plan = plannedPerWeek > 0 ? plannedPerWeek : 3;
  return Math.max(0, Math.min(1, sessionsThisWeek / plan));
}

/** Monday-based week progress, 1/7 on Monday … 1 on Sunday. */
export function weekProgress(d: Date): number {
  const day = (d.getDay() + 6) % 7; // Mon = 0
  return (day + 1) / 7;
}

/** Monday of the week containing d, as YYYY-MM-DD (local). */
export function weekStartKey(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Consecutive logged days ending today (or yesterday, if today has nothing logged yet). */
export function currentStreak(loggedKeys: Iterable<string>, today: string): number {
  const set = new Set(loggedKeys);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
