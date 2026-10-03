import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, styles as ui } from '../../components/ui';
import { exerciseById } from '../../data/exercises';
import { getProfile } from '../../db/queries';
import {
  addSet, discardSession, exerciseHistory, finishSession, getSession, lastSetsFor, loadCustomExercises, removeExerciseFromSession,
  removeSet, updateSet, type Session, type SetRow,
} from '../../db/training';
import { cancelRestEnd, scheduleRestEnd } from '../../lib/restTimer';
import { bestE1rm, formatDuration, sessionVolume, suggestLoad } from '../../lib/training';
import { colors, radius, space, type } from '../../theme';

type Draft = { a: string; b: string }; // first and second input of a set row, as typed

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const db = useSQLiteContext();
  const [session, setSession] = useState<Session | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [lastByEx, setLastByEx] = useState<Record<string, SetRow[]>>({});
  const [now, setNow] = useState(() => Date.now());
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const restAlerted = useRef(false);

  const load = useCallback(async () => {
    await loadCustomExercises(db);
    const r = await getSession(db, sessionId);
    setSession(r.session);
    setSets(r.sets);
    setDrafts((d) => {
      const next = { ...d };
      for (const s of r.sets) if (!next[s.id]) next[s.id] = toDraft(s);
      return next;
    });
    const exIds = [...new Set(r.sets.map((s) => s.exercise_id))];
    const entries = await Promise.all(exIds.map(async (e) => [e, await lastSetsFor(db, e, sessionId)] as const));
    setLastByEx(Object.fromEntries(entries));
  }, [db, sessionId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = session?.status === 'active';

  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync('workout').catch(() => {});
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      try { Promise.resolve(deactivateKeepAwake('workout')).catch(() => {}); } catch { /* not active */ }
    };
  }, [active]);

  const restLeft = restEnd ? Math.max(0, Math.round((restEnd - now) / 1000)) : 0;
  useEffect(() => {
    if (restEnd && restLeft === 0 && !restAlerted.current) {
      restAlerted.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [restEnd, restLeft]);

  const groups = useMemo(() => {
    const out: { position: number; exerciseId: string; sets: SetRow[] }[] = [];
    for (const s of sets) {
      let g = out.find((x) => x.position === s.position && x.exerciseId === s.exercise_id);
      if (!g) out.push((g = { position: s.position, exerciseId: s.exercise_id, sets: [] }));
      g.sets.push(s);
    }
    return out;
  }, [sets]);

  if (!session) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const persist = async (s: SetRow, patch: Partial<SetRow> = {}) => {
    const ex = exerciseById(s.exercise_id);
    const d = drafts[s.id] ?? toDraft(s);
    const values = fromDraft(d, ex?.logType ?? 'weight_reps');
    const next = { ...s, ...values, ...patch };
    setSets((xs) => xs.map((x) => (x.id === s.id ? next : x)));
    await updateSet(db, next);
    return next;
  };

  const toggleDone = async (s: SetRow) => {
    const next = await persist(s, { done: s.done ? 0 : 1 });
    if (next.done && !next.is_warmup) {
      const rest = next.rest_s ?? exerciseById(next.exercise_id)?.restSec ?? 90;
      if (rest > 0) {
        restAlerted.current = false;
        setRestEnd(Date.now() + rest * 1000);
        const nextName = exerciseById(next.exercise_id)?.name ?? 'next set';
        scheduleRestEnd(rest, `Next: ${nextName}`);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const adjustRest = (delta: number) => {
    if (!restEnd) return;
    const end = Math.max(Date.now(), restEnd + delta * 1000);
    setRestEnd(end);
    scheduleRestEnd((end - Date.now()) / 1000, 'Rest over');
  };
  const skipRest = () => {
    setRestEnd(null);
    cancelRestEnd();
  };

  const finish = async () => {
    const doneCount = sets.filter((s) => s.done).length;
    if (!doneCount) {
      Alert.alert('Nothing logged', 'Tick at least one set, or discard this workout.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: async () => { await cancelRestEnd(); await discardSession(db, sessionId); router.back(); } },
      ]);
      return;
    }
    const profile = await getProfile(db);
    // personal records: best e1RM this session vs everything before
    const records: string[] = [];
    for (const g of groups) {
      const mine = bestE1rm(g.sets);
      if (!mine) continue;
      const hist = (await exerciseHistory(db, g.exerciseId, 60)).filter((h) => h.session_id !== sessionId);
      const prev = bestE1rm(hist);
      if (prev != null && mine > prev) records.push(exerciseById(g.exerciseId)?.name ?? g.exerciseId);
    }
    await cancelRestEnd();
    const kcal = await finishSession(db, sessionId, profile?.weightKg ?? 70);
    const minutes = Math.round((Date.now() - Date.parse(session.started_at)) / 60000);
    Alert.alert(
      'Workout saved',
      `${minutes} min · ${sessionVolume(sets)} kg volume · ~${kcal} kcal${records.length ? `\nNew records: ${records.join(', ')}` : ''}`,
    );
    router.back();
  };

  const elapsed = (now - Date.parse(session.started_at)) / 1000;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: active ? `${session.name} · ${formatDuration(elapsed)}` : session.name }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: restEnd && active ? 140 : 60 }} keyboardShouldPersistTaps="handled">
        {!active && (
          <Card>
            <Text style={type.h2}>{new Date(session.started_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
            <Text style={type.small}>
              {session.ended_at ? `${Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60000)} min · ` : ''}
              {sessionVolume(sets)} kg volume · ~{Math.round(session.kcal)} kcal
            </Text>
          </Card>
        )}

        {groups.map((g) => {
          const ex = exerciseById(g.exerciseId);
          const lt = ex?.logType ?? 'weight_reps';
          const last = lastByEx[g.exerciseId] ?? [];
          const sug = suggestLoad(last, g.sets[0]?.rep_max ?? 12, ex?.incrementKg ?? 2.5, lt);
          const [ha, hb] = headers(lt);
          return (
            <Card key={`${g.position}-${g.exerciseId}`}>
              <Pressable
                onPress={() => router.push(`/exercise/${g.exerciseId}`)}
                onLongPress={() => active && Alert.alert('Remove exercise?', ex?.name, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: async () => { await removeExerciseFromSession(db, sessionId, g.exerciseId); load(); } },
                ])}
              >
                <Text style={type.h2}>{ex?.name ?? g.exerciseId}</Text>
              </Pressable>
              <Text style={type.small}>
                {last.length ? `Last: ${last.filter((s) => s.done && !s.is_warmup).map((s) => lastLabel(s, lt)).join(', ')}` : 'First time: pick a weight you can do with 2 reps to spare'}
                {g.sets[0]?.rep_min ? `  ·  target ${g.sets[0].rep_min}–${g.sets[0].rep_max}` : ''}
              </Text>
              {active && sug.progressed && (
                <Text style={{ color: colors.good, fontWeight: '700', marginTop: 4 }}>
                  {lt === 'assisted' ? `You hit the top last time: try ${sug.kg} kg assistance` : `You hit the top last time: try ${sug.kg} kg`}
                </Text>
              )}

              <View style={{ flexDirection: 'row', marginTop: space.md, marginBottom: 4 }}>
                <Text style={[type.label, { width: 44 }]}>SET</Text>
                <Text style={[type.label, { flex: 1, textAlign: 'center' }]}>{ha}</Text>
                {hb ? <Text style={[type.label, { flex: 1, textAlign: 'center' }]}>{hb}</Text> : null}
                <View style={{ width: 48 }} />
              </View>
              {g.sets.map((s) => {
                const d = drafts[s.id] ?? toDraft(s);
                return (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, opacity: s.done ? 0.65 : 1 }}>
                    <Pressable
                      disabled={!active}
                      onPress={() => persist(s, { is_warmup: s.is_warmup ? 0 : 1 })}
                      onLongPress={() => active && Alert.alert('Delete set?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await removeSet(db, s.id); load(); } }])}
                      accessibilityLabel={s.is_warmup ? 'Warm-up set, tap to make working' : `Set ${s.set_no}, tap to mark warm-up`}
                      style={{ width: 44 }}
                    >
                      <Text style={{ fontWeight: '800', color: s.is_warmup ? colors.amber : colors.ink }}>{s.is_warmup ? 'W' : s.set_no}</Text>
                    </Pressable>
                    <SetInput editable={active} value={d.a} onChange={(v) => setDrafts((x) => ({ ...x, [s.id]: { ...d, a: v } }))} onBlur={() => persist(s)} />
                    {hb ? <SetInput editable={active} value={d.b} onChange={(v) => setDrafts((x) => ({ ...x, [s.id]: { ...d, b: v } }))} onBlur={() => persist(s)} /> : null}
                    <Pressable
                      disabled={!active}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: !!s.done }}
                      onPress={() => toggleDone(s)}
                      style={{ width: 40, height: 40, marginLeft: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? colors.good : colors.bg }}
                    >
                      <Text style={{ color: s.done ? '#fff' : colors.muted, fontWeight: '800', fontSize: 16 }}>✓</Text>
                    </Pressable>
                  </View>
                );
              })}
              {active && (
                <Pressable onPress={async () => { await addSet(db, sessionId, g.exerciseId); load(); }} style={{ paddingTop: 6 }}>
                  <Text style={{ color: colors.steel, fontWeight: '700' }}>＋ Add set</Text>
                </Pressable>
              )}
            </Card>
          );
        })}

        {active && (
          <>
            <Button title="Add exercise" variant="ghost" onPress={() => router.push({ pathname: '/exercise-picker', params: { sessionId: String(sessionId) } })} style={{ marginBottom: space.md }} />
            <Button title="Finish workout" onPress={finish} style={{ marginBottom: space.md }} />
            <Text style={[type.small, { textAlign: 'center' }]}>Tap a set number to mark a warm-up · long-press to delete</Text>
          </>
        )}
      </ScrollView>

      {active && restEnd && (
        <View style={{ position: 'absolute', left: space.md, right: space.md, bottom: space.md, backgroundColor: restLeft > 0 ? colors.ink : colors.good, borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.amber, fontWeight: '800', fontSize: 12 }}>{restLeft > 0 ? 'REST' : 'GO'}</Text>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{restLeft > 0 ? formatDuration(restLeft) : 'Next set'}</Text>
          </View>
          <RestBtn label="−15" onPress={() => adjustRest(-15)} />
          <RestBtn label="+15" onPress={() => adjustRest(15)} />
          <RestBtn label={restLeft > 0 ? 'Skip' : 'Close'} onPress={skipRest} />
        </View>
      )}
    </View>
  );
}

function headers(lt: string): [string, string | null] {
  switch (lt) {
    case 'reps': return ['REPS', null];
    case 'assisted': return ['ASSIST KG', 'REPS'];
    case 'time': return ['SECONDS', null];
    case 'distance_time': return ['KM', 'MIN'];
    default: return ['KG', 'REPS'];
  }
}

function toDraft(s: SetRow): Draft {
  const n = (v: number | null | undefined) => (v == null ? '' : String(v));
  const ex = exerciseById(s.exercise_id);
  switch (ex?.logType) {
    case 'reps': return { a: n(s.reps), b: '' };
    case 'time': return { a: n(s.seconds), b: '' };
    case 'distance_time': return { a: s.distance_m == null ? '' : String(s.distance_m / 1000), b: s.seconds == null ? '' : String(Math.round(s.seconds / 60)) };
    default: return { a: n(s.kg), b: n(s.reps) };
  }
}

function fromDraft(d: Draft, lt: string): Pick<SetRow, 'kg' | 'reps' | 'seconds' | 'distance_m'> {
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  switch (lt) {
    case 'reps': return { kg: null, reps: num(d.a), seconds: null, distance_m: null };
    case 'time': return { kg: null, reps: null, seconds: num(d.a), distance_m: null };
    case 'distance_time': {
      const km = num(d.a), min = num(d.b);
      return { kg: null, reps: null, distance_m: km == null ? null : km * 1000, seconds: min == null ? null : min * 60 };
    }
    default: return { kg: num(d.a), reps: num(d.b), seconds: null, distance_m: null };
  }
}

function lastLabel(s: SetRow, lt: string): string {
  switch (lt) {
    case 'reps': return `${s.reps ?? '–'}`;
    case 'time': return `${s.seconds ?? '–'} s`;
    case 'distance_time': return `${s.distance_m != null ? s.distance_m / 1000 : '–'} km / ${s.seconds != null ? Math.round(s.seconds / 60) : '–'} min`;
    case 'assisted': return `−${s.kg ?? 0}×${s.reps ?? '–'}`;
    default: return `${s.kg ?? '–'}×${s.reps ?? '–'}`;
  }
}

function SetInput({ value, onChange, onBlur, editable }: { value: string; onChange: (v: string) => void; onBlur: () => void; editable: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      editable={editable}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={[ui.input, { flex: 1, height: 40, marginHorizontal: 4, textAlign: 'center', fontWeight: '700' }]}
    />
  );
}

function RestBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginLeft: 8, paddingHorizontal: 12, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
