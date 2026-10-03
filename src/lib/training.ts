// Training maths. Pure functions (unit-tested): progression, volume, records, muscle load, session kcal.

export type LogType = 'weight_reps' | 'reps' | 'assisted' | 'time' | 'distance_time';

export interface SetLike {
  kg: number | null;
  reps: number | null;
  seconds: number | null;
  distance_m: number | null;
  is_warmup: number | boolean;
  done: number | boolean;
}

const working = (s: SetLike) => !!s.done && !s.is_warmup;

/**
 * Double progression: if every working set last time reached the top of the rep range, add one increment.
 * Assisted lifts progress the other way (less assistance).
 */
export function suggestLoad(
  last: SetLike[],
  repMax: number,
  incrementKg: number,
  logType: LogType,
): { kg: number | null; progressed: boolean } {
  const done = last.filter(working);
  if (!done.length) return { kg: null, progressed: false };
  const topKg = Math.max(...done.map((s) => s.kg ?? 0));
  const hitTop = done.every((s) => (s.reps ?? 0) >= repMax);
  if (!hitTop || incrementKg <= 0 || (logType !== 'weight_reps' && logType !== 'assisted')) {
    return { kg: done[done.length - 1].kg, progressed: false };
  }
  if (logType === 'assisted') return { kg: Math.max(0, topKg - incrementKg), progressed: true };
  return { kg: Math.round((topKg + incrementKg) * 100) / 100, progressed: true };
}

export function setVolume(s: SetLike): number {
  if (!working(s)) return 0;
  return (s.kg ?? 0) * (s.reps ?? 0);
}

export function sessionVolume(sets: SetLike[]): number {
  return Math.round(sets.reduce((a, s) => a + setVolume(s), 0));
}

/** Epley e1RM of the best working set (weight × reps lifts only). */
export function bestE1rm(sets: SetLike[]): number | null {
  const vals = sets
    .filter((s) => working(s) && (s.kg ?? 0) > 0 && (s.reps ?? 0) > 0)
    .map((s) => (s.reps! <= 1 ? s.kg! : s.kg! * (1 + s.reps! / 30)));
  return vals.length ? Math.round(Math.max(...vals) * 10) / 10 : null;
}

/** Hard sets per muscle: primary muscles count 1, secondary 0.5. */
export function setsPerMuscle(
  sets: { exercise_id: string; is_warmup: number | boolean; done: number | boolean }[],
  muscles: (exerciseId: string) => { primary: string[]; secondary: string[] } | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sets) {
    if (!s.done || s.is_warmup) continue;
    const m = muscles(s.exercise_id);
    if (!m) continue;
    m.primary.forEach((p) => (out[p] = (out[p] ?? 0) + 1));
    m.secondary.forEach((p) => (out[p] = (out[p] ?? 0) + 0.5));
  }
  return out;
}

/**
 * Net session kcal: MET of the exercises done (weighted by working sets) × body weight × duration,
 * minus resting 1 MET (already inside the daily target). Capped at 2 hours.
 */
export function sessionKcal(
  sets: { exercise_id: string; is_warmup: number | boolean; done: number | boolean }[],
  met: (exerciseId: string) => number,
  weightKg: number,
  minutes: number,
): number {
  const done = sets.filter((s) => s.done && !s.is_warmup);
  if (!done.length || minutes <= 0) return 0;
  const avgMet = done.reduce((a, s) => a + met(s.exercise_id), 0) / done.length;
  const hours = Math.min(minutes, 120) / 60;
  return Math.round(Math.max(0, avgMet - 1) * weightKg * hours);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
