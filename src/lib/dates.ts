// Local "log day" keys. A day starts at 4 am, so a 12:30 am snack counts toward the previous day.

export const DAY_START_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function todayKey(now: Date = new Date(), dayStartHour = DAY_START_HOUR): string {
  const shifted = new Date(now.getTime() - dayStartHour * 3600_000);
  return toKey(shifted);
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function dayLabel(key: string, now: Date = new Date()): string {
  const today = todayKey(now);
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return fromKey(key).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
