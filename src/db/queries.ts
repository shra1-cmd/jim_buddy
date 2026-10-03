import type { SQLiteDatabase } from 'expo-sqlite';
import { rankCandidates, tokens } from '../lib/grounding';
import { forGrams, type Nutrients } from '../lib/nutrition';
import type { BodyStats, Targets } from '../lib/targets';

export const SLOTS = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
};
/** Share of the day's calories per meal (plan default 25/35/15/25). */
export const SLOT_SHARE: Record<Slot, number> = { breakfast: 0.25, lunch: 0.35, snacks: 0.15, dinner: 0.25 };

export interface Profile extends BodyStats, Targets {
  name: string;
  eatBackPct: number;
}

export interface Food {
  id: string;
  name: string;
  source: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  unit: string | null;
  unit_grams: number | null;
}

export interface MealItem extends Nutrients {
  id: number;
  local_date: string;
  slot: Slot;
  food_id: string | null;
  name: string;
  qty: number;
  unit: string | null;
  grams: number;
  source: string;
}

const now = () => new Date().toISOString();

// ---------- profile ----------

export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const r = await db.getFirstAsync<any>('SELECT * FROM user_profile WHERE id = 1');
  if (!r) return null;
  return {
    name: r.name,
    sex: r.sex,
    age: r.age,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    activity: r.activity,
    goal: r.goal,
    kcal: r.kcal,
    proteinG: r.protein_g,
    carbsG: r.carbs_g,
    fatG: r.fat_g,
    fiberG: r.fiber_g,
    eatBackPct: r.eat_back_pct,
  };
}

export async function saveProfile(db: SQLiteDatabase, p: Profile) {
  await db.runAsync(
    `INSERT INTO user_profile (id, name, sex, age, height_cm, weight_kg, activity, goal, kcal, protein_g, carbs_g, fat_g, fiber_g, eat_back_pct, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, sex=excluded.sex, age=excluded.age, height_cm=excluded.height_cm,
       weight_kg=excluded.weight_kg, activity=excluded.activity, goal=excluded.goal, kcal=excluded.kcal, protein_g=excluded.protein_g,
       carbs_g=excluded.carbs_g, fat_g=excluded.fat_g, fiber_g=excluded.fiber_g, eat_back_pct=excluded.eat_back_pct, updated_at=excluded.updated_at`,
    p.name, p.sex, p.age, p.heightCm, p.weightKg, p.activity, p.goal, p.kcal, p.proteinG, p.carbsG, p.fatG, p.fiberG, p.eatBackPct, now(),
  );
}

export async function setEatBack(db: SQLiteDatabase, pct: number) {
  await db.runAsync('UPDATE user_profile SET eat_back_pct = ?, updated_at = ? WHERE id = 1', pct, now());
}

// ---------- foods ----------

export async function searchFoods(db: SQLiteDatabase, q: string, limit = 40): Promise<Food[]> {
  const term = q.trim();
  if (!term) return [];
  const words = term.split(/\s+/).slice(0, 4);
  const where = words.map(() => 'name LIKE ?').join(' AND ');
  const args = words.map((w) => `%${w}%`);
  // Rank: your own + basic foods first, then names that start with the query, then shorter names.
  return db.getAllAsync<Food>(
    `SELECT * FROM food WHERE ${where}
     ORDER BY CASE source WHEN 'custom' THEN 0 WHEN 'basic' THEN 1 ELSE 2 END,
              CASE WHEN name LIKE ? THEN 0 ELSE 1 END, length(name)
     LIMIT ?`,
    ...args, `${words[0]}%`, limit,
  );
}

export async function recentFoods(db: SQLiteDatabase, slot: Slot, limit = 12): Promise<Food[]> {
  // Foods used in this slot most often over the last 30 days, then anything recent.
  return db.getAllAsync<Food>(
    `SELECT f.* FROM meal_item m JOIN food f ON f.id = m.food_id
     WHERE m.local_date >= date('now', '-30 days')
     GROUP BY f.id
     ORDER BY SUM(CASE WHEN m.slot = ? THEN 3 ELSE 1 END) DESC, MAX(m.created_at) DESC
     LIMIT ?`,
    slot, limit,
  );
}

export async function createCustomFood(
  db: SQLiteDatabase,
  f: { name: string; kcal: number; protein: number; carbs: number; fat: number; fiber?: number; unit?: string | null; unitGrams?: number | null },
): Promise<string> {
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  await db.runAsync(
    'INSERT INTO food (id, name, source, kcal, protein, carbs, fat, fiber, unit, unit_grams) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, f.name, 'custom', f.kcal, f.protein, f.carbs, f.fat, f.fiber ?? 0, f.unit ?? null, f.unitGrams ?? null,
  );
  return id;
}

// ---------- meals ----------

export async function addFoodToMeal(db: SQLiteDatabase, date: string, slot: Slot, food: Food, qty: number, useUnit: boolean) {
  const grams = useUnit && food.unit_grams ? qty * food.unit_grams : qty;
  const n = forGrams({ k: food.kcal, p: food.protein, c: food.carbs, f: food.fat, fb: food.fiber }, grams);
  await db.runAsync(
    `INSERT INTO meal_item (local_date, slot, food_id, name, qty, unit, grams, kcal, protein, carbs, fat, fiber, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
    date, slot, food.id, food.name, qty, useUnit ? food.unit : null, grams, n.kcal, n.protein, n.carbs, n.fat, n.fiber, now(),
  );
}

export async function quickAdd(db: SQLiteDatabase, date: string, slot: Slot, name: string, n: Nutrients) {
  await db.runAsync(
    `INSERT INTO meal_item (local_date, slot, food_id, name, qty, unit, grams, kcal, protein, carbs, fat, fiber, source, created_at)
     VALUES (?, ?, NULL, ?, 1, 'serving', 0, ?, ?, ?, ?, ?, 'quick', ?)`,
    date, slot, name || 'Quick add', n.kcal, n.protein, n.carbs, n.fat, n.fiber, now(),
  );
}

export async function mealItemsForDay(db: SQLiteDatabase, date: string): Promise<MealItem[]> {
  return db.getAllAsync<MealItem>('SELECT * FROM meal_item WHERE local_date = ? ORDER BY created_at', date);
}

export async function deleteMealItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM meal_item WHERE id = ?', id);
}

export async function copyMeal(db: SQLiteDatabase, fromDate: string, toDate: string, slot: Slot): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO meal_item (local_date, slot, food_id, name, qty, unit, grams, kcal, protein, carbs, fat, fiber, source, created_at)
     SELECT ?, slot, food_id, name, qty, unit, grams, kcal, protein, carbs, fat, fiber, source, ? FROM meal_item
     WHERE local_date = ? AND slot = ?`,
    toDate, now(), fromDate, slot,
  );
  return r.changes;
}

// ---------- body ----------

export interface BodyEntry {
  local_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
}

export async function saveWeight(db: SQLiteDatabase, date: string, weightKg: number) {
  await db.runAsync(
    `INSERT INTO body_entry (local_date, weight_kg, created_at) VALUES (?, ?, ?)
     ON CONFLICT(local_date) DO UPDATE SET weight_kg = excluded.weight_kg`,
    date, weightKg, now(),
  );
  await db.runAsync('UPDATE user_profile SET weight_kg = ? WHERE id = 1', weightKg);
}

export async function bodyEntries(db: SQLiteDatabase, limit = 60): Promise<BodyEntry[]> {
  return db.getAllAsync<BodyEntry>(
    'SELECT local_date, weight_kg, waist_cm FROM body_entry WHERE weight_kg IS NOT NULL ORDER BY local_date DESC LIMIT ?',
    limit,
  );
}

// ---------- AI grounding + scan queue ----------

/** Candidate foods for a model-named item: SQL prefilter on its words, then ranked in JS. */
export async function candidatesFor(db: SQLiteDatabase, name: string, limit = 5): Promise<(Food & { score: number })[]> {
  const words = tokens(name).slice(0, 4);
  if (!words.length) return [];
  const where = words.map(() => 'name LIKE ?').join(' OR ');
  const rows = await db.getAllAsync<Food>(`SELECT * FROM food WHERE ${where} LIMIT 200`, ...words.map((w) => `%${w}%`));
  return rankCandidates(name, rows, limit);
}

export async function getFood(db: SQLiteDatabase, id: string): Promise<Food | null> {
  return db.getFirstAsync<Food>('SELECT * FROM food WHERE id = ?', id);
}

/** Save a confirmed AI line item (grams-based). */
export async function addAiItem(db: SQLiteDatabase, date: string, slot: Slot, food: Food, grams: number) {
  const n = forGrams({ k: food.kcal, p: food.protein, c: food.carbs, f: food.fat, fb: food.fiber }, grams);
  const unitQty = food.unit && food.unit_grams ? Math.round((grams / food.unit_grams) * 10) / 10 : null;
  await db.runAsync(
    `INSERT INTO meal_item (local_date, slot, food_id, name, qty, unit, grams, kcal, protein, carbs, fat, fiber, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?)`,
    date, slot, food.id, food.name, unitQty ?? Math.round(grams), unitQty != null ? food.unit : null, grams,
    n.kcal, n.protein, n.carbs, n.fat, n.fiber, now(),
  );
}

export interface QueuedScan {
  id: number;
  local_date: string;
  slot: Slot;
  kind: 'photo' | 'text' | 'label';
  image_uri: string | null;
  text: string | null;
  hint: string | null;
  place: string | null;
  oil: string | null;
  status: 'pending' | 'error';
  error: string | null;
}

export async function queueScan(db: SQLiteDatabase, q: Omit<QueuedScan, 'id' | 'status' | 'error'>) {
  await db.runAsync(
    'INSERT INTO scan_queue (local_date, slot, kind, image_uri, text, hint, place, oil, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    q.local_date, q.slot, q.kind, q.image_uri, q.text, q.hint, q.place, q.oil, now(),
  );
}
export const pendingScans = (db: SQLiteDatabase) => db.getAllAsync<QueuedScan>('SELECT * FROM scan_queue ORDER BY created_at');
export const getQueuedScan = (db: SQLiteDatabase, id: number) => db.getFirstAsync<QueuedScan>('SELECT * FROM scan_queue WHERE id = ?', id);
export async function deleteQueuedScan(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM scan_queue WHERE id = ?', id);
}
