import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { BodyMap } from '../../components/BodyMap';
import { BodyProfileCard } from '../../components/BodyProfile';
import { MiniLine } from '../../components/MiniLine';
import { Mascot } from '../../components/Illustrations';
import { Button, Card, Chip, RoundButton, SectionLabel, styles as ui } from '../../components/ui';
import { exerciseById, MUSCLE_LABEL } from '../../data/exercises';
import { listPhotos, measurementEntries, topLifts, type Measurement } from '../../db/body';
import { bodyEntries, getProfile, saveWeight, setTargets, type BodyEntry, type Profile } from '../../db/queries';
import { doneSetsSince, exerciseHistory, loadCustomExercises } from '../../db/training';
import { weekStartKey } from '../../lib/balance';
import { bestE1rm, setsPerMuscle } from '../../lib/training';
import { targetsPrompt } from '../../lib/chatgpt';
import { todayKey } from '../../lib/dates';
import { bodyProfile } from '../../lib/measures';
import { movingAverage, weeklyRate, type Point } from '../../lib/progress';
import { ACTIVITY_LEVELS, GOALS, computeTargets, macroKcal, type Targets } from '../../lib/targets';
import { clay, colors, radius, space, type } from '../../theme';

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<BodyEntry[]>([]);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState<{ last: number; change: number | null } | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [lifts, setLifts] = useState<{ id: string; name: string; points: Point[] }[]>([]);
  const [muscles, setMuscles] = useState<Record<string, number>>({});
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [measures, setMeasures] = useState<Measurement[]>([]);
  const [showBody, setShowBody] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<keyof Targets, string>>({ kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '' });
  const num = (s: string) => Number(s.replace(',', '.').replace(/[^0-9.]/g, ''));

  const openEditor = () => {
    if (!profile) return router.push('/onboarding');
    setDraft({ kcal: String(profile.kcal), proteinG: String(profile.proteinG), carbsG: String(profile.carbsG), fatG: String(profile.fatG), fiberG: String(profile.fiberG) });
    setEditing(true);
  };

  const saveTargets = async () => {
    const t: Targets = { kcal: num(draft.kcal), proteinG: num(draft.proteinG), carbsG: num(draft.carbsG), fatG: num(draft.fatG), fiberG: num(draft.fiberG) };
    if (!(t.kcal >= 1000 && t.kcal <= 6000)) return Alert.alert('Check calories', 'Enter a daily number between 1000 and 6000, e.g. 1950.');
    if (!(t.proteinG >= 30 && t.proteinG <= 400)) return Alert.alert('Check protein', 'Enter grams per day, e.g. 140.');
    if (!(t.carbsG >= 0 && t.carbsG <= 900)) return Alert.alert('Check carbs', 'Enter grams per day, e.g. 220.');
    if (!(t.fatG >= 15 && t.fatG <= 300)) return Alert.alert('Check fat', 'Enter grams per day, e.g. 55.');
    if (!(t.fiberG >= 0 && t.fiberG <= 100)) return Alert.alert('Check fiber', 'Enter grams per day, e.g. 28.');
    const rounded = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v)])) as unknown as Targets;
    await setTargets(db, rounded);
    setEditing(false);
    load();
  };

  const askChatGpt = async () => {
    if (!profile) return;
    const prompt = targetsPrompt({
      sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg: profile.weightKg,
      activity: ACTIVITY_LEVELS.find((a) => a.value === profile.activity)?.label ?? 'desk job',
      goal: GOALS.find((g) => g.value === profile.goal)?.label ?? 'maintain',
    });
    await Linking.openURL(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`).catch(() => Alert.alert('Couldn’t open ChatGPT', 'Open the ChatGPT app and ask there.'));
  };

  const resetTargets = async () => {
    if (!profile) return;
    await setTargets(db, computeTargets(profile));
    setEditing(false);
    load();
  };

  const load = useCallback(async () => {
    const [p, e, m, ph, top, weekSets] = await Promise.all([
      getProfile(db), bodyEntries(db, 90), measurementEntries(db, 60), listPhotos(db), topLifts(db, 4),
      doneSetsSince(db, weekStartKey(new Date())),
      loadCustomExercises(db), // so sets of your own exercises count on the muscle map
    ]);
    setProfile(p);
    setEntries(e);
    const w = m.filter((r) => r.waist_cm != null);
    setMeasures(m);
    setWaist(w.length ? { last: w[0].waist_cm!, change: w.length > 1 ? Math.round((w[0].waist_cm! - w[w.length - 1].waist_cm!) * 10) / 10 : null } : null);
    setPhotoCount(ph.length);
    setMuscles(setsPerMuscle(weekSets, (id) => exerciseById(id)));
    const ids = top.length ? top : [];
    setLifts(
      await Promise.all(
        ids.map(async (id) => {
          const rows = await exerciseHistory(db, id, 20);
          const bySession = new Map<number, typeof rows>();
          rows.forEach((r) => bySession.set(r.session_id, [...(bySession.get(r.session_id) ?? []), r]));
          const points: Point[] = [];
          bySession.forEach((sets) => {
            const v = bestE1rm(sets);
            if (v != null) points.push({ date: sets[0].local_date, value: v });
          });
          points.sort((a, b) => a.date.localeCompare(b.date));
          return { id, name: exerciseById(id)?.name ?? id, points };
        }),
      ),
    );
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const points: Point[] = useMemo(
    () => entries.filter((e) => e.weight_kg != null).map((e) => ({ date: e.local_date, value: e.weight_kg as number })),
    [entries],
  );
  const smooth = useMemo(() => movingAverage(points, 7), [points]);
  const rate = weeklyRate(smooth);
  const latestAvg = smooth.length ? smooth[smooth.length - 1].value : null;
  const body = useMemo(
    () => bodyProfile(measures, profile?.heightCm ?? null, points.length ? points[0].value : profile?.weightKg ?? null, profile?.sex ?? 'male'),
    [measures, profile, points],
  );

  const logWeight = async () => {
    const w = Number(weight.replace(',', '.'));
    if (!(w >= 30 && w <= 250)) {
      Alert.alert('Check the number', 'Enter your weight in kg, e.g. 72.4');
      return;
    }
    await saveWeight(db, todayKey(), w);
    setWeight('');
    load();
  };

  const goalLabel = GOALS.find((g) => g.value === profile?.goal)?.label ?? '';

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <View style={{ backgroundColor: colors.mint, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', boxShadow: clay.tile, marginBottom: space.lg }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#FDE2D2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 4, borderColor: colors.cardHi, boxShadow: clay.soft, marginRight: space.md }}>
          <Mascot face size={76} id="profile" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#24493C', flexShrink: 1 }} numberOfLines={1}>Hi, {profile?.name || 'you'}! 👋</Text>
            <RoundButton icon="gear" label="Settings" color={colors.tealDeep} size={36} onPress={() => router.push('/settings')} />
          </View>
          <Text style={{ color: '#3F6E5D', fontSize: 13 }}>{goalLabel}</Text>
          <Pressable onPress={openEditor} accessibilityLabel="Edit daily targets" style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, boxShadow: clay.soft }}>
            <Text style={{ fontWeight: '700', fontSize: 13 }}>
              {profile ? `${profile.kcal} kcal · ${profile.proteinG} g protein  ✎` : 'Set targets ›'}
            </Text>
          </Pressable>
        </View>
      </View>

      {editing && profile && (
        <Card style={{ borderColor: colors.coral, borderWidth: 2 }}>
          <Text style={[type.h2, { marginBottom: space.md }]}>Daily targets</Text>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <TargetField label="CALORIES (KCAL)" value={draft.kcal} onChange={(v) => setDraft({ ...draft, kcal: v })} autoFocus big />
            <TargetField label="PROTEIN (G)" value={draft.proteinG} onChange={(v) => setDraft({ ...draft, proteinG: v })} big />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <TargetField label="CARBS (G)" value={draft.carbsG} onChange={(v) => setDraft({ ...draft, carbsG: v })} />
            <TargetField label="FAT (G)" value={draft.fatG} onChange={(v) => setDraft({ ...draft, fatG: v })} />
            <TargetField label="FIBER (G)" value={draft.fiberG} onChange={(v) => setDraft({ ...draft, fiberG: v })} />
          </View>
          {(() => {
            const fromMacros = macroKcal(num(draft.proteinG), num(draft.carbsG), num(draft.fatG));
            const off = Math.abs(fromMacros - num(draft.kcal)) > Math.max(100, num(draft.kcal) * 0.1);
            return (
              <Text style={[type.small, { marginTop: space.sm, color: off ? colors.danger : colors.muted }]}>
                Protein + carbs + fat = {fromMacros} kcal{off ? ' (far from your calorie target)' : ''}. Suggested for you: {computeTargets(profile).kcal} kcal · P {computeTargets(profile).proteinG} · C {computeTargets(profile).carbsG} · F {computeTargets(profile).fatG} · fiber {computeTargets(profile).fiberG} g.
              </Text>
            );
          })()}
          <Pressable onPress={askChatGpt} accessibilityRole="link" style={{ marginVertical: space.sm }}>
            <Text style={{ color: colors.tealDeep, fontWeight: '700' }}>💬 Chat with ChatGPT for targets that suit your body ›</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Save" onPress={saveTargets} style={{ flex: 1 }} />
            <Button title="Use suggested" variant="ghost" onPress={resetTargets} style={{ flex: 1 }} />
          </View>
          <Pressable onPress={() => setEditing(false)} style={{ alignSelf: 'center', marginTop: space.sm }}>
            <Text style={{ color: colors.steel, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </Card>
      )}

      <SectionLabel>Body weight</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md }}>
          <Big value={latestAvg != null ? `${latestAvg} kg` : '—'} label="7-day average" />
          <Big value={rate != null ? `${rate > 0 ? '+' : ''}${rate} kg` : '—'} label="per week" />
          <Big value={points.length ? `${points[0].value} kg` : '—'} label="last entry" small />
        </View>
        <TrendChart raw={points} smooth={smooth} />
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <TextInput
            placeholder="Today's weight (kg)"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
            style={[ui.input, { flex: 1 }]}
          />
          <Button title="Log" onPress={logWeight} style={{ width: 80 }} />
        </View>
        <Text style={[type.small, { marginTop: space.sm }]}>
          Weigh in the morning. Daily numbers swing with water; watch the average line. During a recomposition, waist and strength
          trends matter more than the scale.
        </Text>
      </Card>

      <SectionLabel>Body</SectionLabel>
      <Card>
        <Row title="Measurements" sub={waist ? `Waist ${waist.last} cm${waist.change != null ? ` (${waist.change > 0 ? '+' : ''}${waist.change} since first)` : ''}` : 'Waist, chest, arm, thigh'} onPress={() => router.push('/measurements')} />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <Row title="Progress photos" sub={photoCount ? `${photoCount} photo${photoCount > 1 ? 's' : ''} · compare side by side` : 'Front, side, back'} onPress={() => router.push('/photos')} />
      </Card>

      <SectionLabel>Strength (estimated 1-rep max)</SectionLabel>
      <Card>
        {lifts.length === 0 && <Text style={type.small}>Finish a workout with weighted sets to see your strength trend.</Text>}
        {lifts.map((l) => {
          const last = l.points[l.points.length - 1];
          const first = l.points[0];
          const diff = last && first && l.points.length > 1 ? Math.round((last.value - first.value) * 10) / 10 : null;
          return (
            <Pressable key={l.id} onPress={() => router.push(`/exercise/${l.id}`)} style={{ marginBottom: space.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[type.body, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>{l.name}</Text>
                <Text style={[type.body, { fontWeight: '800' }]}>
                  {last ? `${last.value} kg` : '—'}
                  {diff != null ? <Text style={{ color: diff >= 0 ? colors.good : colors.danger, fontWeight: '600' }}>{`  ${diff >= 0 ? '+' : ''}${diff}`}</Text> : null}
                </Text>
              </View>
              <MiniLine points={l.points} height={36} empty={null} />
            </Pressable>
          );
        })}
      </Card>

      <SectionLabel>Muscles this week</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
          <Chip label="Front" selected={side === 'front'} onPress={() => setSide('front')} />
          <Chip label="Back" selected={side === 'back'} onPress={() => setSide('back')} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <BodyMap side={side} scale={0.8} levels={Object.fromEntries(Object.entries(muscles).map(([k, v]) => [k, v >= 10 ? 2 : 1])) as Record<string, 1 | 2>} />
        </View>
        {Object.keys(muscles).length === 0 ? (
          <Text style={type.small}>No sets logged since Monday.</Text>
        ) : (
          <Text style={type.small}>
            {Object.entries(muscles).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${MUSCLE_LABEL[k] ?? k} ${v}`).join(' · ')}
            {'\n'}Hard sets since Monday (secondary muscles count half). Solid coral = 10+, a good weekly dose for growth.
          </Text>
        )}
      </Card>

      <SectionLabel>Body profile</SectionLabel>
      <Card>
        <Button
          title={showBody ? 'Hide body profile' : 'Body profile'}
          icon="person"
          variant={showBody ? 'ghost' : 'secondary'}
          onPress={() => setShowBody(!showBody)}
        />
        {showBody && (
          <View style={{ marginTop: space.md }}>
            <BodyProfileCard p={body} sex={profile?.sex ?? 'male'} avgWeight={latestAvg} photoCount={photoCount} />
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

function TargetField({ label, value, onChange, autoFocus, big }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; big?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.label, { marginBottom: 4 }]} numberOfLines={1}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" autoFocus={autoFocus} selectTextOnFocus style={[ui.input, { fontSize: big ? 20 : 17, fontWeight: '800' }]} accessibilityLabel={label.toLowerCase()} />
    </View>
  );
}

function Row({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontWeight: '600' }]}>{title}</Text>
        <Text style={type.small}>{sub}</Text>
      </View>
      <Text style={{ color: colors.steel, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

function Big({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <View>
      <Text style={{ fontSize: small ? 16 : 20, fontWeight: '800', color: colors.ink }}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function TrendChart({ raw, smooth }: { raw: Point[]; smooth: Point[] }) {
  const W = 300, H = 110, pad = 8;
  if (raw.length < 2) {
    return (
      <View style={{ height: 60, justifyContent: 'center' }}>
        <Text style={type.small}>Log a few days to see your trend.</Text>
      </View>
    );
  }
  const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date));
  const t = (d: string) => Date.parse(d);
  const t0 = t(sorted[0].date), t1 = t(sorted[sorted.length - 1].date) || t0 + 1;
  const vals = sorted.map((p) => p.value);
  const lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5;
  const x = (d: string) => pad + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {sorted.map((p) => (
        <Circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={3} fill={colors.steelLight} />
      ))}
      <Polyline points={smooth.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke={colors.ink} strokeWidth={2.5} />
    </Svg>
  );
}
