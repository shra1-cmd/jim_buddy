import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bmi, bmiBand, bodyProfile, latestMeasures, MEASURES, measureRange, navyBodyFat, type Measurement } from '../src/lib/measures.ts';

const row = (local_date: string, v: Partial<Measurement>): Measurement =>
  ({ local_date, ...Object.fromEntries(MEASURES.map((m) => [m.key, null])), ...v }) as Measurement;

test('latest value per field comes from the newest entry that has it', () => {
  const rows = [
    row('2026-10-01', { waist_cm: 86, chest_cm: 100, neck_cm: 38 }),
    row('2026-10-15', { waist_cm: 84 }),
  ];
  const { values, updated } = latestMeasures(rows);
  assert.equal(values.waist_cm, 84);
  assert.equal(values.chest_cm, 100);
  assert.equal(values.neck_cm, 38);
  assert.equal(values.hips_cm, undefined);
  assert.equal(updated, '2026-10-15');
  assert.deepEqual(latestMeasures([]), { values: {}, updated: null });
});

test('BMI and its band', () => {
  assert.equal(bmi(72, 175), 23.5);
  assert.equal(bmi(72, 0), null);
  assert.equal(bmiBand(23.5), 'healthy');
  assert.equal(bmiBand(17), 'under');
  assert.equal(bmiBand(27), 'over');
  assert.equal(bmiBand(31), 'obese');
});

test('Navy tape body fat', () => {
  assert.equal(navyBodyFat('male', 178, 38, 85), 16.4);
  assert.equal(navyBodyFat('male', 178, 38, 30), null); // waist under neck: not a real reading
  assert.equal(navyBodyFat('female', 165, 33, 75), null); // women need hips
  assert.equal(navyBodyFat('female', 165, 33, 75, 98), 28.4);
});

test('body profile: logged body fat wins over the estimate; ratios prefer the natural waist', () => {
  const p = bodyProfile([row('2026-10-20', { neck_cm: 38, waist_cm: 85, natural_waist_cm: 80, chest_cm: 100, shoulder_cm: 120 })], 178, 74, 'male');
  assert.equal(p.bmi, 23.4);
  assert.deepEqual(p.bodyFat, { pct: 16.4, estimated: true });
  assert.equal(p.waistToHeight, 0.45);
  assert.equal(p.chestToWaist, 1.25);
  assert.equal(p.shoulderToWaist, 1.5);

  const logged = bodyProfile([row('2026-10-20', { neck_cm: 38, waist_cm: 85, body_fat_pct: 14 })], 178, 74, 'male');
  assert.deepEqual(logged.bodyFat, { pct: 14, estimated: false });

  const none = bodyProfile([], null, null, 'female');
  assert.equal(none.bmi, null);
  assert.equal(none.bodyFat, null);
  assert.equal(none.updated, null);
});

test('input ranges per field', () => {
  assert.deepEqual(measureRange('body_fat_pct'), [3, 60]);
  assert.deepEqual(measureRange('wrist_l_cm'), [10, 30]);
  assert.deepEqual(measureRange('waist_cm'), [15, 250]);
});
