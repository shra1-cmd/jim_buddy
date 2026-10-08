// How a set is typed in, per exercise log type: column headers, text ⇄ values, and a short "last time" label.
// Pure (unit-tested), no React Native imports.
import type { LogType } from './training.ts'; // explicit extension: these libs also run under node:test

export type Draft = { a: string; b: string }; // first and second input of a set row, as typed
export type SetValues = { kg: number | null; reps: number | null; seconds: number | null; distance_m: number | null };

export function headers(lt: LogType | string): [string, string | null] {
  switch (lt) {
    case 'reps': return ['REPS', null];
    case 'assisted': return ['ASSIST KG', 'REPS'];
    case 'time': return ['SECONDS', null];
    case 'distance_time': return ['KM', 'MIN'];
    default: return ['KG', 'REPS'];
  }
}

export function toDraft(s: Partial<SetValues>, lt: LogType | string): Draft {
  const n = (v: number | null | undefined) => (v == null ? '' : String(v));
  switch (lt) {
    case 'reps': return { a: n(s.reps), b: '' };
    case 'time': return { a: n(s.seconds), b: '' };
    case 'distance_time': return { a: s.distance_m == null ? '' : String(s.distance_m / 1000), b: s.seconds == null ? '' : String(Math.round(s.seconds / 60)) };
    default: return { a: n(s.kg), b: n(s.reps) };
  }
}

export function fromDraft(d: Draft, lt: LogType | string): SetValues {
  const num = (v: string) => {
    if (v.trim() === '') return null;
    const x = Number(v.replace(',', '.'));
    return Number.isFinite(x) && x >= 0 ? x : null;
  };
  switch (lt) {
    case 'reps': return { kg: null, reps: num(d.a), seconds: null, distance_m: null };
    case 'time': return { kg: null, reps: null, seconds: num(d.a), distance_m: null };
    case 'distance_time': {
      const km = num(d.a), min = num(d.b);
      return { kg: null, reps: null, distance_m: km == null ? null : km * 1000, seconds: min == null ? null : min * 60 };
    }
    default: return { kg: num(d.a), reps: num(d.b), seconds: null, distance_m: null };
  }
}

/** A set counts once its main number is filled in (reps for lifts, time or distance for cardio). */
export function isFilled(v: SetValues, lt: LogType | string): boolean {
  switch (lt) {
    case 'time': return (v.seconds ?? 0) > 0;
    case 'distance_time': return (v.distance_m ?? 0) > 0 || (v.seconds ?? 0) > 0;
    default: return (v.reps ?? 0) > 0;
  }
}

export function setLabel(s: Partial<SetValues>, lt: LogType | string): string {
  switch (lt) {
    case 'reps': return `${s.reps ?? '–'} reps`;
    case 'time': return `${s.seconds ?? '–'} s`;
    case 'distance_time': return `${s.distance_m != null ? s.distance_m / 1000 : '–'} km / ${s.seconds != null ? Math.round(s.seconds / 60) : '–'} min`;
    case 'assisted': return `−${s.kg ?? 0} kg × ${s.reps ?? '–'}`;
    default: return `${s.kg ?? 0} kg × ${s.reps ?? '–'}`;
  }
}
