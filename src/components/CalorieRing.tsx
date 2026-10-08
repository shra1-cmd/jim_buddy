import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Text } from './AppText';
import { signedKcal } from '../lib/targets';
import { clay, colors } from '../theme';

/**
 * Journal calorie ring. The number is eaten − allowance:
 * "−1650" (teal) = still to eat, "+130" (red) = over. Past 100 % a red second lap shows the excess.
 */
export function CalorieRing({ eaten, budget, size = 116 }: { eaten: number; budget: number; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  const progress = budget > 0 ? eaten / budget : 0;
  const base = Math.min(progress, 1);
  const extra = Math.max(0, Math.min(progress - 1, 1));
  const over = progress > 1;
  const diff = Math.round(eaten - budget);

  // end-cap knob on the arc tip
  const tip = (over ? extra : base) * 2 * Math.PI - Math.PI / 2;
  const kx = mid + r * Math.cos(tip);
  const ky = mid + r * Math.sin(tip);

  const well = size - stroke * 2 - 10;

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={diff > 0 ? `${diff} kcal over` : `${-diff} kcal left to eat`}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="ringWarm" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.peach} />
            <Stop offset="1" stopColor={colors.coral} />
          </LinearGradient>
          <LinearGradient id="ringOver" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F08A7A" />
            <Stop offset="1" stopColor={colors.danger} />
          </LinearGradient>
        </Defs>
        {/* track */}
        <Circle cx={mid} cy={mid} r={r} stroke="#F6DCC6" strokeWidth={stroke} fill="none" />
        {/* first lap */}
        {base > 0 && (
          <Circle
            cx={mid} cy={mid} r={r} fill="none"
            stroke="url(#ringWarm)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * base} ${c}`}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
        {/* excess lap */}
        {extra > 0 && (
          <Circle
            cx={mid} cy={mid} r={r} fill="none"
            stroke="url(#ringOver)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * extra} ${c}`}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
        {progress > 0.02 && <Circle cx={kx} cy={ky} r={stroke / 2 - 2.5} fill="#FFFAF4" />}
      </Svg>

      {/* inner clay well keeps the number clear of the ring */}
      <View
        style={{
          width: well, height: well, borderRadius: well / 2, backgroundColor: colors.cardHi,
          alignItems: 'center', justifyContent: 'center', boxShadow: clay.well,
        }}
      >
        <Text
          style={{ fontSize: 19, fontWeight: '800', color: over ? colors.danger : colors.tealDeep, letterSpacing: -0.3 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {signedKcal(diff)}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: -2 }}>kcal</Text>
      </View>
    </View>
  );
}
