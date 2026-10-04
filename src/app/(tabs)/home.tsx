import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import { MacroDonut, WeekBars } from '../../components/Charts';
import { Glyph } from '../../components/Glyphs';
import { BowlBuddy, DumbbellArt, Mascot, Plant, Sparkle } from '../../components/Illustrations';
import { Card, IconBadge, Pill, RoundButton, SectionLabel, StatTile } from '../../components/ui';
import { syncPhoneSteps } from '../../db/activity';
import { loggedDays } from '../../db/body';
import { menuCount, menuSlotCounts } from '../../db/menu';
import {
  SLOT_LABEL, SLOTS, SLOT_SHARE, dayTotals, getProfile, mealItemsForDay, slotForNow, type MealItem, type Profile, type Slot,
} from '../../db/queries';
import { getSetting } from '../../db/settings';
import { activeSession, burnBreakdown, listPlans, sessionsSince, startSession, type Burn, type Plan, type Session } from '../../db/training';
import { currentStreak, weekStartKey } from '../../lib/balance';
import { addDays, fromKey, todayKey } from '../../lib/dates';
import { dowOfKey } from '../../lib/menu';
import { sum } from '../../lib/nutrition';
import { caloriesLeft } from '../../lib/targets';
import { clay, colors, radius, space, tiles, type } from '../../theme';

const SLOT_STYLE = {
  breakfast: { icon: 'sun', tint: tiles.yellow },
  lunch: { icon: 'bowl', tint: tiles.green },
  snacks: { icon: 'cup', tint: tiles.coral },
  dinner: { icon: 'moon', tint: tiles.blue },
} as const;

interface State {
  profile: Profile | null;
  items: MealItem[];
  burn: Burn;
  week: Session[];
  todayPlans: (Plan & { count: number })[];
  active: Session | null;
  weekKcal: number[];
  weekProtein: number[];
  streak: number;
  menuTotal: number;
  menuSlots: Partial<Record<Slot, number>>;
  backupDue: boolean;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<State | null>(null);
  const [metric, setMetric] = useState<'kcal' | 'protein'>('kcal');
  const today = todayKey();
  const monday = weekStartKey(fromKey(today));
  const dow = dowOfKey(today);

  const load = useCallback(async () => {
    await syncPhoneSteps(db, false);
    const [profile, items, burn, week, plans, active, totals, logged, mt, ms, lastBackup, firstMeal] = await Promise.all([
      getProfile(db), mealItemsForDay(db, today), burnBreakdown(db, today), sessionsSince(db, monday), listPlans(db), activeSession(db),
      dayTotals(db, monday, addDays(monday, 6)), loggedDays(db, addDays(today, -120), today), menuCount(db), menuSlotCounts(db, dow),
      getSetting(db, 'last_backup_at'), db.getFirstAsync<{ d: string | null }>('SELECT MIN(local_date) AS d FROM meal_item'),
    ]);
    const byDay = (k: 'kcal' | 'protein') => Array.from({ length: 7 }, (_, i) => totals.find((t) => t.local_date === addDays(monday, i))?.[k] ?? 0);
    const weekAgo = addDays(today, -7);
    setS({
      profile, items, burn, week, active,
      todayPlans: plans.filter((p) => p.count > 0 && p.days.split(',').includes(String(dow))),
      weekKcal: byDay('kcal'),
      weekProtein: byDay('protein'),
      streak: currentStreak(logged, today),
      menuTotal: mt,
      menuSlots: ms,
      backupDue: lastBackup ? lastBackup.slice(0, 10) < weekAgo : !!firstMeal?.d && firstMeal.d <= weekAgo,
    });
  }, [db, today, monday, dow]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!s) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const { profile } = s;
  const totals = sum(s.items);
  const target = profile?.kcal ?? 2000;
  const proteinTarget = profile?.proteinG ?? 120;
  const eatBack = Math.round((s.burn.total * (profile?.eatBackPct ?? 50)) / 100);
  const kcalLeft = profile ? caloriesLeft(profile.kcal, totals.kcal, s.burn.total, profile.eatBackPct) : 0;
  const proteinLeft = Math.max(0, Math.round(proteinTarget - totals.protein));
  const trainedToday = s.week.some((w) => w.local_date === today);
  const plan = s.todayPlans[0];

  const hour = new Date().getHours();
  const greet = hour >= 5 && hour < 12 ? ['Good Morning', '☀️'] : hour >= 12 && hour < 17 ? ['Good Afternoon', '🌤️'] : ['Good Evening', '🌙'];
  const name = profile?.name || 'there';

  const openSlot = (slot: Slot) =>
    router.push({ pathname: '/add-food', params: { slot, ...((s.menuSlots[slot] ?? 0) > 0 ? { mode: 'menu' } : {}) } });

  const hero = s.active
    ? { sub: 'Your workout is in progress. Keep going!', cta: 'Resume workout', go: () => router.push(`/workout/${s.active!.id}`) }
    : plan && !trainedToday
      ? { sub: `Today: ${plan.name} · ${plan.count} exercises. Let’s lift!`, cta: 'Start workout', go: async () => router.push(`/workout/${await startSession(db, plan.id)}`) }
      : trainedToday
        ? { sub: 'Workout done. Time to refuel well!', cta: 'Log a meal', go: () => openSlot(slotForNow()) }
        : { sub: 'Let’s fuel up and move today!', cta: 'Log a meal', go: () => openSlot(slotForNow()) };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.sm, paddingBottom: 24 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FDE2D2', alignItems: 'center', justifyContent: 'center', boxShadow: clay.soft, overflow: 'hidden', borderWidth: 3, borderColor: colors.cardHi }}>
          <Mascot face size={50} id="avatar" />
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={{ fontSize: 22, fontWeight: '800' }} numberOfLines={1}>Hi, {name}! 👋</Text>
          <Text style={type.small}>{fromKey(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <RoundButton icon="gear" label="Settings" color={colors.tealDeep} size={44} onPress={() => router.push('/settings')} />
      </View>

      {/* hero */}
      <View style={{ backgroundColor: '#FDCBB5', borderRadius: radius.lg, boxShadow: clay.tile, marginBottom: space.md, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingTop: space.md, paddingRight: space.md }}>
          <View style={{ marginLeft: -4, marginBottom: -2 }}>
            <Mascot size={126} id="hero" />
          </View>
          <View style={{ flex: 1, paddingBottom: space.lg, paddingLeft: 4 }}>
            <View style={{ position: 'absolute', right: -12, top: -8 }}>
              <Plant size={40} id="heroplant" />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#7A3B2E', paddingRight: 28 }}>{greet[0]}, {name}! {greet[1]}</Text>
            <Text style={{ fontSize: 13, color: '#B65A40', marginTop: 4 }}>{hero.sub}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={hero.go}
              style={({ pressed }) => ({ marginTop: space.md, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.coral, borderRadius: radius.pill, paddingHorizontal: 16, height: 40, boxShadow: clay.button, transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <Glyph name="play" size={14} />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>{hero.cta}</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ height: 10, backgroundColor: '#F7B89C' }} />
      </View>

      {/* stat tiles */}
      <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.md }}>
        <StatTile icon="fork" tint={tiles.green} label="Calories left" value={kcalLeft.toLocaleString('en-IN')} note={eatBack ? `+${eatBack} from activity` : `of ${target.toLocaleString('en-IN')} kcal`} noteGood={eatBack > 0} onPress={() => router.push('/journal')} />
        <StatTile icon="egg" tint={tiles.coral} label="Protein" value={`${Math.round(totals.protein)} g`} note={proteinLeft ? `${proteinLeft} g to go` : 'Target hit ✓'} noteGood={!proteinLeft} onPress={() => router.push('/journal')} accent={colors.gold} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.lg }}>
        <StatTile icon="bolt" tint={tiles.yellow} label="Burned" value={`${s.burn.total}`} note={s.burn.stepCount ? `${s.burn.stepCount.toLocaleString('en-IN')} steps` : 'kcal today'} noteGood={s.burn.stepCount > 0} onPress={() => router.push('/train')} />
        <StatTile icon="flame" tint={tiles.blue} label="Current streak" value={`${s.streak}`} note="days in a row" onPress={() => router.push('/journal')} accent="#FCE3B4" />
      </View>

      {/* this week */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>{metric === 'kcal' ? 'Calories this week' : 'Protein this week'}</Text>
          <Pill label={metric === 'kcal' ? 'kcal ▾' : 'protein ▾'} onPress={() => setMetric(metric === 'kcal' ? 'protein' : 'kcal')} />
        </View>
        <WeekBars
          values={metric === 'kcal' ? s.weekKcal : s.weekProtein}
          goal={metric === 'kcal' ? target : proteinTarget}
          unit={metric === 'kcal' ? 'kcal' : 'g'}
          todayIndex={dow - 1}
        />
        <Text style={[type.small, { marginTop: 4 }]}>Dashed line = your daily goal. Tap a bar for its value.</Text>
      </Card>

      {/* macros + workout */}
      <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.md }}>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: space.sm }}>Macros today</Text>
          <MacroDonut protein={totals.protein} carbs={totals.carbs} fat={totals.fat} kcal={totals.kcal} />
        </Card>
        <Pressable onPress={() => router.push('/train')} style={{ flex: 1, borderRadius: radius.lg, overflow: 'hidden', boxShadow: clay.tile }}>
          <LinearGradient colors={['#A8DCC9', '#4E9C84']} style={{ flex: 1, padding: space.lg, justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F4F40' }}>Today’s workout</Text>
            <View style={{ alignItems: 'center', marginVertical: space.sm }}>
              <DumbbellArt width={128} id="homedb" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }} numberOfLines={2}>
                  {s.active ? s.active.name : trainedToday ? 'Done ✓' : plan ? plan.name : 'Rest day'}
                </Text>
                <Text style={{ fontSize: 12, color: '#E6F5EF' }}>
                  {s.active ? 'In progress' : trainedToday ? `${s.burn.workouts + s.burn.sports} kcal burned` : plan ? `${plan.count} exercises` : 'Walk, stretch, sleep'}
                </Text>
              </View>
              <RoundButton icon="play" label="Open workout" color={colors.tealDeep} size={38} onPress={() => (s.active || (plan && !trainedToday) ? hero.go() : router.push('/train'))} />
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      {/* today's meals */}
      <Card>
        <SectionLabel action="See All" onAction={() => router.push('/journal')}>Today’s meals</SectionLabel>
        {SLOTS.map((slot, i) => {
          const list = s.items.filter((it) => it.slot === slot);
          const kcal = Math.round(list.reduce((a, it) => a + it.kcal, 0));
          const st = SLOT_STYLE[slot];
          const names = list.map((it) => it.name.split(/[,(/]/)[0].trim());
          return (
            <View key={slot} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: st.tint.bg, alignItems: 'center', justifyContent: 'center', boxShadow: clay.soft }}>
                <IconBadge name={st.icon} color={st.tint.badge} size={32} />
              </View>
              <View style={{ flex: 1, marginHorizontal: space.md }}>
                <Text style={{ fontSize: 15, fontWeight: '700' }}>{SLOT_LABEL[slot]}</Text>
                <Text style={type.small} numberOfLines={1}>
                  {list.length ? `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''} · ${kcal} kcal` : `Nothing yet · ${Math.round(target * SLOT_SHARE[slot])} kcal budget`}
                </Text>
              </View>
              <RoundButton icon="plus" label={`Add to ${SLOT_LABEL[slot]}`} color={colors.coral} onPress={() => openSlot(slot)} />
            </View>
          );
        })}
      </Card>

      {/* banner */}
      <View style={{ backgroundColor: '#A9CDBB', borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', boxShadow: clay.tile, marginBottom: space.md }}>
        <BowlBuddy size={64} id="banner" />
        <View style={{ flex: 1, marginHorizontal: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{s.menuTotal ? 'Today’s menu is ready ' : 'Plan your mess week '}</Text>
            <Sparkle size={13} color="#FFE7A8" />
          </View>
          <Text style={{ color: '#F3FBF7', fontSize: 12 }}>
            {s.menuTotal ? `${Object.values(s.menuSlots).reduce((a, b) => a + (b ?? 0), 0)} dishes today · pick Low / Medium / High` : 'Upload your menu once, pick portions daily'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/menu')}
          style={({ pressed }) => ({ backgroundColor: colors.teal, borderRadius: radius.pill, paddingHorizontal: 14, height: 36, justifyContent: 'center', boxShadow: clay.buttonTeal, transform: [{ scale: pressed ? 0.96 : 1 }] })}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{s.menuTotal ? 'Open' : 'Upload'}</Text>
        </Pressable>
      </View>

      {s.backupDue && (
        <Pressable onPress={() => router.push('/settings')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, boxShadow: clay.soft }}>
          <IconBadge name="gear" color={tiles.blue.badge} size={36} accent={tiles.blue.badge} />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={{ fontWeight: '700' }}>Back up your log</Text>
            <Text style={type.small}>Everything lives only on this phone. Export a copy ›</Text>
          </View>
        </Pressable>
      )}
    </ScrollView>
  );
}
