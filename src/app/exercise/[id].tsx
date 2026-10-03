import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BodyMap } from '../../components/BodyMap';
import { Card, SectionLabel } from '../../components/ui';
import { exerciseById } from '../../data/exercises';
import { colors, space, type } from '../../theme';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = exerciseById(id);
  if (!e) {
    return (
      <View style={{ padding: space.lg }}>
        <Text style={type.body}>Exercise not found.</Text>
      </View>
    );
  }

  const levels: Record<string, 1 | 2> = {};
  e.secondary.forEach((m) => (levels[m] = 1));
  e.primary.forEach((m) => (levels[m] = 2));

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: e.name }} />

      <Card style={{ alignItems: 'center', backgroundColor: colors.cream }}>
        <Text style={[type.small, { textAlign: 'center' }]}>
          Looping demo (start ↔ end position) arrives in Phase 2.
        </Text>
      </Card>

      <SectionLabel>Muscles</SectionLabel>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <BodyMap levels={levels} side="front" scale={0.7} />
        <BodyMap levels={levels} side="back" scale={0.7} />
      </Card>
      <Text style={[type.small, { marginTop: -space.sm, marginBottom: space.md }]}>
        Solid amber: primary. Light: secondary.
      </Text>

      <SectionLabel>Defaults</SectionLabel>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Fact label="Reps" value={e.reps} />
        <Fact label="Rest" value={e.restSec ? `${e.restSec} s` : '—'} />
        <Fact label="Equipment" value={e.equipment} />
      </Card>

      <SectionLabel>How to</SectionLabel>
      <Card>
        {e.cues.map((c, i) => (
          <Text key={c} style={[type.body, { paddingVertical: 4 }]}>{i + 1}. {c}</Text>
        ))}
      </Card>

      <SectionLabel>Common mistakes</SectionLabel>
      <Card>
        {e.mistakes.map((m) => (
          <Text key={m} style={[type.body, { paddingVertical: 4 }]}>✕ {m}</Text>
        ))}
      </Card>

      {e.alternatives.length > 0 && (
        <>
          <SectionLabel>Swap (same muscles)</SectionLabel>
          <Card>
            {e.alternatives.map((a) => {
              const alt = exerciseById(a);
              return alt ? (
                <Pressable key={a} onPress={() => router.replace(`/exercise/${a}`)} style={{ paddingVertical: 8 }}>
                  <Text style={[type.body, { color: colors.steel, fontWeight: '600' }]}>{alt.name}  ›</Text>
                </Pressable>
              ) : null;
            })}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={type.label}>{label.toUpperCase()}</Text>
      <Text style={[type.body, { fontWeight: '700', marginTop: 2 }]}>{value}</Text>
    </View>
  );
}
