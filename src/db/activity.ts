import { Pedometer } from 'expo-sensors';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { SPORTS, sportKcal, type Intensity } from '../lib/activity';
import { DAY_START_HOUR, addDays, fromKey, todayKey } from '../lib/dates';

const now = () => new Date().toISOString();

// ---------- steps ----------

export async function getSteps(db: SQLiteDatabase, date: string) {
  return db.getFirstAsync<{ steps: number; source: string }>('SELECT steps, source FROM step_day WHERE local_date = ?', date);
}

export async function stepsSince(db: SQLiteDatabase, from: string) {
  return db.getAllAsync<{ local_date: string; steps: number }>('SELECT local_date, steps FROM step_day WHERE local_date >= ? ORDER BY local_date', from);
}

/** Typed in by hand (from the Health / Fitness app). A manual number wins over the pedometer for that day. */
export async function setManualSteps(db: SQLiteDatabase, date: string, steps: number) {
  await db.runAsync(
    `INSERT INTO step_day (local_date, steps, source, updated_at) VALUES (?, ?, 'manual', ?)
     ON CONFLICT(local_date) DO UPDATE SET steps = excluded.steps, source = 'manual', updated_at = excluded.updated_at`,
    date, Math.round(steps), now(),
  );
}

export async function clearManualSteps(db: SQLiteDatabase, date: string) {
  await db.runAsync("DELETE FROM step_day WHERE local_date = ? AND source = 'manual'", date);
}

export type StepSync = 'ok' | 'unsupported' | 'denied' | 'error';

/**
 * iPhone: reads the last 7 days of steps from the phone's motion chip (the same counter the Health app shows
 * for "iPhone"). Android's pedometer can't read history in Expo Go, so there you type the number in.
 */
export async function syncPhoneSteps(db: SQLiteDatabase, ask = true): Promise<StepSync> {
  if (Platform.OS !== 'ios') return 'unsupported';
  try {
    if (!(await Pedometer.isAvailableAsync())) return 'unsupported';
    const perm = ask ? await Pedometer.requestPermissionsAsync() : await Pedometer.getPermissionsAsync();
    if (!perm.granted) return 'denied';
    const today = todayKey();
    for (let i = 6; i >= 0; i--) {
      const key = addDays(today, -i);
      const d = fromKey(key);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAY_START_HOUR);
      const end = new Date(Math.min(Date.now(), start.getTime() + 24 * 3600_000));
      if (end <= start) continue;
      const r = await Pedometer.getStepCountAsync(start, end);
      await db.runAsync(
        `INSERT INTO step_day (local_date, steps, source, updated_at) VALUES (?, ?, 'phone', ?)
         ON CONFLICT(local_date) DO UPDATE SET steps = excluded.steps, updated_at = excluded.updated_at
         WHERE step_day.source = 'phone'`,
        key, r.steps, now(),
      );
    }
    return 'ok';
  } catch {
    return 'error';
  }
}

// ---------- sports ----------

/** A game is stored as a finished session (kind = 'sport') so it shows in Burned, history and the week strip. */
export async function logSport(db: SQLiteDatabase, date: string, sportId: string, intensity: Intensity, minutes: number, weightKg: number) {
  const s = SPORTS.find((x) => x.id === sportId);
  if (!s) return 0;
  const kcal = sportKcal(s.met[intensity], weightKg, minutes);
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60000);
  await db.runAsync(
    `INSERT INTO workout_session (plan_id, name, local_date, started_at, ended_at, kcal, status, kind)
     VALUES (NULL, ?, ?, ?, ?, ?, 'done', 'sport')`,
    `${s.name} · ${intensity === 'high' ? 'High' : 'Medium'}`, date, start.toISOString(), end.toISOString(), kcal,
  );
  return kcal;
}

export async function sportsOn(db: SQLiteDatabase, date: string) {
  return db.getAllAsync<{ id: number; name: string; kcal: number; started_at: string; ended_at: string }>(
    "SELECT id, name, kcal, started_at, ended_at FROM workout_session WHERE local_date = ? AND kind = 'sport' ORDER BY id", date,
  );
}

export async function deleteSport(db: SQLiteDatabase, id: number) {
  await db.runAsync("DELETE FROM workout_session WHERE id = ? AND kind = 'sport'", id);
}
