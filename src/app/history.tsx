import { Stack, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../components/AppText';
import { Card, IconBadge } from '../components/ui';
import { sessionsHistory, type Session } from '../db/training';
import { fromKey } from '../lib/dates';
import { space, tiles, type } from '../theme';

export default function History() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<(Session & { sets: number; volume: number })[]>([]);
  useFocusEffect(useCallback(() => { sessionsHistory(db).then(setRows); }, [db]));

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'History' }} />
      {rows.length === 0 && <Text style={type.small}>No finished workouts or games yet.</Text>}
      {rows.map((s) => {
        return (
          <Pressable key={s.id} onPress={() => s.kind !== 'sport' && router.push(`/workout/${s.id}`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconBadge name={s.kind === 'sport' ? 'heart' : 'dumbbell'} color={s.kind === 'sport' ? tiles.coral.badge : tiles.green.badge} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={type.h2}>{s.name}</Text>
                <Text style={type.small}>
                  {fromKey(s.local_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {s.kind === 'sport' ? '' : ` · ${s.sets} sets · ${Math.round(s.volume)} kg`} · ~{Math.round(s.kcal)} kcal
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
