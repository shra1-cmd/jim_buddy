// ChatGPT hand-off: the prompts JimBuddy copies, and parsers for the pipe tables ChatGPT sends back.
// Pure (unit-tested), no React Native imports.
import { parseDays, parseSlot, type MenuSlot } from './menu.ts'; // explicit extension: these libs also run under node:test

export interface EstimatedItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MenuRow extends EstimatedItem {
  dow: number; // 1 Mon … 7 Sun
  slot: MenuSlot;
}

// ---------- prompts ----------

export function mealPrompt(o: { slot: string; place?: string; hint?: string }): string {
  const where = o.place ? ` (${o.place.toLowerCase()} food)` : '';
  const extra = o.hint?.trim() ? `\nContext: ${o.hint.trim()}.` : '';
  return `You are a careful nutrition estimator who knows Indian home, mess and restaurant food well.
Look at the photo I'm sending of my ${o.slot}${where}. List every separate food you can see and estimate each portion in grams.${extra}
Then give the nutrition for that portion (not per 100 g).
Reply ONLY with a table in exactly this format, one food per line, no other text:
item | grams | kcal | protein | carbs | fat | fiber
Use plain numbers (no units). If the food looks oily, add cooking oil/ghee as its own line.`;
}

export function menuPrompt(): string {
  return `You are a nutrition assistant who knows Indian hostel, PG and mess food well.
I'll send a photo of my weekly mess menu next. Work in two steps.

STEP 1 – Read the photo and list everything day by day (Monday to Sunday), grouped as breakfast, lunch, snacks and dinner.
Split combos into separate dishes ("Rice, Dal, Curd" → 3 dishes). Then ask me if anything is wrong or missing, and wait.
I may change dishes or skip meals I don't eat; keep updating the list until I say "final".

STEP 2 – When I say "final", reply ONLY with this table, one dish per line, no other text:
day | meal | item | grams | kcal | protein | carbs | fat | fiber
day = Mon, Tue, Wed, Thu, Fri, Sat, Sun or Daily (served every day) · meal = breakfast, lunch, snacks or dinner.
grams = a typical MEDIUM serving at an Indian mess; nutrition is for that serving (not per 100 g). Plain numbers only.`;
}

/** Asks ChatGPT for daily targets that fit the user's body and goal. */
export function targetsPrompt(o: { sex: string; age: number; heightCm: number; weightKg: number; activity: string; goal: string }): string {
  return `You are a sports nutritionist. Suggest my daily nutrition targets.
Me: ${o.sex}, ${o.age} years, ${o.heightCm} cm, ${o.weightKg} kg. Daily life: ${o.activity.toLowerCase()} (workouts not included). Goal: ${o.goal.toLowerCase()}.
I eat mostly Indian food and lift weights. Ask me anything that would change the answer (diet type, training days, health conditions).
When we agree, end with one line in exactly this format:
kcal | protein g | carbs g | fat g | fiber g`;
}

// ---------- parsing ----------

const num = (s: string | undefined): number => {
  const m = (s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

function cells(raw: string): string[] | null {
  const line = raw.trim().replace(/^\|/, '').replace(/\|$/, '');
  if (!line.includes('|')) return null;
  return line.split('|').map((c) => c.trim().replace(/\*\*/g, ''));
}

const isRule = (s: string) => /^[-:\s]*$/.test(s);
const isHeaderWord = (s: string) => /^(item|food|dish|total|day|meal)s?$/i.test(s.trim());

function nutrition(cols: string[], name: string): EstimatedItem | null {
  const [grams, kcal, protein, carbs, fat] = cols.slice(0, 5).map(num);
  const fiber = cols.length > 5 ? num(cols[5]) : 0;
  if (![grams, kcal, protein, carbs, fat].every(Number.isFinite) || kcal < 0 || grams <= 0) return null;
  return { name, grams, kcal, protein, carbs, fat, fiber: Number.isFinite(fiber) ? fiber : 0 };
}

/** "item | grams | kcal | protein | carbs | fat | fiber" lines (markdown tables are fine). */
export function parseMealReply(reply: string): EstimatedItem[] {
  const out: EstimatedItem[] = [];
  for (const raw of reply.split(/\r?\n/)) {
    const c = cells(raw);
    if (!c || c.length < 6) continue;
    const name = c[0];
    if (!name || isRule(name) || isHeaderWord(name)) continue;
    const it = nutrition(c.slice(1), name);
    if (it) out.push(it);
  }
  return out;
}

/** "day | meal | item | grams | kcal | protein | carbs | fat | fiber" → one row per day the dish is served. */
export function parseMenuReply(reply: string): { rows: MenuRow[]; skipped: number } {
  const rows: MenuRow[] = [];
  let skipped = 0;
  for (const raw of reply.split(/\r?\n/)) {
    const c = cells(raw);
    if (!c || c.length < 8) continue;
    const [dayCell, mealCell, name] = c;
    if (isRule(dayCell) || isHeaderWord(dayCell) || !name || isHeaderWord(name)) continue;
    const days = parseDays(dayCell);
    const slot = parseSlot(mealCell);
    const it = nutrition(c.slice(3), name);
    if (!days.length || !slot || !it) {
      skipped++;
      continue;
    }
    for (const dow of days) rows.push({ ...it, dow, slot });
  }
  return { rows, skipped };
}

/** Scale an estimate to a new gram amount. */
export function scaleItem<T extends EstimatedItem>(it: T, grams: number): T {
  const f = it.grams > 0 ? grams / it.grams : 0;
  const r = (v: number) => Math.round(v * f * 10) / 10;
  return { ...it, grams: Math.round(grams), kcal: Math.round(it.kcal * f), protein: r(it.protein), carbs: r(it.carbs), fat: r(it.fat), fiber: r(it.fiber) };
}
