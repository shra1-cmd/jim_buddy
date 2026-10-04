# JimBuddy

Food × strength tracker: log what you eat, train with a tap-a-muscle exercise library, and watch the balance.
React Native + Expo (SDK 57), Expo Router, local-first SQLite. Plan: see the "JimBuddy — Food × Strength App Plan" doc.

## What's in the app (v2)

Everything lives in the phone's SQLite database: no account, no cloud, no API keys.

- **Look**:
  - Pastel "clay" design: warm cream surfaces, soft raised cards, coral / sage / butter / sky tiles.
  - Rounded Nunito type and a mint tab bar.
  - Buddy, an original mascot.
- **Home dashboard**:
  - Greeting with a hero card. Its button is context-aware: start today's plan, resume a workout, or log a meal.
  - Four stat tiles: calories left, protein, burned, streak.
  - Calories/protein-this-week bars with a goal line, and a macros donut.
  - A today's-workout card, a today's-meals list and a weekly-menu banner.
- **Journal**:
  - Calories ring and macro bars, plus the four meals with per-meal budgets.
  - **Scan meal**, and right under it **Weekly menu**.
  - Shortcuts: "From menu" and "Copy yesterday".
- **Weekly menu (mess / PG)**:
  1. Upload a photo of the menu. It is saved on the phone.
  2. "Open ChatGPT" sends it with ready-made instructions.
  3. Copy ChatGPT's table and switch back. The dishes load by themselves, one row per day and meal, each with a medium portion.
  - You can edit, add or remove any dish.
- **Add food**:
  - **Today's menu** is the default when that meal has dishes on the menu. Untick what you skipped and set each dish
    with a **Low · Medium · High** bar (0.5× / 1× / 1.5× of the medium portion).
  - Also: **Scan meal**, **Quick add**, and search across 1,038 Indian foods.
- **Scan meal**:
  1. Opens ChatGPT with the question filled in (and copied).
  2. Take the photo with ChatGPT's camera.
  3. Copy its table and switch back. JimBuddy loads it automatically, and you adjust grams before saving.
- **Train**:
  - Plans, with starter templates behind a button.
  - Live logging with progression, rest timer, PRs and history.
  - **Steps & games**: iPhone step counter or typed steps; cricket, badminton, football, basketball and table tennis,
    each at medium or high intensity.
  - 40-exercise library with a body map.
- **Profile**:
  - Editable targets: tap the kcal pill.
  - Weight trend, measurements, progress photos, strength trend and the weekly muscle map.
- **Settings**: eat-back %, recalculate targets, JSON backup export/restore, credits.

Removed in v2:

- "Describe it", "Scan label" and the optional in-app scan service. The Cloudflare proxy and its settings are still in
  git history at tag `v1.2`.
- The Home balance beam and the protein-fix card.

Deferred: Apple Health / Health Connect sync (needs a dev build + paid Apple account), cloud sync.

## Run it

```bash
npm install
npx expo start            # press "a" for an Android emulator/phone, or scan the QR with Expo Go
```

Everything runs in **Expo Go** on iPhone and Android (no custom native modules). Updating from an older zip: replace the
folder, run `npm install` again; the database migrates itself (your log is kept).
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
npm test            # node:test: targets, portions, dates, trends, progression, steps/sports, ChatGPT + menu parsing, streaks
```

## Layout

```
src/app/            routes: (tabs)/home|journal|train|profile, add-food, scan, menu, onboarding, exercise/[id],
                    exercise-picker, plan/[id], workout/[id], history, measurements, photos, settings
src/components/     clay ui kit, AppText (Nunito), ClayTabBar, Glyphs, Illustrations (Buddy), Charts, BodyMap, ExerciseDemo
src/data/           40-exercise library + templates, exercise drawing map
src/db/             migrations (PRAGMA user_version = 4), food/meal, training, activity, menu, body, settings queries
src/lib/            pure logic (targets, nutrition, dates, progress, training, activity, menu, chatgpt, balance) + images, backup, restTimer
tests/              unit tests for src/lib
```

## Data notes

- `src/db/seed/foods.json` is generated from INDB (`INDB.xlsx`, CC BY — credit shown in Profile). Per-serving grams come
  from INDB's unit-serving energy. Some INDB recipes count cooking water in their weight (e.g. boiled egg ≈151 g per egg),
  so their per-100 g numbers look low while per-unit numbers are right; the app logs by unit by default. The basic
  "Egg, whole, boiled" entry ranks first for eggs.
- Basic foods (milk, curd, whey, paneer, nuts…) use typical label/USDA-style values.
- Meal items store a nutrient snapshot, so editing a food never rewrites history.
- Exercise drawings in `assets/exercises/` are adapted from Everkinetic (CC BY-SA 4.0); see `assets/exercises/LICENSE.md`.
  Changes to those images must stay CC BY-SA.
- Backups are JSON with everything you typed (not the INDB seed, not photos, never the invite token).
