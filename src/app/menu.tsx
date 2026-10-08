import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { BowlBuddy } from '../components/Illustrations';
import { Button, Card, IconBadge, styles as ui } from '../components/ui';
import {
  addMenuItem, clearMenu, deleteMenuItem, logMenuPicks, menuDayCounts, menuForDay, menuLoggedCounts, replaceMenu, updateMenuItem, type MenuItem,
} from '../db/menu';
import { SLOT_LABEL } from '../db/queries';
import { menuPrompt, parseMenuReply, type MenuRow } from '../lib/chatgpt';
import { dayLabel, todayKey } from '../lib/dates';
import { DAYS, MENU_SLOTS, dowOfKey, keyForDowThisWeek, type MenuSlot } from '../lib/menu';
import { clay, colors, radius, space, tiles, type } from '../theme';

const SLOT_TINT: Record<MenuSlot, { bg: string; badge: string }> = {
  breakfast: tiles.yellow, lunch: tiles.green, snacks: tiles.coral, dinner: tiles.blue,
};
const SLOT_ICON = { breakfast: 'sun', lunch: 'bowl', snacks: 'cup', dinner: 'moon' } as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Weekly mess / PG menu: ChatGPT reads the menu photo with you, its final table is pasted here, then dishes go to the journal. */
export default function MenuScreen() {
  const db = useSQLiteContext();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [dow, setDow] = useState(dowOfKey(todayKey()));
  const [items, setItems] = useState<MenuItem[]>([]);
  const [logged, setLogged] = useState<Partial<Record<MenuSlot, number>>>({});
  const [asked, setAsked] = useState(false);
  const [reply, setReply] = useState('');
  const [pending, setPending] = useState<{ rows: MenuRow[]; skipped: number } | null>(null);
  const [editing, setEditing] = useState<{ slot: MenuSlot; item?: MenuItem } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const lastClip = useRef('');

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const date = keyForDowThisWeek(todayKey(), dow);
  const isToday = date === todayKey();

  const load = useCallback(async () => {
    const [c, it, lg] = await Promise.all([menuDayCounts(db), menuForDay(db, dow), menuLoggedCounts(db, keyForDowThisWeek(todayKey(), dow))]);
    setCounts(c);
    setItems(it);
    setLogged(lg);
  }, [db, dow]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ---------- ChatGPT hand-off ----------
  const openChatGpt = async () => {
    const prompt = menuPrompt();
    await Clipboard.setStringAsync(prompt).catch(() => {});
    setAsked(true);
    await Linking.openURL(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`).catch(() =>
      Alert.alert('Instructions copied', 'Open the ChatGPT app and paste them.'),
    );
  };

  const readTable = (txt: string, quiet = false) => {
    const r = parseMenuReply(txt);
    if (!r.rows.length) {
      if (!quiet) Alert.alert('Couldn’t read that', 'Say “final” in ChatGPT, then copy the whole table it sends (lines like “Mon | lunch | Rice | 200 | 260 | 5 | 56 | 1 | 1”).');
      return false;
    }
    setPending(r);
    return true;
  };

  // Coming back from ChatGPT with the final table copied → load it without another tap.
  useEffect(() => {
    if (!asked || pending) return;
    const check = async () => {
      try {
        if (!(await Clipboard.hasStringAsync())) return;
        const txt = (await Clipboard.getStringAsync()) || '';
        if (!txt || txt === lastClip.current) return;
        lastClip.current = txt;
        if (parseMenuReply(txt).rows.length) {
          setReply(txt);
          readTable(txt, true);
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
    setDow(dowOfKey(todayKey()));
    load();
  };

  // ---------- add to journal ----------
  const addToJournal = (slots: MenuSlot[]) => {
    const withDishes = slots.filter((s) => items.some((r) => r.slot === s));
    if (!withDishes.length) return;
    const go = async () => {
      for (const s of withDishes) {
        await logMenuPicks(db, date, s, items.filter((r) => r.slot === s).map((r) => ({ item: r, grams: r.grams })));
      }
      load();
      Alert.alert('Added ✓', `${withDishes.map((s) => SLOT_LABEL[s]).join(', ')} added to ${dayLabel(date).toLowerCase()} at medium portions. Change portions in the Journal.`);
    };
    const already = withDishes.filter((s) => logged[s]);
    if (already.length) {
      Alert.alert('Already in your journal', `${already.map((s) => SLOT_LABEL[s]).join(', ')} already has menu dishes on this day. Add again?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add again', onPress: go },
      ]);
    } else go();
  };

  // ---------- review of an imported table ----------
  if (pending) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
        <Card style={{ backgroundColor: tiles.green.bg }}>
          <Text style={type.h2}>Found {pending.rows.length} dishes</Text>
          <Text style={[type.small, { marginTop: 4 }]}>
            Check the week below.{pending.skipped ? ` ${pending.skipped} line(s) skipped (day or meal not readable).` : ''}
          </Text>
        </Card>
        {DAYS.map((_, i) => {
          const day = pending.rows.filter((r) => r.dow === i + 1);
          return (
            <Card key={i}>
              <Text style={[type.h2, { marginBottom: space.sm }]}>{DAY_NAMES[i]}</Text>
              {day.length === 0 && <Text style={type.small}>Nothing on the menu.</Text>}
              {MENU_SLOTS.map((s) => {
                const list = day.filter((r) => r.slot === s);
                if (!list.length) return null;
                return (
                  <View key={s} style={{ marginBottom: space.sm }}>
                    <Text style={[type.label, { color: SLOT_TINT[s].badge }]}>{SLOT_LABEL[s].toUpperCase()} · {Math.round(list.reduce((a, r) => a + r.kcal, 0))} kcal</Text>
                    {list.map((r, j) => <DishRow key={j} name={r.name} grams={r.grams} kcal={r.kcal} protein={r.protein} />)}
                  </View>
                );
              })}
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
        <Step n={1} title="Open ChatGPT" done={asked} />
        <Text style={[type.small, { marginVertical: space.sm }]}>
          The instructions are filled in (and copied). In ChatGPT tap ＋ and send a photo of your mess menu. It lists the week day by day; fix
          anything or drop meals you skip, then say “final”.
        </Text>
        <Button title={asked ? 'Open ChatGPT again' : 'Open ChatGPT'} variant={asked ? 'ghost' : 'secondary'} icon="menu" onPress={openChatGpt} />
      </Card>

      <Card style={asked ? { borderWidth: 2, borderColor: colors.coral } : undefined}>
        <Step n={2} title="Paste the final table" />
        <Text style={[type.small, { marginVertical: space.sm }]}>Copy ChatGPT’s final table and switch back: it loads by itself. If iPhone asks, choose Allow Paste.</Text>
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
    </>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: tiles.green.bg, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', boxShadow: clay.tile, marginBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#2D5E4C' }}>Your weekly menu</Text>
            <Text style={{ color: colors.tealDeep, marginTop: 4 }}>
              {total ? `${total} dishes across the week. Tap “Add to journal” on a meal to log it.` : 'Let ChatGPT read your mess / PG menu, then log meals in one tap.'}
            </Text>
          </View>
          <BowlBuddy size={84} id="menuhero" />
        </View>

        {total === 0 ? setup : (
          <>
            <DayStrip dow={dow} onPick={setDow} counts={counts} />
            {items.length > 0 && (
              <Button
                title={`Add all of ${isToday ? 'today' : DAY_NAMES[dow - 1]} to journal`}
                icon="check"
                onPress={() => addToJournal(MENU_SLOTS)}
                style={{ marginBottom: space.md }}
              />
            )}
            {MENU_SLOTS.map((s) => {
              const list = items.filter((r) => r.slot === s);
              return (
                <Card key={s}>
                  <SlotHeader
                    slot={s}
                    kcal={list.reduce((a, r) => a + r.kcal, 0)}
                    added={!!logged[s]}
                    onAdd={list.length ? () => addToJournal([s]) : undefined}
                  />
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
              <Button title={showSetup ? 'Hide update' : 'Update with ChatGPT'} variant="ghost" onPress={() => setShowSetup(!showSetup)} style={{ flex: 1 }} />
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

function SlotHeader({ slot, kcal, added, onAdd }: { slot: MenuSlot; kcal?: number; added?: boolean; onAdd?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
      <IconBadge name={SLOT_ICON[slot]} color={SLOT_TINT[slot].badge} size={34} />
      <View style={{ marginLeft: space.sm, flex: 1 }}>
        <Text style={type.h2}>{SLOT_LABEL[slot]}</Text>
        {kcal ? <Text style={type.small}>{Math.round(kcal)} kcal (medium)</Text> : null}
      </View>
      {onAdd && (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add ${SLOT_LABEL[slot]} to journal`}
          style={{ backgroundColor: added ? tiles.green.bg : colors.coral, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, boxShadow: clay.soft }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: added ? colors.tealDeep : '#fff' }}>{added ? '✓ Added' : '＋ Add to journal'}</Text>
        </Pressable>
      )}
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
