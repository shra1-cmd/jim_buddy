import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmr, caloriesLeft, computeTargets, e1rm, workoutKcal } from '../src/lib/targets.ts';
import { forGrams, quantityLabel, sum } from '../src/lib/nutrition.ts';
import { addDays, todayKey } from '../src/lib/dates.ts';
import { movingAverage, weeklyRate } from '../src/lib/progress.ts';

test('Mifflin–St Jeor matches hand calculation', () => {
  // 10*72 + 6.25*175 - 5*27 + 5 = 720 + 1093.75 - 135 + 5 = 1683.75
  assert.equal(bmr({ sex: 'male', age: 27, heightCm: 175, weightKg: 72 }), 1683.75);
  assert.equal(bmr({ sex: 'female', age: 27, heightCm: 160, weightKg: 55 }), 550 + 1000 - 135 - 161);
});

test('recomp targets: ~7.5% under maintenance, 2.1 g/kg protein, macros add up', () => {
  const t = computeTargets({ sex: 'male', age: 27, heightCm: 175, weightKg: 72, activity: 1.2, goal: 'recomp' });
  // maintenance 1683.75*1.2 = 2020.5 → *0.925 = 1868.96 → 1870
  assert.equal(t.kcal, 1870);
  assert.equal(t.proteinG, 151);
  const macroKcal = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
  assert.ok(Math.abs(macroKcal - t.kcal) <= 8, `macro kcal ${macroKcal} vs ${t.kcal}`);
  assert.equal(t.fiberG, 26);
});

test('calories left applies eat-back share', () => {
  assert.equal(caloriesLeft(2000, 1500, 300, 50), 650);
  assert.equal(caloriesLeft(2000, 2100, 0, 50), -100);
});

test('workout kcal is net of resting MET and capped at 2 h', () => {
  assert.equal(workoutKcal(3.5, 70, 60), 175);
  assert.equal(workoutKcal(3.5, 70, 240), 350);
});

test('Epley e1RM', () => {
  assert.equal(e1rm(60, 10), 80);
  assert.equal(e1rm(100, 1), 100);
});

test('portion maths and totals', () => {
  const roti = { k: 202, p: 5.9, c: 30, f: 6, fb: 4 };
  assert.deepEqual(forGrams(roti, 36), { kcal: 73, protein: 2.1, carbs: 10.8, fat: 2.2, fiber: 1.4 });
  assert.equal(sum([forGrams(roti, 36), forGrams(roti, 36)]).kcal, 146);
  assert.equal(quantityLabel(1.5, 'chapati'), '1.5 chapati');
  assert.equal(quantityLabel(120, null), '120 g');
});

test('day starts at 4 am', () => {
  assert.equal(todayKey(new Date(2026, 9, 3, 0, 30)), '2026-10-02');
  assert.equal(todayKey(new Date(2026, 9, 3, 4, 1)), '2026-10-03');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('7-day moving average and weekly rate', () => {
  const pts = Array.from({ length: 15 }, (_, i) => ({ date: addDays('2026-09-01', i), value: 80 - i * 0.1 }));
  const s = movingAverage(pts, 7);
  assert.equal(s.length, 15);
  assert.equal(s[0].value, 80);
  const r = weeklyRate(s)!;
  assert.ok(r < -0.5 && r > -0.8, `rate ${r}`);
});
