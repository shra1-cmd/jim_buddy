import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestE1rm, formatDuration, sessionKcal, sessionVolume, setsPerMuscle, suggestLoad } from '../src/lib/training.ts';
import { matchScore, rankCandidates, tokens } from '../src/lib/grounding.ts';
import { beamTilt, fuelScore, trainingScore, weekProgress, weekStartKey } from '../src/lib/balance.ts';

const S = (kg: number | null, reps: number | null, extra: Partial<{ is_warmup: number; done: number }> = {}) => ({
  kg, reps, seconds: null, distance_m: null, is_warmup: 0, done: 1, ...extra,
});

test('double progression adds the increment only when every working set hit the top', () => {
  assert.deepEqual(suggestLoad([S(60, 10), S(60, 10), S(60, 10)], 10, 2.5, 'weight_reps'), { kg: 62.5, progressed: true });
  assert.deepEqual(suggestLoad([S(60, 10), S(60, 9)], 10, 2.5, 'weight_reps'), { kg: 60, progressed: false });
  // warm-ups and unfinished sets are ignored
  assert.deepEqual(suggestLoad([S(40, 5, { is_warmup: 1 }), S(60, 12), S(60, 3, { done: 0 })], 12, 2.5, 'weight_reps'), { kg: 62.5, progressed: true });
  // lateral raises move in small steps
  assert.deepEqual(suggestLoad([S(8, 20), S(8, 20)], 20, 1, 'weight_reps'), { kg: 9, progressed: true });
  // assisted pull-ups progress by removing assistance
  assert.deepEqual(suggestLoad([S(20, 10), S(20, 10)], 10, 2.5, 'assisted'), { kg: 17.5, progressed: true });
  assert.deepEqual(suggestLoad([], 10, 2.5, 'weight_reps'), { kg: null, progressed: false });
});

test('volume and e1RM ignore warm-ups', () => {
  const sets = [S(40, 10, { is_warmup: 1 }), S(60, 10), S(70, 5)];
  assert.equal(sessionVolume(sets), 600 + 350);
  assert.equal(bestE1rm(sets), 81.7); // 70 × (1 + 5/30) = 81.67
});

test('sets per muscle count primary 1 and secondary 0.5', () => {
  const muscles = (id: string) => (id === 'bench' ? { primary: ['chest'], secondary: ['triceps', 'deltoids'] } : undefined);
  const out = setsPerMuscle([{ exercise_id: 'bench', done: 1, is_warmup: 0 }, { exercise_id: 'bench', done: 1, is_warmup: 0 }, { exercise_id: 'bench', done: 0, is_warmup: 0 }], muscles);
  assert.deepEqual(out, { chest: 2, triceps: 1, deltoids: 1 });
});

test('session kcal is net of resting MET and capped', () => {
  const sets = [{ exercise_id: 'a', done: 1, is_warmup: 0 }, { exercise_id: 'b', done: 1, is_warmup: 0 }];
  const met = (id: string) => (id === 'a' ? 3.5 : 5.0);
  // avg MET 4.25 → (4.25 − 1) × 70 × 1 h = 227.5 → 228
  assert.equal(sessionKcal(sets, met, 70, 60), 228);
  assert.equal(sessionKcal(sets, met, 70, 300), 455);
  assert.equal(sessionKcal([], met, 70, 60), 0);
  assert.equal(formatDuration(95), '1:35');
});

test('grounding matches Indian dish names to database rows', () => {
  assert.deepEqual(tokens('Chapati/Roti'), ['chapati', 'roti']);
  assert.ok(matchScore('roti', 'Chapati/Roti') > 0.7);
  assert.ok(matchScore('2 rotis', 'Chapati/Roti') > 0.4);
  const foods = [
    { name: 'Vegetable biryani/biriyani', source: 'indb' },
    { name: 'Mutton biryani/biriyani', source: 'indb' },
    { name: 'Boiled rice (Uble chawal)', source: 'indb' },
  ];
  const ranked = rankCandidates('mutton biryani', foods);
  assert.equal(ranked[0].name, 'Mutton biryani/biriyani');
  assert.equal(rankCandidates('pizza', foods).length, 0);
});

test('balance scores and tilt', () => {
  assert.equal(fuelScore(1000, 2000, 120, 120), 0.5);
  assert.equal(trainingScore(2, 0), 2 / 3);
  assert.equal(beamTilt(0.5, 0.5, 0.5), 4); // on pace with training, half fuel → tips toward training
  assert.equal(beamTilt(1, 0, 1), -6);
  assert.equal(weekProgress(new Date(2026, 9, 5)), 1 / 7); // Monday
  assert.equal(weekStartKey(new Date(2026, 9, 3)), '2026-09-28'); // Saturday → Monday
});
