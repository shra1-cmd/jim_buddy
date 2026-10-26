import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { MiniLine } from '../components/MiniLine';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../components/ui';
import { MEASURES, measurementEntries, saveMeasurements, type MeasureKey, type Measurement } from '../db/body';
import { fromKey, todayKey } from '../lib/dates';
import { latestMeasures, MEASURE_GROUPS, measureRange, unitOf } from '../lib/measures';
import { colors, space, type } from '../theme';

// The trend chart only offers the measurements people actually track over time.
const TREND: MeasureKey[] = ['waist_cm', 'chest_cm', 'arm_cm', 'thigh_cm', 'hips_cm', 'neck_cm', 'shoulder_cm', 'body_fat_pct'];
const short = (k: MeasureKey) => MEASURES.find((m) => m.key === k)!.short;

export default function Measurements() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<Measurement[]>([]);
  const [draft, setDraft] = useState<Partial<Record<MeasureKey, string>>>({});
  const [focus, setFocus] = useState<MeasureKey>('waist_cm');

  const load = useCallback(async () => setRows(await measurementEntries(db, 120)), [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = useMemo(() => latestMeasures(rows).values, [rows]);
  const series = useMemo(
    () => rows.filter((r) => r[focus] != null).map((r) => ({ date: r.local_date, value: r[focus] as number })).reverse(),
    [rows, focus],
  );
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  const unit = unitOf(focus);

  const save = async () => {
    const parsed: Partial<Record<MeasureKey, number>> = {};
    for (const m of MEASURES) {
      const v = Number((draft[m.key] ?? '').replace(',', '.'));
      if (draft[m.key]?.trim()) {
        const [lo, hi] = measureRange(m.key);
        if (!(v >= lo && v <= hi)) return Alert.alert('Check the numbers', `${m.label} should be ${lo}–${hi} ${unitOf(m.key)}.`);
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
          {TREND.map((k) => <Chip key={k} label={short(k)} selected={focus === k} onPress={() => setFocus(k)} />)}
        </View>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>
            {last != null ? `${last} ${unit}` : '—'}
            {first != null && last != null && series.length > 1 ? (
              <Text style={type.small}>{`   ${last - first > 0 ? '+' : ''}${(last - first).toFixed(1)} ${unit} since ${fromKey(series[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}</Text>
            ) : null}
          </Text>
          <MiniLine points={series} height={100} />
          {focus === 'waist_cm' && <Text style={type.small}>Waist down while weight holds steady usually means fat lost and muscle gained.</Text>}
        </Card>

        <SectionLabel>Log today</SectionLabel>
        <Card>
          {MEASURE_GROUPS.map((g) => (
            <View key={g.key} style={{ marginBottom: space.sm }}>
              <Text style={[type.h2, { fontSize: 15, marginBottom: space.sm }]}>{g.label}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm }}>
                {MEASURES.filter((m) => m.group === g.key).map((m) => (
                  <View key={m.key} style={{ width: '48%', flexGrow: 1, marginBottom: space.md }}>
                    <Text style={[type.label, { marginBottom: 4, fontSize: 11 }]} numberOfLines={1}>{`${m.label.toUpperCase()} (${unitOf(m.key).toUpperCase()})`}</Text>
                    <TextInput
                      value={draft[m.key] ?? ''}
                      onChangeText={(t) => setDraft({ ...draft, [m.key]: t })}
                      keyboardType="decimal-pad"
                      placeholder={latest[m.key] != null ? `last ${latest[m.key]}` : m.hint}
                      placeholderTextColor={colors.muted}
                      style={ui.input}
                      accessibilityLabel={`${m.label} in ${unitOf(m.key) === '%' ? 'percent' : 'centimetres'}`}
                      accessibilityHint={m.hint}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Button title="Save" onPress={save} />
          <Text style={[type.small, { marginTop: space.sm }]}>
            Measure every 2 weeks, same time of day, same tape. Leave blank what you skip; the body profile keeps the last value of each.
            Height comes from your profile, weight from your daily weigh-ins.
          </Text>
        </Card>

        <SectionLabel>History</SectionLabel>
        <Card>
          {rows.length === 0 && <Text style={type.small}>Nothing yet.</Text>}
          {rows.slice(0, 15).map((r) => (
            <View key={r.local_date} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 6 }}>
              <Text style={type.body}>{fromKey(r.local_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              <Text style={[type.small, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                {MEASURES.filter((m) => r[m.key] != null).map((m) => `${m.short} ${r[m.key]}`).join(' · ')}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
