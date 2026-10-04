import type { SQLiteDatabase } from 'expo-sqlite';
import { deleteImage } from '../lib/images';

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
