import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { MiniLine } from '../components/MiniLine';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../components/ui';
import { MEASURES, measurementEntries, saveMeasurements, type MeasureKey, type Measurement } from '../db/body';
import { fromKey, todayKey } from '../lib/dates';
import { colors, space, type } from '../theme';

export default function Measurements() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<Measurement[]>([]);
  const [draft, setDraft] = useState<Partial<Record<MeasureKey, string>>>({});
  const [focus, setFocus] = useState<MeasureKey>('waist_cm');

  const load = useCallback(async () => setRows(await measurementEntries(db, 120)), [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = useMemo(
    () => rows.filter((r) => r[focus] != null).map((r) => ({ date: r.local_date, value: r[focus] as number })).reverse(),
    [rows, focus],
  );
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;

  const save = async () => {
    const parsed: Partial<Record<MeasureKey, number>> = {};
    for (const m of MEASURES) {
      const v = Number((draft[m.key] ?? '').replace(',', '.'));
      if (draft[m.key]?.trim()) {
        if (!(v >= 15 && v <= 250)) return Alert.alert('Check the numbers', `${m.label} should be in cm, e.g. 84.5`);
        parsed[m.key] = v;
      }
    }
    if (!Object.keys(parsed).length) return;
    await saveMeasurements(db, todayKey(), parsed);
    setDraft({});
    load();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Trend</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {MEASURES.map((m) => <Chip key={m.key} label={m.label} selected={focus === m.key} onPress={() => setFocus(m.key)} />)}
        </View>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>
            {last != null ? `${last} cm` : '—'}
            {first != null && last != null && series.length > 1 ? (
              <Text style={type.small}>{`   ${last - first > 0 ? '+' : ''}${(last - first).toFixed(1)} cm since ${fromKey(series[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}</Text>
            ) : null}
          </Text>
          <MiniLine points={series} height={100} />
          {focus === 'waist_cm' && <Text style={type.small}>Waist down while weight holds steady usually means fat lost and muscle gained.</Text>}
        </Card>

        <SectionLabel>Log today</SectionLabel>
        <Card>
          {MEASURES.map((m) => (
            <View key={m.key} style={{ marginBottom: space.md }}>
              <Text style={[type.label, { marginBottom: 4 }]}>{m.label.toUpperCase()} (CM)</Text>
              <TextInput
                value={draft[m.key] ?? ''}
                onChangeText={(t) => setDraft({ ...draft, [m.key]: t })}
                keyboardType="decimal-pad"
                placeholder={m.hint}
                placeholderTextColor={colors.muted}
                style={ui.input}
                accessibilityLabel={`${m.label} in centimetres`}
              />
            </View>
          ))}
          <Button title="Save" onPress={save} />
          <Text style={[type.small, { marginTop: space.sm }]}>Measure every 2 weeks, same time of day, same tape. Leave blank what you skip.</Text>
        </Card>

        <SectionLabel>History</SectionLabel>
        <Card>
          {rows.length === 0 && <Text style={type.small}>Nothing yet.</Text>}
          {rows.slice(0, 15).map((r) => (
            <View key={r.local_date} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={type.body}>{fromKey(r.local_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              <Text style={type.small}>
                {MEASURES.filter((m) => r[m.key] != null).map((m) => `${m.label} ${r[m.key]}`).join(' · ')}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
