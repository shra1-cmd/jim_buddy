// Trend helpers (unit-tested).

export interface Point {
  date: string; // YYYY-MM-DD
  value: number;
}

/** Trailing moving average over the previous `days` calendar days (inclusive), oldest → newest. */
export function movingAverage(points: Point[], days = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const t = (d: string) => Date.parse(`${d}T12:00:00Z`) / 86_400_000;
  return sorted.map((p, i) => {
    const window = sorted.slice(0, i + 1).filter((q) => t(p.date) - t(q.date) < days);
    const avg = window.reduce((s, q) => s + q.value, 0) / window.length;
    return { date: p.date, value: Math.round(avg * 10) / 10 };
  });
}

/** kg per week between the first and last smoothed points (null if under 7 days of span). */
export function weeklyRate(smoothed: Point[]): number | null {
  if (smoothed.length < 2) return null;
  const first = smoothed[0];
  const last = smoothed[smoothed.length - 1];
  const spanDays = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (spanDays < 7) return null;
  return Math.round(((last.value - first.value) / spanDays) * 7 * 100) / 100;
}
