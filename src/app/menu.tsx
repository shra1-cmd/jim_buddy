import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { BowlBuddy } from '../components/Illustrations';
import { Button, Card, IconBadge, styles as ui } from '../components/ui';
import {
  addMenuItem, clearMenu, deleteMenuItem, menuDayCounts, menuForDay, replaceMenu, updateMenuItem, type MenuItem,
} from '../db/menu';
import { SLOT_LABEL } from '../db/queries';
import { getSetting, setSetting } from '../db/settings';
import { menuPrompt, parseMenuReply, type MenuRow } from '../lib/chatgpt';
import { todayKey } from '../lib/dates';
import { deleteImage, keepImage, pickPhoto, PermissionError } from '../lib/images';
import { DAYS, MENU_SLOTS, dowOfKey, type MenuSlot } from '../lib/menu';
import { clay, colors, radius, space, tiles, type } from '../theme';

const SLOT_TINT: Record<MenuSlot, { bg: string; badge: string }> = {
  breakfast: tiles.yellow, lunch: tiles.green, snacks: tiles.coral, dinner: tiles.blue,
};
const SLOT_ICON = { breakfast: 'sun', lunch: 'bowl', snacks: 'cup', dinner: 'moon' } as const;

/** Weekly mess / PG menu: upload a photo once, let ChatGPT turn it into dishes, then pick portions from Add food. */
export default function MenuScreen() {
  const db = useSQLiteContext();
  const [photo, setPhoto] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [dow, setDow] = useState(dowOfKey(todayKey()));
  const [items, setItems] = useState<MenuItem[]>([]);
  const [asked, setAsked] = useState(false);
  const [reply, setReply] = useState('');
  const [pending, setPending] = useState<{ rows: MenuRow[]; skipped: number } | null>(null);
  const [editing, setEditing] = useState<{ slot: MenuSlot; item?: MenuItem } | null>(null);
  const [viewPhoto, setViewPhoto] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const lastClip = useRef('');

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const load = useCallback(async () => {
    const [p, c, it] = await Promise.all([getSetting(db, 'menu_photo'), menuDayCounts(db), menuForDay(db, dow)]);
    setPhoto(p);
    setCounts(c);
    setItems(it);
  }, [db, dow]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ---------- upload + convert ----------
  const upload = async (src: 'camera' | 'library') => {
    try {
      const ph = await pickPhoto(src);
      if (!ph) return;
      const uri = await keepImage(ph.uri, 'menu');
      if (photo && photo !== uri) deleteImage(photo); // keep only the latest menu photo
      await setSetting(db, 'menu_photo', uri);
      setPhoto(uri);
    } catch (e) {
      if (e instanceof PermissionError) {
        Alert.alert('Permission needed', e.message, [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]);
      } else Alert.alert('Couldn’t add the photo', String((e as Error).message ?? e));
    }
  };

  const convert = async () => {
    const prompt = menuPrompt();
    await Clipboard.setStringAsync(prompt).catch(() => {});
    setAsked(true);
    if (photo && Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      Alert.alert('Prompt copied ✓', 'Pick ChatGPT in the share sheet, then long-press the message box → Paste and send. Copy ChatGPT’s table and come back.', [
        { text: 'Open share sheet', onPress: () => Sharing.shareAsync(photo, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Send menu to ChatGPT' }).catch(() => {}) },
      ]);
    } else {
      await Linking.openURL(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`).catch(() => {});
    }
  };

  const readTable = (txt: string, quiet = false) => {
    const r = parseMenuReply(txt);
    if (!r.rows.length) {
      if (!quiet) Alert.alert('Couldn’t read that', 'Copy the whole table ChatGPT sent (lines like “Mon | lunch | Rice | 200 | 260 | 5 | 56 | 1 | 1”).');
      return false;
    }
    setPending(r);
    return true;
  };

  useEffect(() => {
    if (!asked || pending) return;
    const check = async () => {
      try {
        if (!(await Clipboard.hasStringAsync())) return;
        const txt = (await Clipboard.getStringAsync()) || '';
        if (!txt || txt === lastClip.current) return;
        lastClip.current = txt;
        const r = parseMenuReply(txt);
        if (r.rows.length) {
          setReply(txt);
          setPending(r);
        }
      } catch {
        // paste refused; the button still works
      }
    };
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [asked, pending]);

  const savePending = async () => {
    if (!pending) return;
    await replaceMenu(db, pending.rows);
    setPending(null);
    setAsked(false);
    setReply('');
    setShowSetup(false);
    load();
  };

  // ---------- review of an imported table ----------
  if (pending) {
    const byDay = DAYS.map((d, i) => ({ d, n: pending.rows.filter((r) => r.dow === i + 1).length }));
    const preview = pending.rows.filter((r) => r.dow === dow);
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
        <Card style={{ backgroundColor: tiles.green.bg }}>
          <Text style={type.h2}>Found {pending.rows.length} dishes</Text>
          <Text style={[type.small, { marginTop: 4 }]}>
            {byDay.map((x) => `${x.d} ${x.n}`).join(' · ')}{pending.skipped ? `\n${pending.skipped} line(s) skipped (day or meal not readable).` : ''}
          </Text>
        </Card>
        <DayStrip dow={dow} onPick={setDow} counts={Object.fromEntries(byDay.map((x, i) => [i + 1, x.n]))} />
        {MENU_SLOTS.map((s) => {
          const list = preview.filter((r) => r.slot === s);
          if (!list.length) return null;
          return (
            <Card key={s}>
              <SlotHeader slot={s} />
              {list.map((r, i) => <DishRow key={i} name={r.name} grams={r.grams} kcal={r.kcal} protein={r.protein} />)}
            </Card>
          );
        })}
        <Button title={total ? 'Replace my menu with this' : 'Save menu'} onPress={savePending} />
        <Button title="Discard" variant="ghost" onPress={() => setPending(null)} style={{ marginTop: space.sm }} />
      </ScrollView>
    );
  }

  const setup = (
    <>
      <Card>
        <Step n={1} title="Upload the menu photo" done={!!photo} />
        {photo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm }}>
            <Pressable onPress={() => setViewPhoto(true)} accessibilityLabel="View menu photo">
              <Image source={{ uri: photo }} style={{ width: 76, height: 96, borderRadius: radius.sm, backgroundColor: colors.cream }} />
            </Pressable>
            <View style={{ flex: 1, gap: space.sm }}>
              <Text style={type.small}>Saved on this phone. Tap to view.</Text>
              <Button title="Change photo" variant="ghost" icon="camera" onPress={() => upload('library')} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <Button title="Camera" icon="camera" onPress={() => upload('camera')} style={{ flex: 1 }} />
            <Button title="Gallery" variant="ghost" onPress={() => upload('library')} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      <Card>
        <Step n={2} title="Turn it into dishes with ChatGPT" done={asked} />
        <Text style={[type.small, { marginVertical: space.sm }]}>
          {photo ? 'Sends the photo to ChatGPT; the instructions are copied, just paste them.' : 'Opens ChatGPT with the instructions. Attach your menu photo or paste the menu text there.'}
        </Text>
        <Button title="Open ChatGPT" variant="secondary" icon="menu" onPress={convert} />
      </Card>

      {asked && (
        <Card style={{ borderWidth: 2, borderColor: colors.coral }}>
          <Step n={3} title="Bring back the table" />
          <Text style={[type.small, { marginVertical: space.sm }]}>Copy ChatGPT’s table and switch back: it loads by itself. If iPhone asks, choose Allow Paste.</Text>
          <Button title="Paste ChatGPT’s table" onPress={async () => { const t = (await Clipboard.getStringAsync().catch(() => '')) || ''; setReply(t); readTable(t); }} />
          <TextInput
            value={reply}
            onChangeText={setReply}
            multiline
            placeholder={'…or paste it here:\nMon | lunch | Rice | 200 | 260 | 5 | 56 | 1 | 1'}
            style={[ui.input, { height: 110, paddingTop: 12, textAlignVertical: 'top', marginTop: space.sm }]}
          />
          {reply.trim().length > 0 && <Button title="Read table" variant="ghost" onPress={() => readTable(reply)} style={{ marginTop: space.sm }} />}
        </Card>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: tiles.green.bg, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', boxShadow: clay.tile, marginBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#2D5E4C' }}>Your weekly menu</Text>
            <Text style={{ color: colors.tealDeep, marginTop: 4 }}>
              {total ? `${total} dishes across the week. Add meals from Add food → Today’s menu.` : 'Upload your mess / PG menu once. Then log meals with a Low · Medium · High bar.'}
            </Text>
          </View>
          <BowlBuddy size={84} id="menuhero" />
        </View>

        {total === 0 ? setup : (
          <>
            <DayStrip dow={dow} onPick={setDow} counts={counts} />
            {MENU_SLOTS.map((s) => {
              const list = items.filter((r) => r.slot === s);
              return (
                <Card key={s}>
                  <SlotHeader slot={s} kcal={list.reduce((a, r) => a + r.kcal, 0)} />
                  {list.length === 0 && <Text style={type.small}>Nothing on the menu.</Text>}
                  {list.map((r) => (
                    <DishRow
                      key={r.id}
                      name={r.name}
                      grams={r.grams}
                      kcal={r.kcal}
                      protein={r.protein}
                      onPress={() => setEditing({ slot: s, item: r })}
                      onRemove={async () => { await deleteMenuItem(db, r.id); load(); }}
                    />
                  ))}
                  {editing?.slot === s ? (
                    <DishForm
                      initial={editing.item}
                      onCancel={() => setEditing(null)}
                      onSave={async (v) => {
                        if (editing.item) await updateMenuItem(db, editing.item.id, v);
                        else await addMenuItem(db, { ...v, dow, slot: s });
                        setEditing(null);
                        load();
                      }}
                    />
                  ) : (
                    <Pressable onPress={() => setEditing({ slot: s })} style={{ paddingTop: space.sm }} accessibilityRole="button">
                      <Text style={{ color: colors.tealDeep, fontWeight: '700' }}>＋ Add dish</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })}
            <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
              <Button title={showSetup ? 'Hide update' : 'Update from photo'} variant="ghost" onPress={() => setShowSetup(!showSetup)} style={{ flex: 1 }} />
              <Button
                title="Clear menu"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() =>
                  Alert.alert('Clear the whole menu?', 'Meals you already logged stay in your journal.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: async () => { await clearMenu(db); load(); } },
                  ])
                }
              />
            </View>
            {showSetup && setup}
          </>
        )}
      </ScrollView>

      <Modal visible={viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(false)}>
        <Pressable onPress={() => setViewPhoto(false)} style={{ flex: 1, backgroundColor: 'rgba(40,25,18,0.85)', alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
          {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <Text style={{ color: '#fff', marginTop: space.md }}>Tap to close</Text>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Step({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: done ? tiles.green.badge : colors.coral, alignItems: 'center', justifyContent: 'center', boxShadow: clay.badge, marginRight: space.sm }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{done ? '✓' : n}</Text>
      </View>
      <Text style={type.h2}>{title}</Text>
    </View>
  );
}

function DayStrip({ dow, onPick, counts }: { dow: number; onPick: (d: number) => void; counts: Record<number, number> }) {
  const today = dowOfKey(todayKey());
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: space.md }}>
      {DAYS.map((d, i) => {
        const n = i + 1;
        const on = n === dow;
        return (
          <Pressable
            key={d}
            onPress={() => onPick(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: on ? colors.coral : colors.card, boxShadow: on ? clay.button : clay.soft }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#fff' : colors.ink }}>{d}</Text>
            <Text style={{ fontSize: 11, color: on ? '#FFE9E1' : colors.muted }}>{counts[n] ?? 0}</Text>
            {n === today && <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: on ? '#fff' : colors.coral }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function SlotHeader({ slot, kcal }: { slot: MenuSlot; kcal?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
      <IconBadge name={SLOT_ICON[slot]} color={SLOT_TINT[slot].badge} size={34} />
      <Text style={[type.h2, { marginLeft: space.sm, flex: 1 }]}>{SLOT_LABEL[slot]}</Text>
      {kcal ? <Text style={type.small}>{Math.round(kcal)} kcal (medium)</Text> : null}
    </View>
  );
}

function DishRow({ name, grams, kcal, protein, onPress, onRemove }: { name: string; grams: number; kcal: number; protein: number; onPress?: () => void; onRemove?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{name}</Text>
        <Text style={type.small}>{Math.round(grams)} g · {Math.round(kcal)} kcal · {Math.round(protein)} g protein</Text>
      </View>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${name}`}>
          <Text style={{ color: colors.danger, fontSize: 20, fontWeight: '800' }}>×</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function DishForm({ initial, onSave, onCancel }: { initial?: MenuItem; onSave: (v: Omit<MenuRow, 'dow' | 'slot'>) => void; onCancel: () => void }) {
  const [v, setV] = useState({
    name: initial?.name ?? '',
    grams: initial ? String(initial.grams) : '',
    kcal: initial ? String(initial.kcal) : '',
    protein: initial ? String(initial.protein) : '',
    carbs: initial ? String(initial.carbs) : '',
    fat: initial ? String(initial.fat) : '',
  });
  const n = (s: string) => Math.max(0, Number(s.replace(',', '.')) || 0);
  const field = (k: keyof typeof v, label: string, numeric = true) => (
    <View style={{ flex: numeric ? 1 : undefined, marginBottom: space.sm }}>
      <Text style={[type.label, { marginBottom: 4 }]}>{label}</Text>
      <TextInput value={v[k]} onChangeText={(t) => setV({ ...v, [k]: t })} keyboardType={numeric ? 'decimal-pad' : 'default'} style={ui.input} accessibilityLabel={label} />
    </View>
  );
  return (
    <View style={{ marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line }}>
      {field('name', 'Dish', false)}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {field('grams', 'Medium (g)')}
        {field('kcal', 'kcal')}
        {field('protein', 'Protein g')}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {field('carbs', 'Carbs g')}
        {field('fat', 'Fat g')}
        <View style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          title="Save dish"
          disabled={!v.name.trim() || n(v.grams) <= 0}
          onPress={() => onSave({ name: v.name.trim(), grams: n(v.grams), kcal: n(v.kcal), protein: n(v.protein), carbs: n(v.carbs), fat: n(v.fat), fiber: initial?.fiber ?? 0 })}
          style={{ flex: 1 }}
        />
        <Button title="Cancel" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
