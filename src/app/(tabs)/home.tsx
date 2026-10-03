import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Bar, Button, Card, SectionLabel } from '../../components/ui';
import { getProfile, mealItemsForDay, type Profile } from '../../db/queries';
import { todayKey } from '../../lib/dates';
import { sum, ZERO, type Nutrients } from '../../lib/nutrition';
import { colors, space, type } from '../../theme';

// Minimal Home for now: today's fuel at a glance. The full Balance screen comes in v2.
export default function HomeScreen() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totals, setTotals] = useState<Nutrients>(ZERO);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getProfile(db), mealItemsForDay(db, todayKey())]).then(([p, items]) => {
        setProfile(p);
        setTotals(sum(items));
      });
    }, [db]),
  );

  const kcalLeft = (profile?.kcal ?? 0) - totals.kcal;
  const proteinLeft = Math.max(0, Math.round((profile?.proteinG ?? 0) - totals.protein));

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <Text style={[type.h1, { marginBottom: space.lg }]}>{profile?.name ? `Hi ${profile.name}` : 'Today'}</Text>
      <SectionLabel>Fuel</SectionLabel>
      <Card>
        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.ink }}>{Math.abs(kcalLeft)} kcal</Text>
        <Text style={[type.small, { marginBottom: space.md }]}>{kcalLeft >= 0 ? 'left today' : 'over today'}</Text>
        <Bar big label="Protein" value={totals.protein} target={profile?.proteinG ?? 0} />
        <Text style={type.small}>{proteinLeft > 0 ? `${proteinLeft} g protein to go.` : 'Protein target hit. Nice.'}</Text>
      </Card>
      <SectionLabel>Training</SectionLabel>
      <Card>
        <Text style={type.body}>Plans and live workout logging arrive in Phase 2. Browse the exercise library meanwhile.</Text>
        <View style={{ height: space.md }} />
        <Button title="Open Train" variant="secondary" onPress={() => router.push('/train')} />
      </Card>
    </ScrollView>
  );
}
