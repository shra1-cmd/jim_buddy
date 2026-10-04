import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { CameraIcon } from '../../components/TabIcons';
import { Bar, Card, Ring } from '../../components/ui';
import {
  SLOT_LABEL, SLOT_SHARE, SLOTS, copyMeal, deleteMealItem, getProfile, mealItemsForDay, pendingScans,
  type MealItem, type Profile, type QueuedScan, type Slot,
} from '../../db/queries';
import { syncPhoneSteps } from '../../db/activity';
import { burnedOn } from '../../db/training';
import { addDays, dayLabel, todayKey } from '../../lib/dates';
import { quantityLabel, sum } from '../../lib/nutrition';
import { caloriesLeft } from '../../lib/targets';
import { colors, radius, space, type } from '../../theme';

export default function JournalScreen() {
  const db = useSQLiteContext();
  const [date, setDate] = useState(todayKey());
  const [items, setItems] = useState<MealItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [burned, setBurned] = useState(0);
  const [pending, setPending] = useState<QueuedScan[]>([]);

  const load = useCallback(async () => {
    if (date >= addDays(todayKey(), -6)) await syncPhoneSteps(db, false); // silent: only if already allowed
    const [p, rows, b, q] = await Promise.all([getProfile(db), mealItemsForDay(db, date), burnedOn(db, date), pendingScans(db)]);
    setProfile(p);
    setItems(rows);
    setBurned(b);
    setPending(q);
  }, [db, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = useMemo(() => sum(items), [items]);
  const target = profile?.kcal ?? 2000;
  const left = caloriesLeft(target, totals.kcal, burned, profile?.eatBackPct ?? 50);

  const openAdd = (slot: Slot) => router.push({ pathname: '/add-food', params: { date, slot } });

  const onItemPress = (item: MealItem) => {
    Alert.alert(item.name, `${quantityLabel(item.qty, item.unit)} · ${Math.round(item.kcal)} kcal · ${item.protein} g protein`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMealItem(db, item.id);
          load();
        },
      },
    ]);
  };

  const copyYesterday = async (slot: Slot) => {
    const n = await copyMeal(db, addDays(date, -1), date, slot);
    if (n === 0) Alert.alert('Nothing to copy', `Yesterday's ${SLOT_LABEL[slot].toLowerCase()} is empty.`);
    load();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      {/* Date strip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <Pressable accessibilityLabel="Previous day" onPress={() => setDate(addDays(date, -1))} style={dateBtn}>
          <Text style={{ fontSize: 20, color: colors.ink }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setDate(todayKey())}>
          <Text style={type.h2}>{dayLabel(date)}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Next day" onPress={() => setDate(addDays(date, 1))} style={dateBtn}>
          <Text style={{ fontSize: 20, color: colors.ink }}>›</Text>
        </Pressable>
      </View>

      {/* Day summary */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
          <Stat value={totals.kcal} label="Eaten" />
          <Ring progress={totals.kcal / target} center={String(Math.abs(left))} sub={left >= 0 ? 'kcal left' : 'kcal over'} />
          <Stat value={burned} label="Burned" />
        </View>
        <Bar big label="Protein" value={totals.protein} target={profile?.proteinG ?? 120} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Bar label="Carbs" value={totals.carbs} target={profile?.carbsG ?? 250} />
          <Bar label="Fat" value={totals.fat} target={profile?.fatG ?? 60} />
          <Bar label="Fiber" value={totals.fiber} target={profile?.fiberG ?? 30} />
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/scan', params: { date, slot: slotForNow() } })}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.amber, borderRadius: radius.md, height: 46, marginBottom: space.md }}
      >
        <CameraIcon color={colors.ink} />
        <Text style={{ fontWeight: '700', color: colors.ink }}>Scan meal</Text>
      </Pressable>

      {pending.length > 0 && (
        <Card style={{ borderColor: colors.amber, borderWidth: 2 }}>
          <Text style={type.h2}>{pending.length} scan{pending.length > 1 ? 's' : ''} pending</Text>
          <Text style={[type.small, { marginBottom: 8 }]}>Saved while offline. Not counted until you confirm them.</Text>
          {pending.map((q) => (
            <Pressable key={q.id} onPress={() => router.push({ pathname: '/scan', params: { date: q.local_date, slot: q.slot, mode: q.kind, queueId: String(q.id) } })} style={{ paddingVertical: 6 }}>
              <Text style={{ color: colors.steel, fontWeight: '700' }}>Analyse {SLOT_LABEL[q.slot].toLowerCase()} · {q.local_date}  ›</Text>
            </Pressable>
          ))}
        </Card>
      )}

      {SLOTS.map((slot) => {
        const slotItems = items.filter((i) => i.slot === slot);
        const t = sum(slotItems);
        const budget = Math.round(target * SLOT_SHARE[slot]);
        return (
          <Card key={slot} style={{ paddingVertical: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={type.h2}>{SLOT_LABEL[slot]}</Text>
                <Text style={type.small}>
                  {t.kcal} / {budget} kcal · {t.protein} g protein
                </Text>
              </View>
              <Pressable accessibilityLabel={`Add food to ${SLOT_LABEL[slot]}`} onPress={() => openAdd(slot)} style={plusBtn}>
                <Text style={{ color: '#fff', fontSize: 24, lineHeight: 26, fontWeight: '600' }}>+</Text>
              </Pressable>
            </View>
            {slotItems.map((it) => (
              <Pressable key={it.id} onPress={() => onItemPress(it)} style={itemRow}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Text style={type.body} numberOfLines={1}>{it.name}</Text>
                  <Text style={type.small}>{it.source === 'quick' ? 'Quick add' : quantityLabel(it.qty, it.unit)}</Text>
                </View>
                <Text style={{ fontWeight: '600', color: colors.ink }}>{Math.round(it.kcal)}</Text>
              </Pressable>
            ))}
            {slotItems.length === 0 && (
              <Pressable onPress={() => copyYesterday(slot)} style={{ marginTop: space.sm }}>
                <Text style={{ color: colors.steel, fontWeight: '600' }}>{`Copy yesterday’s ${SLOT_LABEL[slot].toLowerCase()}`}</Text>
              </Pressable>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function slotForNow(): Slot {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snacks';
  return 'dinner';
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', width: 70 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{Math.round(value)}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const dateBtn = { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' } as const;
const plusBtn = { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' } as const;
const itemRow = { flexDirection: 'row', alignItems: 'center', paddingTop: space.md, marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.line } as const;
