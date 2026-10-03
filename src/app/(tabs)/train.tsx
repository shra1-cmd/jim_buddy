import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { Card, Chip, SectionLabel } from '../../components/ui';
import { EXERCISES, GROUPS, STARTER_TEMPLATES, exerciseById, exercisesForMuscle, type Exercise } from '../../data/exercises';
import { colors, space, type } from '../../theme';

type View_ = 'workouts' | 'exercises';

const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Chest', deltoids: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearm: 'Forearms', abs: 'Abs',
  obliques: 'Obliques', quadriceps: 'Quads', hamstring: 'Hamstrings', gluteal: 'Glutes', calves: 'Calves',
  adductors: 'Adductors', trapezius: 'Traps', 'upper-back': 'Upper back', 'lower-back': 'Lower back',
};

export default function TrainScreen() {
  const [view, setView] = useState<View_>('exercises');
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <View style={{ flexDirection: 'row', marginBottom: space.md }}>
        <Chip label="My Workouts" selected={view === 'workouts'} onPress={() => setView('workouts')} />
        <Chip label="Exercises" selected={view === 'exercises'} onPress={() => setView('exercises')} />
      </View>
      {view === 'workouts' ? <Workouts /> : <Exercises />}
    </ScrollView>
  );
}

function Workouts() {
  return (
    <>
      <Card style={{ backgroundColor: colors.amberSoft, borderColor: colors.amberSoft }}>
        <Text style={[type.body, { fontWeight: '700' }]}>Plan builder and live logging land in Phase 2.</Text>
        <Text style={[type.small, { color: colors.inkSoft, marginTop: 4 }]}>
          Starter templates below show what you’ll be able to duplicate and edit.
        </Text>
      </Card>
      <SectionLabel>Starter templates</SectionLabel>
      {STARTER_TEMPLATES.map((t) => (
        <Card key={t.name}>
          <Text style={type.h2}>{t.name}</Text>
          <Text style={[type.small, { marginBottom: space.sm }]}>{t.days}</Text>
          {t.exercises.map((id) => {
            const e = exerciseById(id);
            return e ? (
              <Pressable key={id} onPress={() => router.push(`/exercise/${id}`)}>
                <Text style={[type.body, { paddingVertical: 4 }]}>· {e.name}</Text>
              </Pressable>
            ) : null;
          })}
        </Card>
      ))}
    </>
  );
}

function Exercises() {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [muscle, setMuscle] = useState<string | null>(null);

  const filtered = useMemo(() => (muscle ? exercisesForMuscle(muscle) : []), [muscle]);

  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Text style={type.small}>Tap a muscle</Text>
          <Pressable onPress={() => setSide(side === 'front' ? 'back' : 'front')}>
            <Text style={{ color: colors.steel, fontWeight: '700' }}>Show {side === 'front' ? 'back' : 'front'} ↺</Text>
          </Pressable>
        </View>
        <BodyMap
          levels={muscle ? { [muscle]: 2 } : {}}
          side={side}
          scale={1.1}
          onPress={(slug) => setMuscle(MUSCLE_LABEL[slug] ? slug : null)}
        />
      </Card>

      {muscle ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>{MUSCLE_LABEL[muscle]} · {filtered.length}</SectionLabel>
            <Pressable onPress={() => setMuscle(null)}>
              <Text style={{ color: colors.steel, fontWeight: '600', marginBottom: space.sm }}>Show all</Text>
            </Pressable>
          </View>
          <Card>{filtered.map((e) => <ExerciseRow key={e.id} e={e} muscle={muscle} />)}</Card>
        </>
      ) : (
        GROUPS.map((g) => {
          const list = EXERCISES.filter((e) => e.group === g.id);
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
      <Text style={type.body}>{e.name}</Text>
      <Text style={type.small}>{secondaryOnly ? 'secondary' : e.equipment}  ›</Text>
    </Pressable>
  );
}
