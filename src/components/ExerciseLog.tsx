import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text, TextInput } from './AppText';
import { Glyph } from './Glyphs';
import { styles as ui } from './ui';
import { MUSCLE_LABEL, exerciseById } from '../data/exercises';
import { deleteLoggedSet, refreshLogKcal, saveLoggedSet, type PlanExercise, type SetRow } from '../db/training';
import { fromDraft, headers, isFilled, setLabel, toDraft, type Draft } from '../lib/setFields';
import { clay, colors, space, tiles, type } from '../theme';

type Row = { id?: number; d: Draft };

/**
 * One plan exercise in today's log: tap to open, type kg and reps, each set saves as you leave the box.
 * Nothing to start or stop.
 */
export function ExerciseLog({
  planId, date, pe, index, saved, last, weightKg, onChanged, onLongPress,
}: {
  planId: string;
  date: string;
  pe: PlanExercise;
  index: number;
  saved: SetRow[];
  last: SetRow[];
  weightKg: number;
  onChanged: () => void;
  onLongPress: () => void;
}) {
  const db = useSQLiteContext();
  const ex = exerciseById(pe.exercise_id);
  const lt = ex?.logType ?? 'weight_reps';
  const [ha, hb] = headers(lt);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => {
    const r: Row[] = saved.map((s) => ({ id: s.id, d: toDraft(s, lt) }));
    while (r.length < Math.max(1, pe.sets)) r.push({ d: { a: '', b: '' } });
    return r;
  });

  const logged = rows.filter((r) => r.id != null);
  const lastDone = last.filter((s) => s.done && !s.is_warmup);
  const summary = logged.length
    ? `${logged.length} set${logged.length > 1 ? 's' : ''} · ${logged.slice(0, 3).map((r) => setLabel(fromDraft(r.d, lt), lt)).join(', ')}${logged.length > 3 ? '…' : ''}`
    : lastDone.length
      ? `Last: ${lastDone.slice(0, 3).map((s) => setLabel(s, lt)).join(', ')}`
      : ex ? ex.primary.map((m) => MUSCLE_LABEL[m] ?? m).join(', ') : '';

  const persist = async (i: number) => {
    const row = rows[i];
    const values = fromDraft(row.d, lt);
    let sessionId: number | null = null;
    if (isFilled(values, lt)) {
      const r = await saveLoggedSet(db, { id: row.id, planId, date, exerciseId: pe.exercise_id, position: pe.position, setNo: i + 1, values });
      sessionId = r.sessionId;
      setRows((xs) => xs.map((x, j) => (j === i ? { ...x, id: r.id } : x)));
    } else if (row.id != null) {
      await deleteLoggedSet(db, row.id);
      setRows((xs) => xs.map((x, j) => (j === i ? { d: x.d } : x)));
    } else return;
    if (sessionId != null) await refreshLogKcal(db, sessionId, weightKg);
    onChanged();
  };

  const removeRow = (i: number) =>
    Alert.alert(`Remove set ${i + 1}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const id = rows[i].id;
          setRows((xs) => xs.filter((_, j) => j !== i));
          if (id != null) { await deleteLoggedSet(db, id); onChanged(); }
        },
      },
    ]);

  const edit = (i: number, patch: Partial<Draft>) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, d: { ...x.d, ...patch } } : x)));

  return (
    <View style={[ui.card, { paddingVertical: space.md }]}>
      <Pressable
        onPress={() => setOpen(!open)}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Long-press to move or remove"
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: logged.length ? tiles.green.badge : tiles.coral.bg, alignItems: 'center', justifyContent: 'center', boxShadow: clay.badge }}>
          <Text style={{ fontWeight: '800', color: logged.length ? '#fff' : colors.coralDeep }}>{logged.length ? '✓' : index + 1}</Text>
        </View>
        <View style={{ flex: 1, marginHorizontal: space.md }}>
          <Text style={[type.h2, { fontSize: 16 }]} numberOfLines={2}>{ex?.name ?? pe.exercise_id}</Text>
          <Text style={type.small} numberOfLines={1}>{summary}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
          <Glyph name="chevron" size={16} color={colors.muted} />
        </View>
      </Pressable>

      {open && (
        <View style={{ marginTop: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line }}>
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            <Text style={[type.label, { width: 40 }]}>SET</Text>
            <Text style={[type.label, { flex: 1, textAlign: 'center' }]}>{ha}</Text>
            {hb ? <Text style={[type.label, { flex: 1, textAlign: 'center' }]}>{hb}</Text> : null}
            <View style={{ width: 22 }} />
          </View>
          {rows.map((r, i) => {
            const hint = lastDone[Math.min(i, lastDone.length - 1)];
            const ph = hint ? toDraft(hint, lt) : { a: '', b: '' };
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Pressable onLongPress={() => removeRow(i)} accessibilityLabel={`Set ${i + 1}, long-press to remove`} style={{ width: 40 }}>
                  <Text style={{ fontWeight: '800', color: colors.ink }}>{i + 1}</Text>
                </Pressable>
                <SetBox value={r.d.a} placeholder={ph.a} onChange={(v) => edit(i, { a: v })} onBlur={() => persist(i)} label={`Set ${i + 1} ${ha.toLowerCase()}`} />
                {hb ? <SetBox value={r.d.b} placeholder={ph.b} onChange={(v) => edit(i, { b: v })} onBlur={() => persist(i)} label={`Set ${i + 1} ${hb.toLowerCase()}`} /> : null}
                <View style={{ width: 22, alignItems: 'flex-end' }}>
                  {r.id != null && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.good }} accessibilityLabel="Saved" />}
                </View>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
            <Pressable onPress={() => setRows((xs) => [...xs, { d: { a: '', b: '' } }])} accessibilityRole="button">
              <Text style={{ color: colors.tealDeep, fontWeight: '700' }}>＋ Add set</Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/exercise/${pe.exercise_id}`)} accessibilityRole="link">
              <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>How to do it ›</Text>
            </Pressable>
          </View>
          <Text style={[type.small, { marginTop: space.sm }]}>Grey numbers are last time. Saves as you type · long-press a set number to remove it.</Text>
        </View>
      )}
    </View>
  );
}

function SetBox({ value, placeholder, onChange, onBlur, label }: { value: string; placeholder: string; onChange: (v: string) => void; onBlur: () => void; label: string }) {
  return (
    <TextInput
      value={value}
      placeholder={placeholder}
      onChangeText={onChange}
      onBlur={onBlur}
      keyboardType="decimal-pad"
      selectTextOnFocus
      accessibilityLabel={label}
      style={[ui.input, { flex: 1, height: 42, marginHorizontal: 4, textAlign: 'center', fontWeight: '700' }]}
    />
  );
}
