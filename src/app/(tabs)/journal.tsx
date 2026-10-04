import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/AppText';
import { Glyph } from '../../components/Glyphs';
import { Bar, Button, Card, IconBadge, Ring } from '../../components/ui';
import { syncPhoneSteps } from '../../db/activity';
import { menuCount, menuSlotCounts } from '../../db/menu';
import {
  SLOT_LABEL, SLOT_SHARE, SLOTS, copyMeal, deleteMealItem, getProfile, mealItemsForDay, slotForNow,
  type MealItem, type Profile, type Slot,
} from '../../db/queries';
import { burnedOn } from '../../db/training';
import { addDays, dayLabel, todayKey } from '../../lib/dates';
import { dowOfKey } from '../../lib/menu';
import { quantityLabel, sum } from '../../lib/nutrition';
import { caloriesLeft } from '../../lib/targets';
import { clay, colors, macro, radius, space, tiles, type } from '../../theme';

const SLOT_STYLE = {
  breakfast: { icon: 'sun', tint: tiles.yellow },
  lunch: { icon: 'bowl', tint: tiles.green },
  snacks: { icon: 'cup', tint: tiles.coral },
  dinner: { icon: 'moon', tint: tiles.blue },
} as const;

export default function JournalScreen() {
  const db = useSQLiteContext();
  const [date, setDate] = useState(todayKey());
  const [items, setItems] = useState<MealItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [burned, setBurned] = useState(0);
  const [menuTotal, setMenuTotal] = useState(0);
  const [menuSlots, setMenuSlots] = useState<Partial<Record<Slot, number>>>({});

  const load = useCallback(async () => {
    if (date >= addDays(todayKey(), -6)) await syncPhoneSteps(db, false); // silent: only if already allowed
    const [p, rows, b, mt, ms] = await Promise.all([
      getProfile(db), mealItemsForDay(db, date), burnedOn(db, date), menuCount(db), menuSlotCounts(db, dowOfKey(date)),
    ]);
    setProfile(p);
    setItems(rows);
    setBurned(b);
    setMenuTotal(mt);
    setMenuSlots(ms);
  }, [db, date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = useMemo(() => sum(items), [items]);
  const target = profile?.kcal ?? 2000;
  const left = caloriesLeft(target, totals.kcal, burned, profile?.eatBackPct ?? 50);

  const openAdd = (slot: Slot, mode?: 'menu') => router.push({ pathname: '/add-food', params: { date, slot, ...(mode ? { mode } : {}) } });

  const onItemPress = (item: MealItem) => {
    Alert.alert(item.name, `${quantityLabel(item.qty, item.unit)} · ${Math.round(item.kcal)} kcal · ${item.protein} g protein`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMealItem(db, item.id); load(); } },
    ]);
  };

  const copyYesterday = async (slot: Slot) => {
    const n = await copyMeal(db, addDays(date, -1), date, slot);
    if (n === 0) Alert.alert('Nothing to copy', `Yesterday's ${SLOT_LABEL[slot].toLowerCase()} is empty.`);
    load();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 32 }}>
      {/* Date strip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <RoundNav dir="back" onPress={() => setDate(addDays(date, -1))} />
        <Pressable onPress={() => setDate(todayKey())} style={{ backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 8, boxShadow: clay.soft }}>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{dayLabel(date)}</Text>
        </Pressable>
        <RoundNav dir="next" onPress={() => setDate(addDays(date, 1))} />
      </View>

      {/* Day summary */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
          <Stat value={totals.kcal} label="Eaten" />
          <Ring progress={totals.kcal / target} center={String(Math.abs(left))} sub={left >= 0 ? 'kcal left' : 'kcal over'} />
          <Stat value={burned} label="Burned" />
        </View>
        <Bar big label="Protein" value={totals.protein} target={profile?.proteinG ?? 120} color={macro.protein} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Bar label="Carbs" value={totals.carbs} target={profile?.carbsG ?? 250} color={macro.carbs} />
          <Bar label="Fat" value={totals.fat} target={profile?.fatG ?? 60} color={macro.fat} />
          <Bar label="Fiber" value={totals.fiber} target={profile?.fiberG ?? 30} color={colors.sageDeep} />
        </View>
      </Card>

      <Button title="Scan meal" icon="camera" onPress={() => router.push({ pathname: '/scan', params: { date, slot: slotForNow() } })} style={{ marginBottom: space.sm }} />
      <Button
        title={menuTotal ? 'Weekly menu' : 'Upload weekly menu'}
        icon="menu"
        variant="secondary"
        onPress={() => router.push('/menu')}
        style={{ marginBottom: space.lg }}
      />

      {SLOTS.map((slot) => {
        const slotItems = items.filter((i) => i.slot === slot);
        const t = sum(slotItems);
        const budget = Math.round(target * SLOT_SHARE[slot]);
        const st = SLOT_STYLE[slot];
        const onMenu = menuSlots[slot] ?? 0;
        return (
          <Card key={slot} style={{ paddingVertical: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconBadge name={st.icon} color={st.tint.badge} size={42} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={type.h2}>{SLOT_LABEL[slot]}</Text>
                <Text style={type.small}>{Math.round(t.kcal)} / {budget} kcal · {Math.round(t.protein)} g protein</Text>
              </View>
              <Pressable
                accessibilityLabel={`Add food to ${SLOT_LABEL[slot]}`}
                onPress={() => openAdd(slot, onMenu > 0 ? 'menu' : undefined)}
                style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', boxShadow: clay.button, transform: [{ scale: pressed ? 0.94 : 1 }] })}
              >
                <Glyph name="plus" size={22} />
              </Pressable>
            </View>
            {slotItems.map((it) => (
              <Pressable key={it.id} onPress={() => onItemPress(it)} style={{ flexDirection: 'row', alignItems: 'center', paddingTop: space.md, marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.line }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Text style={type.body} numberOfLines={1}>{it.name}</Text>
                  <Text style={type.small}>{it.source === 'quick' ? 'Quick add' : quantityLabel(it.qty, it.unit)}{it.source === 'menu' ? ' · menu' : it.source === 'chatgpt' ? ' · ChatGPT' : ''}</Text>
                </View>
                <Text style={{ fontWeight: '700' }}>{Math.round(it.kcal)}</Text>
              </Pressable>
            ))}
            {slotItems.length === 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md }}>
                {onMenu > 0 && (
                  <Pressable onPress={() => openAdd(slot, 'menu')} accessibilityRole="button">
                    <Text style={{ color: colors.coralDeep, fontWeight: '700' }}>From menu ({onMenu})</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => copyYesterday(slot)} accessibilityRole="button">
                  <Text style={{ color: colors.tealDeep, fontWeight: '700' }}>{`Copy yesterday’s ${SLOT_LABEL[slot].toLowerCase()}`}</Text>
                </Pressable>
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function RoundNav({ dir, onPress }: { dir: 'back' | 'next'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={dir === 'back' ? 'Previous day' : 'Next day'}
      onPress={onPress}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', boxShadow: clay.soft, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <View style={{ transform: [{ rotate: dir === 'back' ? '180deg' : '0deg' }] }}>
        <Glyph name="chevron" size={18} color={colors.ink} />
      </View>
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', width: 70 }}>
      <Text style={{ fontSize: 22, fontWeight: '800' }}>{Math.round(value)}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}
