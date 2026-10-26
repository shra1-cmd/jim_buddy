// Body measurements: which fields exist, and the numbers derived from them. Pure (unit-tested).

import type { Sex } from './targets.ts';

export type MeasureGroup = 'body' | 'torso' | 'arms' | 'legs' | 'comp';

export const MEASURE_GROUPS: { key: MeasureGroup; label: string }[] = [
  { key: 'body', label: 'Body' },
  { key: 'torso', label: 'Waist & torso' },
  { key: 'arms', label: 'Arms' },
  { key: 'legs', label: 'Legs' },
  { key: 'comp', label: 'Body composition' },
];

// Columns on body_entry. arm_cm / thigh_cm predate left/right and hold the right side.
export const MEASURES = [
  { key: 'neck_cm', group: 'body', label: 'Neck', short: 'Neck', hint: 'Below the Adam’s apple' },
  { key: 'chest_cm', group: 'body', label: 'Chest', short: 'Chest', hint: 'Nipple line, arms down' },
  { key: 'shoulder_width_cm', group: 'body', label: 'Shoulder width', short: 'Shoulder W', hint: 'Bone to bone, across the back' },
  { key: 'shoulder_cm', group: 'body', label: 'Shoulder circumference', short: 'Shoulders', hint: 'Around both delts, widest point' },
  { key: 'natural_waist_cm', group: 'torso', label: 'Natural waist', short: 'Nat. waist', hint: 'Narrowest point, above the navel' },
  { key: 'waist_cm', group: 'torso', label: 'Navel waist', short: 'Waist', hint: 'At the navel, relaxed' },
  { key: 'abdomen_cm', group: 'torso', label: 'Widest abdomen', short: 'Abdomen', hint: 'Widest point of the belly' },
  { key: 'hips_cm', group: 'torso', label: 'Hips', short: 'Hips', hint: 'Widest point of the glutes' },
  { key: 'biceps_l_cm', group: 'arms', label: 'Flexed biceps (L)', short: 'Biceps L', hint: 'Flexed, peak' },
  { key: 'arm_cm', group: 'arms', label: 'Flexed biceps (R)', short: 'Biceps R', hint: 'Flexed, peak' },
  { key: 'upper_arm_l_cm', group: 'arms', label: 'Relaxed upper arm (L)', short: 'Upper arm L', hint: 'Relaxed, mid-arm' },
  { key: 'upper_arm_r_cm', group: 'arms', label: 'Relaxed upper arm (R)', short: 'Upper arm R', hint: 'Relaxed, mid-arm' },
  { key: 'forearm_l_cm', group: 'arms', label: 'Forearm (L)', short: 'Forearm L', hint: 'Widest point, fist clenched' },
  { key: 'forearm_r_cm', group: 'arms', label: 'Forearm (R)', short: 'Forearm R', hint: 'Widest point, fist clenched' },
  { key: 'wrist_l_cm', group: 'arms', label: 'Wrist (L)', short: 'Wrist L', hint: 'Just above the bone' },
  { key: 'wrist_r_cm', group: 'arms', label: 'Wrist (R)', short: 'Wrist R', hint: 'Just above the bone' },
  { key: 'thigh_l_cm', group: 'legs', label: 'Thigh (L)', short: 'Thigh L', hint: 'Widest point, standing' },
  { key: 'thigh_cm', group: 'legs', label: 'Thigh (R)', short: 'Thigh R', hint: 'Widest point, standing' },
  { key: 'calf_l_cm', group: 'legs', label: 'Calf (L)', short: 'Calf L', hint: 'Widest point, standing' },
  { key: 'calf_r_cm', group: 'legs', label: 'Calf (R)', short: 'Calf R', hint: 'Widest point, standing' },
  { key: 'inseam_cm', group: 'legs', label: 'Inseam', short: 'Inseam', hint: 'Crotch to floor' },
  { key: 'body_fat_pct', group: 'comp', label: 'Body fat', short: 'Body fat', hint: 'From a scale or caliper, %' },
] as const satisfies readonly { key: string; group: MeasureGroup; label: string; short: string; hint: string }[];

export type MeasureKey = (typeof MEASURES)[number]['key'];
export type Measurement = { local_date: string } & Record<MeasureKey, number | null>;
export type MeasureValues = Partial<Record<MeasureKey, number>>;

export const unitOf = (k: MeasureKey) => (k === 'body_fat_pct' ? '%' : 'cm');

/** Sane input range for a field; anything outside is a typo (inches, a missing decimal…). */
export function measureRange(k: MeasureKey): [number, number] {
  if (k === 'body_fat_pct') return [3, 60];
  if (k === 'wrist_l_cm' || k === 'wrist_r_cm') return [10, 30];
  return [15, 250];
}

/** Newest value of each field across entries (any order), and the date of the newest entry. */
export function latestMeasures(rows: Measurement[]): { values: MeasureValues; updated: string | null } {
  const sorted = [...rows].sort((a, b) => b.local_date.localeCompare(a.local_date));
  const values: MeasureValues = {};
  for (const r of sorted) {
    for (const m of MEASURES) if (values[m.key] == null && r[m.key] != null) values[m.key] = r[m.key]!;
  }
  return { values, updated: sorted[0]?.local_date ?? null };
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0 && heightCm > 0)) return null;
  return round(weightKg / (heightCm / 100) ** 2, 1);
}

export function bmiBand(v: number): string {
  if (v < 18.5) return 'under';
  if (v < 25) return 'healthy';
  if (v < 30) return 'over';
  return 'obese';
}

/** US Navy tape estimate (cm). Men: waist at the navel; women also need hips. */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm?: number, waistCm?: number, hipsCm?: number): number | null {
  if (!heightCm || !neckCm || !waistCm) return null;
  const log = Math.log10;
  let pct: number;
  if (sex === 'male') {
    if (waistCm <= neckCm) return null;
    pct = 495 / (1.0324 - 0.19077 * log(waistCm - neckCm) + 0.15456 * log(heightCm)) - 450;
  } else {
    if (!hipsCm || waistCm + hipsCm <= neckCm) return null;
    pct = 495 / (1.29579 - 0.35004 * log(waistCm + hipsCm - neckCm) + 0.221 * log(heightCm)) - 450;
  }
  return pct > 2 && pct < 70 ? round(pct, 1) : null;
}

export const ratio = (a?: number | null, b?: number | null) => (a && b ? round(a / b, 2) : null);

export interface BodyProfile {
  values: MeasureValues;
  updated: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  bodyFat: { pct: number; estimated: boolean } | null;
  waistToHeight: number | null;
  chestToWaist: number | null;
  shoulderToWaist: number | null;
}

/**
 * Everything the body profile card shows. Ratios use the natural waist when logged, else the navel waist.
 * Body fat is the logged number if there is one, otherwise the Navy tape estimate.
 */
export function bodyProfile(rows: Measurement[], heightCm: number | null, weightKg: number | null, sex: Sex): BodyProfile {
  const { values, updated } = latestMeasures(rows);
  const waist = values.natural_waist_cm ?? values.waist_cm;
  const est = heightCm ? navyBodyFat(sex, heightCm, values.neck_cm, sex === 'male' ? values.waist_cm ?? waist : waist, values.hips_cm) : null;
  return {
    values,
    updated,
    heightCm,
    weightKg,
    bmi: heightCm && weightKg ? bmi(weightKg, heightCm) : null,
    bodyFat: values.body_fat_pct != null ? { pct: values.body_fat_pct, estimated: false } : est != null ? { pct: est, estimated: true } : null,
    waistToHeight: ratio(waist, heightCm),
    chestToWaist: ratio(values.chest_cm, waist),
    shoulderToWaist: ratio(values.shoulder_cm, waist),
  };
}
