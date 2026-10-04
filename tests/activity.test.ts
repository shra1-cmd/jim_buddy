import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sportKcal, stepBaseline, stepsKcal } from '../src/lib/activity.ts';

test('steps only count above the activity baseline', () => {
  assert.equal(stepBaseline(1.2), 5000);
  assert.equal(stepBaseline(1.375), 7500);
  assert.equal(stepsKcal(4000, 72, 5000), 0);
  assert.equal(stepsKcal(10000, 72, 5000), 137); // 5000 × 72 × 0.00038
});

test('sport kcal is net of resting and capped', () => {
  assert.equal(sportKcal(5.5, 72, 60), 324);
  assert.equal(sportKcal(5.5, 72, 600), sportKcal(5.5, 72, 180));
  assert.equal(sportKcal(5.5, 72, -5), 0);
});
