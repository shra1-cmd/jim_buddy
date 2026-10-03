import type { SQLiteDatabase } from 'expo-sqlite';
import { deleteImage } from '../lib/images';
import type { Food } from './queries';

const now = () => new Date().toISOString();

// ---------- measurements ----------

export const MEASURES = [
  { key: 'waist_cm', label: 'Waist', hint: 'At the navel, relaxed' },
  { key: 'chest_cm', label: 'Chest', hint: 'Nipple line, arms down' },
  { key: 'arm_cm', label: 'Arm', hint: 'Flexed, widest point' },
  { key: 'thigh_cm', label: 'Thigh', hint: 'Widest point, standing' },
] as const;
export type MeasureKey = (typeof MEASURES)[number]['key'];

export type Measurement = { local_date: string } & Record<MeasureKey, number | null>;

/** Upserts only the fields given; weight on the same day stays untouched. */
export async function saveMeasurements(db: SQLiteDatabase, date: string, m: Partial<Record<MeasureKey, number>>) {
  const keys = (Object.keys(m) as MeasureKey[]).filter((k) => m[k] != null && m[k]! > 0);
  if (!keys.length) return;
  await db.runAsync(
    `INSERT INTO body_entry (local_date, ${keys.join(', ')}, created_at) VALUES (?, ${keys.map(() => '?').join(', ')}, ?)
     ON CONFLICT(local_date) DO UPDATE SET ${keys.map((k) => `${k} = excluded.${k}`).join(', ')}`,
    date, ...keys.map((k) => m[k]!), now(),
  );
}

export async function measurementEntries(db: SQLiteDatabase, limit = 60): Promise<Measurement[]> {
  return db.getAllAsync<Measurement>(
    `SELECT local_date, waist_cm, chest_cm, arm_cm, thigh_cm FROM body_entry
     WHERE waist_cm IS NOT NULL OR chest_cm IS NOT NULL OR arm_cm IS NOT NULL OR thigh_cm IS NOT NULL
     ORDER BY local_date DESC LIMIT ?`,
    limit,
  );
}

// ---------- progress photos ----------

export const ANGLES = ['front', 'side', 'back'] as const;
export type Angle = (typeof ANGLES)[number];
export interface Photo {
  id: number;
  local_date: string;
  angle: Angle;
  uri: string;
}

export const listPhotos = (db: SQLiteDatabase) =>
  db.getAllAsync<Photo>('SELECT id, local_date, angle, uri FROM progress_photo ORDER BY local_date DESC, id DESC');

export async function addPhoto(db: SQLiteDatabase, date: string, angle: Angle, uri: string) {
  await db.runAsync('INSERT INTO progress_photo (local_date, angle, uri, created_at) VALUES (?, ?, ?, ?)', date, angle, uri, now());
}

export async function deletePhoto(db: SQLiteDatabase, p: Photo) {
  await db.runAsync('DELETE FROM progress_photo WHERE id = ?', p.id);
  deleteImage(p.uri);
}

// ---------- home helpers ----------

/** Days (YYYY-MM-DD) in [from, to] that have any food logged. */
export async function loggedDays(db: SQLiteDatabase, from: string, to: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ d: string }>(
    'SELECT DISTINCT local_date AS d FROM meal_item WHERE local_date BETWEEN ? AND ?', from, to,
  );
  return new Set(rows.map((r) => r.d));
}

export interface ProteinFix {
  food: Food;
  qty: number; // in food.unit when it has one, else grams
  label: string;
  protein: number;
  kcal: number;
}

// Protein-dense fallbacks from the basic list when the user has no history yet.
const FALLBACK_IDS = ['basic_egg_boiled', 'basic_egg_white', 'basic_paneer', 'basic_chicken_breast', 'basic_whey', 'basic_soya_chunks'];

/**
 * One concrete protein suggestion: a lean food the user already eats (protein ≥ 8 g per 100 kcal),
 * sized to close most of the gap without blowing the calorie budget.
 */
export async function proteinFix(db: SQLiteDatabase, proteinLeft: number, kcalLeft: number): Promise<ProteinFix | null> {
  if (proteinLeft < 8) return null;
  let foods = await db.getAllAsync<Food & { n: number }>(
    `SELECT f.*, COUNT(*) AS n FROM meal_item m JOIN food f ON f.id = m.food_id
     WHERE m.local_date >= date('now', '-45 days') AND f.kcal > 0 AND f.protein * 100.0 / f.kcal >= 8
     GROUP BY f.id ORDER BY n DESC LIMIT 6`,
  );
  if (!foods.length) {
    foods = await db.getAllAsync<Food & { n: number }>(
      `SELECT *, 0 AS n FROM food WHERE id IN (${FALLBACK_IDS.map(() => '?').join(',')}) OR (source = 'basic' AND kcal > 0 AND protein * 100.0 / kcal >= 12)`,
      ...FALLBACK_IDS,
    );
    foods.sort((a, b) => b.protein / b.kcal - a.protein / a.kcal);
  }
  const budget = Math.max(150, kcalLeft);
  const want = Math.min(proteinLeft, 35); // one sitting
  let best: ProteinFix | null = null;
  for (const f of foods) {
    let grams: number;
    let qty: number;
    let label: string;
    if (f.unit && f.unit_grams) {
      // cap at 3 units so it stays a realistic serving (not "11 egg whites")
      qty = Math.min(3, Math.max(1, Math.round((want / f.protein) * 100 / f.unit_grams)));
      grams = qty * f.unit_grams;
      label = `${qty} ${f.unit}${qty > 1 && !f.unit.endsWith('s') && !f.unit.includes('(') ? 's' : ''}`;
    } else {
      grams = Math.min(250, Math.max(50, Math.round((want / f.protein) * 10) * 10));
      qty = grams;
      label = `${grams} g`;
    }
    const kcal = Math.round((f.kcal * grams) / 100);
    const protein = Math.round((f.protein * grams) / 100);
    if (kcal > budget || protein < 6) continue;
    if (!best || protein > best.protein) best = { food: f, qty, label, protein, kcal };
  }
  return best;
}

/** The exercises logged most often (weight × reps only), for the Strength card. */
export async function topLifts(db: SQLiteDatabase, limit = 4): Promise<string[]> {
  const rows = await db.getAllAsync<{ exercise_id: string }>(
    `SELECT sl.exercise_id FROM set_log sl JOIN workout_session ws ON ws.id = sl.session_id
     WHERE ws.status = 'done' AND sl.done = 1 AND sl.is_warmup = 0 AND sl.kg > 0 AND sl.reps > 0
     GROUP BY sl.exercise_id ORDER BY COUNT(DISTINCT sl.session_id) DESC, MAX(ws.started_at) DESC LIMIT ?`,
    limit,
  );
  return rows.map((r) => r.exercise_id);
}
