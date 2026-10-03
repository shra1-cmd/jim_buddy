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

const DATABASE_VERSION = 1;

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

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
