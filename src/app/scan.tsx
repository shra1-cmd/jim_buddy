import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { Mascot } from '../components/Illustrations';
import { Button, Card, Chip, IconBadge, SectionLabel, styles as ui } from '../components/ui';
import { SLOT_LABEL, addEstimate, type Slot } from '../db/queries';
import { MEAL_COLUMNS, MEAL_EXAMPLE, mealPrompt, readMealReply, rowErrorText, scaleItem, type EstimatedItem, type RowError } from '../lib/chatgpt';
import { todayKey } from '../lib/dates';
import { sum } from '../lib/nutrition';
import { clay, colors, radius, space, tiles, type } from '../theme';

type Place = 'Home' | 'Mess' | 'Restaurant';
type Line = EstimatedItem & { key: string; base: EstimatedItem };

const toLines = (items: EstimatedItem[]): Line[] => items.map((it, i) => ({ ...it, key: `${i}`, base: it }));

function alertSkipped(read: number, errors: RowError[]) {
  if (!errors.length) return;
  Alert.alert(`Read ${read} item${read > 1 ? 's' : ''}, skipped ${errors.length}`, `${rowErrorText(errors)}\n\nAdd skipped foods later with Quick add.`);
}

/** Scan meal: ChatGPT takes the photo and estimates; its copied table comes back here automatically. */
export default function Scan() {
  const db = useSQLiteContext();
  const p = useLocalSearchParams<{ date?: string; slot?: Slot }>();
  const date = p.date ?? todayKey();
  const slot: Slot = p.slot ?? 'lunch';
  const [hint, setHint] = useState('');
  const [place, setPlace] = useState<Place>('Mess');
  const [asked, setAsked] = useState(false);
  const [reply, setReply] = useState('');
  const [lines, setLines] = useState<Line[] | null>(null);
  const lastClip = useRef('');

  const quickAdd = () => router.replace({ pathname: '/add-food', params: { date, slot, mode: 'quick' } });

  /** Loads whatever rows are usable; says which lines were skipped. Returns false (input untouched) when none were. */
  const load = (txt: string) => {
    const { items, errors } = readMealReply(txt);
    if (!items.length) {
      const how = `Each line needs 7 parts:\n${MEAL_COLUMNS}\ne.g. ${MEAL_EXAMPLE}`;
      Alert.alert(
        'Couldn’t read that',
        errors.length ? `These lines need fixing:\n${rowErrorText(errors)}\n\n${how}` : `No food lines found. Copy the table ChatGPT sent.\n\n${how}`,
        [{ text: 'Add by hand', onPress: quickAdd }, { text: 'OK', style: 'cancel' }],
      );
      return false;
    }
    setReply(txt);
    setLines(toLines(items));
    alertSkipped(items.length, errors);
    return true;
  };

  const ask = async () => {
    const prompt = mealPrompt({ slot: SLOT_LABEL[slot].toLowerCase(), place, hint });
    await Clipboard.setStringAsync(prompt).catch(() => {});
    setAsked(true);
    await Linking.openURL(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`).catch(() =>
      Alert.alert('Prompt copied', 'Open the ChatGPT app and paste it.'),
    );
  };

  // Coming back from ChatGPT with its table copied → load it without another tap.
  useEffect(() => {
    if (!asked || lines) return;
    const check = async () => {
      try {
        if (!(await Clipboard.hasStringAsync())) return;
        const txt = (await Clipboard.getStringAsync()) || '';
        if (!txt || txt === lastClip.current) return;
        lastClip.current = txt;
        const { items, errors } = readMealReply(txt);
        if (items.length) {
          setReply(txt);
          setLines(toLines(items));
          alertSkipped(items.length, errors);
        }
      } catch {
        // "Don't Allow Paste" – the Paste button still works
      }
    };
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [asked, lines]);

  const paste = async (fromClipboard: boolean) => {
    const txt = fromClipboard ? (await Clipboard.getStringAsync().catch(() => '')) || '' : reply;
    if (!txt.trim()) {
      Alert.alert('Nothing to read', fromClipboard ? 'The clipboard is empty. In ChatGPT, tap Copy on the table, then come back.' : 'Paste ChatGPT’s table in the box first.');
      return;
    }
    // A failed clipboard read goes into an empty box so it can be fixed by hand; text the user typed is never replaced.
    if (!load(txt) && fromClipboard && !reply.trim()) setReply(txt);
  };

  const save = async () => {
    if (!lines) return;
    for (const l of lines) if (l.grams > 0) await addEstimate(db, date, slot, l);
    router.back();
  };

  if (lines) {
    const tot = sum(lines);
    const setGrams = (key: string, g: number) => setLines((xs) => xs!.map((x) => (x.key === key ? { ...scaleItem(x.base, g), key: x.key, base: x.base } : x)));
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: 'Check the items' }} />
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.small, { marginBottom: space.md }]}>ChatGPT’s estimate. Change grams if a portion looks off (macros scale with it), or remove a line.</Text>
          {lines.map((e) => (
            <Card key={e.key}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type.h2, { flex: 1 }]} numberOfLines={2}>{e.name}</Text>
                <Pressable onPress={() => setLines((xs) => xs!.filter((x) => x.key !== e.key))} accessibilityLabel={`Remove ${e.name}`} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 20 }}>×</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
                <TextInput
                  value={String(e.grams)}
                  keyboardType="number-pad"
                  onChangeText={(t) => setGrams(e.key, Number(t.replace(/[^0-9]/g, '')) || 0)}
                  style={[ui.input, { width: 96, flexShrink: 0, textAlign: 'center', fontWeight: '700', fontSize: 18 }]}
                  accessibilityLabel={`${e.name} grams`}
                />
                <Text style={type.body}>grams</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
                {[0.5, 0.75, 1, 1.5, 2].map((f) => (
                  <Chip key={f} label={`${f}×`} selected={e.grams === Math.round(e.base.grams * f)} onPress={() => setGrams(e.key, e.base.grams * f)} />
                ))}
              </View>
              <Text style={type.small}>{e.kcal} kcal · P {e.protein} g · C {e.carbs} g · F {e.fat} g · fiber {e.fiber} g</Text>
            </Card>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
          <Button title={`Add to ${SLOT_LABEL[slot]} · ${Math.round(tot.kcal)} kcal · ${Math.round(tot.protein)} g protein`} onPress={save} disabled={!lines.length} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: `Scan ${SLOT_LABEL[slot].toLowerCase()}` }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: tiles.coral.bg, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', boxShadow: clay.tile, marginBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#7A3B2E' }}>Snap it in ChatGPT</Text>
            <Text style={{ color: colors.coralDeep, marginTop: 4 }}>JimBuddy writes the question; ChatGPT does the estimating.</Text>
          </View>
          <Mascot size={92} id="scan" />
        </View>

        <Card>
          {[
            ['Open ChatGPT', 'the question is filled in (and copied)'],
            ['Tap ＋ → Camera', 'fit the whole plate in, then send'],
            ['Tap Copy on the table', 'switch back here: it loads by itself'],
          ].map(([a, b], i) => (
            <View key={a} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < 2 ? space.md : 0 }}>
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: [tiles.green, tiles.yellow, tiles.blue][i].badge, alignItems: 'center', justifyContent: 'center', boxShadow: clay.badge, marginRight: space.md }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{a}</Text>
                <Text style={type.small}>{b}</Text>
              </View>
            </View>
          ))}
        </Card>

        <SectionLabel>Context (optional)</SectionLabel>
        <TextInput value={hint} onChangeText={setHint} placeholder="e.g. 2 rotis, extra dal" style={[ui.input, { marginBottom: space.sm }]} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(['Home', 'Mess', 'Restaurant'] as Place[]).map((pl) => <Chip key={pl} label={pl} selected={place === pl} onPress={() => setPlace(pl)} />)}
        </View>

        <Button title={asked ? 'Open ChatGPT again' : 'Open ChatGPT'} icon="camera" variant={asked ? 'ghost' : 'primary'} onPress={ask} style={{ marginTop: space.md }} />
        <Text style={[type.small, { marginTop: space.sm, textAlign: 'center' }]}>Uses your own ChatGPT account. Nothing is stored online by JimBuddy.</Text>

        {asked && (
          <Card style={{ marginTop: space.lg, borderWidth: 2, borderColor: colors.coral }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
              <IconBadge name="check" color={tiles.green.badge} size={34} />
              <Text style={[type.h2, { marginLeft: space.sm }]}>Bring back the answer</Text>
            </View>
            <Text style={[type.small, { marginBottom: space.md }]}>Copy ChatGPT’s table and switch back. If iPhone asks, choose Allow Paste.</Text>
            <Button title="Paste ChatGPT’s answer" variant="secondary" onPress={() => paste(true)} />
            <TextInput
              value={reply}
              onChangeText={setReply}
              multiline
              placeholder={`…or paste it here:\n${MEAL_EXAMPLE}`}
              style={[ui.input, { height: 110, paddingTop: 12, textAlignVertical: 'top', marginTop: space.sm }]}
            />
            {reply.trim().length > 0 && <Button title="Read answer" variant="ghost" onPress={() => paste(false)} style={{ marginTop: space.sm }} />}
            <Pressable onPress={quickAdd} accessibilityRole="button" style={{ marginTop: space.md, alignSelf: 'center' }}>
              <Text style={{ color: colors.tealDeep, fontWeight: '700' }}>No table? Add it by hand</Text>
            </Pressable>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
