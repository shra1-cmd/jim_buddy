import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mealPrompt, menuPrompt, parseMealReply, parseMenuReply, scaleItem } from '../src/lib/chatgpt.ts';
import { dowOfKey, parseDays, parseSlot, portionFactor } from '../src/lib/menu.ts';

test('meal table: markdown, header, separator and total rows are ignored', () => {
  const reply = `Here you go:
| item | grams | kcal | protein | carbs | fat | fiber |
|---|---|---|---|---|---|---|
| Chapati | 80 g | 240 | 7.5 | 40 | 6 | 4 |
| **Dal tadka** | 150 | 180 | 9 | 22 | 6 | 5 |
| Total | 230 | 420 | 16.5 | 62 | 12 | 9 |`;
  const items = parseMealReply(reply);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { name: 'Chapati', grams: 80, kcal: 240, protein: 7.5, carbs: 40, fat: 6, fiber: 4 });
  assert.equal(items[1].name, 'Dal tadka');
  assert.equal(parseMealReply('Paneer butter masala | 200 | 420 | 14 | 12 | 34')[0].fiber, 0);
});

test('scaling keeps proportions', () => {
  const s = scaleItem({ name: 'Rice', grams: 200, kcal: 260, protein: 5, carbs: 56, fat: 0.6, fiber: 0.8 }, 100);
  assert.equal(s.kcal, 130);
  assert.equal(s.carbs, 28);
});

test('day cells: single, ranges, lists, daily, weekdays', () => {
  assert.deepEqual(parseDays('Monday'), [1]);
  assert.deepEqual(parseDays('thurs'), [4]);
  assert.deepEqual(parseDays('Mon-Wed'), [1, 2, 3]);
  assert.deepEqual(parseDays('Fri to Mon'), [5, 6, 7, 1]);
  assert.deepEqual(parseDays('Mon, Wed & Fri'), [1, 3, 5]);
  assert.deepEqual(parseDays('Daily'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(parseDays('weekends'), [6, 7]);
  assert.deepEqual(parseDays('someday'), []);
});

test('meal cells map onto journal meals', () => {
  assert.equal(parseSlot('Tiffin'), 'breakfast');
  assert.equal(parseSlot('Evening snacks'), 'snacks');
  assert.equal(parseSlot('Supper'), 'dinner');
  assert.equal(parseSlot('LUNCH'), 'lunch');
  assert.equal(parseSlot('xyz'), null);
});

test('menu table expands "Daily" rows and skips unreadable lines', () => {
  const reply = `| day | meal | item | grams | kcal | protein | carbs | fat | fiber |
|---|---|---|---|---|---|---|---|---|
| Mon | Breakfast | Idli | 120 | 170 | 5 | 34 | 1 | 2 |
| Mon | Lunch | Rice | 200 | 260 | 5 | 56 | 0.6 | 0.8 |
| Daily | Snacks | Tea with milk | 150 | 90 | 3 | 12 | 3 | 0 |
| Funday | Dinner | Mystery | 100 | 100 | 1 | 1 | 1 | 1 |`;
  const { rows, skipped } = parseMenuReply(reply);
  assert.equal(skipped, 1);
  assert.equal(rows.length, 2 + 7);
  assert.deepEqual(rows[0], { name: 'Idli', grams: 120, kcal: 170, protein: 5, carbs: 34, fat: 1, fiber: 2, dow: 1, slot: 'breakfast' });
  assert.equal(rows.filter((r) => r.slot === 'snacks').length, 7);
});

test('portions and weekdays', () => {
  assert.equal(portionFactor('low'), 0.5);
  assert.equal(portionFactor('high'), 1.5);
  assert.equal(dowOfKey('2026-10-05'), 1); // a Monday
  assert.equal(dowOfKey('2026-10-04'), 7); // a Sunday
});

test('prompts carry the exact table formats', () => {
  assert.match(mealPrompt({ slot: 'lunch', place: 'Mess', hint: '2 rotis' }), /item \| grams \| kcal \| protein \| carbs \| fat \| fiber/);
  assert.match(mealPrompt({ slot: 'lunch', place: 'Mess' }), /mess food/);
  assert.match(menuPrompt(), /day \| meal \| item \| grams/);
});
