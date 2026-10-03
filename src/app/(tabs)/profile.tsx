import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { BodyMap } from '../../components/BodyMap';
import { MiniLine } from '../../components/MiniLine';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../../components/ui';
import { exerciseById, MUSCLE_LABEL } from '../../data/exercises';
import { listPhotos, measurementEntries, topLifts } from '../../db/body';
import { bodyEntries, getProfile, saveWeight, type BodyEntry, type Profile } from '../../db/queries';
import { doneSetsSince, exerciseHistory } from '../../db/training';
import { weekStartKey } from '../../lib/balance';
import { bestE1rm, setsPerMuscle } from '../../lib/training';
import { todayKey } from '../../lib/dates';
import { movingAverage, weeklyRate, type Point } from '../../lib/progress';
import { GOALS } from '../../lib/targets';
import { colors, radius, space, type } from '../../theme';

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

  const load = useCallback(async () => {
    const [p, e, m, ph, top, weekSets] = await Promise.all([
      getProfile(db), bodyEntries(db, 90), measurementEntries(db, 60), listPhotos(db), topLifts(db, 4),
      doneSetsSince(db, weekStartKey(new Date())),
    ]);
    setProfile(p);
    setEntries(e);
    const w = m.filter((r) => r.waist_cm != null);
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
          <Text style={{ color: colors.amber, fontSize: 26, fontWeight: '800' }}>{(profile?.name || 'J').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={type.h2}>{profile?.name || 'You'}</Text>
            <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Settings" hitSlop={10}>
              <Text style={{ color: colors.steel, fontWeight: '700' }}>Settings ›</Text>
            </Pressable>
          </View>
          <Text style={type.small}>{goalLabel}</Text>
          <Pressable onPress={() => router.push('/onboarding')} style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: colors.amberSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 13 }}>
              {profile ? `${profile.kcal} kcal · ${profile.proteinG} g protein  ›` : 'Set targets ›'}
            </Text>
          </Pressable>
        </View>
      </View>

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
            {'\n'}Hard sets since Monday (secondary muscles count half). Dark amber = 10+, a good weekly dose for growth.
          </Text>
        )}
      </Card>
    </ScrollView>
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
