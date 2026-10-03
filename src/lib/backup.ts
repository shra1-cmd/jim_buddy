import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

// Everything the user typed. Seed foods (INDB/basic) are rebuilt by the app, so only custom foods are exported.
const TABLES = [
  'user_profile', 'meal_item', 'body_entry', 'custom_exercise', 'workout_plan', 'plan_exercise',
  'workout_session', 'set_log', 'progress_photo', 'settings',
] as const;

export interface Backup {
  app: 'jimbuddy';
  version: 1;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
}

export async function buildBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const t of TABLES) tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  tables.food = await db.getAllAsync("SELECT * FROM food WHERE source = 'custom'");
  // never export the invite token
  tables.settings = tables.settings.filter((r) => r.key !== 'invite_token');
  return { app: 'jimbuddy', version: 1, exported_at: new Date().toISOString(), tables };
}

/** Writes a JSON backup and opens the share sheet (save to Files / Drive / send to yourself). */
export async function exportBackup(db: SQLiteDatabase): Promise<string> {
  const data = JSON.stringify(await buildBackup(db));
  const name = `jimbuddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    return name;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(data);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save JimBuddy backup' });
  return name;
}

/** Replaces all user data with a backup. Photos are referenced by path and are not inside the JSON. */
export async function restoreBackup(db: SQLiteDatabase, raw: string): Promise<number> {
  const b = JSON.parse(raw) as Backup;
  if (b.app !== 'jimbuddy' || !b.tables) throw new Error('Not a JimBuddy backup file.');
  let rows = 0;
  await db.withTransactionAsync(async () => {
    for (const t of TABLES) {
      await db.runAsync(`DELETE FROM ${t}`);
      for (const r of b.tables[t] ?? []) {
        const cols = Object.keys(r);
        if (!cols.length) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          ...cols.map((c) => r[c] as string | number | null),
        );
        rows++;
      }
    }
    for (const r of b.tables.food ?? []) {
      const cols = Object.keys(r);
      await db.runAsync(`INSERT OR REPLACE INTO food (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((c) => r[c] as string | number | null));
      rows++;
    }
  });
  return rows;
}

export async function pickAndRestore(db: SQLiteDatabase): Promise<number | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain'] });
  if (picked.canceled || !picked.result) return null;
  const text = await picked.result.text();
  return restoreBackup(db, text);
}
