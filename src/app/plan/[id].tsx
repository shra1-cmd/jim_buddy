import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { ExerciseLog } from '../../components/ExerciseLog';
import { Button, Chip, SectionLabel, styles as ui } from '../../components/ui';
import { exerciseById } from '../../data/exercises';
import { getProfile } from '../../db/queries';
import {
  dayLog, deletePlan, getPlan, getSession, lastSetsFor, loadCustomExercises, movePlanExercise, removePlanExercise, updatePlan,
  type PlanExercise, type SetRow,
} from '../../db/training';
import { dayLabel, todayKey } from '../../lib/dates';
import { colors, space, type } from '../../theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A plan is a list of exercises; open one and type today's kg and reps. No start, stop or timer. */
export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const date = todayKey();
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [items, setItems] = useState<PlanExercise[] | null>(null);
  const [saved, setSaved] = useState<Record<string, SetRow[]>>({});
  const [last, setLast] = useState<Record<string, SetRow[]>>({});
  const [weightKg, setWeightKg] = useState(70);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0); // remounts the logs after a reorder / removal

  const load = useCallback(async () => {
    await loadCustomExercises(db);
    const [p, log, prof] = await Promise.all([getPlan(db, id), dayLog(db, id, date), getProfile(db)]);
    if (!p.plan) return;
    if (!loaded) {
      setName(p.plan.name);
      setDays(p.plan.days ? p.plan.days.split(',').map(Number) : []);
      setLoaded(true);
    }
    const sets = log ? (await getSession(db, log.id)).sets : [];
    const byEx: Record<string, SetRow[]> = {};
    for (const s of sets) (byEx[s.exercise_id] ??= []).push(s);
    const lastEntries = await Promise.all(p.items.map(async (pe) => [pe.exercise_id, await lastSetsFor(db, pe.exercise_id, log?.id)] as const));
    setSaved(byEx);
    setLast(Object.fromEntries(lastEntries));
    setWeightKg(prof?.weightKg ?? 70);
    setItems(p.items);
  }, [db, id, date, loaded]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveMeta = async (n = name, d = days) => updatePlan(db, id, n.trim() || 'My plan', [...d].sort().join(','));

  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    setDays(next);
    saveMeta(name, next);
  };

  const options = (pe: PlanExercise, idx: number) => {
    const list = items ?? [];
    const after = async (fn: () => Promise<unknown>) => { await fn(); setVersion((v) => v + 1); load(); };
    Alert.alert(exerciseById(pe.exercise_id)?.name ?? 'Exercise', undefined, [
      ...(idx > 0 ? [{ text: 'Move up', onPress: () => after(() => movePlanExercise(db, id, pe.id, -1)) }] : []),
      ...(idx < list.length - 1 ? [{ text: 'Move down', onPress: () => after(() => movePlanExercise(db, id, pe.id, 1)) }] : []),
      { text: 'Remove from plan', style: 'destructive' as const, onPress: () => after(() => removePlanExercise(db, pe.id)) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const remove = () =>
    Alert.alert('Delete plan?', 'Sets you already logged stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlan(db, id); router.back(); } },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: name || 'Plan' }} />
        <SectionLabel>Name</SectionLabel>
        <TextInput value={name} onChangeText={setName} onBlur={() => saveMeta()} style={[ui.input, { marginBottom: space.lg }]} />

        <SectionLabel>Days (optional)</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
          {DAYS.map((d, i) => (
            <Chip key={d} label={d} selected={days.includes(i + 1)} onPress={() => toggleDay(i + 1)} />
          ))}
        </View>

        <SectionLabel>{`Exercises · ${dayLabel(date)}`}</SectionLabel>
        {items?.length === 0 && <Text style={[type.small, { marginBottom: space.md }]}>No exercises yet. Add some below.</Text>}
        {items?.map((pe, idx) => (
          <ExerciseLog
            key={`${version}-${pe.id}`}
            planId={id}
            date={date}
            pe={pe}
            index={idx}
            saved={saved[pe.exercise_id] ?? []}
            last={last[pe.exercise_id] ?? []}
            weightKg={weightKg}
            onChanged={load}
            onLongPress={() => options(pe, idx)}
          />
        ))}
        {!!items?.length && <Text style={[type.small, { textAlign: 'center', marginBottom: space.md }]}>Tap an exercise to enter kg and reps · long-press to move or remove</Text>}

        <Button title="Add exercises" variant="ghost" onPress={() => router.push({ pathname: '/exercise-picker', params: { planId: id } })} style={{ marginBottom: space.md }} />
        <Pressable onPress={remove} style={{ alignItems: 'center', padding: space.md }}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete plan</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
