import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BalanceBeam } from '../../components/BalanceBeam';
import { Bar, Button, Card, SectionLabel } from '../../components/ui';
import { loggedDays, proteinFix, type ProteinFix } from '../../db/body';
import { addFoodToMeal, bodyEntries, getProfile, mealItemsForDay, type Profile } from '../../db/queries';
import { getSetting } from '../../db/settings';
import { activeSession, burnedOn, listPlans, sessionsSince, startSession, type Plan, type Session } from '../../db/training';
import { beamTilt, fuelScore, trainingScore, weekProgress, weekStartKey } from '../../lib/balance';
import { addDays, fromKey, todayKey } from '../../lib/dates';
import { sum, type Nutrients } from '../../lib/nutrition';
import { movingAverage, weeklyRate } from '../../lib/progress';
import { caloriesLeft } from '../../lib/targets';
import { colors, radius, space, type } from '../../theme';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const isoDow = (key: string) => ((fromKey(key).getDay() + 6) % 7) + 1; // Mon = 1 … Sun = 7

function slotForNow(): 'breakfast' | 'lunch' | 'snacks' | 'dinner' {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h < 16 && h >= 11) return 'lunch';
  if (h < 19 && h >= 16) return 'snacks';
  return 'dinner';
}

interface State {
  profile: Profile | null;
  totals: Nutrients;
  burned: number;
  week: Session[];
  planned: number;
  todayPlans: (Plan & { count: number })[];
  active: Session | null;
  logged: Set<string>;
  fix: ProteinFix | null;
  weightAvg: number | null;
  weightRate: number | null;
  backupDue: boolean;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [s, setS] = useState<State | null>(null);
  const today = todayKey();
  const monday = weekStartKey(fromKey(today));

  const load = useCallback(async () => {
    const [profile, items, burned, week, plans, active, logged, body, lastBackup, firstMeal] = await Promise.all([
      getProfile(db), mealItemsForDay(db, today), burnedOn(db, today), sessionsSince(db, monday), listPlans(db),
      activeSession(db), loggedDays(db, monday, addDays(monday, 6)), bodyEntries(db, 30), getSetting(db, 'last_backup_at'),
      db.getFirstAsync<{ d: string | null }>('SELECT MIN(local_date) AS d FROM meal_item'),
    ]);
    const totals = sum(items);
    const days = new Set<number>();
    plans.forEach((p) => p.days.split(',').filter(Boolean).forEach((d) => days.add(Number(d))));
    const dow = String(isoDow(today));
    const left = profile ? caloriesLeft(profile.kcal, totals.kcal, burned, profile.eatBackPct) : 0;
    const proteinLeft = Math.max(0, (profile?.proteinG ?? 0) - totals.protein);
    const smooth = movingAverage(body.filter((b) => b.weight_kg != null).map((b) => ({ date: b.local_date, value: b.weight_kg! })), 7);
    const weekAgo = addDays(today, -7);
    setS({
      profile, totals, burned, week, active, logged,
      planned: days.size || 3,
      todayPlans: plans.filter((p) => p.days.split(',').includes(dow)),
      fix: profile ? await proteinFix(db, proteinLeft, left) : null,
      weightAvg: smooth.length ? smooth[smooth.length - 1].value : null,
      weightRate: weeklyRate(smooth),
      backupDue: lastBackup ? lastBackup.slice(0, 10) < weekAgo : !!firstMeal?.d && firstMeal.d <= weekAgo,
    });
  }, [db, today, monday]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!s) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const { profile, totals } = s;
  const kcalTarget = profile?.kcal ?? 0;
  const proteinTarget = profile?.proteinG ?? 0;
  const fuel = fuelScore(totals.kcal, kcalTarget, totals.protein, proteinTarget);
  const done = s.week.length;
  const training = trainingScore(done, s.planned);
  const tilt = beamTilt(fuel, training, weekProgress(fromKey(today)));
  const kcalLeft = profile ? caloriesLeft(profile.kcal, totals.kcal, s.burned, profile.eatBackPct) : 0;
  const proteinLeft = Math.max(0, Math.round(proteinTarget - totals.protein));
  const trainedToday = s.week.some((w) => w.local_date === today);

  const message =
    Math.abs(tilt) < 1.5
      ? 'Balanced. Food and training are keeping pace.'
      : tilt > 0
        ? `Training is ahead of your fuel. ${proteinLeft > 0 ? `${proteinLeft} g protein still to go.` : 'Eat to match it.'}`
        : trainedToday || !s.todayPlans.length
          ? 'Fuel is ahead of training this week. A session tomorrow evens it out.'
          : 'Fuel is ahead. Today’s workout will level the beam.';

  const start = async (planId: string) => {
    const id = await startSession(db, planId);
    router.push(`/workout/${id}`);
  };

  const addFix = async () => {
    if (!s.fix) return;
    const f = s.fix.food;
    await addFoodToMeal(db, today, slotForNow(), f, s.fix.qty, !!(f.unit && f.unit_grams));
    load();
  };

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Text style={type.small}>{fromKey(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <Text style={[type.h1, { marginBottom: space.md }]}>{profile?.name ? `${hello}, ${profile.name}` : hello}</Text>

      <Card style={{ paddingBottom: space.md }}>
        <BalanceBeam tilt={tilt} fuelLabel={`${Math.round(fuel * 100)}%`} ironLabel={`${done}/${s.planned}`} />
        <Text style={[type.body, { textAlign: 'center', marginTop: space.sm }]}>{message}</Text>
      </Card>

      <SectionLabel>Fuel today</SectionLabel>
      <Card>
        <Pressable onPress={() => router.push('/journal')} style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: space.sm }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: kcalLeft >= 0 ? colors.ink : colors.danger }}>{Math.abs(Math.round(kcalLeft))}</Text>
          <Text style={[type.small, { marginLeft: 6 }]}>{kcalLeft >= 0 ? 'kcal left' : 'kcal over'}{s.burned ? ` · includes ${Math.round((s.burned * (profile?.eatBackPct ?? 50)) / 100)} from training` : ''}</Text>
        </Pressable>
        <Bar label="Protein" value={totals.protein} target={proteinTarget} />
        {s.fix ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: space.md, marginTop: space.xs }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: colors.ink }]}>PROTEIN FIX</Text>
              <Text style={[type.body, { fontWeight: '600' }]}>{s.fix.label} {s.fix.food.name.toLowerCase().includes(s.fix.food.unit ?? '§') ? '' : `· ${s.fix.food.name}`}</Text>
              <Text style={type.small}>+{s.fix.protein} g protein · {s.fix.kcal} kcal</Text>
            </View>
            <Button title="Add" variant="secondary" onPress={addFix} style={{ width: 72 }} />
          </View>
        ) : proteinLeft === 0 && proteinTarget > 0 ? (
          <Text style={type.small}>Protein target hit. Nice.</Text>
        ) : null}
      </Card>

      <SectionLabel>Training today</SectionLabel>
      <Card>
        {s.active ? (
          <>
            <Text style={[type.body, { fontWeight: '700' }]}>{s.active.name} is in progress</Text>
            <Button title="Resume workout" onPress={() => router.push(`/workout/${s.active!.id}`)} style={{ marginTop: space.md }} />
          </>
        ) : trainedToday ? (
          <Text style={type.body}>
            Done for today: {s.week.filter((w) => w.local_date === today).map((w) => w.name).join(', ')}{s.burned > 0 ? ` · ~${s.burned} kcal` : ''}. Recover well.
          </Text>
        ) : s.todayPlans.length ? (
          s.todayPlans.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '700' }]}>{p.name}</Text>
                <Text style={type.small}>{p.count} exercises</Text>
              </View>
              <Button title="Start" onPress={() => start(p.id)} style={{ width: 90 }} />
            </View>
          ))
        ) : (
          <>
            <Text style={type.body}>Rest day on your plan.</Text>
            <Text style={type.small}>Walk, stretch, sleep. Or start something anyway from Train.</Text>
            <Button title="Open Train" variant="ghost" onPress={() => router.push('/train')} style={{ marginTop: space.md }} />
          </>
        )}
      </Card>

      <SectionLabel>This week</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {DOW.map((d, i) => {
            const key = addDays(monday, i);
            const trained = s.week.some((w) => w.local_date === key);
            const ate = s.logged.has(key);
            const isToday = key === today;
            return (
              <View key={key} style={{ alignItems: 'center', width: 36 }}>
                <Text style={[type.small, isToday && { color: colors.ink, fontWeight: '800' }]}>{d}</Text>
                <View style={{ width: 30, height: 30, borderRadius: 15, marginTop: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: trained ? colors.amber : 'transparent', borderWidth: isToday ? 2 : 1, borderColor: isToday ? colors.ink : colors.line }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{fromKey(key).getDate()}</Text>
                </View>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 4, backgroundColor: ate ? colors.steel : 'transparent' }} />
              </View>
            );
          })}
        </View>
        <Text style={[type.small, { marginTop: space.sm }]}>Amber = trained · dot = food logged</Text>
        <View style={{ flexDirection: 'row', marginTop: space.md, gap: space.md }}>
          <Mini value={s.weightAvg != null ? `${s.weightAvg} kg` : '—'} label={s.weightRate != null ? `${s.weightRate > 0 ? '+' : ''}${s.weightRate} kg / week` : 'weight trend'} onPress={() => router.push('/profile')} />
          <Mini value={`${done} of ${s.planned}`} label="workouts" onPress={() => router.push('/history')} />
        </View>
      </Card>

      {s.backupDue && (
        <Pressable onPress={() => router.push('/settings')} style={{ backgroundColor: colors.cream, borderRadius: radius.md, padding: space.md, marginTop: space.sm }}>
          <Text style={[type.body, { fontWeight: '700' }]}>Back up your log</Text>
          <Text style={type.small}>Everything lives only on this phone. Export a backup to Files or Drive ›</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Mini({ value, label, onPress }: { value: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </Pressable>
  );
}
