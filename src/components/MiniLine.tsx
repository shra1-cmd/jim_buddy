import { Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, type } from '../theme';

/** Small date-scaled line chart. points must be oldest first. */
export function MiniLine({ points, height = 60, color = colors.ink, empty = 'Log twice to see a trend.' }: {
  points: { date: string; value: number }[];
  height?: number;
  color?: string;
  empty?: string | null;
}) {
  const W = 300, pad = 6;
  if (points.length < 2) {
    return empty ? <View style={{ height: Math.min(height, 40), justifyContent: 'center' }}><Text style={type.small}>{empty}</Text></View> : null;
  }
  const t = (d: string) => Date.parse(d);
  const t0 = t(points[0].date), t1 = t(points[points.length - 1].date);
  const vals = points.map((p) => p.value);
  const spread = Math.max(...vals) - Math.min(...vals) || 1;
  const lo = Math.min(...vals) - spread * 0.15, hi = Math.max(...vals) + spread * 0.15;
  const x = (d: string) => pad + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad);
  const last = points[points.length - 1];
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      <Polyline points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke={color} strokeWidth={2.5} />
      <Circle cx={x(last.date)} cy={y(last.value)} r={4} fill={colors.amber} />
    </Svg>
  );
}
