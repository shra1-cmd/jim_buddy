# JimBuddy

Food × strength tracker: log what you eat, train with a tap-a-muscle exercise library, and watch the balance.
React Native + Expo (SDK 57), Expo Router, local-first SQLite. Plan: see the "JimBuddy — Food × Strength App Plan" doc.

## What works now (Phase 0 + Phase 1)

- **Onboarding** — body stats → calorie, protein, carb, fat and fiber targets (Mifflin–St Jeor; activity excludes workouts).
- **Journal** — day strip, calories ring, protein-first macro bars, Breakfast / Lunch / Snacks / Dinner with per-meal budgets,
  tap an item to delete, "Copy yesterday's …" on empty meals.
- **Add food** — search 1,014 Indian recipes from the Indian Nutrient Databank + 24 basic foods, household units
  (chapati, bowl, egg…) or grams, recents ranked per meal, quick add, "save as my food".
- **Train** — 40 standard exercises by group, front/back body map (tap a muscle), exercise detail with muscles, cues,
  mistakes and Swap; starter templates (read-only for now).
- **Profile** — weight log, 7-day moving average, weekly rate, trend chart; edit targets; eat-back setting.
- **Brand** — Two-plates icon, Android adaptive + monochrome layers, splash.

Not yet: live workout logging and plan builder (Phase 2), AI meal scan + health sync (Phase 3), measurements/photos (Phase 4).
The Scan meal button explains this instead of pretending.

## Run it

```bash
npm install
npx expo start            # press "a" for an Android emulator/phone, or scan the QR with Expo Go
```

Everything here runs in **Expo Go** on iPhone and Android (no custom native modules yet).
Web works too (`npx expo start --web`); the Metro config adds the headers expo-sqlite needs.

## Build an APK for friends

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview   # gives a shareable APK link
```

Before the first build, change `android.package` / `ios.bundleIdentifier` in `app.json` (`com.jimbuddy.app` is a placeholder).
iPhone builds need the paid Apple Developer Program (see the plan).

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # node:test for targets, portions, dates, trends
```

## Layout

```
src/app/            routes (Expo Router): (tabs)/home|journal|train|profile, add-food, onboarding, exercise/[id]
src/components/     ui kit, tab icons, BodyMap
src/data/           the 40-exercise library + starter templates (fixed ids)
src/db/             migrations (PRAGMA user_version), queries, seed/foods.json
src/lib/            pure maths: targets, nutrition, dates (day starts 4 am), progress
tests/              unit tests for src/lib
```

## Data notes

- `src/db/seed/foods.json` is generated from INDB (`INDB.xlsx`, CC BY — credit shown in Profile). Per-serving grams come
  from INDB's unit-serving energy. Some INDB recipes count cooking water in their weight (e.g. boiled egg ≈151 g per egg),
  so their per-100 g numbers look low while per-unit numbers are right; the app logs by unit by default. The basic
  "Egg, whole, boiled" entry ranks first for eggs.
- Basic foods (milk, curd, whey, paneer, nuts…) use typical label/USDA-style values.
- Meal items store a nutrient snapshot, so editing a food never rewrites history.
