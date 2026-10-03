import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Button, Card, SectionLabel, styles as ui } from '../../components/ui';
import { bodyEntries, getProfile, saveWeight, type BodyEntry, type Profile } from '../../db/queries';
import { fromKey, todayKey } from '../../lib/dates';
import { movingAverage, weeklyRate, type Point } from '../../lib/progress';
import { GOALS } from '../../lib/targets';
import { colors, radius, space, type } from '../../theme';

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<BodyEntry[]>([]);
  const [weight, setWeight] = useState('');

  const load = useCallback(async () => {
    const [p, e] = await Promise.all([getProfile(db), bodyEntries(db, 90)]);
    setProfile(p);
    setEntries(e);
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
          <Text style={type.h2}>{profile?.name || 'You'}</Text>
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
          trends (coming in Phase 4) matter more than the scale.
        </Text>
      </Card>

      <SectionLabel>Recent entries</SectionLabel>
      <Card>
        {entries.length === 0 && <Text style={type.small}>No entries yet.</Text>}
        {entries.slice(0, 10).map((e) => (
          <View key={e.local_date} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={type.body}>{fromKey(e.local_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
            <Text style={[type.body, { fontWeight: '600' }]}>{e.weight_kg} kg</Text>
          </View>
        ))}
      </Card>

      <SectionLabel>Credits</SectionLabel>
      <Text style={type.small}>
        Food data: Indian Nutrient Databank (INDB), CC BY, built on ICMR-NIN food composition tables. Basic foods use typical
        values.
      </Text>
    </ScrollView>
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
