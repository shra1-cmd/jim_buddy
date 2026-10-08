import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sportKcal, stepBaseline, stepsKcal } from '../src/lib/activity.ts';

test('steps: 100 steps ≈ 3.3 kcal, every step counts', () => {
  assert.equal(stepBaseline(1.2), 5000);
  assert.equal(stepsKcal(100), 3);
  assert.equal(stepsKcal(1000), 33);
  assert.equal(stepsKcal(10000), 330);
  assert.equal(stepsKcal(-50), 0);
});

test('sport kcal is net of resting and capped', () => {
  assert.equal(sportKcal(5.5, 72, 60), 324);
  assert.equal(sportKcal(5.5, 72, 600), sportKcal(5.5, 72, 180));
  assert.equal(sportKcal(5.5, 72, -5), 0);
});
