import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../components/ui';
import {
  SLOT_LABEL, addAiItem, addEstimate, addFoodToMeal, candidatesFor, createCustomFood, deleteQueuedScan, getFood, getQueuedScan, queueScan,
  type Food, type Slot,
} from '../db/queries';
import { getSetting } from '../db/settings';
import { chatGptPrompt, parseChatGptReply, scaleItem, type EstimatedItem } from '../lib/activity';
import { ProxyError, describePlate, scanLabel, scanPlate, type LabelResult, type PlateResult } from '../lib/ai';
import { todayKey } from '../lib/dates';
import { OIL_GRAMS } from '../lib/grounding';
import { PermissionError, deleteImage, keepImage, pickPhoto, readBase64, type Picked } from '../lib/images';
import { forGrams, sum } from '../lib/nutrition';
import { colors, radius, space, type } from '../theme';

type Mode = 'photo' | 'text' | 'label';
type Place = 'Home' | 'Mess' | 'Restaurant';
type Oil = 'low' | 'normal' | 'high';
type Line = { key: string; name: string; household: string | null; confidence: number; grams: number; candidates: Food[]; chosen: Food | null };

export default function Scan() {
  const db = useSQLiteContext();
  const p = useLocalSearchParams<{ date?: string; slot?: Slot; mode?: Mode; queueId?: string }>();
  const date = p.date ?? todayKey();
  const slot: Slot = p.slot ?? 'lunch';
  const [mode, setMode] = useState<Mode>(p.mode ?? 'photo');
  const [photo, setPhoto] = useState<Picked | null>(null);
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const [place, setPlace] = useState<Place>('Mess');
  const [oil, setOil] = useState<Oil>('normal');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [label, setLabel] = useState<LabelResult | null>(null);
  const [oilFood, setOilFood] = useState<Food | null>(null);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [asked, setAsked] = useState(false); // prompt sent to ChatGPT, waiting for the answer
  const [reply, setReply] = useState('');
  const [estimates, setEstimates] = useState<(EstimatedItem & { key: string; base: EstimatedItem })[] | null>(null);
  const queueId = p.queueId ? Number(p.queueId) : null;

  useEffect(() => {
    getFood(db, 'basic_oil').then(setOilFood);
    getSetting(db, 'proxy_url').then((u) => setProxyUrl(u?.trim() || null));
  }, [db]);

  // Opened from the pending-scan card: restore the queued input and analyse it now.
  useEffect(() => {
    if (!queueId) return;
    (async () => {
      const q = await getQueuedScan(db, queueId);
      if (!q) return;
      setMode(q.kind);
      setHint(q.hint ?? '');
      if (q.place) setPlace(q.place as Place);
      if (q.oil) setOil(q.oil as Oil);
      if (q.text) setText(q.text);
      if (q.image_uri) setPhoto({ uri: q.image_uri, base64: await readBase64(q.image_uri) });
    })();
  }, [db, queueId]);

  const choosePhoto = async (src: 'camera' | 'library') => {
    try {
      const ph = await pickPhoto(src);
      if (ph) setPhoto(ph);
    } catch (e) {
      if (e instanceof PermissionError) {
        Alert.alert('Permission needed', e.message, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert('Camera unavailable', `${(e as Error).message ?? e}\nTry Gallery, or Describe it instead.`);
      }
    }
  };

  // ---------- ChatGPT hand-off (default; no API key or server needed) ----------
  const askChatGpt = async () => {
    const prompt = chatGptPrompt(mode, { slot: SLOT_LABEL[slot].toLowerCase(), place: mode === 'photo' ? place : undefined, hint, text });
    try {
      await Clipboard.setStringAsync(prompt);
    } catch {
      // clipboard unavailable (web without permission) – the prompt is also shown on screen
    }
    setAsked(true);
    // Opens the ChatGPT app (or chatgpt.com) with the prompt filled in; it's on the clipboard too in case it isn't.
    await Linking.openURL(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`).catch(() => {
      Alert.alert('Prompt copied', 'Open the ChatGPT app and paste it.');
    });
  };

  // Auto-import: when you come back from ChatGPT with its table copied, load it without another tap.
  const lastClip = useRef('');
  useEffect(() => {
    if (!asked || estimates) return;
    const check = async () => {
      try {
        if (!(await Clipboard.hasStringAsync())) return;
        const txt = (await Clipboard.getStringAsync()) || '';
        if (!txt || txt === lastClip.current) return;
        lastClip.current = txt;
        const items = parseChatGptReply(txt);
        if (items.length) {
          setReply(txt);
          setEstimates(items.map((it, i) => ({ ...it, key: `${i}`, base: it })));
        }
      } catch {
        // clipboard read refused (iOS "Allow Paste" → Don't Allow) – the Paste button still works
      }
    };
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [asked, estimates]);

  const readReply = async (fromClipboard: boolean) => {
    let txt = reply;
    if (fromClipboard) {
      txt = (await Clipboard.getStringAsync().catch(() => '')) || '';
      setReply(txt);
    }
    const items = parseChatGptReply(txt);
    if (!items.length) {
      Alert.alert('Couldn’t read that', 'Copy the whole table ChatGPT sent (lines like “Chapati | 80 | 240 | 7 | 40 | 6 | 4”) and try again.');
      return;
    }
    setEstimates(items.map((it, i) => ({ ...it, key: `${i}`, base: it })));
  };

  const saveEstimates = async () => {
    if (!estimates) return;
    for (const e of estimates) if (e.grams > 0) await addEstimate(db, date, slot, e);
    await finishQueue();
    router.back();
  };

  const analyse = async () => {
    setBusy(true);
    const [url, token] = await Promise.all([getSetting(db, 'proxy_url'), getSetting(db, 'invite_token')]);
    try {
      if (mode === 'label') {
        const r = await scanLabel(url, token, { image: photo!.base64 });
        setLabel(r.result);
      } else {
        const r = mode === 'photo'
          ? await scanPlate(url, token, { image: photo!.base64, hint: hint.trim(), slot, place })
          : await describePlate(url, token, { text: text.trim(), slot });
        await ground(r.result);
      }
    } catch (e) {
      const err = e as ProxyError;
      if (err.code === 'offline' || err.code === 'timeout') {
        if (!queueId) {
          const kept = photo ? await keepImage(photo.uri, 'scans') : null;
          await queueScan(db, { local_date: date, slot, kind: mode, image_uri: kept, text: mode === 'text' ? text : null, hint, place, oil });
        }
        Alert.alert('Saved for later', `${err.message} The meal is queued as “Scan pending” and you can analyse it from Journal when you're online.`);
        router.back();
      } else if (err.code === 'not_configured') {
        Alert.alert('Set up the scan service', err.message, [
          { text: 'Later', style: 'cancel' },
          { text: 'Open settings', onPress: () => router.push('/settings') },
        ]);
      } else {
        Alert.alert('Scan failed', `${err.message ?? e} Try Describe it, search or quick add instead.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const ground = async (r: PlateResult) => {
    const out: Line[] = [];
    for (const [i, it] of r.items.entries()) {
      const cands = it.name === 'unknown' ? [] : await candidatesFor(db, it.name, 4);
      out.push({ key: `${i}`, name: it.name, household: it.household, confidence: it.confidence, grams: Math.round(it.grams), candidates: cands, chosen: cands[0] ?? null });
    }
    if (r.oil_level) setOil(r.oil_level);
    setQuestion(r.question);
    setLines(out);
  };

  const totals = useMemo(() => {
    if (!lines) return null;
    const parts = lines.filter((l) => l.chosen).map((l) => forGrams({ k: l.chosen!.kcal, p: l.chosen!.protein, c: l.chosen!.carbs, f: l.chosen!.fat, fb: l.chosen!.fiber }, l.grams));
    if (oilFood && OIL_GRAMS[oil] > 0) parts.push(forGrams({ k: oilFood.kcal, p: 0, c: 0, f: oilFood.fat, fb: 0 }, OIL_GRAMS[oil]));
    return sum(parts);
  }, [lines, oil, oilFood]);

  const save = async () => {
    if (!lines) return;
    for (const l of lines) if (l.chosen && l.grams > 0) await addAiItem(db, date, slot, l.chosen, l.grams);
    if (oilFood && OIL_GRAMS[oil] > 0) await addAiItem(db, date, slot, oilFood, OIL_GRAMS[oil]);
    await finishQueue();
    router.back();
  };

  const finishQueue = async () => {
    if (!queueId) return;
    const q = await getQueuedScan(db, queueId);
    deleteImage(q?.image_uri ?? null);
    await deleteQueuedScan(db, queueId);
  };

  const saveLabel = async (l: LabelResult, name: string) => {
    const g = l.per_100g;
    const id = await createCustomFood(db, { name, kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat, fiber: g.fiber ?? 0, unit: l.serving_grams ? 'serving' : null, unitGrams: l.serving_grams });
    const food = await getFood(db, id);
    if (food) await addFoodToMeal(db, date, slot, food, l.serving_grams ? 1 : 100, !!l.serving_grams);
    await finishQueue();
    Alert.alert('Saved', `${name} is now in your foods, and one ${l.serving_grams ? 'serving' : '100 g'} is in ${SLOT_LABEL[slot]}. Edit the portion from Journal if needed.`);
    router.back();
  };

  if (estimates) {
    const tot = sum(estimates.map((e) => ({ kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber })));
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: 'Check the items' }} />
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.small, { marginBottom: space.md }]}>ChatGPT’s estimate. Change grams if a portion looks off (macros scale with it), or remove a line.</Text>
          {estimates.map((e) => (
            <Card key={e.key}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type.h2, { flex: 1 }]} numberOfLines={2}>{e.name}</Text>
                <Pressable onPress={() => setEstimates((xs) => xs!.filter((x) => x.key !== e.key))} accessibilityLabel={`Remove ${e.name}`} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 18 }}>×</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
                <TextInput
                  value={String(e.grams)}
                  keyboardType="number-pad"
                  onChangeText={(t) => {
                    const g = Number(t.replace(/[^0-9]/g, '')) || 0;
                    setEstimates((xs) => xs!.map((x) => (x.key === e.key ? { ...scaleItem(x.base, g), key: x.key, base: x.base } : x)));
                  }}
                  style={[ui.input, { width: 96, flexShrink: 0, textAlign: 'center', fontWeight: '700', fontSize: 18 }]}
                  accessibilityLabel={`${e.name} grams`}
                />
                <Text style={type.body}>grams</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
                {[0.5, 0.75, 1, 1.5, 2].map((f) => (
                  <Chip key={f} label={`${f}×`} selected={e.grams === Math.round(e.base.grams * f)} onPress={() => setEstimates((xs) => xs!.map((x) => (x.key === e.key ? { ...scaleItem(x.base, Math.round(x.base.grams * f)), key: x.key, base: x.base } : x)))} />
                ))}
              </View>
              <Text style={[type.small, { marginTop: 4 }]}>{e.kcal} kcal · P {e.protein} g · C {e.carbs} g · F {e.fat} g · fiber {e.fiber} g</Text>
            </Card>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
          <Button title={`Add to ${SLOT_LABEL[slot]} · ${Math.round(tot.kcal)} kcal · ${Math.round(tot.protein)} g protein`} onPress={saveEstimates} disabled={!estimates.length} />
        </View>
      </View>
    );
  }

  if (label) return <LabelConfirm l={label} onSave={saveLabel} />;

  if (lines) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: 'Check the items' }} />
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.small, { marginBottom: space.md }]}>The model guessed foods and grams; calories come from the food database. Fix anything that’s off.</Text>
          {question && (
            <Card style={{ backgroundColor: colors.amberSoft, borderColor: colors.amberSoft }}>
              <Text style={type.body}>❓ {question}</Text>
            </Card>
          )}
          {lines.map((l) => (
            <LineCard key={l.key} l={l} onChange={(next) => setLines((xs) => xs!.map((x) => (x.key === l.key ? next : x)))} db={db} />
          ))}
          <Card>
            <Text style={type.h2}>Cooking oil / ghee</Text>
            <View style={{ flexDirection: 'row', marginTop: space.sm }}>
              {(['low', 'normal', 'high'] as Oil[]).map((o) => (
                <Chip key={o} label={`${o[0].toUpperCase() + o.slice(1)} · ${OIL_GRAMS[o]} g`} selected={oil === o} onPress={() => setOil(o)} />
              ))}
            </View>
          </Card>
        </ScrollView>
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
          <Button title={`Add to ${SLOT_LABEL[slot]} · ${totals?.kcal ?? 0} kcal · ${totals?.protein ?? 0} g protein`} onPress={save} disabled={!lines.some((l) => l.chosen)} />
        </View>
      </View>
    );
  }

  const canAsk = mode === 'text' ? text.trim().length > 2 : true;
  const canAnalyse = mode === 'text' ? text.trim().length > 2 : !!photo;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: mode === 'label' ? 'Scan label' : mode === 'text' ? 'Describe it' : 'Scan meal' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', marginBottom: space.md }}>
          <Chip label="Photo" selected={mode === 'photo'} onPress={() => setMode('photo')} />
          <Chip label="Describe it" selected={mode === 'text'} onPress={() => setMode('text')} />
          <Chip label="Nutrition label" selected={mode === 'label'} onPress={() => setMode('label')} />
        </View>

        {mode === 'text' ? (
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="e.g. 2 rotis, a katori of dal, bhindi sabzi and curd"
            placeholderTextColor={colors.muted}
            style={[ui.input, { height: 110, paddingTop: 12, textAlignVertical: 'top', marginBottom: space.md }]}
          />
        ) : !proxyUrl ? (
          <Card>
            <Text style={type.h2}>{mode === 'label' ? 'Snap the label in ChatGPT' : 'Snap your plate in ChatGPT'}</Text>
            <Text style={[type.small, { marginTop: space.sm }]}>
              1. Tap Open ChatGPT (the prompt is filled in and copied).{'\n'}
              2. In ChatGPT tap ＋ → Camera and {mode === 'label' ? 'photograph the nutrition table' : 'fit the whole plate in'}.{'\n'}
              3. If the box is empty, long-press → Paste. Send.{'\n'}
              4. Tap Copy under the reply and come back. JimBuddy loads it automatically.
            </Text>
          </Card>
        ) : (
          <>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, marginBottom: space.md, backgroundColor: colors.line }} resizeMode="cover" />
            ) : (
              <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
                <Text style={[type.body, { textAlign: 'center' }]}>
                  {mode === 'label' ? 'Photograph the nutrition table on the pack.' : 'Fit the whole plate in. A spoon or your hand helps with scale.'}
                </Text>
              </Card>
            )}
            <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
              <Button title="Camera" variant="secondary" onPress={() => choosePhoto('camera')} style={{ flex: 1 }} />
              <Button title="Gallery" variant="ghost" onPress={() => choosePhoto('library')} style={{ flex: 1 }} />
            </View>
          </>
        )}

        {mode === 'photo' && (
          <>
            <SectionLabel>Context (optional)</SectionLabel>
            <TextInput value={hint} onChangeText={setHint} placeholder="mess lunch, 2 rotis" placeholderTextColor={colors.muted} style={[ui.input, { marginBottom: space.sm }]} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {(['Home', 'Mess', 'Restaurant'] as Place[]).map((pl) => <Chip key={pl} label={pl} selected={place === pl} onPress={() => setPlace(pl)} />)}
            </View>
          </>
        )}

        <Button title={asked ? 'Open ChatGPT again' : 'Open ChatGPT'} variant={asked ? 'ghost' : 'primary'} onPress={askChatGpt} disabled={!canAsk} style={{ marginTop: space.md }} />
        <Text style={[type.small, { marginTop: space.sm, textAlign: 'center' }]}>
          Uses your own ChatGPT account. No API key, nothing stored online by JimBuddy.
        </Text>

        {asked && (
          <Card style={{ marginTop: space.md, borderColor: colors.amber, borderWidth: 2 }}>
            <Text style={type.h2}>2 · Bring back ChatGPT’s answer</Text>
            <Text style={[type.small, { marginVertical: space.sm }]}>
              Tap Copy under ChatGPT’s reply and switch back: it loads by itself. If iPhone asks, choose Allow Paste. Or use the button.
            </Text>
            <Button title="Paste ChatGPT’s answer" onPress={() => readReply(true)} />
            <TextInput
              value={reply}
              onChangeText={setReply}
              multiline
              placeholder={'…or paste it here:\nChapati | 80 | 240 | 7 | 40 | 6 | 4'}
              placeholderTextColor={colors.muted}
              style={[ui.input, { height: 110, paddingTop: 12, textAlignVertical: 'top', marginTop: space.sm }]}
            />
            {reply.trim().length > 0 && <Button title="Read answer" variant="secondary" onPress={() => readReply(false)} style={{ marginTop: space.sm }} />}
          </Card>
        )}

        {proxyUrl && (
          <>
            <Button title={busy ? 'Analysing…' : 'Analyse in app (scan service)'} variant="ghost" onPress={analyse} disabled={!canAnalyse || busy || (mode !== 'text' && !photo?.base64)} style={{ marginTop: space.lg }} />
            {busy && <ActivityIndicator style={{ marginTop: space.md }} color={colors.ink} />}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LineCard({ l, onChange, db }: { l: Line; onChange: (l: Line) => void; db: ReturnType<typeof useSQLiteContext> }) {
  const [search, setSearch] = useState('');
  const n = l.chosen ? forGrams({ k: l.chosen.kcal, p: l.chosen.protein, c: l.chosen.carbs, f: l.chosen.fat, fb: l.chosen.fiber }, l.grams) : null;
  const low = l.confidence < 0.6;
  const findMore = async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) return;
    const c = await candidatesFor(db, q, 4);
    onChange({ ...l, candidates: c, chosen: c[0] ?? l.chosen });
  };
  return (
    <Card style={low ? { borderColor: colors.amber, borderWidth: 2 } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type.h2, { flex: 1, fontSize: 16 }]}>{l.name}</Text>
        <Text style={type.small}>{low ? 'unsure' : `${Math.round(l.confidence * 100)}%`}</Text>
      </View>
      {l.household && <Text style={type.small}>{l.household}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
        {l.candidates.map((c) => (
          <Chip key={c.id} label={c.name.length > 34 ? `${c.name.slice(0, 32)}…` : c.name} selected={l.chosen?.id === c.id} onPress={() => onChange({ ...l, chosen: c })} />
        ))}
        <Chip label="Skip" selected={!l.chosen} onPress={() => onChange({ ...l, chosen: null })} />
      </View>
      <TextInput value={search} onChangeText={findMore} placeholder="Not right? Search another food" placeholderTextColor={colors.muted} style={[ui.input, { height: 40, marginBottom: space.sm }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Button variant="ghost" title="½×" onPress={() => onChange({ ...l, grams: Math.round(l.grams / 2) })} style={{ height: 38, paddingHorizontal: 10 }} />
        <Button variant="ghost" title="−" onPress={() => onChange({ ...l, grams: Math.max(0, Math.round(l.grams * 0.8)) })} style={{ height: 38, width: 40, paddingHorizontal: 0 }} />
        <TextInput value={String(l.grams)} onChangeText={(v) => onChange({ ...l, grams: Math.max(0, Number(v) || 0) })} keyboardType="number-pad" style={[ui.input, { flex: 1, height: 38, textAlign: 'center', fontWeight: '700' }]} />
        <Text style={type.small}>g</Text>
        <Button variant="ghost" title="+" onPress={() => onChange({ ...l, grams: Math.round(l.grams * 1.25) })} style={{ height: 38, width: 40, paddingHorizontal: 0 }} />
        <Button variant="ghost" title="2×" onPress={() => onChange({ ...l, grams: l.grams * 2 })} style={{ height: 38, paddingHorizontal: 10 }} />
      </View>
      <Text style={[type.small, { marginTop: space.sm }]}>
        {n ? `${n.kcal} kcal · ${n.protein} g protein` : l.candidates.length ? 'Skipped' : 'No match found: search above or skip and quick add'}
      </Text>
    </Card>
  );
}

function LabelConfirm({ l, onSave }: { l: LabelResult; onSave: (l: LabelResult, name: string) => void }) {
  const [name, setName] = useState(l.name);
  const g = l.per_100g;
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <Stack.Screen options={{ title: 'Check the label' }} />
      <SectionLabel>Name</SectionLabel>
      <TextInput value={name} onChangeText={setName} style={[ui.input, { marginBottom: space.lg }]} />
      <Card>
        <Text style={type.label}>PER 100 G</Text>
        <Text style={[type.body, { marginTop: 6 }]}>{g.kcal} kcal · {g.protein} g protein · {g.carbs} g carbs · {g.fat} g fat{g.fiber != null ? ` · ${g.fiber} g fiber` : ''}</Text>
        <Text style={[type.small, { marginTop: 6 }]}>{l.serving_grams ? `Serving: ${l.serving_grams} g` : 'No serving size printed'}</Text>
      </Card>
      <Text style={[type.small, { marginBottom: space.md }]}>Compare with the pack before saving: label scans are usually exact, but check the kcal line.</Text>
      <Button title="Save as my food and add" onPress={() => onSave(l, name.trim() || l.name)} />
      <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: space.md }}>
        <Text style={{ color: colors.steel, fontWeight: '600' }}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}
