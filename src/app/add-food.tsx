import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, styles as ui } from '../components/ui';
import {
  SLOT_LABEL, addFoodToMeal, createCustomFood, quickAdd, recentFoods, searchFoods,
  type Food, type Slot,
} from '../db/queries';
import { todayKey } from '../lib/dates';
import { forGrams } from '../lib/nutrition';
import { colors, space, type } from '../theme';

type Mode = 'search' | 'portion' | 'quick';

export default function AddFood() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ date?: string; slot?: Slot }>();
  const date = params.date ?? todayKey();
  const slot: Slot = params.slot ?? 'lunch';

  const [mode, setMode] = useState<Mode>('search');
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

  if (mode === 'quick') {
    return <QuickAdd onBack={() => setMode('search')} onSave={async (v, saveAsFood) => {
      if (saveAsFood && v.name) {
        // Saved as a custom food per serving (100 g basis = 1 serving) so it shows up in search and recents.
        const id = await createCustomFood(db, { ...v, unit: 'serving', unitGrams: 100 });
        await addFoodToMeal(db, date, slot, { id, name: v.name, source: 'custom', kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, fiber: 0, unit: 'serving', unit_grams: 100 }, 1, true);
      } else {
        await quickAdd(db, date, slot, v.name, { ...v, fiber: 0 });
      }
      router.back();
    }} />;
  }

  return (
    <View style={{ flex: 1, padding: space.lg }}>
      <Text style={[type.small, { marginBottom: space.sm }]}>Adding to {SLOT_LABEL[slot]}</Text>
      <TextInput
        autoFocus
        placeholder="Search: roti, dal, egg, paneer…"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={ui.input}
        returnKeyType="search"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md }}>
        <Chip label="Quick add kcal" onPress={() => setMode('quick')} />
        <Chip label="Describe it" onPress={() => router.replace({ pathname: '/scan', params: { date, slot, mode: 'text' } })} />
        <Chip label="Scan meal" onPress={() => router.replace({ pathname: '/scan', params: { date, slot, mode: 'photo' } })} />
        <Chip label="Scan label" onPress={() => router.replace({ pathname: '/scan', params: { date, slot, mode: 'label' } })} />
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

function QuickAdd({ onBack, onSave }: { onBack: () => void; onSave: (v: { name: string; kcal: number; protein: number; carbs: number; fat: number }, saveAsFood: boolean) => void }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [save, setSave] = useState(false);
  const num = (s: string) => Math.max(0, Number(s.replace(',', '.')) || 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack}>
          <Text style={{ color: colors.steel, fontWeight: '600', marginBottom: space.md }}>‹ Back to search</Text>
        </Pressable>
        <Text style={[type.h1, { marginBottom: space.lg }]}>Quick add</Text>
        <Field label="Name (optional)" value={name} onChange={setName} />
        <Field label="Calories (kcal)" value={kcal} onChange={setKcal} numeric />
        <Field label="Protein (g)" value={protein} onChange={setProtein} numeric />
        <Field label="Carbs (g)" value={carbs} onChange={setCarbs} numeric />
        <Field label="Fat (g)" value={fat} onChange={setFat} numeric />
        <View style={{ flexDirection: 'row', marginBottom: space.md }}>
          <Chip label="Save as my food" selected={save} onPress={() => setSave(!save)} />
        </View>
        <Button
          title="Add"
          disabled={num(kcal) <= 0 || (save && !name.trim())}
          onPress={() => onSave({ name: name.trim(), kcal: num(kcal), protein: num(protein), carbs: num(carbs), fat: num(fat) }, save)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, numeric }: { label: string; value: string; onChange: (s: string) => void; numeric?: boolean }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} style={ui.input} />
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
