import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../../components/ui';
import { exerciseById } from '../../data/exercises';
import {
  deletePlan, getPlan, loadCustomExercises, movePlanExercise, removePlanExercise, startSession, updatePlan, updatePlanExercise,
  type PlanExercise,
} from '../../db/training';
import { ensureTimerPermission } from '../../lib/restTimer';
import { colors, space, type } from '../../theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [items, setItems] = useState<PlanExercise[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    await loadCustomExercises(db);
    const p = await getPlan(db, id);
    if (!p.plan) return;
    if (!loaded) {
      setName(p.plan.name);
      setDays(p.plan.days ? p.plan.days.split(',').map(Number) : []);
      setLoaded(true);
    }
    setItems(p.items);
  }, [db, id, loaded]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveMeta = async (n = name, d = days) => updatePlan(db, id, n.trim() || 'My plan', [...d].sort().join(','));

  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    setDays(next);
    saveMeta(name, next);
  };

  const change = async (pe: PlanExercise, patch: Partial<PlanExercise>) => {
    const next = { ...pe, ...patch };
    if (next.rep_min > next.rep_max) next.rep_max = next.rep_min;
    setItems((xs) => xs.map((x) => (x.id === pe.id ? next : x)));
    await updatePlanExercise(db, next);
  };

  const start = async () => {
    if (!items.length) return Alert.alert('Empty plan', 'Add at least one exercise.');
    await saveMeta();
    await ensureTimerPermission();
    const sid = await startSession(db, id);
    router.replace(`/workout/${sid}`);
  };

  const remove = () =>
    Alert.alert('Delete plan?', 'Past workouts stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlan(db, id); router.back(); } },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Edit plan' }} />
      <SectionLabel>Name</SectionLabel>
      <TextInput value={name} onChangeText={setName} onBlur={() => saveMeta()} style={[ui.input, { marginBottom: space.lg }]} />

      <SectionLabel>Days (optional)</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
        {DAYS.map((d, i) => (
          <Chip key={d} label={d} selected={days.includes(i + 1)} onPress={() => toggleDay(i + 1)} />
        ))}
      </View>

      <SectionLabel>Exercises · {items.length}</SectionLabel>
      {items.map((pe, idx) => {
        const ex = exerciseById(pe.exercise_id);
        const timed = ex?.logType === 'time' || ex?.logType === 'distance_time';
        return (
          <Card key={pe.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.h2, { flex: 1, fontSize: 16 }]}>{ex?.name ?? pe.exercise_id}</Text>
              <Pressable accessibilityLabel="Move up" disabled={idx === 0} onPress={async () => { await movePlanExercise(db, id, pe.id, -1); load(); }} style={{ padding: 6, opacity: idx === 0 ? 0.3 : 1 }}>
                <Text style={{ fontSize: 18 }}>↑</Text>
              </Pressable>
              <Pressable accessibilityLabel="Move down" disabled={idx === items.length - 1} onPress={async () => { await movePlanExercise(db, id, pe.id, 1); load(); }} style={{ padding: 6, opacity: idx === items.length - 1 ? 0.3 : 1 }}>
                <Text style={{ fontSize: 18 }}>↓</Text>
              </Pressable>
              <Pressable accessibilityLabel="Remove" onPress={async () => { await removePlanExercise(db, pe.id); load(); }} style={{ padding: 6 }}>
                <Text style={{ fontSize: 16, color: colors.danger }}>✕</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
              <Stepper label="Sets" value={pe.sets} min={1} max={10} onChange={(v) => change(pe, { sets: v })} />
              {!timed && <Stepper label="Reps from" value={pe.rep_min} min={1} max={50} onChange={(v) => change(pe, { rep_min: v })} />}
              {!timed && <Stepper label="to" value={pe.rep_max} min={1} max={50} onChange={(v) => change(pe, { rep_max: v })} />}
              <Stepper label="Rest s" value={pe.rest_s} min={0} max={600} step={15} onChange={(v) => change(pe, { rest_s: v })} />
            </View>
          </Card>
        );
      })}
      <Button title="Add exercises" variant="ghost" onPress={() => router.push({ pathname: '/exercise-picker', params: { planId: id } })} style={{ marginBottom: space.md }} />
      <Button title="Start this workout" onPress={start} style={{ marginBottom: space.md }} />
      <Pressable onPress={remove} style={{ alignItems: 'center', padding: space.md }}>
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete plan</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stepper({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={type.label}>{label.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => onChange(Math.max(min, value - step))} style={stepBtn}>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>−</Text>
        </Pressable>
        <Text style={{ minWidth: 30, textAlign: 'center', fontWeight: '700', color: colors.ink }}>{value}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} onPress={() => onChange(Math.min(max, value + step))} style={stepBtn}>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
const stepBtn = { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' } as const;
