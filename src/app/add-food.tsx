import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { Glyph } from '../components/Glyphs';
import { BowlBuddy } from '../components/Illustrations';
import { Button, Card, Chip, styles as ui } from '../components/ui';
import { logMenuPicks, menuCount, menuFor, type MenuItem } from '../db/menu';
import {
  SLOT_LABEL, addFoodToMeal, createCustomFood, quickAdd, recentFoods, searchFoods,
  type Food, type Slot,
} from '../db/queries';
import { todayKey } from '../lib/dates';
import { validateFoodEntry, type EntryField, type EntryInput } from '../lib/foodEntry';
import { DAYS, PORTIONS, dowOfKey, portionFactor, type Portion as Level } from '../lib/menu';
import { forGrams, type Nutrients } from '../lib/nutrition';
import { clay, colors, radius, space, tiles, type } from '../theme';

type Mode = 'search' | 'portion' | 'quick' | 'menu';

export default function AddFood() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ date?: string; slot?: Slot; mode?: 'menu' | 'quick' }>();
  const date = params.date ?? todayKey();
  const slot: Slot = params.slot ?? 'lunch';

  const [mode, setMode] = useState<Mode>(params.mode === 'menu' || params.mode === 'quick' ? params.mode : 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [recents, setRecents] = useState<Food[]>([]);
  const [food, setFood] = useState<Food | null>(null);

  useEffect(() => {
    recentFoods(db, slot).then(setRecents);
  }, [db, slot]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      searchFoods(db, query).then((r) => alive && setResults(r));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [db, query]);

  const list = query.trim() ? results : recents;

  if (mode === 'portion' && food) {
    return <Portion food={food} slotLabel={SLOT_LABEL[slot]} onBack={() => setMode('search')} onAdd={async (qty, useUnit) => {
      await addFoodToMeal(db, date, slot, food, qty, useUnit);
      router.back();
    }} />;
  }

  if (mode === 'menu') {
    return <MenuPick date={date} slot={slot} onBack={() => setMode('search')} onDone={() => router.back()} />;
  }

  if (mode === 'quick') {
    return <QuickAdd onBack={() => setMode('search')} onSave={async (v, saveAsFood) => {
      if (saveAsFood && v.name) {
        // Saved as a custom food per serving (100 g basis = 1 serving) so it shows up in search and recents.
        const id = await createCustomFood(db, { ...v, unit: 'serving', unitGrams: 100 });
        await addFoodToMeal(db, date, slot, { id, name: v.name, source: 'custom', kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, fiber: v.fiber, unit: 'serving', unit_grams: 100 }, 1, true);
      } else {
        await quickAdd(db, date, slot, v.name, v);
      }
      router.back();
    }} />;
  }

  return (
    <View style={{ flex: 1, padding: space.lg }}>
      <Text style={[type.small, { marginBottom: space.sm }]}>Adding to {SLOT_LABEL[slot]}</Text>
      <TextInput
        placeholder="Search: roti, dal, egg, paneer…"
        value={query}
        onChangeText={setQuery}
        style={ui.input}
        returnKeyType="search"
      />
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, marginBottom: space.xs }}>
        <ActionTile icon="menu" label="Today’s menu" tint={tiles.green} onPress={() => setMode('menu')} />
        <ActionTile icon="camera" label="Scan meal" tint={tiles.coral} onPress={() => router.replace({ pathname: '/scan', params: { date, slot } })} />
        <ActionTile icon="bolt" label="Quick add" tint={tiles.yellow} onPress={() => setMode('quick')} />
      </View>
      <Text style={[type.label, { marginTop: space.sm, marginBottom: space.sm }]}>
        {query.trim() ? `RESULTS (${results.length})` : recents.length ? 'RECENT' : 'START TYPING TO SEARCH 1,000+ INDIAN FOODS'}
      </Text>
      <FlatList
        data={list}
        keyExtractor={(f) => f.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setFood(item);
              setMode('portion');
            }}
            style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}
          >
            <Text style={type.body}>{item.name}</Text>
            <Text style={type.small}>
              {item.unit && item.unit_grams
                ? `${Math.round((item.kcal * item.unit_grams) / 100)} kcal per ${item.unit} · `
                : ''}
              {Math.round(item.kcal)} kcal / 100 g · {item.protein} g protein
              {item.source === 'custom' ? ' · yours' : ''}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function Portion({ food, slotLabel, onBack, onAdd }: { food: Food; slotLabel: string; onBack: () => void; onAdd: (qty: number, useUnit: boolean) => void }) {
  const hasUnit = !!(food.unit && food.unit_grams);
  const [useUnit, setUseUnit] = useState(hasUnit);
  const [qtyText, setQtyText] = useState(hasUnit ? '1' : '100');
  const qty = Math.max(0, Number(qtyText.replace(',', '.')) || 0);
  const grams = useUnit && food.unit_grams ? qty * food.unit_grams : qty;
  const n = useMemo(() => forGrams({ k: food.kcal, p: food.protein, c: food.carbs, f: food.fat, fb: food.fiber }, grams), [food, grams]);
  const step = useUnit ? 0.5 : 10;

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <Pressable onPress={onBack}>
        <Text style={{ color: colors.steel, fontWeight: '600', marginBottom: space.md }}>‹ Back to search</Text>
      </Pressable>
      <Text style={type.h1}>{food.name}</Text>
      <Text style={[type.small, { marginBottom: space.lg }]}>
        {food.source === 'indb' ? 'Indian Nutrient Databank (CC BY)' : food.source === 'basic' ? 'Typical values' : 'Your food'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {hasUnit && <Chip label={food.unit!} selected={useUnit} onPress={() => { setUseUnit(true); setQtyText('1'); }} />}
        <Chip label="grams" selected={!useUnit} onPress={() => { setUseUnit(false); setQtyText(String(Math.round(grams) || 100)); }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: space.lg, gap: space.md }}>
        <Button variant="ghost" title="−" onPress={() => setQtyText(String(Math.max(0, +(qty - step).toFixed(1))))} style={{ width: 56 }} />
        <TextInput
          value={qtyText}
          onChangeText={setQtyText}
          keyboardType="decimal-pad"
          style={[ui.input, { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700' }]}
          accessibilityLabel="Quantity"
        />
        <Button variant="ghost" title="+" onPress={() => setQtyText(String(+(qty + step).toFixed(1)))} style={{ width: 56 }} />
      </View>
      {useUnit && <Text style={[type.small, { textAlign: 'center', marginTop: -space.sm, marginBottom: space.md }]}>≈ {Math.round(grams)} g</Text>}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Macro label="kcal" value={n.kcal} />
          <Macro label="protein" value={n.protein} />
          <Macro label="carbs" value={n.carbs} />
          <Macro label="fat" value={n.fat} />
        </View>
      </Card>
      <Button title={`Add to ${slotLabel}`} onPress={() => onAdd(qty, useUnit)} disabled={qty <= 0} />
    </ScrollView>
  );
}

function QuickAdd({ onBack, onSave }: { onBack: () => void; onSave: (v: Nutrients & { name: string }, saveAsFood: boolean) => void }) {
  const [input, setInput] = useState<EntryInput>({ name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [save, setSave] = useState(false);
  const [tried, setTried] = useState(false);
  const { value, errors } = validateFoodEntry(input, { requireName: save });
  const field = (f: EntryField, label: string, numeric = true) => (
    <Field label={label} value={input[f]} onChange={(t) => setInput((x) => ({ ...x, [f]: t }))} numeric={numeric} error={tried ? errors[f] : undefined} />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack}>
          <Text style={{ color: colors.steel, fontWeight: '600', marginBottom: space.md }}>‹ Back to search</Text>
        </Pressable>
        <Text style={[type.h1, { marginBottom: space.lg }]}>Quick add</Text>
        {field('name', save ? 'Name' : 'Name (optional)', false)}
        {field('kcal', 'Calories (kcal)')}
        {field('protein', 'Protein (g, optional)')}
        {field('carbs', 'Carbs (g, optional)')}
        {field('fat', 'Fat (g, optional)')}
        {field('fiber', 'Fiber (g, optional)')}
        <View style={{ flexDirection: 'row', marginBottom: space.md }}>
          <Chip label="Save as my food" selected={save} onPress={() => setSave(!save)} />
        </View>
        <Button
          title="Add"
          onPress={() => {
            setTried(true);
            if (value) onSave(value, save);
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, numeric, error }: { label: string; value: string; onChange: (s: string) => void; numeric?: boolean; error?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={[ui.input, error ? { borderWidth: 2, borderColor: colors.danger } : null]}
        accessibilityLabel={label}
        accessibilityHint={error}
      />
      {error && <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{Math.round(value)}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function ActionTile({ icon, label, tint, onPress }: { icon: 'menu' | 'camera' | 'bolt'; label: string; tint: { bg: string; badge: string }; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.lg, backgroundColor: tint.bg, boxShadow: clay.tile, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: tint.badge, alignItems: 'center', justifyContent: 'center', boxShadow: clay.badge }}>
        <Glyph name={icon} size={21} accent={tint.badge} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', marginTop: 6 }}>{label}</Text>
    </Pressable>
  );
}

const PORTION_FILL = ['#FDB79F', '#F7946F', '#F06A4B'];

/** The Low · Medium · High quantity bar. Segments fill up to the chosen level. */
function PortionBar({ value, onChange }: { value: Level; onChange: (p: Level) => void }) {
  const idx = PORTIONS.findIndex((p) => p.id === value);
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: '#F6E2CF', borderRadius: radius.pill, padding: 3, boxShadow: clay.well }}>
      {PORTIONS.map((p, i) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${p.label} portion`}
          accessibilityState={{ selected: i === idx }}
          onPress={() => onChange(p.id)}
          style={{ flex: 1, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= idx ? PORTION_FILL[i] : 'transparent', boxShadow: i === idx ? clay.button : undefined }}
        >
          <Text style={{ fontSize: 12, fontWeight: i === idx ? '800' : '600', color: i <= idx ? '#fff' : colors.muted }}>{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Today's menu for this meal: tick what you ate and slide each dish to Low / Medium / High. */
function MenuPick({ date, slot, onBack, onDone }: { date: string; slot: Slot; onBack: () => void; onDone: () => void }) {
  const db = useSQLiteContext();
  const dow = dowOfKey(date);
  const [dishes, setDishes] = useState<MenuItem[] | null>(null);
  const [any, setAny] = useState(0);
  const [pick, setPick] = useState<Record<number, { on: boolean; portion: Level }>>({});

  useEffect(() => {
    (async () => {
      const [d, n] = await Promise.all([menuFor(db, dow, slot), menuCount(db)]);
      setDishes(d);
      setAny(n);
      setPick(Object.fromEntries(d.map((x) => [x.id, { on: true, portion: 'medium' as Level }])));
    })();
  }, [db, dow, slot]);

  const chosen = (dishes ?? []).filter((d) => pick[d.id]?.on).map((d) => ({ item: d, grams: d.grams * portionFactor(pick[d.id].portion) }));
  const kcal = chosen.reduce((a, c) => a + (c.item.kcal * c.grams) / c.item.grams, 0);
  const protein = chosen.reduce((a, c) => a + (c.item.protein * c.grams) / c.item.grams, 0);

  if (!dishes) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <Pressable onPress={onBack}>
          <Text style={{ color: colors.tealDeep, fontWeight: '700', marginBottom: space.md }}>‹ Search instead</Text>
        </Pressable>
        <View style={{ backgroundColor: tiles.green.bg, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', boxShadow: clay.tile, marginBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#2D5E4C' }}>{DAYS[dow - 1]} · {SLOT_LABEL[slot]}</Text>
            <Text style={{ color: colors.tealDeep, marginTop: 4 }}>
              {dishes.length ? 'Untick what you skipped, set how much you took.' : any ? 'Nothing on this meal’s menu.' : 'No weekly menu yet.'}
            </Text>
          </View>
          <BowlBuddy size={70} id="pick" />
        </View>

        {dishes.length === 0 && (
          <Button title={any ? 'Edit weekly menu' : 'Upload weekly menu'} variant="secondary" icon="menu" onPress={() => router.push('/menu')} />
        )}

        {dishes.map((d) => {
          const st = pick[d.id] ?? { on: true, portion: 'medium' as Level };
          const g = Math.round(d.grams * portionFactor(st.portion));
          const f = portionFactor(st.portion);
          return (
            <Card key={d.id} style={{ opacity: st.on ? 1 : 0.55 }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: st.on }}
                onPress={() => setPick({ ...pick, [d.id]: { ...st, on: !st.on } })}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: st.on ? space.md : 0 }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 8, marginRight: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: st.on ? colors.sageDeep : colors.cardHi, boxShadow: st.on ? clay.buttonTeal : clay.well }}>
                  {st.on && <Glyph name="check" size={16} />}
                </View>
                <Text style={[type.h2, { flex: 1 }]} numberOfLines={2}>{d.name}</Text>
                <Text style={{ fontWeight: '800' }}>{st.on ? Math.round(d.kcal * f) : 0} kcal</Text>
              </Pressable>
              {st.on && (
                <>
                  <PortionBar value={st.portion} onChange={(p) => setPick({ ...pick, [d.id]: { ...st, portion: p } })} />
                  <Text style={[type.small, { marginTop: 6 }]}>{g} g · {Math.round(d.protein * f * 10) / 10} g protein · medium is {Math.round(d.grams)} g</Text>
                </>
              )}
            </Card>
          );
        })}
      </ScrollView>
      {dishes.length > 0 && (
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
          <Button
            title={chosen.length ? `Add ${chosen.length} to ${SLOT_LABEL[slot]} · ${Math.round(kcal)} kcal · ${Math.round(protein)} g protein` : 'Pick at least one dish'}
            disabled={!chosen.length}
            onPress={async () => { await logMenuPicks(db, date, slot, chosen); onDone(); }}
          />
        </View>
      )}
    </View>
  );
}
