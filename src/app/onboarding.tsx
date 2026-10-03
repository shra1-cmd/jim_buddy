import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../components/ui';
import { getProfile, saveProfile, saveWeight } from '../db/queries';
import { todayKey } from '../lib/dates';
import { ACTIVITY_LEVELS, GOALS, computeTargets, type Goal, type Sex } from '../lib/targets';
import { colors, space, type } from '../theme';

export default function Onboarding() {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState(1.2);
  const [goal, setGoal] = useState<Goal>('recomp');
  const [eatBack, setEatBack] = useState(50);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    getProfile(db).then((p) => {
      if (!p) return;
      setEditing(true);
      setName(p.name);
      setSex(p.sex);
      setAge(String(p.age));
      setHeight(String(p.heightCm));
      setWeight(String(p.weightKg));
      setActivity(p.activity);
      setGoal(p.goal);
      setEatBack(p.eatBackPct);
    });
  }, [db]);

  const num = (s: string) => Number(s.replace(',', '.'));
  const valid = num(age) >= 14 && num(age) <= 90 && num(height) >= 120 && num(height) <= 230 && num(weight) >= 30 && num(weight) <= 250;
  const targets = useMemo(
    () => (valid ? computeTargets({ sex, age: num(age), heightCm: num(height), weightKg: num(weight), activity, goal }) : null),
    [valid, sex, age, height, weight, activity, goal],
  );

  const save = async () => {
    if (!targets) return;
    const weightKg = num(weight);
    await saveProfile(db, {
      name: name.trim(), sex, age: num(age), heightCm: num(height), weightKg, activity, goal, eatBackPct: eatBack, ...targets,
    });
    if (!editing) await saveWeight(db, todayKey(), weightKg);
    if (editing && router.canGoBack()) router.back();
    else router.replace('/journal');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {!editing && (
          <Text style={[type.body, { marginBottom: space.lg, color: colors.inkSoft }]}>
            A few numbers so JimBuddy can set your calorie and protein targets. Everything stays on this phone.
          </Text>
        )}

        <SectionLabel>About you</SectionLabel>
        <TextInput placeholder="Name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={[ui.input, { marginBottom: space.md }]} />
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
          <Chip label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
          <NumberField label="Age" value={age} onChange={setAge} />
          <NumberField label="Height (cm)" value={height} onChange={setHeight} />
          <NumberField label="Weight (kg)" value={weight} onChange={setWeight} />
        </View>

        <SectionLabel>Daily life, not counting workouts</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
          {ACTIVITY_LEVELS.map((a) => (
            <Chip key={a.value} label={a.label} selected={activity === a.value} onPress={() => setActivity(a.value)} />
          ))}
        </View>
        <Text style={[type.small, { marginBottom: space.lg }]}>Workouts are added separately, so the gym isn’t counted twice.</Text>

        <SectionLabel>Goal</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
          {GOALS.map((g) => (
            <Chip key={g.value} label={g.label} selected={goal === g.value} onPress={() => setGoal(g.value)} />
          ))}
        </View>

        <SectionLabel>Add back exercise calories</SectionLabel>
        <View style={{ flexDirection: 'row', marginBottom: space.lg }}>
          {[0, 50, 100].map((v) => (
            <Chip key={v} label={`${v}%`} selected={eatBack === v} onPress={() => setEatBack(v)} />
          ))}
        </View>

        <Card style={{ backgroundColor: colors.ink }}>
          {targets ? (
            <>
              <Text style={{ color: colors.amber, fontWeight: '700', marginBottom: 4 }}>YOUR DAILY TARGETS</Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{targets.kcal} kcal</Text>
              <Text style={{ color: '#fff', marginTop: 4 }}>
                {targets.proteinG} g protein · {targets.carbsG} g carbs · {targets.fatG} g fat · {targets.fiberG} g fiber
              </Text>
            </>
          ) : (
            <Text style={{ color: '#fff' }}>Enter age, height and weight to see your targets.</Text>
          )}
        </Card>
        <Button title={editing ? 'Save targets' : 'Start logging'} onPress={save} disabled={!targets} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={ui.input} />
    </View>
  );
}
