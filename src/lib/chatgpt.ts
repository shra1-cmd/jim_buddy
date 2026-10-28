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

export const MEAL_COLUMNS = 'item | grams | kcal | protein | carbs | fat | fiber';
export const MEAL_EXAMPLE = 'Rolled oats | 80 | 311 | 13.5 | 53 | 5.5 | 8.1';

export function mealPrompt(o: { slot: string; place?: string; hint?: string }): string {
  const where = o.place ? ` (${o.place.toLowerCase()} food)` : '';
  const extra = o.hint?.trim() ? `\nContext: ${o.hint.trim()}.` : '';
  return `You are a careful nutrition estimator who knows Indian home, mess and restaurant food well.
Look at the photo I'm sending of my ${o.slot}${where}. List every separate food you can see and estimate each portion in grams.${extra}
Then give the nutrition for that portion (not per 100 g).
Reply with ONLY a code block (inside \`\`\`) holding this table, one food per line, no other text:
${MEAL_COLUMNS}
Example line: ${MEAL_EXAMPLE}
Rules: exactly 7 parts per line, plain numbers with no units, a dot for decimals, no commas inside numbers, no Total row.
Count cooking oil/ghee inside each dish's numbers; don't list it as a separate line.`;
}

export function menuPrompt(): string {
  return `You are a nutrition assistant who knows Indian hostel, PG and mess food well.
I'll send a photo of my weekly mess menu next. Work in two steps.

STEP 1 – Read the photo and list everything day by day (Monday to Sunday), grouped as breakfast, lunch, snacks and dinner.
Split combos into separate dishes ("Rice, Dal, Curd" → 3 dishes). Then ask me if anything is wrong or missing, and wait.
I may change dishes or skip meals I don't eat; keep updating the list until I say "final".

STEP 2 – When I say "final", reply with ONLY a code block (inside \`\`\`) holding this table, one dish per line, no other text:
day | meal | item | grams | kcal | protein | carbs | fat | fiber
day = Mon, Tue, Wed, Thu, Fri, Sat, Sun or Daily (served every day) · meal = breakfast, lunch, snacks or dinner.
grams = a typical MEDIUM serving at an Indian mess; nutrition is for that serving (not per 100 g).
Plain numbers with no units, a dot for decimals, no commas inside numbers, no Total rows. Count cooking oil/ghee inside each dish.`;
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
// ChatGPT's reply reaches the clipboard in several shapes: markdown pipes (Copy button, code block),
// tab-separated cells (copying the rendered table), or one cell per line (selecting text on Android).

export interface RowError {
  line: number; // 1-based line in the pasted text
  text: string;
  reason: string;
}

const FIELDS = ['grams', 'kcal', 'protein', 'carbs', 'fat', 'fiber'] as const;
const LINE_BREAK = /\r\n|[\r\n\u0085\u2028\u2029]/;

/** "80", "7.5", "6,4", "1,050", "~120", "80 g" → number; NaN when the cell holds no number. */
export function toNumber(s: string | undefined): number {
  let t = (s ?? '').trim();
  t = /\d{1,3}(,\d{3})+(?!\d)/.test(t) && !/\d,\d{1,2}(?!\d)/.test(t) ? t.replace(/,/g, '') : t.replace(/(\d),(\d)/, '$1.$2');
  const m = t.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

const isNumberCell = (s: string) => /^[~≈]?\s*-?\d[\d.,]*\s*(g|gm|grams?|ml|kcal|cal)?$/i.test(s.trim());
const isDash = (s: string) => /^[-–—]$/.test(s.trim());
const clean = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/ /g, ' ').trim();

function cells(raw: string): string[] | null {
  let line = clean(raw.replace(/[│┃｜¦]/g, '|'));
  if (!line.includes('|')) {
    if (!line.includes('\t')) return null;
    line = line.replace(/\t/g, '|');
  }
  line = line.replace(/^\|/, '').replace(/\|$/, '');
  return line.split('|').map(clean);
}

const isRule = (s: string) => /^[-:\s]*$/.test(s);
const isHeaderWord = (s: string) => /^(item|food|dish|total|day|meal)s?$/i.test(s.trim());
const isTotal = (s: string) => /^(grand\s+)?(total|sum|overall)\b/i.test(s.trim());
/** A header or prose row: none of the cells after the name holds a digit. */
const isHeaderRow = (c: string[]) => isHeaderWord(c[0]) || !c.slice(1).some((x) => /\d/.test(x));
/** Drops list markers ChatGPT sometimes adds: "- Idli", "1. Idli". */
const itemName = (s: string) => clean(s).replace(/^([-*•]\s+|\d+[.)]\s+)/, '').trim();

/** cols = grams, kcal, protein, carbs, fat[, fiber]. Returns the item, or why the row is unusable. */
function nutrition(cols: string[], name: string): EstimatedItem | string {
  if (!name) return 'the item name is empty';
  const v: number[] = [];
  for (let i = 0; i < FIELDS.length; i++) {
    const f = FIELDS[i];
    const cell = cols[i];
    if (cell === undefined && f === 'fiber') {
      v.push(0);
      continue;
    }
    if (!cell?.trim()) return `${f} is missing`;
    const n = i >= 2 && isDash(cell) ? 0 : toNumber(cell);
    if (!Number.isFinite(n)) return `${f} isn’t a number (“${cell}”)`;
    if (n < 0) return `${f} can’t be negative`;
    v.push(n);
  }
  const [grams, kcal, protein, carbs, fat, fiber] = v;
  if (grams <= 0) return 'grams must be more than 0';
  return { name, grams, kcal, protein, carbs, fat, fiber };
}

/** One cell per line: a name followed by six number lines. */
function stacked(lines: string[]): EstimatedItem[] {
  const t = lines.map(clean).filter(Boolean);
  const out: EstimatedItem[] = [];
  for (let i = 0; i + 6 < t.length; ) {
    const run = t.slice(i + 1, i + 7);
    if (!isNumberCell(t[i]) && run.every(isNumberCell)) {
      const it = isTotal(t[i]) ? null : nutrition(run, itemName(t[i]));
      if (it && typeof it !== 'string') out.push(it);
      i += 7;
    } else i++;
  }
  return out;
}

/** "item | grams | kcal | protein | carbs | fat | fiber" lines, plus the lines that look like food rows but can't be used. */
export function readMealReply(reply: string): { items: EstimatedItem[]; errors: RowError[] } {
  const items: EstimatedItem[] = [];
  const errors: RowError[] = [];
  const lines = reply.split(LINE_BREAK);
  lines.forEach((raw, i) => {
    const c = cells(raw);
    if (!c || c.every(isRule) || isHeaderRow(c) || isTotal(c[0])) return;
    const it =
      c.length === 6 || c.length === 7
        ? nutrition(c.slice(1), itemName(c[0]))
        : `it has ${c.length} parts; it needs 7 (${MEAL_COLUMNS})`;
    if (typeof it === 'string') errors.push({ line: i + 1, text: raw.trim(), reason: it });
    else items.push(it);
  });
  if (!items.length && !errors.length) items.push(...stacked(lines));
  return { items, errors };
}

export function parseMealReply(reply: string): EstimatedItem[] {
  return readMealReply(reply).items;
}

/** "Line 4 (Oats | 80 | abc…): protein isn't a number" – the first few, for an alert. */
export function rowErrorText(errors: RowError[], max = 3): string {
  const short = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
  const lines = errors.slice(0, max).map((e) => `Line ${e.line} (${short(e.text)}): ${e.reason}`);
  if (errors.length > max) lines.push(`…and ${errors.length - max} more`);
  return lines.join('\n');
}

/** "day | meal | item | grams | kcal | protein | carbs | fat | fiber" → one row per day the dish is served. */
export function parseMenuReply(reply: string): { rows: MenuRow[]; skipped: number } {
  const rows: MenuRow[] = [];
  let skipped = 0;
  for (const raw of reply.split(LINE_BREAK)) {
    const c = cells(raw);
    if (!c || c.length < 8) continue;
    const [dayCell, mealCell, name] = c;
    if (isRule(dayCell) || isHeaderWord(dayCell) || !name || isHeaderWord(name) || isTotal(name)) continue;
    const days = parseDays(dayCell);
    const slot = parseSlot(mealCell);
    const it = nutrition(c.slice(3), itemName(name));
    if (!days.length || !slot || typeof it === 'string') {
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
