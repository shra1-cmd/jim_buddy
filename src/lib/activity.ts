// Steps and sports. Pure (unit-tested), no React Native imports.

// ---------- steps ----------

/**
 * Steps already assumed by the activity level picked in onboarding. Only steps above this count as
 * extra burn, otherwise everyday walking is counted twice (once in the target, once here).
 */
export function stepBaseline(activity: number): number {
  if (activity >= 1.55) return 10000;
  if (activity >= 1.375) return 7500;
  return 5000;
}

/** Net walking cost ≈ 0.5 kcal per kg per km, ~1,300 steps per km → 0.00038 kcal per step per kg. */
export function stepsKcal(steps: number, weightKg: number, baseline: number): number {
  return Math.round(Math.max(0, steps - baseline) * weightKg * 0.00038);
}

// ---------- sports ----------

export type Intensity = 'medium' | 'high';
export interface Sport {
  id: string;
  name: string;
  emoji: string;
  met: Record<Intensity, number>; // 2024 Adult Compendium of Physical Activities (approx.)
  hint: Record<Intensity, string>;
}

export const SPORTS: Sport[] = [
  { id: 'cricket', name: 'Cricket', emoji: '🏏', met: { medium: 4.8, high: 6.0 }, hint: { medium: 'Casual match, fielding', high: 'Batting/bowling hard, nets' } },
  { id: 'badminton', name: 'Badminton', emoji: '🏸', met: { medium: 5.5, high: 7.0 }, hint: { medium: 'Social doubles', high: 'Competitive singles' } },
  { id: 'football', name: 'Football', emoji: '⚽', met: { medium: 7.0, high: 10.0 }, hint: { medium: 'Casual kickabout', high: 'Full match' } },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', met: { medium: 6.5, high: 8.0 }, hint: { medium: 'Shooting around', high: 'Full-court game' } },
  { id: 'table_tennis', name: 'Table tennis', emoji: '🏓', met: { medium: 4.0, high: 5.5 }, hint: { medium: 'Friendly rally', high: 'Competitive match' } },
];

/** Net kcal (resting 1 MET is already in the daily target), capped at 3 hours. */
export function sportKcal(met: number, weightKg: number, minutes: number): number {
  const hours = Math.min(Math.max(0, minutes), 180) / 60;
  return Math.round(Math.max(0, met - 1) * weightKg * hours);
}
