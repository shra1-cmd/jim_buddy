import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { Button, Card, Chip, SectionLabel } from '../../components/ui';
import { GROUPS, MUSCLE_LABEL, STARTER_TEMPLATES, allExercises, exercisesForMuscle, type Exercise } from '../../data/exercises';
import {
  activeSession, createPlan, createPlanFromTemplate, listPlans, loadCustomExercises, startSession,
  type Plan, type Session,
} from '../../db/training';
import { ensureTimerPermission } from '../../lib/restTimer';
import { colors, radius, space, type } from '../../theme';

type View_ = 'workouts' | 'exercises';

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TrainScreen() {
  const db = useSQLiteContext();
  const [view, setView] = useState<View_>('workouts');
  const [plans, setPlans] = useState<(Plan & { count: number })[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    await loadCustomExercises(db);
    const [p, a] = await Promise.all([listPlans(db), activeSession(db)]);
    setPlans(p);
    setActive(a);
    setTick((t) => t + 1);
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const start = async (planId: string | null) => {
    await ensureTimerPermission();
    const id = await startSession(db, planId);
    router.push(`/workout/${id}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 110 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <Chip label="My Workouts" selected={view === 'workouts'} onPress={() => setView('workouts')} />
          <Chip label="Exercises" selected={view === 'exercises'} onPress={() => setView('exercises')} />
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push('/history')} accessibilityLabel="Workout history" style={{ marginBottom: space.sm }}>
            <Text style={{ color: colors.steel, fontWeight: '700' }}>History ›</Text>
          </Pressable>
        </View>

        {active && (
          <Pressable onPress={() => router.push(`/workout/${active.id}`)}>
            <Card style={{ backgroundColor: colors.ink, borderColor: colors.ink }}>
              <Text style={{ color: colors.amber, fontWeight: '800' }}>WORKOUT IN PROGRESS</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 }}>{active.name} · tap to resume</Text>
            </Card>
          </Pressable>
        )}

        {view === 'workouts' ? (
          <Workouts db={db} plans={plans} onStart={start} reload={load} />
        ) : (
          <Exercises />
        )}
      </ScrollView>

      {!active && view === 'workouts' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => start(null)}
          style={{ position: 'absolute', right: space.lg, bottom: space.lg, backgroundColor: colors.amber, borderRadius: radius.pill, paddingHorizontal: 20, height: 52, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}
        >
          <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 15 }}>＋ Empty workout</Text>
        </Pressable>
      )}
    </View>
  );
}

function Workouts({ db, plans, onStart, reload }: { db: ReturnType<typeof useSQLiteContext>; plans: (Plan & { count: number })[]; onStart: (id: string | null) => void; reload: () => void }) {
  const newPlan = async () => {
    const id = await createPlan(db, `Plan ${plans.length + 1}`);
    router.push(`/plan/${id}`);
  };
  const applyTemplate = async (i: number) => {
    const id = await createPlanFromTemplate(db, i);
    reload();
    router.push(`/plan/${id}`);
  };

  return (
    <>
      <SectionLabel>My plans</SectionLabel>
      {plans.length === 0 && (
        <Card>
          <Text style={type.body}>No plans yet. Start from a template below or build your own.</Text>
        </Card>
      )}
      {plans.map((p) => (
        <Card key={p.id}>
          <Pressable onPress={() => router.push(`/plan/${p.id}`)}>
            <Text style={type.h2}>{p.name}</Text>
            <Text style={type.small}>
              {p.count} exercises{p.days ? ` · ${p.days.split(',').map((d) => DAY[Number(d)]).join(' ')}` : ''}  · edit ›
            </Text>
          </Pressable>
          <Button title="Start" onPress={() => (p.count ? onStart(p.id) : Alert.alert('Empty plan', 'Add exercises first.'))} style={{ marginTop: space.md, height: 42 }} />
        </Card>
      ))}
      <Button title="New plan" variant="ghost" onPress={newPlan} style={{ marginBottom: space.lg }} />

      <SectionLabel>Starter templates</SectionLabel>
      {STARTER_TEMPLATES.map((t, i) => (
        <Card key={t.name}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={type.h2}>{t.name}</Text>
              <Text style={type.small}>{t.days}</Text>
            </View>
            <Chip label="Use" onPress={() => applyTemplate(i)} />
          </View>
        </Card>
      ))}
    </>
  );
}

function Exercises() {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [muscle, setMuscle] = useState<string | null>(null);
  const filtered = useMemo(() => (muscle ? exercisesForMuscle(muscle) : []), [muscle]);
  const all = allExercises();

  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Text style={type.small}>Tap a muscle</Text>
          <Pressable onPress={() => setSide(side === 'front' ? 'back' : 'front')}>
            <Text style={{ color: colors.steel, fontWeight: '700' }}>Show {side === 'front' ? 'back' : 'front'} ↺</Text>
          </Pressable>
        </View>
        <BodyMap levels={muscle ? { [muscle]: 2 } : {}} side={side} scale={1.1} onPress={(slug) => setMuscle(MUSCLE_LABEL[slug] ? slug : null)} />
      </Card>

      {muscle ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>{MUSCLE_LABEL[muscle]} · {filtered.length}</SectionLabel>
            <Pressable onPress={() => setMuscle(null)}>
              <Text style={{ color: colors.steel, fontWeight: '600', marginBottom: space.sm }}>Show all</Text>
            </Pressable>
          </View>
          <Card>{filtered.length ? filtered.map((e) => <ExerciseRow key={e.id} e={e} muscle={muscle} />) : <Text style={type.small}>Nothing here yet.</Text>}</Card>
        </>
      ) : (
        GROUPS.map((g) => {
          const list = all.filter((e) => e.group === g.id);
          return (
            <View key={g.id}>
              <SectionLabel>{g.label} · {list.length}</SectionLabel>
              <Card>{list.map((e) => <ExerciseRow key={e.id} e={e} />)}</Card>
            </View>
          );
        })
      )}
    </>
  );
}

function ExerciseRow({ e, muscle }: { e: Exercise; muscle?: string }) {
  const secondaryOnly = muscle && !e.primary.includes(muscle as never);
  return (
    <Pressable onPress={() => router.push(`/exercise/${e.id}`)} style={{ paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[type.body, { flex: 1 }]}>{e.name}</Text>
      <Text style={type.small}>{secondaryOnly ? 'secondary' : e.equipment}  ›</Text>
    </Pressable>
  );
}
