import type { SQLiteDatabase } from 'expo-sqlite';
import { addDays } from '../lib/dates';
import { FEEDBACK_SNOOZE_DAYS, daysBetween, shouldAskFeedback, type Rating } from '../lib/feedback';
import { getSetting, setSetting } from './settings';

/** First launch date; also backfilled for people who installed before the welcome note existed. */
export async function ensureFirstOpen(db: SQLiteDatabase, today: string): Promise<string> {
  const v = await getSetting(db, 'first_open_at');
  if (v) return v;
  await setSetting(db, 'first_open_at', today);
  return today;
}

export async function daysUsed(db: SQLiteDatabase, today: string): Promise<number> {
  return daysBetween(await ensureFirstOpen(db, today), today) + 1;
}

export async function feedbackDue(db: SQLiteDatabase, today: string): Promise<boolean> {
  const [firstOpen, sent, asks, snoozeUntil, active] = await Promise.all([
    ensureFirstOpen(db, today),
    getSetting(db, 'feedback_sent_at'),
    getSetting(db, 'feedback_asks'),
    getSetting(db, 'feedback_snooze_until'),
    db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT local_date FROM meal_item UNION SELECT local_date FROM workout_session WHERE status = 'done'
       )`,
    ),
  ]);
  return shouldAskFeedback({ firstOpen, activeDays: active?.n ?? 0, sent: !!sent, asks: Number(asks ?? 0), snoozeUntil }, today);
}

/** "Maybe later": count the ask and stay quiet for a few days. */
export async function snoozeFeedback(db: SQLiteDatabase, today: string) {
  const asks = Number((await getSetting(db, 'feedback_asks')) ?? 0) + 1;
  await setSetting(db, 'feedback_asks', String(asks));
  await setSetting(db, 'feedback_snooze_until', addDays(today, FEEDBACK_SNOOZE_DAYS));
}

export async function markFeedbackSent(db: SQLiteDatabase, rating: Rating) {
  await setSetting(db, 'feedback_sent_at', new Date().toISOString());
  await setSetting(db, 'feedback_rating', rating);
}
