import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../../components/ui';
import { GROUPS, MUSCLE_LABEL, STARTER_TEMPLATES, allExercises, exercisesForMuscle, type Exercise } from '../../data/exercises';
import { clearManualSteps, deleteSport, getSteps, logSport, setManualSteps, sportsOn, syncPhoneSteps, type StepSync } from '../../db/activity';
import { getProfile, type Profile } from '../../db/queries';
import {
  activeSession, burnBreakdown, createPlan, createPlanFromTemplate, listPlans, loadCustomExercises, startSession,
  type Burn, type Plan, type Session,
} from '../../db/training';
import { SPORTS, sportKcal, stepBaseline, type Intensity } from '../../lib/activity';
import { todayKey } from '../../lib/dates';
import { ensureTimerPermission } from '../../lib/restTimer';
import { colors, radius, space, type } from '../../theme';

type View_ = 'workouts' | 'activity' | 'exercises';

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
          <Chip label="Workouts" selected={view === 'workouts'} onPress={() => setView('workouts')} />
          <Chip label="Steps & games" selected={view === 'activity'} onPress={() => setView('activity')} />
          <Chip label="Exercises" selected={view === 'exercises'} onPress={() => setView('exercises')} />
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
        ) : view === 'activity' ? (
          <Activity db={db} />
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

  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionLabel>My plans</SectionLabel>
        <Pressable onPress={() => router.push('/history')} accessibilityLabel="Workout history" style={{ marginBottom: space.sm }}>
          <Text style={{ color: colors.steel, fontWeight: '700' }}>History ›</Text>
        </Pressable>
      </View>
      {plans.length === 0 && (
        <Card>
          <Text style={type.body}>No plans yet. Pick a starter template or build your own.</Text>
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
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Button title="New plan" variant="ghost" onPress={newPlan} style={{ flex: 1 }} />
        <Button title={showTemplates ? 'Starter templates ▴' : 'Starter templates ▾'} variant={showTemplates ? 'secondary' : 'ghost'} onPress={() => setShowTemplates(!showTemplates)} style={{ flex: 1 }} />
      </View>

      {showTemplates && STARTER_TEMPLATES.map((t, i) => (
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

function Activity({ db }: { db: ReturnType<typeof useSQLiteContext> }) {
  const today = todayKey();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [burn, setBurn] = useState<Burn | null>(null);
  const [stepSrc, setStepSrc] = useState<string | null>(null);
  const [sync, setSync] = useState<StepSync | null>(null);
  const [manual, setManual] = useState('');
  const [games, setGames] = useState<{ id: number; name: string; kcal: number; started_at: string; ended_at: string }[]>([]);
  const [sport, setSport] = useState(SPORTS[0].id);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [minutes, setMinutes] = useState('60');

  const load = useCallback(async () => {
    const [p, b, s, g] = await Promise.all([getProfile(db), burnBreakdown(db, today), getSteps(db, today), sportsOn(db, today)]);
    setProfile(p);
    setBurn(b);
    setStepSrc(s?.source ?? null);
    setGames(g);
  }, [db, today]);

  const syncNow = useCallback(async () => {
    setSync(await syncPhoneSteps(db));
    load();
  }, [db, load]);
  useFocusEffect(useCallback(() => { syncNow(); }, [syncNow]));

  const weight = profile?.weightKg ?? 70;
  const baseline = stepBaseline(profile?.activity ?? 1.2);
  const sp = SPORTS.find((x) => x.id === sport)!;
  const mins = Math.max(0, Number(minutes.replace(',', '.')) || 0);
  const preview = sportKcal(sp.met[intensity], weight, mins);

  const saveSteps = async () => {
    const n = Number(manual.replace(/[^0-9]/g, ''));
    if (!(n >= 0 && n <= 100000)) return Alert.alert('Check the number', 'Enter today’s steps, e.g. 8450');
    await setManualSteps(db, today, n);
    setManual('');
    load();
  };

  const addGame = async () => {
    if (mins < 5) return Alert.alert('How long?', 'Enter the minutes you played (5 or more).');
    await logSport(db, today, sport, intensity, mins, weight);
    load();
  };

  const stepNote =
    sync === 'ok' && stepSrc !== 'manual' ? 'Synced from this iPhone’s step counter.'
      : sync === 'denied' ? 'Motion & Fitness access is off. Turn it on in iPhone Settings → JimBuddy (or Expo Go), or type your steps.'
        : stepSrc === 'manual' ? 'Typed in by you.'
          : Platform.OS === 'ios' ? 'Type the number from your Fitness / Health app.' : 'Type the number from your fitness app (Android can’t read past steps without a dev build).';

  return (
    <>
      <Card style={{ backgroundColor: colors.ink, borderColor: colors.ink }}>
        <Text style={{ color: colors.amber, fontWeight: '800', fontSize: 12 }}>BURNED TODAY</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{burn?.total ?? 0} kcal</Text>
        <Text style={{ color: colors.steelLight }}>
          Workouts {burn?.workouts ?? 0} · Games {burn?.sports ?? 0} · Steps {burn?.steps ?? 0}
        </Text>
        <Text style={{ color: colors.steelLight, fontSize: 12, marginTop: 4 }}>
          Journal adds back {profile?.eatBackPct ?? 50}% of this to your calories.
        </Text>
      </Card>

      <SectionLabel>Steps</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.ink }}>{(burn?.stepCount ?? 0).toLocaleString('en-IN')}</Text>
          <Text style={type.small}>≈ {burn?.steps ?? 0} kcal extra</Text>
        </View>
        <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, marginVertical: space.sm, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, ((burn?.stepCount ?? 0) / Math.max(baseline * 1.6, 1)) * 100)}%`, height: 8, backgroundColor: colors.amber }} />
        </View>
        <Text style={type.small}>
          {stepNote} Your first {baseline.toLocaleString('en-IN')} steps are already inside your calorie target, so only steps above that count.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <TextInput value={manual} onChangeText={setManual} keyboardType="number-pad" placeholder="Today’s steps" placeholderTextColor={colors.muted} style={[ui.input, { flex: 1 }]} accessibilityLabel="Today's steps" />
          <Button title="Save" onPress={saveSteps} style={{ width: 80 }} />
        </View>
        {Platform.OS === 'ios' && (
          <View style={{ flexDirection: 'row', marginTop: space.sm }}>
            <Chip label="Sync from iPhone" onPress={async () => { await clearManualSteps(db, today); syncNow(); }} />
          </View>
        )}
      </Card>

      <SectionLabel>Games</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SPORTS.map((s) => <Chip key={s.id} label={`${s.emoji} ${s.name}`} selected={sport === s.id} onPress={() => setSport(s.id)} />)}
        </View>
        <Text style={[type.label, { marginTop: space.sm, marginBottom: 6 }]}>INTENSITY</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {(['medium', 'high'] as Intensity[]).map((i) => (
            <Pressable key={i} onPress={() => setIntensity(i)} style={{ flex: 1, padding: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: intensity === i ? colors.ink : colors.line, backgroundColor: intensity === i ? colors.amberSoft : colors.card }}>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{i === 'high' ? 'High' : 'Medium'}</Text>
              <Text style={type.small}>{sp.hint[i]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[type.label, { marginTop: space.md, marginBottom: 6 }]}>TIME (MINUTES)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" style={[ui.input, { width: 90, textAlign: 'center', fontWeight: '700' }]} accessibilityLabel="Minutes played" />
          {[30, 60, 90].map((m) => <Chip key={m} label={`${m}`} selected={mins === m} onPress={() => setMinutes(String(m))} />)}
        </View>
        <Button title={`Add ${sp.name} · ≈ ${preview} kcal`} onPress={addGame} style={{ marginTop: space.md }} />
        <Text style={[type.small, { marginTop: space.sm }]}>Estimate = MET × your weight ({weight} kg) × time, minus resting burn.</Text>
      </Card>

      {games.length > 0 && (
        <>
          <SectionLabel>Logged today</SectionLabel>
          <Card>
            {games.map((g) => (
              <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { fontWeight: '600' }]}>{g.name}</Text>
                  <Text style={type.small}>{Math.round((Date.parse(g.ended_at) - Date.parse(g.started_at)) / 60000)} min · {g.kcal} kcal</Text>
                </View>
                <Pressable accessibilityLabel={`Remove ${g.name}`} onPress={async () => { await deleteSport(db, g.id); load(); }} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 18 }}>×</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}
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
