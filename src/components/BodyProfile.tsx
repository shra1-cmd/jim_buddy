import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { fromKey } from '../lib/dates';
import { bmiBand, MEASURE_GROUPS, MEASURES, unitOf, type BodyProfile, type MeasureKey } from '../lib/measures';
import type { Sex } from '../lib/targets';
import { clay, colors, radius, space, type } from '../theme';
import { Text } from './AppText';
import { BodyMap } from './BodyMap';
import { Button } from './ui';

// Callouts beside the figure. It faces you, so the person's right side is on the left of the screen.
const LEFT: MeasureKey[] = ['neck_cm', 'chest_cm', 'arm_cm', 'forearm_r_cm', 'thigh_cm', 'calf_r_cm'];
const RIGHT: MeasureKey[] = ['shoulder_cm', 'biceps_l_cm', 'waist_cm', 'hips_cm', 'thigh_l_cm', 'calf_l_cm'];

// Muscles tinted on the figure once their measurement is logged.
const SLUGS: Partial<Record<MeasureKey, string[]>> = {
  neck_cm: ['neck'], chest_cm: ['chest'], shoulder_cm: ['deltoids'], shoulder_width_cm: ['deltoids'],
  waist_cm: ['abs', 'obliques'], natural_waist_cm: ['abs', 'obliques'], abdomen_cm: ['abs', 'obliques'],
  arm_cm: ['biceps'], biceps_l_cm: ['biceps'], upper_arm_l_cm: ['biceps'], upper_arm_r_cm: ['biceps'],
  forearm_l_cm: ['forearm'], forearm_r_cm: ['forearm'], thigh_cm: ['quadriceps', 'adductors'], thigh_l_cm: ['quadriceps', 'adductors'],
  calf_l_cm: ['calves', 'tibialis'], calf_r_cm: ['calves', 'tibialis'],
};

const SIDE_COL = 84; // width of each callout column
const meta = (k: MeasureKey) => MEASURES.find((m) => m.key === k)!;
const fmt = (v: number | null | undefined, unit = '') => (v != null ? `${v}${unit}` : '—');

/** Front-only figure with the latest tape measurements around it, plus BMI, body fat and ratios. */
export function BodyProfileCard({ p, sex, avgWeight, photoCount }: { p: BodyProfile; sex: Sex; avgWeight: number | null; photoCount: number }) {
  const { width } = useWindowDimensions();
  const [all, setAll] = useState(false);
  // screen − page padding − card padding − two callout columns, against the figure's 200 px base width
  const scale = Math.max(0.5, Math.min(0.8, (width - 2 * space.lg - 2 * space.lg - 2 * SIDE_COL) / 200));
  const levels: Record<string, 2> = {};
  (Object.keys(p.values) as MeasureKey[]).forEach((k) => SLUGS[k]?.forEach((s) => { levels[s] = 2; }));
  const empty = p.updated == null;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Stat label="Height" value={fmt(p.heightCm, ' cm')} />
        <Stat label="Weight" value={fmt(p.weightKg, ' kg')} />
        <Stat label="BMI" value={fmt(p.bmi)} note={p.bmi != null ? bmiBand(p.bmi) : undefined} />
        <Stat label="Body fat" value={p.bodyFat ? `${p.bodyFat.pct}%` : '—'} note={p.bodyFat?.estimated ? 'tape est.' : undefined} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <Column keys={LEFT} values={p.values} align="right" />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <BodyMap side="front" gender={sex} scale={scale} levels={levels} fills={[colors.mint, colors.steelLight]} />
        </View>
        <Column keys={RIGHT} values={p.values} align="left" />
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Stat label="Waist / height" value={fmt(p.waistToHeight)} note={p.waistToHeight != null ? (p.waistToHeight < 0.5 ? 'under 0.5 ✓' : 'aim < 0.5') : undefined} />
        <Stat label="Chest / waist" value={fmt(p.chestToWaist)} />
        <Stat label="Shoulder / waist" value={fmt(p.shoulderToWaist)} note={p.shoulderToWaist != null ? 'V-taper ~1.6' : undefined} />
      </View>

      {empty ? (
        <Button title="Add measurements" variant="secondary" onPress={() => router.push('/measurements')} style={{ marginTop: space.md }} />
      ) : (
        <Pressable onPress={() => setAll(!all)} accessibilityRole="button" accessibilityState={{ expanded: all }} style={{ marginTop: space.md, paddingVertical: 4 }}>
          <Text style={{ color: colors.tealDeep, fontWeight: '700' }}>{all ? 'Hide all measurements ▴' : 'All measurements ▾'}</Text>
        </Pressable>
      )}

      {all && !empty && (
        <View style={{ marginTop: space.sm }}>
          {MEASURE_GROUPS.map((g) => (
            <View key={g.key} style={{ marginBottom: space.sm }}>
              <Text style={[type.label, { marginBottom: 2 }]}>{g.label.toUpperCase()}</Text>
              {g.key === 'body' && <Line label="Height" value={fmt(p.heightCm, ' cm')} />}
              {g.key === 'body' && <Line label="Weight" value={fmt(p.weightKg, ' kg')} />}
              {g.key === 'body' && <Line label="BMI" value={fmt(p.bmi)} />}
              {MEASURES.filter((m) => m.group === g.key).map((m) => (
                <Line key={m.key} label={m.label} value={fmt(p.values[m.key], ` ${unitOf(m.key)}`)} />
              ))}
              {g.key === 'comp' && (
                <>
                  {p.bodyFat?.estimated && <Line label="Body fat (tape estimate)" value={`${p.bodyFat.pct} %`} />}
                  <Line label="Waist-to-height ratio" value={fmt(p.waistToHeight)} />
                  <Line label="Chest-to-waist ratio" value={fmt(p.chestToWaist)} />
                  <Line label="Shoulder-to-waist ratio" value={fmt(p.shoulderToWaist)} />
                  <Line label="Average body weight (7 days)" value={fmt(avgWeight, ' kg')} />
                  <Line label="Progress photos" value={photoCount ? `${photoCount} ›` : 'Add ›'} onPress={() => router.push('/photos')} />
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm }}>
        <Text style={[type.small, { fontSize: 11 }]}>
          {empty ? 'No measurements yet' : `Updated ${fromKey(p.updated!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </Text>
        {!empty && (
          <Pressable onPress={() => router.push('/measurements')} accessibilityRole="link" hitSlop={8}>
            <Text style={{ color: colors.tealDeep, fontWeight: '700', fontSize: 12 }}>Update ›</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Column({ keys, values, align }: { keys: MeasureKey[]; values: BodyProfile['values']; align: 'left' | 'right' }) {
  return (
    <View style={{ width: SIDE_COL, justifyContent: 'space-around', alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {keys.map((k) => (
        <View key={k} style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }} accessible accessibilityLabel={`${meta(k).label} ${values[k] ?? 'not logged'} centimetres`}>
          <Text style={[type.label, { fontSize: 10 }]} numberOfLines={1}>{meta(k).short.toUpperCase()}</Text>
          <View style={{ backgroundColor: values[k] != null ? colors.cardHi : 'transparent', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, boxShadow: values[k] != null ? clay.soft : undefined }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: values[k] != null ? colors.ink : colors.muted }}>
              {fmt(values[k])}
              {values[k] != null ? <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '600' }}> cm</Text> : null}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cardHi, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', boxShadow: clay.well }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[type.label, { fontSize: 10, textAlign: 'center' }]} numberOfLines={1}>{label}</Text>
      {note ? <Text style={{ fontSize: 10, color: colors.tealDeep, fontWeight: '600' }} numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}

function Line({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={type.small}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: onPress ? colors.tealDeep : colors.ink }}>{value}</Text>
    </Pressable>
  );
}
