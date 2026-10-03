import { Stack, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { Card } from '../components/ui';
import { sessionsHistory, type Session } from '../db/training';
import { fromKey } from '../lib/dates';
import { space, type } from '../theme';

export default function History() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<(Session & { sets: number; volume: number })[]>([]);
  useFocusEffect(useCallback(() => { sessionsHistory(db).then(setRows); }, [db]));

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'History' }} />
      {rows.length === 0 && <Text style={type.small}>No finished workouts yet.</Text>}
      {rows.map((s) => {
        const mins = s.ended_at ? Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60000) : 0;
        return (
          <Pressable key={s.id} onPress={() => router.push(`/workout/${s.id}`)}>
            <Card>
              <Text style={type.h2}>{s.name}</Text>
              <Text style={type.small}>
                {fromKey(s.local_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {mins} min · {s.sets} sets ·{' '}
                {Math.round(s.volume)} kg · ~{Math.round(s.kcal)} kcal
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
