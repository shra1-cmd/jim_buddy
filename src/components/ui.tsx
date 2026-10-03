import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, space, type } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={[type.label, { marginBottom: space.sm, textTransform: 'uppercase' }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.ink : variant === 'secondary' ? colors.amber : 'transparent';
  const fg = variant === 'primary' ? '#fff' : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.line },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.ink, borderColor: colors.ink }]}
    >
      <Text style={{ color: selected ? '#fff' : colors.ink, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Calories ring: the arc shows the share of the target eaten (amber), overflow turns it red. */
export function Ring({ size = 150, progress, center, sub }: { size?: number; progress: number; center: string; sub: string }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(progress, 1));
  const over = progress > 1;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        {p > 0 && <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.danger : colors.amber}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * p} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />}
      </Svg>
      <Text style={{ fontSize: 30, fontWeight: '800', color: colors.ink }}>{center}</Text>
      <Text style={type.small}>{sub}</Text>
    </View>
  );
}

export function Bar({ label, value, target, unit = 'g', big }: { label: string; value: number; target: number; unit?: string; big?: boolean }) {
  const p = target > 0 ? Math.min(value / target, 1) : 0;
  const left = Math.max(0, Math.round(target - value));
  return (
    <View style={{ flex: big ? undefined : 1, marginBottom: big ? space.md : 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: big ? 15 : 12, fontWeight: big ? '700' : '600', color: colors.ink }}>{label}</Text>
        <Text style={{ fontSize: big ? 14 : 11, color: colors.muted }}>
          {big ? `${left} ${unit} left` : `${Math.round(value)}/${target}`}
        </Text>
      </View>
      <View style={{ height: big ? 10 : 6, backgroundColor: colors.line, borderRadius: radius.pill, overflow: 'hidden' }}>
        <View style={{ width: `${p * 100}%`, height: '100%', backgroundColor: big ? colors.ink : colors.steelLight, borderRadius: radius.pill }} />
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  button: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  input: {
    minWidth: 0, // lets inputs shrink inside flex rows (web otherwise uses an intrinsic width)
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.ink,
  },
});
