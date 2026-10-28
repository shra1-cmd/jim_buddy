import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mealPrompt, menuPrompt, parseMealReply, parseMenuReply, readMealReply, rowErrorText, scaleItem, toNumber } from '../src/lib/chatgpt.ts';
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

// ---------- pasted meal tables (Scan meal → "Paste ChatGPT's answer") ----------

const BREAKFAST = [
  'Milk (200 ml) | 200 | 122 | 6.4 | 9.6 | 6.6 | 0',
  'Rolled oats | 80 | 311 | 13.5 | 53.0 | 5.5 | 8.1',
  'Whey protein | 30 | 120 | 24.0 | 3.0 | 2.0 | 0',
];
const names = (r: string) => parseMealReply(r).map((i) => i.name);

test('regression: a table copied from ChatGPT’s rendered reply is tab-separated, with no pipes', () => {
  const copied = ['item\tgrams\tkcal\tprotein\tcarbs\tfat\tfiber', ...BREAKFAST.map((l) => l.split(' | ').join('\t'))].join('\n');
  const { items, errors } = readMealReply(copied);
  assert.deepEqual(errors, []);
  assert.deepEqual(items.map((i) => i.name), ['Milk (200 ml)', 'Rolled oats', 'Whey protein']);
  assert.deepEqual(items[1], { name: 'Rolled oats', grams: 80, kcal: 311, protein: 13.5, carbs: 53, fat: 5.5, fiber: 8.1 });
});

test('regression: one cell per line (text selected on Android) still reads', () => {
  const copied = ['item', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'fiber', ...BREAKFAST.flatMap((l) => l.split(' | '))].join('\n');
  assert.deepEqual(names(copied), ['Milk (200 ml)', 'Rolled oats', 'Whey protein']);
});

test('plain pipe rows with decimals', () => {
  const items = parseMealReply(BREAKFAST.join('\n'));
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], { name: 'Milk (200 ml)', grams: 200, kcal: 122, protein: 6.4, carbs: 9.6, fat: 6.6, fiber: 0 });
  assert.equal(items[2].protein, 24);
});

test('markdown table inside a code block, with header, separator, bold and a Total row', () => {
  const reply = `Here is your breakfast:
\`\`\`
| **Item** | Grams | Kcal | Protein (g) | Carbs (g) | Fat (g) | Fiber (g) |
|:---|---:|---:|---:|---:|---:|---:|
| ${BREAKFAST.join(' |\n| ')} |
| **Total** | 310 | 553 | 43.9 | 65.6 | 14.1 | 8.1 |
\`\`\``;
  const { items, errors } = readMealReply(reply);
  assert.deepEqual(errors, []);
  assert.deepEqual(items.map((i) => i.name), ['Milk (200 ml)', 'Rolled oats', 'Whey protein']);
  assert.equal(items.reduce((a, i) => a + i.kcal, 0), 553);
});

test('extra spaces, blank lines, box-drawing pipes and every line ending', () => {
  const spaced = ['', '   Milk (200 ml)   |200|  122 |6.4|9.6 | 6.6|0   ', '', '\t', ' Rolled oats │ 80 │ 311 │ 13.5 │ 53 │ 5.5 │ 8.1', ''].join('\n');
  assert.deepEqual(names(spaced), ['Milk (200 ml)', 'Rolled oats']);
  for (const eol of ['\n', '\r\n', '\r', '\u2028']) assert.equal(parseMealReply(BREAKFAST.join(eol)).length, 3, JSON.stringify(eol));
});

test('names with parentheses, commas, hyphens and numbers; list markers dropped', () => {
  const reply = `- 2 eggs, boiled (large) | 100 | 155 | 12.6 | 1.1 | 10.6 | 0
1. Aloo-paratha (with 1 tsp ghee) | 150 | 420 | 8 | 52 | 20 | 4`;
  assert.deepEqual(names(reply), ['2 eggs, boiled (large)', 'Aloo-paratha (with 1 tsp ghee)']);
});

test('numbers: units, approx signs, decimal commas, thousands, dashes for zero', () => {
  assert.equal(toNumber('80 g'), 80);
  assert.equal(toNumber('~120'), 120);
  assert.equal(toNumber('6,4'), 6.4);
  assert.equal(toNumber('1,050'), 1050);
  assert.ok(Number.isNaN(toNumber('abc')));
  const [b] = parseMealReply('Chicken biryani | 450 g | 1,050 kcal | 38 | 120 | 45 | —');
  assert.deepEqual(b, { name: 'Chicken biryani', grams: 450, kcal: 1050, protein: 38, carbs: 120, fat: 45, fiber: 0 });
});

test('rows with too few or too many parts are reported, good rows still load', () => {
  const reply = [BREAKFAST[0], 'Banana | 120 | 107 | 1.3', `${BREAKFAST[1]} | extra | 9`, BREAKFAST[2]].join('\n');
  const { items, errors } = readMealReply(reply);
  assert.deepEqual(items.map((i) => i.name), ['Milk (200 ml)', 'Whey protein']);
  assert.deepEqual(errors.map((e) => e.line), [2, 3]);
  assert.match(errors[0].reason, /4 parts; it needs 7/);
  assert.match(errors[1].reason, /9 parts/);
  assert.match(rowErrorText(errors), /^Line 2 \(Banana \| 120 \| 107 \| 1\.3\): it has 4 parts/);
});

test('invalid, missing and negative numbers are reported with the field name', () => {
  const { items, errors } = readMealReply(`Oats | 80 | 311 | abc | 53 | 5.5 | 8.1
Curd | 100 | | 3.1 | 4.7 | 4 | 0
Ghee | 10 | 90 | 0 | 0 | -10 | 0
Air | 0 | 0 | 0 | 0 | 0 | 0
Tea | 150 | Infinity | 3 | 12 | 3 | 0`);
  assert.equal(items.length, 0);
  assert.deepEqual(errors.map((e) => e.reason), [
    'protein isn’t a number (“abc”)',
    'kcal is missing',
    'fat can’t be negative',
    'grams must be more than 0',
    'kcal isn’t a number (“Infinity”)',
  ]);
});

test('empty clipboard and plain prose give nothing, without errors', () => {
  for (const t of ['', '   \n\n', 'Sorry, I can’t see the photo clearly. Could you send another?']) {
    assert.deepEqual(readMealReply(t), { items: [], errors: [] });
  }
});

test('a valid table followed by irrelevant text', () => {
  const reply = `${BREAKFAST.join('\n')}

Notes: values are approximate | portions estimated from the photo.
Want me to suggest a higher-protein option?`;
  assert.deepEqual(readMealReply(reply), { items: parseMealReply(BREAKFAST.join('\n')), errors: [] });
});

test('prompts ask for a code block and no separate oil line', () => {
  const p = mealPrompt({ slot: 'breakfast' });
  assert.match(p, /code block/);
  assert.match(p, /don't list it as a separate line/);
  assert.match(menuPrompt(), /code block/);
});

test('menu table also reads when copied as tabs', () => {
  const { rows, skipped } = parseMenuReply('Mon\tBreakfast\tIdli\t120\t170\t5\t34\t1\t2\nTotal\tday\t\t\t\t\t\t\t');
  assert.equal(skipped, 0);
  assert.deepEqual(rows[0], { name: 'Idli', grams: 120, kcal: 170, protein: 5, carbs: 34, fat: 1, fiber: 2, dow: 1, slot: 'breakfast' });
});
