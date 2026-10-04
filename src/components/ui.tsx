import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { clay, colors, radius, space, type } from '../theme';
import { Text } from './AppText';
import { Glyph, type GlyphName } from './Glyphs';

// The pastel-clay kit: raised cards, pill buttons, soft chips, icon badges and stat tiles.

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Section title like "Listening Overview", with an optional pill action on the right ("See all"). */
export function SectionLabel({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs, marginBottom: space.sm }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, flexShrink: 1 }}>{children}</Text>
      {action && onAction ? <Pill label={action} onPress={onAction} /> : null}
    </View>
  );
}

/** Small cream pill ("See All", "This Week ▾"). */
export function Pill({ label, onPress, style }: { label: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [{ backgroundColor: colors.cardHi, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, boxShadow: clay.soft, opacity: pressed ? 0.75 : 1 }, style]}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  icon?: GlyphName;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.coral : variant === 'secondary' ? colors.sageDeep : colors.card;
  const fg = variant === 'ghost' ? colors.ink : '#fff';
  const shadow = variant === 'primary' ? clay.button : variant === 'secondary' ? clay.buttonTeal : clay.soft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, boxShadow: disabled ? undefined : shadow, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {icon ? <View style={{ marginRight: 8 }}><Glyph name={icon} size={18} color={fg} accent={variant === 'primary' ? colors.coral : colors.sageDeep} /></View> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: colors.sageDeep, boxShadow: clay.buttonTeal } : null,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={{ color: selected ? '#fff' : colors.ink, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Rounded square badge with a white glyph (like the stat-tile icons). */
export function IconBadge({ name, color, size = 44, accent }: { name: GlyphName; color: string; size?: number; accent?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color, alignItems: 'center', justifyContent: 'center', boxShadow: clay.badge }}>
      <Glyph name={name} size={size * 0.52} color="#fff" accent={accent ?? color} />
    </View>
  );
}

/** Round raised button (the "play" buttons in the reference). */
export function RoundButton({ icon, onPress, color = colors.sageDeep, size = 40, label }: { icon: GlyphName; onPress: () => void; color?: string; size?: number; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.cardHi, alignItems: 'center', justifyContent: 'center', boxShadow: clay.soft, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Glyph name={icon} size={size * 0.48} color={color} />
    </Pressable>
  );
}

/** Pastel stat tile: badge, label, big value, small coloured note. */
export function StatTile({ icon, tint, label, value, note, noteGood, onPress, accent }: {
  icon: GlyphName;
  tint: { bg: string; badge: string };
  label: string;
  value: string;
  note?: string;
  noteGood?: boolean;
  onPress?: () => void;
  accent?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.tile, { backgroundColor: tint.bg, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <IconBadge name={icon} color={tint.badge} size={42} accent={accent} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink, marginTop: 10 }} numberOfLines={1}>{label}</Text>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {note ? (
        <Text style={{ fontSize: 12, fontWeight: noteGood ? '700' : '500', color: noteGood ? colors.good : colors.inkSoft, marginTop: 2 }} numberOfLines={1}>{note}</Text>
      ) : null}
    </Pressable>
  );
}

/** Calories ring: coral arc for the share eaten, red when over. */
export function Ring({ size = 150, progress, center, sub }: { size?: number; progress: number; center: string; sub: string }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(progress, 1));
  const over = progress > 1;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F6DCC6" strokeWidth={stroke} fill="none" />
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? colors.danger : colors.coral}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c * p} ${c}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <Text style={{ fontSize: 30, fontWeight: '800', color: colors.ink }}>{center}</Text>
      <Text style={type.small}>{sub}</Text>
    </View>
  );
}

export function Bar({ label, value, target, unit = 'g', big, color }: { label: string; value: number; target: number; unit?: string; big?: boolean; color?: string }) {
  const p = target > 0 ? Math.min(value / target, 1) : 0;
  const left = Math.max(0, Math.round(target - value));
  return (
    <View style={{ flex: big ? undefined : 1, marginBottom: big ? space.md : 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ fontSize: big ? 15 : 12, fontWeight: big ? '700' : '600', color: colors.ink }}>{label}</Text>
        <Text style={{ fontSize: big ? 13 : 11, color: colors.muted }}>
          {big ? `${left} ${unit} left` : `${Math.round(value)}/${target}`}
        </Text>
      </View>
      <View style={{ height: big ? 12 : 7, backgroundColor: '#F6E2CF', borderRadius: radius.pill, overflow: 'hidden', boxShadow: clay.well }}>
        <View style={{ width: `${p * 100}%`, height: '100%', backgroundColor: color ?? colors.coral, borderRadius: radius.pill }} />
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
    boxShadow: clay.card,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: 14,
    boxShadow: clay.tile,
  },
  button: {
    height: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: space.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cardHi,
    marginRight: space.sm,
    marginBottom: space.sm,
    boxShadow: clay.soft,
  },
  input: {
    minWidth: 0, // lets inputs shrink inside flex rows (web otherwise uses an intrinsic width)
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardHi,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.ink,
    boxShadow: clay.well,
  },
});
