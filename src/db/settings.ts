import type { SQLiteDatabase } from 'expo-sqlite';

export type SettingKey = 'last_backup_at' | 'menu_photo';

export async function getSetting(db: SQLiteDatabase, key: SettingKey): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: SettingKey, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}
