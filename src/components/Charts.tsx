import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors, dayColors, fonts, macro } from '../theme';
import { Text } from './AppText';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function niceStep(max: number): number {
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const short = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`);

/**
 * Weekly bars, Mon → Sun, one fixed pastel per day (as in the reference). Tap a bar for its value.
 * A dashed line marks the daily goal.
 */
export function WeekBars({ values, goal, unit, todayIndex }: { values: number[]; goal: number; unit: string; todayIndex: number }) {
  const [w, setW] = useState(300);
  const [sel, setSel] = useState<number | null>(null);
  const H = 150, top = 14, bottom = 22, left = 30;
  const max = Math.max(goal * 1.1, ...values, 1);
  const step = niceStep(max);
  const yMax = Math.ceil(max / step) * step;
  const plotH = H - top - bottom;
  const y = (v: number) => top + plotH * (1 - v / yMax);
  const slot = (w - left) / 7;
  const bw = Math.min(22, slot * 0.52);
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={H}>
        {ticks.map((t) => (
          <G key={t}>
            <Line x1={left} x2={w} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
            <SvgText x={left - 6} y={y(t) + 4} fontSize={10} fontFamily={fonts.bold} fill={colors.muted} textAnchor="end">{short(t)}</SvgText>
          </G>
        ))}
        {goal > 0 && <Line x1={left} x2={w} y1={y(goal)} y2={y(goal)} stroke={colors.coral} strokeWidth={1.5} strokeDasharray="4 4" />}
        {values.map((v, i) => {
          const cx = left + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(v));
          const x = cx - bw / 2;
          return (
            <G key={i}>
              {h > 0 && (
                <>
                  <Rect x={x} y={y(v)} width={bw} height={h} rx={Math.min(bw / 2, h / 2)} fill={dayColors[i]} />
                  {h > bw / 2 && <Rect x={x} y={y(0) - bw / 2} width={bw} height={bw / 2} fill={dayColors[i]} />}
                  <Rect x={x + 3} y={y(v) + 4} width={3} height={Math.max(0, h - 10)} rx={1.5} fill="#fff" opacity={0.35} />
                </>
              )}
              <SvgText x={cx} y={H - 6} fontSize={11} fontFamily={i === todayIndex ? fonts.black : fonts.bold} fill={i === todayIndex ? colors.ink : colors.inkSoft} textAnchor="middle">
                {DAY[i]}
              </SvgText>
            </G>
          );
        })}
        {sel != null && (
          <G>
            <Rect x={Math.min(w - 64, Math.max(left, left + slot * sel + slot / 2 - 32))} y={Math.max(0, y(values[sel]) - 26)} width={64} height={20} rx={10} fill={colors.ink} />
            <SvgText x={Math.min(w - 32, Math.max(left + 32, left + slot * sel + slot / 2))} y={Math.max(0, y(values[sel]) - 26) + 14} fontSize={11} fontFamily={fonts.extrabold} fill="#fff" textAnchor="middle">
              {`${Math.round(values[sel])} ${unit}`}
            </SvgText>
          </G>
        )}
      </Svg>
      {/* hit targets, wider than the bars */}
      <View style={{ position: 'absolute', left, right: 0, top: 0, bottom: bottom, flexDirection: 'row' }}>
        {values.map((v, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${DAY[i]}: ${Math.round(v)} ${unit}`}
            onPress={() => setSel(sel === i ? null : i)}
            style={{ flex: 1 }}
          />
        ))}
      </View>
    </View>
  );
}

/** Calorie share of protein / carbs / fat, with a legend that carries the numbers (colour is never alone). */
export function MacroDonut({ protein, carbs, fat, kcal, size = 112 }: { protein: number; carbs: number; fat: number; kcal: number; size?: number }) {
  const parts = [
    { label: 'Protein', kcal: protein * 4, g: protein, color: macro.protein },
    { label: 'Carbs', kcal: carbs * 4, g: carbs, color: macro.carbs },
    { label: 'Fat', kcal: fat * 9, g: fat, color: macro.fat },
  ];
  const total = parts.reduce((a, p) => a + p.kcal, 0);
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 ? 2 : 0;
  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F6DCC6" strokeWidth={stroke} fill="none" />
          {total > 0 &&
            parts.map((p) => {
              const len = (p.kcal / total) * c;
              const el = len > gap ? (
                <Circle
                  key={p.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={p.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                  strokeDashoffset={-acc}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              ) : null;
              acc += len;
              return el;
            })}
        </Svg>
        <Text style={{ fontSize: 17, fontWeight: '800' }}>{Math.round(kcal)}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>kcal</Text>
      </View>
      <View style={{ alignSelf: 'stretch', marginTop: 10, gap: 5 }}>
        {parts.map((p) => (
          <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '600', flex: 1 }}>{p.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700' }}>{total ? `${Math.round((p.kcal / total) * 100)}%` : '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
