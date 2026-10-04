import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../components/ui';
import { GROUPS, allExercises, type Exercise, type Group } from '../data/exercises';
import { addExerciseToSession, addPlanExercise, createCustomExercise, loadCustomExercises } from '../db/training';
import type { LogType } from '../lib/training';
import { colors, space, type } from '../theme';

const LOG_TYPES: { v: LogType; label: string }[] = [
  { v: 'weight_reps', label: 'kg × reps' },
  { v: 'reps', label: 'Reps only' },
  { v: 'assisted', label: 'Assisted' },
  { v: 'time', label: 'Time' },
  { v: 'distance_time', label: 'Distance + time' },
];
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'cardio machine'];

// Multi-select exercises into a plan (?planId=) or a live workout (?sessionId=).
export default function ExercisePicker() {
  const db = useSQLiteContext();
  const { planId, sessionId } = useLocalSearchParams<{ planId?: string; sessionId?: string }>();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [list, setList] = useState<Exercise[]>(allExercises());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCustomExercises(db).then(() => setList(allExercises()));
  }, [db]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? list.filter((e) => e.name.toLowerCase().includes(t)) : list;
  }, [q, list]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const add = async () => {
    for (const id of picked) {
      if (planId) await addPlanExercise(db, planId, id);
      else if (sessionId) await addExerciseToSession(db, Number(sessionId), id);
    }
    router.back();
  };

  if (creating) return <CreateCustom onDone={async (id) => { setList(allExercises()); setCreating(false); if (id) setPicked((p) => [...p, id]); }} db={db} />;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Add exercises' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        <TextInput placeholder="Search exercises" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} style={[ui.input, { marginBottom: space.md }]} />
        <Chip label="＋ Create custom exercise" onPress={() => setCreating(true)} />
        {GROUPS.map((g) => {
          const items = filtered.filter((e) => e.group === g.id);
          if (!items.length) return null;
          return (
            <View key={g.id}>
              <SectionLabel>{g.label}</SectionLabel>
              <Card style={{ paddingVertical: 4 }}>
                {items.map((e) => {
                  const on = picked.includes(e.id);
                  return (
                    <Pressable key={e.id} onPress={() => toggle(e.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : 'transparent', marginRight: space.md, alignItems: 'center', justifyContent: 'center' }}>
                        {on && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                      </View>
                      <Text style={[type.body, { flex: 1 }]}>{e.name}</Text>
                      <Text style={type.small}>{e.equipment}</Text>
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
        <Button title={picked.length ? `Add ${picked.length}` : 'Pick exercises'} onPress={add} disabled={!picked.length} />
      </View>
    </View>
  );
}

function CreateCustom({ db, onDone }: { db: ReturnType<typeof useSQLiteContext>; onDone: (id: string | null) => void }) {
  const [name, setName] = useState('');
  const [grp, setGrp] = useState<Group>('chest');
  const [equipment, setEquipment] = useState('dumbbell');
  const [logType, setLogType] = useState<LogType>('weight_reps');
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Custom exercise' }} />
      <SectionLabel>Name</SectionLabel>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Pec deck fly" placeholderTextColor={colors.muted} style={[ui.input, { marginBottom: space.lg }]} />
      <SectionLabel>Muscle group</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
        {GROUPS.map((g) => <Chip key={g.id} label={g.label} selected={grp === g.id} onPress={() => setGrp(g.id)} />)}
      </View>
      <SectionLabel>Equipment</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
        {EQUIPMENT.map((e) => <Chip key={e} label={e} selected={equipment === e} onPress={() => setEquipment(e)} />)}
      </View>
      <SectionLabel>Log as</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
        {LOG_TYPES.map((l) => <Chip key={l.v} label={l.label} selected={logType === l.v} onPress={() => setLogType(l.v)} />)}
      </View>
      <Button title="Create" disabled={!name.trim()} onPress={async () => onDone(await createCustomExercise(db, name.trim(), grp, equipment, logType))} />
      <Pressable onPress={() => onDone(null)} style={{ alignItems: 'center', padding: space.md }}>
        <Text style={{ color: colors.steel, fontWeight: '600' }}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}
