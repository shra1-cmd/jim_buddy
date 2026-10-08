import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './AppText';
import { IconBadge } from './ui';
import { MICROS, microTarget } from '../data/micros';
import { SLOT_LABEL, SLOTS, type MealItem, type Profile } from '../db/queries';
import { sum } from '../lib/nutrition';
import { clay, colors, macro, radius, space, tiles, type } from '../theme';

const SLOT_ICON = { breakfast: 'sun', lunch: 'bowl', snacks: 'cup', dinner: 'moon' } as const;
const SLOT_TINT = { breakfast: tiles.yellow, lunch: tiles.green, snacks: tiles.coral, dinner: tiles.blue } as const;

/** Pop-up from "Macros today": what you've eaten against your targets, per meal, then the micronutrients to cover. */
export function MacroSheet({ visible, onClose, items, profile }: { visible: boolean; onClose: () => void; items: MealItem[]; profile: Profile | null }) {
  const insets = useSafeAreaInsets();
  const t = sum(items);
  const rows = [
    { label: 'Calories', value: t.kcal, target: profile?.kcal ?? 2000, unit: 'kcal', color: colors.coral },
    { label: 'Protein', value: t.protein, target: profile?.proteinG ?? 120, unit: 'g', color: macro.protein },
    { label: 'Carbs', value: t.carbs, target: profile?.carbsG ?? 250, unit: 'g', color: macro.carbs },
    { label: 'Fat', value: t.fat, target: profile?.fatG ?? 60, unit: 'g', color: macro.fat },
    { label: 'Fiber', value: t.fiber, target: profile?.fiberG ?? 30, unit: 'g', color: colors.sageDeep },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} accessibilityLabel="Close" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(63, 47, 39, 0.35)' }} />
        <View style={{ maxHeight: '86%', backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, boxShadow: clay.card, paddingBottom: insets.bottom }}>
          <View style={{ alignItems: 'center', paddingTop: space.sm }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md }}>
            <Text style={[type.h2, { flex: 1, fontSize: 20 }]}>Today’s nutrition</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" style={{ backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, boxShadow: clay.soft }}>
              <Text style={{ fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}>
            {/* macros */}
            <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, boxShadow: clay.card, marginBottom: space.md }}>
              <Text style={[type.label, { marginBottom: space.sm }]}>MACROS</Text>
              {rows.map((r) => {
                const p = r.target > 0 ? r.value / r.target : 0;
                return (
                  <View key={r.label} style={{ marginBottom: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
                      <Text style={{ flex: 1, fontWeight: '700', fontSize: 15 }}>{r.label}</Text>
                      <Text style={{ fontWeight: '800', fontSize: 15, color: r.color }}>{Math.round(r.value)}</Text>
                      <Text style={type.small}> / {r.target} {r.unit}</Text>
                    </View>
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.cream, overflow: 'hidden', boxShadow: clay.well }}>
                      <View style={{ width: `${Math.min(p, 1) * 100}%`, height: '100%', borderRadius: 5, backgroundColor: p > 1.1 ? colors.danger : r.color }} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* per meal */}
            <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, boxShadow: clay.card, marginBottom: space.md }}>
              <Text style={[type.label, { marginBottom: space.sm }]}>BY MEAL</Text>
              {SLOTS.map((slot, i) => {
                const m = sum(items.filter((it) => it.slot === slot));
                return (
                  <View key={slot} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <IconBadge name={SLOT_ICON[slot]} color={SLOT_TINT[slot].badge} size={30} />
                    <Text style={{ fontWeight: '700', marginLeft: space.sm, width: 80 }}>{SLOT_LABEL[slot]}</Text>
                    <Text style={[type.small, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
                      {m.kcal ? `${Math.round(m.kcal)} kcal · P ${Math.round(m.protein)} · C ${Math.round(m.carbs)} · F ${Math.round(m.fat)}` : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* micros */}
            <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, boxShadow: clay.card }}>
              <Text style={[type.label, { marginBottom: 2 }]}>MICRONUTRIENTS TO COVER</Text>
              <Text style={[type.small, { marginBottom: space.sm }]}>Daily targets for you. JimBuddy doesn’t count these from your meals yet; eat the sources across the day.</Text>
              {MICROS.map((m, i) => (
                <View key={m.name} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, fontWeight: '800', fontSize: 15 }}>{m.name}</Text>
                    <View style={{ backgroundColor: m.limit ? tiles.coral.bg : tiles.green.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: m.limit ? colors.coralDeep : colors.tealDeep }}>
                        {m.limit ? 'under ' : ''}{microTarget(m, profile?.sex).toLocaleString('en-IN')} {m.unit}
                      </Text>
                    </View>
                  </View>
                  <Text style={[type.small, { marginTop: 2 }]}>{m.why}</Text>
                  <Text style={{ fontSize: 12, color: colors.inkSoft, marginTop: 2 }}>🍽 {m.sources}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
