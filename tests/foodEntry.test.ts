import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAmount, validateFoodEntry, type EntryInput } from '../src/lib/foodEntry.ts';

const blank: EntryInput = { name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' };

test('amounts: blank, decimals and junk', () => {
  assert.equal(parseAmount('  '), null);
  assert.equal(parseAmount('12.5'), 12.5);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.ok(Number.isNaN(parseAmount('12g')));
  assert.ok(Number.isNaN(parseAmount('-3')));
});

test('quick add: calories alone are enough; blank macros count as 0', () => {
  const { value, errors } = validateFoodEntry({ ...blank, kcal: '250' });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { name: '', kcal: 250, protein: 0, carbs: 0, fat: 0, fiber: 0 });
});

test('quick add: every field filled, with a decimal comma', () => {
  const { value } = validateFoodEntry({ name: ' Poha ', kcal: '180', protein: '3,5', carbs: '30', fat: '5', fiber: '2' });
  assert.deepEqual(value, { name: 'Poha', kcal: 180, protein: 3.5, carbs: 30, fat: 5, fiber: 2 });
});

test('quick add: missing or invalid fields get their own message', () => {
  assert.deepEqual(validateFoodEntry(blank).errors, { kcal: 'Enter the calories' });
  assert.equal(validateFoodEntry({ ...blank, kcal: '0' }).errors.kcal, 'Calories must be more than 0');
  assert.equal(validateFoodEntry({ ...blank, kcal: '99999' }).errors.kcal, 'That’s over 10,000 kcal. Check the number');
  const bad = validateFoodEntry({ ...blank, kcal: 'lots', protein: '12g', fat: '-1' });
  assert.equal(bad.value, null);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['fat', 'kcal', 'protein']);
  assert.equal(bad.errors.protein, 'Use a number like 12 or 12.5');
});

test('quick add: a name is needed only to save the food', () => {
  assert.equal(validateFoodEntry({ ...blank, kcal: '100' }, { requireName: true }).errors.name, 'Add a name to save this food');
  assert.ok(validateFoodEntry({ ...blank, name: 'Chikki', kcal: '100' }, { requireName: true }).value);
});
