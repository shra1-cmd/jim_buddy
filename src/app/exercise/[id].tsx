import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { DemoCredit, ExerciseDemo } from '../../components/ExerciseDemo';
import { Button, Card, SectionLabel } from '../../components/ui';
import { exerciseById } from '../../data/exercises';
import { activeSession, addExerciseToSession, exerciseHistory, loadCustomExercises, startSession } from '../../db/training';
import { fromKey } from '../../lib/dates';
import { ensureTimerPermission } from '../../lib/restTimer';
import { bestE1rm } from '../../lib/training';
import { colors, space, type } from '../../theme';

type Hist = { date: string; best: string; e1rm: number | null };

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [, setReady] = useState(false);
  const [hist, setHist] = useState<Hist[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await loadCustomExercises(db);
        setReady(true);
        const rows = await exerciseHistory(db, id, 5);
        const bySession = new Map<number, typeof rows>();
        rows.forEach((r) => bySession.set(r.session_id, [...(bySession.get(r.session_id) ?? []), r]));
        const out: Hist[] = [...bySession.values()].slice(0, 5).map((sets) => {
          const working = sets.filter((s) => !s.is_warmup);
          const top = [...working].sort((a, b) => (b.kg ?? 0) * (b.reps ?? 0) - (a.kg ?? 0) * (a.reps ?? 0))[0];
          const best = top ? (top.kg != null ? `${top.kg} kg × ${top.reps ?? '–'}` : top.reps != null ? `${top.reps} reps` : top.seconds != null ? `${top.seconds} s` : '—') : '—';
          return { date: sets[0].local_date, best, e1rm: bestE1rm(sets) };
        });
        setHist(out);
      })();
    }, [db, id]),
  );

  const e = exerciseById(id);
  if (!e) {
    return (
      <View style={{ padding: space.lg }}>
        <Text style={type.body}>Exercise not found.</Text>
      </View>
    );
  }

  const levels: Record<string, 1 | 2> = {};
  e.secondary.forEach((m) => (levels[m] = 1));
  e.primary.forEach((m) => (levels[m] = 2));

  const addToWorkout = async () => {
    const active = await activeSession(db);
    await ensureTimerPermission();
    if (active) {
      await addExerciseToSession(db, active.id, e.id);
      router.push(`/workout/${active.id}`);
    } else {
      const sid = await startSession(db, null);
      await addExerciseToSession(db, sid, e.id);
      router.push(`/workout/${sid}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: e.name }} />
      <ExerciseDemo exerciseId={e.id} />
      <DemoCredit exerciseId={e.id} />

      <SectionLabel>Muscles</SectionLabel>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <BodyMap levels={levels} side="front" scale={0.7} />
        <BodyMap levels={levels} side="back" scale={0.7} />
      </Card>
      <Text style={[type.small, { marginTop: -space.sm, marginBottom: space.md }]}>Solid amber: primary. Light: secondary.</Text>

      <SectionLabel>Defaults</SectionLabel>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Fact label="Reps" value={e.reps} />
        <Fact label="Rest" value={e.restSec ? `${e.restSec} s` : '—'} />
        <Fact label="Step" value={e.incrementKg ? `${e.incrementKg} kg` : '—'} />
      </Card>

      <SectionLabel>How to</SectionLabel>
      <Card>
        {e.cues.map((c, i) => (
          <Text key={c} style={[type.body, { paddingVertical: 4 }]}>{i + 1}. {c}</Text>
        ))}
      </Card>

      <SectionLabel>Common mistakes</SectionLabel>
      <Card>
        {e.mistakes.map((m, i) => (
          <Text key={`${m}-${i}`} style={[type.body, { paddingVertical: 4 }]}>✕ {m}</Text>
        ))}
      </Card>

      <SectionLabel>Your history</SectionLabel>
      <Card>
        {hist.length === 0 && <Text style={type.small}>Not logged yet.</Text>}
        {hist.map((h) => (
          <View key={h.date + h.best} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={type.body}>{fromKey(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
            <Text style={[type.body, { fontWeight: '600' }]}>{h.best}{h.e1rm ? `  ·  e1RM ${h.e1rm}` : ''}</Text>
          </View>
        ))}
      </Card>

      {e.alternatives.length > 0 && (
        <>
          <SectionLabel>Swap (same muscles)</SectionLabel>
          <Card>
            {e.alternatives.map((a) => {
              const alt = exerciseById(a);
              return alt ? (
                <Pressable key={a} onPress={() => router.replace(`/exercise/${a}`)} style={{ paddingVertical: 8 }}>
                  <Text style={[type.body, { color: colors.steel, fontWeight: '600' }]}>{alt.name}  ›</Text>
                </Pressable>
              ) : null;
            })}
          </Card>
        </>
      )}
      <Button title="Add to workout" onPress={addToWorkout} />
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={type.label}>{label.toUpperCase()}</Text>
      <Text style={[type.body, { fontWeight: '700', marginTop: 2 }]}>{value}</Text>
    </View>
  );
}
