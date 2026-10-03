// Accuracy eval for the meal scan, run against your deployed proxy.
//
// 1. Photograph ~30 real meals. Weigh every component on a kitchen scale (and the oil/ghee for home-cooked ones).
// 2. Put the photos in eval/photos/ and fill eval/meals.json (see meals.example.json).
// 3. PROXY_URL=https://jimbuddy-proxy.<you>.workers.dev TOKEN=your-invite-token node eval/run-eval.mjs
//
// It scores what the model is responsible for: item recall and gram error per matched item.
// Calorie error is computed by the app from the food database, so weigh-and-log your truth meals there too.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { PROXY_URL, TOKEN } = process.env;
if (!PROXY_URL || !TOKEN) throw new Error('Set PROXY_URL and TOKEN');
const dir = new URL('.', import.meta.url).pathname;
const meals = JSON.parse(readFileSync(join(dir, 'meals.json'), 'utf8'));

const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
const sameFood = (a, b) => norm(a).some((w) => norm(b).includes(w));

let truthItems = 0, found = 0, gramErrPct = [];
for (const m of meals) {
  const image = readFileSync(join(dir, 'photos', m.photo)).toString('base64');
  const r = await fetch(`${PROXY_URL}/v1/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-invite-token': TOKEN },
    body: JSON.stringify({ image, hint: m.hint ?? '', slot: m.slot ?? 'lunch', place: m.place ?? '' }),
  });
  const { result, error } = await r.json();
  if (error) { console.log(m.photo, 'ERROR', error); continue; }
  for (const t of m.items) {
    truthItems++;
    const hit = result.items.find((p) => sameFood(p.name, t.name));
    if (hit) {
      found++;
      gramErrPct.push(Math.abs(hit.grams - t.grams) / t.grams);
    }
    console.log(`${m.photo}  ${t.name.padEnd(22)} truth ${String(t.grams).padStart(4)} g   model ${hit ? `${hit.grams} g (${hit.name})` : 'MISSED'}`);
  }
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`\nItem recall: ${found}/${truthItems} = ${(100 * found / Math.max(1, truthItems)).toFixed(0)}%`);
console.log(`Mean gram error on matched items: ${(100 * mean(gramErrPct)).toFixed(0)}%`);
