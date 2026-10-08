import { test } from 'node:test';
import assert from 'node:assert/strict';
import { macroKcal } from '../src/lib/targets.ts';
import { keyForDowThisWeek } from '../src/lib/menu.ts';
import { menuPrompt, targetsPrompt } from '../src/lib/chatgpt.ts';

test('macro calories use 4/4/9', () => {
  assert.equal(macroKcal(140, 200, 60), 140 * 4 + 200 * 4 + 60 * 9);
});

test('weekday dates stay inside the Monday–Sunday week', () => {
  // 2026-10-08 is a Thursday
  assert.equal(keyForDowThisWeek('2026-10-08', 4), '2026-10-08');
  assert.equal(keyForDowThisWeek('2026-10-08', 1), '2026-10-05');
  assert.equal(keyForDowThisWeek('2026-10-08', 7), '2026-10-11');
  // across a month boundary
  assert.equal(keyForDowThisWeek('2026-10-01', 1), '2026-09-28');
});

test('menu prompt asks for review before the final table', () => {
  assert.match(menuPrompt(), /final/);
  assert.match(menuPrompt(), /day \| meal \| item \| grams/);
});

test('targets prompt carries body stats and the reply format', () => {
  const p = targetsPrompt({ sex: 'male', age: 27, heightCm: 175, weightKg: 72, activity: 'Desk job', goal: 'Recomposition' });
  assert.match(p, /27 years, 175 cm, 72 kg/);
  assert.match(p, /kcal \| protein g \| carbs g \| fat g \| fiber g/);
});

test('signed calories read as plus / minus', async () => {
  const { signedKcal } = await import('../src/lib/targets.ts');
  assert.equal(signedKcal(350.4), '+350');
  assert.equal(signedKcal(-120), '−120');
  assert.equal(signedKcal(0), '0');
});

test('set fields: kg/reps round-trip and "filled" rules', async () => {
  const { fromDraft, isFilled, setLabel, toDraft } = await import('../src/lib/setFields.ts');
  const v = fromDraft({ a: '22,5', b: '8' }, 'weight_reps');
  assert.deepEqual(v, { kg: 22.5, reps: 8, seconds: null, distance_m: null });
  assert.equal(isFilled(v, 'weight_reps'), true);
  assert.equal(isFilled(fromDraft({ a: '20', b: '' }, 'weight_reps'), 'weight_reps'), false); // kg alone isn't a set
  assert.deepEqual(toDraft(v, 'weight_reps'), { a: '22.5', b: '8' });
  assert.equal(setLabel(v, 'weight_reps'), '22.5 kg × 8');
  assert.equal(isFilled(fromDraft({ a: '45', b: '' }, 'time'), 'time'), true);
  assert.equal(fromDraft({ a: '-3', b: '' }, 'reps').reps, null);
});
