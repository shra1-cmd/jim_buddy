import type { SQLiteDatabase } from 'expo-sqlite';
import type { MenuRow } from '../lib/chatgpt';
import type { MenuSlot } from '../lib/menu';
import type { Slot } from './queries';

export interface MenuItem extends MenuRow {
  id: number;
  position: number;
}

const now = () => new Date().toISOString();

export const menuCount = async (db: SQLiteDatabase) =>
  (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM menu_item'))?.n ?? 0;

export const menuForDay = (db: SQLiteDatabase, dow: number) =>
  db.getAllAsync<MenuItem>('SELECT * FROM menu_item WHERE dow = ? ORDER BY slot, position, id', dow);

export const menuFor = (db: SQLiteDatabase, dow: number, slot: MenuSlot | Slot) =>
  db.getAllAsync<MenuItem>('SELECT * FROM menu_item WHERE dow = ? AND slot = ? ORDER BY position, id', dow, slot);

/** Dish counts per day, for the week strip on the menu screen. */
export async function menuDayCounts(db: SQLiteDatabase): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ dow: number; n: number }>('SELECT dow, COUNT(*) AS n FROM menu_item GROUP BY dow');
  return Object.fromEntries(rows.map((r) => [r.dow, r.n]));
}

/** Replaces the whole week with an imported table. */
export async function replaceMenu(db: SQLiteDatabase, rows: MenuRow[]) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM menu_item');
    let pos = 0;
    for (const r of rows) {
      await db.runAsync(
        'INSERT INTO menu_item (dow, slot, name, grams, kcal, protein, carbs, fat, fiber, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        r.dow, r.slot, r.name, r.grams, r.kcal, r.protein, r.carbs, r.fat, r.fiber, pos++,
      );
    }
  });
}

export async function addMenuItem(db: SQLiteDatabase, r: MenuRow) {
  const pos = (await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM menu_item WHERE dow = ? AND slot = ?', r.dow, r.slot))?.p ?? -1;
  await db.runAsync(
    'INSERT INTO menu_item (dow, slot, name, grams, kcal, protein, carbs, fat, fiber, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    r.dow, r.slot, r.name, r.grams, r.kcal, r.protein, r.carbs, r.fat, r.fiber, pos + 1,
  );
}

export async function updateMenuItem(db: SQLiteDatabase, id: number, r: Omit<MenuRow, 'dow' | 'slot'>) {
  await db.runAsync(
    'UPDATE menu_item SET name = ?, grams = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, fiber = ? WHERE id = ?',
    r.name, r.grams, r.kcal, r.protein, r.carbs, r.fat, r.fiber, id,
  );
}

export async function deleteMenuItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM menu_item WHERE id = ?', id);
}

export async function clearMenu(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM menu_item');
}

/** Logs picked dishes into a meal. Each line keeps the menu's macros scaled to the chosen grams. */
export async function logMenuPicks(db: SQLiteDatabase, date: string, slot: Slot, picks: { item: MenuRow; grams: number }[]) {
  await db.withTransactionAsync(async () => {
    for (const { item, grams } of picks) {
      const f = item.grams > 0 ? grams / item.grams : 0;
      await db.runAsync(
        `INSERT INTO meal_item (local_date, slot, food_id, name, qty, unit, grams, kcal, protein, carbs, fat, fiber, source, created_at)
         VALUES (?, ?, NULL, ?, ?, 'g', ?, ?, ?, ?, ?, ?, 'menu', ?)`,
        date, slot, item.name, Math.round(grams), Math.round(grams),
        Math.round(item.kcal * f), Math.round(item.protein * f * 10) / 10, Math.round(item.carbs * f * 10) / 10,
        Math.round(item.fat * f * 10) / 10, Math.round(item.fiber * f * 10) / 10, now(),
      );
    }
  });
}

/** How many dishes each meal has on a weekday (for "From menu" shortcuts). */
export async function menuSlotCounts(db: SQLiteDatabase, dow: number): Promise<Partial<Record<Slot, number>>> {
  const rows = await db.getAllAsync<{ slot: Slot; n: number }>('SELECT slot, COUNT(*) AS n FROM menu_item WHERE dow = ? GROUP BY slot', dow);
  return Object.fromEntries(rows.map((r) => [r.slot, r.n]));
}
