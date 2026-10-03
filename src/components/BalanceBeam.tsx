import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

const W = 320, H = 178, PX = 160, PY = 46, ARM = 116, DROP = 44;

/**
 * The JimBuddy scale: a food plate (left) against iron plates (right).
 * tilt > 0 tips toward the iron side (training ahead of fuel); tilt < 0 toward the plate.
 */
export function BalanceBeam({ tilt, fuelLabel, ironLabel }: { tilt: number; fuelLabel: string; ironLabel: string }) {
  const [anim] = useState(() => new Animated.Value(0));
  const [deg, setDeg] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setDeg(value));
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((r) => {
        if (r) anim.setValue(tilt);
        else Animated.spring(anim, { toValue: tilt, friction: 5, tension: 40, useNativeDriver: false }).start();
      });
    return () => anim.removeListener(id);
  }, [tilt, anim]);

  const rad = (deg * Math.PI) / 180;
  const dx = ARM * Math.cos(rad), dy = ARM * Math.sin(rad);
  const L = { x: PX - dx, y: PY - dy };
  const R = { x: PX + dx, y: PY + dy };

  return (
    <View accessible accessibilityLabel={`Balance: fuel ${fuelLabel}, training ${ironLabel}. ${Math.abs(tilt) < 1.5 ? 'Level.' : tilt > 0 ? 'Training side lower.' : 'Fuel side lower.'}`}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* stand */}
        <Path d={`M${PX} ${PY} L${PX - 26} ${H - 18} L${PX + 26} ${H - 18} Z`} fill={colors.cream} stroke={colors.steelLight} strokeWidth={1.5} />
        <Rect x={PX - 46} y={H - 20} width={92} height={8} rx={4} fill={colors.steel} />

        {/* strings */}
        <Line x1={L.x} y1={L.y} x2={L.x - 22} y2={L.y + DROP} stroke={colors.steelLight} strokeWidth={1.5} />
        <Line x1={L.x} y1={L.y} x2={L.x + 22} y2={L.y + DROP} stroke={colors.steelLight} strokeWidth={1.5} />
        <Line x1={R.x} y1={R.y} x2={R.x - 22} y2={R.y + DROP} stroke={colors.steelLight} strokeWidth={1.5} />
        <Line x1={R.x} y1={R.y} x2={R.x + 22} y2={R.y + DROP} stroke={colors.steelLight} strokeWidth={1.5} />

        {/* beam */}
        <Line x1={L.x} y1={L.y} x2={R.x} y2={R.y} stroke={colors.ink} strokeWidth={7} strokeLinecap="round" />
        <Circle cx={PX} cy={PY} r={9} fill={colors.amber} stroke={colors.ink} strokeWidth={3} />

        {/* food plate */}
        <G x={L.x} y={L.y + DROP}>
          <Ellipse cx={0} cy={4} rx={40} ry={9} fill={colors.steel} />
          <Ellipse cx={0} cy={0} rx={40} ry={9} fill="#fff" stroke={colors.steelLight} strokeWidth={1.5} />
          <Ellipse cx={-14} cy={-6} rx={9} ry={6} fill="#fff" stroke={colors.line} />
          <Circle cx={-14} cy={-6} r={3.5} fill={colors.amber} />
          <Path d="M2 -4 q8 -14 20 -6 q-4 8 -20 6 Z" fill={colors.roast} />
          <Rect x={-4} y={-18} width={8} height={14} rx={2} fill="#fff" stroke={colors.steelLight} />
        </G>

        {/* iron plates */}
        <G x={R.x} y={R.y + DROP}>
          <Ellipse cx={0} cy={4} rx={36} ry={8} fill={colors.steel} />
          <Ellipse cx={0} cy={0} rx={36} ry={8} fill={colors.cream} stroke={colors.steelLight} strokeWidth={1.5} />
          <Rect x={-26} y={-24} width={14} height={24} rx={3} fill={colors.ink} />
          <Rect x={-10} y={-18} width={12} height={18} rx={3} fill={colors.inkSoft} />
          <Rect x={4} y={-13} width={10} height={13} rx={3} fill={colors.steel} />
          <Rect x={16} y={-9} width={8} height={9} rx={2} fill={colors.steelLight} />
        </G>
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: '6%', marginTop: -6 }}>
        <Text style={{ fontWeight: '800', color: colors.ink }}>Fuel <Text style={{ color: colors.roast }}>{fuelLabel}</Text></Text>
        <Text style={{ fontWeight: '800', color: colors.ink }}>Training <Text style={{ color: colors.steel }}>{ironLabel}</Text></Text>
      </View>
    </View>
  );
}
