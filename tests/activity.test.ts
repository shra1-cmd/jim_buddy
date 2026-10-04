import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatGptPrompt, parseChatGptReply, scaleItem, sportKcal, stepBaseline, stepsKcal } from '../src/lib/activity.ts';

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

test('parses a ChatGPT markdown table and ignores header, separator and total rows', () => {
  const reply = `Here you go:
| item | grams | kcal | protein | carbs | fat | fiber |
|---|---|---|---|---|---|---|
| Chapati | 80 g | 240 | 7.5 | 40 | 6 | 4 |
| **Dal tadka** | 150 | 180 | 9 | 22 | 6 | 5 |
| Total | 230 | 420 | 16.5 | 62 | 12 | 9 |`;
  const items = parseChatGptReply(reply);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { name: 'Chapati', grams: 80, kcal: 240, protein: 7.5, carbs: 40, fat: 6, fiber: 4 });
  assert.equal(items[1].name, 'Dal tadka');
});

test('plain pipe lines without fiber still parse', () => {
  const items = parseChatGptReply('Paneer butter masala | 200 | 420 | 14 | 12 | 34');
  assert.equal(items.length, 1);
  assert.equal(items[0].fiber, 0);
});

test('scaling keeps proportions', () => {
  const s = scaleItem({ name: 'Rice', grams: 200, kcal: 260, protein: 5, carbs: 56, fat: 0.6, fiber: 0.8 }, 100);
  assert.equal(s.kcal, 130);
  assert.equal(s.carbs, 28);
});

test('prompt carries the format and context', () => {
  const p = chatGptPrompt('photo', { slot: 'lunch', place: 'Mess', hint: '2 rotis' });
  assert.match(p, /item \| grams \| kcal/);
  assert.match(p, /mess food/);
  assert.match(p, /2 rotis/);
});
