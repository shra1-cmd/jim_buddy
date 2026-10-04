import type { SQLiteDatabase } from 'expo-sqlite';
import foods from './seed/foods.json';

type SeedFood = {
  id: string;
  n: string;
  s: string;
  k: number;
  p: number;
  c: number;
  f: number;
  fb: number;
  u: string | null;
  ug: number | null;
};

const DATABASE_VERSION = 3;

/** Runs on app start (SQLiteProvider onInit). Versioned with PRAGMA user_version. */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL DEFAULT '',
        sex TEXT NOT NULL,
        age INTEGER NOT NULL,
        height_cm REAL NOT NULL,
        weight_kg REAL NOT NULL,
        activity REAL NOT NULL,
        goal TEXT NOT NULL,
        kcal INTEGER NOT NULL,
        protein_g INTEGER NOT NULL,
        carbs_g INTEGER NOT NULL,
        fat_g INTEGER NOT NULL,
        fiber_g INTEGER NOT NULL,
        eat_back_pct INTEGER NOT NULL DEFAULT 50,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS food (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL, fiber REAL NOT NULL,
        unit TEXT,
        unit_grams REAL
      );
      CREATE INDEX IF NOT EXISTS food_name_idx ON food(name);
      CREATE TABLE IF NOT EXISTS meal_item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_date TEXT NOT NULL,
        slot TEXT NOT NULL,
        food_id TEXT,
        name TEXT NOT NULL,
        qty REAL NOT NULL,
        unit TEXT,
        grams REAL NOT NULL,
        kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL, fiber REAL NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS meal_item_day_idx ON meal_item(local_date, slot);
      CREATE TABLE IF NOT EXISTS body_entry (
        local_date TEXT PRIMARY KEY NOT NULL,
        weight_kg REAL,
        waist_cm REAL,
        created_at TEXT NOT NULL
      );
    `);

    // Seed: INDB recipes (CC BY) + a few basic foods. Fixed ids so data lines up across phones later.
    const insert = await db.prepareAsync(
      'INSERT OR IGNORE INTO food (id, name, source, kcal, protein, carbs, fat, fiber, unit, unit_grams) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    try {
      await db.withTransactionAsync(async () => {
        for (const f of foods as SeedFood[]) {
          await insert.executeAsync(f.id, f.n, f.s, f.k, f.p, f.c, f.f, f.fb, f.u, f.ug);
        }
      });
    } finally {
      await insert.finalizeAsync();
    }
    version = 1;
  }

  if (version === 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_exercise (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        grp TEXT NOT NULL,
        equipment TEXT NOT NULL,
        log_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workout_plan (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        days TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS plan_exercise (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        sets INTEGER NOT NULL DEFAULT 3,
        rep_min INTEGER NOT NULL DEFAULT 8,
        rep_max INTEGER NOT NULL DEFAULT 12,
        rest_s INTEGER NOT NULL DEFAULT 90
      );
      CREATE INDEX IF NOT EXISTS plan_exercise_plan_idx ON plan_exercise(plan_id, position);
      CREATE TABLE IF NOT EXISTS workout_session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT,
        name TEXT NOT NULL,
        local_date TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        kcal REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
      );
      CREATE INDEX IF NOT EXISTS workout_session_day_idx ON workout_session(local_date);
      CREATE TABLE IF NOT EXISTS set_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        set_no INTEGER NOT NULL,
        kg REAL,
        reps INTEGER,
        seconds INTEGER,
        distance_m REAL,
        is_warmup INTEGER NOT NULL DEFAULT 0,
        done INTEGER NOT NULL DEFAULT 0,
        rep_min INTEGER, rep_max INTEGER, rest_s INTEGER,
        done_at TEXT
      );
      CREATE INDEX IF NOT EXISTS set_log_session_idx ON set_log(session_id, position, set_no);
      CREATE INDEX IF NOT EXISTS set_log_exercise_idx ON set_log(exercise_id, done_at);
      ALTER TABLE body_entry ADD COLUMN chest_cm REAL;
      ALTER TABLE body_entry ADD COLUMN arm_cm REAL;
      ALTER TABLE body_entry ADD COLUMN thigh_cm REAL;
      CREATE TABLE IF NOT EXISTS progress_photo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_date TEXT NOT NULL,
        angle TEXT NOT NULL,
        uri TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scan_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_date TEXT NOT NULL,
        slot TEXT NOT NULL,
        kind TEXT NOT NULL,
        image_uri TEXT,
        text TEXT,
        hint TEXT,
        place TEXT,
        oil TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    version = 2;
  }

  if (version === 2) {
    // v3: daily steps (from the phone's pedometer or typed in)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS step_day (
        local_date TEXT PRIMARY KEY NOT NULL,
        steps INTEGER NOT NULL,
        source TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      ALTER TABLE workout_session ADD COLUMN kind TEXT NOT NULL DEFAULT 'lift';
    `);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
