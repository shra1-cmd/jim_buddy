import { fromKey } from './dates.ts';

// When to ask for feedback, and the message that gets shared. Like an in-app review prompt: only after the app
// has had real use, never twice in a row soon, and never again once sent or after two "Maybe later"s.

export const FEEDBACK_MIN_DAYS = 3; // days since first open
export const FEEDBACK_MIN_ACTIVE_DAYS = 3; // distinct days with a meal or workout logged
export const FEEDBACK_SNOOZE_DAYS = 5;
export const FEEDBACK_MAX_ASKS = 2;

export const RATINGS = [
  { key: 'useful', label: 'Really useful', emoji: '🤩' },
  { key: 'initiative', label: 'Good initiative', emoji: '👍' },
  { key: 'meh', label: 'Not really interesting', emoji: '😐' },
] as const;
export type Rating = (typeof RATINGS)[number]['key'];

export interface FeedbackState {
  firstOpen: string | null; // YYYY-MM-DD
  activeDays: number;
  sent: boolean;
  asks: number;
  snoozeUntil: string | null; // YYYY-MM-DD
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

export function shouldAskFeedback(s: FeedbackState, today: string): boolean {
  if (s.sent || s.asks >= FEEDBACK_MAX_ASKS || !s.firstOpen) return false;
  if (s.snoozeUntil && today < s.snoozeUntil) return false;
  return daysBetween(s.firstOpen, today) >= FEEDBACK_MIN_DAYS && s.activeDays >= FEEDBACK_MIN_ACTIVE_DAYS;
}

/** "Hi Shravan, I'm Priya 👋" + verdict + optional note + a small footer for context. */
export function feedbackMessage(o: { name: string; rating: Rating; note: string; daysUsed?: number; version?: string }): string {
  const r = RATINGS.find((x) => x.key === o.rating)!;
  const name = o.name.trim();
  const lines = [name ? `Hi Shravan, I'm ${name} 👋` : 'Hi Shravan 👋', `JimBuddy feels: ${r.label} ${r.emoji}`];
  const note = o.note.trim();
  if (note) lines.push('', note);
  const meta = [o.version && `v${o.version}`, o.daysUsed != null && `used ${o.daysUsed} day${o.daysUsed === 1 ? '' : 's'}`].filter(Boolean);
  if (meta.length) lines.push('', `— sent from JimBuddy (${meta.join(' · ')})`);
  return lines.join('\n');
}
