# JimBuddy

Food × strength tracker: log what you eat, train with a tap-a-muscle exercise library, and watch the balance.
React Native + Expo (SDK 57), Expo Router, local-first SQLite. Plan: see the "JimBuddy — Food × Strength App Plan" doc.

## What's in v1

- **Home: the Balance**. A food plate against iron plates; the beam tilts toward whichever side is behind
  (today's fuel vs this week's training pace). Below it you get calories left, one concrete **protein fix** from foods you
  actually eat, today's planned workout with Start/Resume, a week strip and mini trends. It also nudges you to back up weekly.
- **Journal**. Day strip, calories ring, macros, four meals with per-meal budgets, copy yesterday. **Burned** is real now
  (MET estimate from finished workouts; 50% eaten back by default).
- **Add food**. Search 1,038 foods (INDB + basics) with household units, recents, quick add, save as your own food.
- **Scan meal (AI)**:
  - Three modes: photo, describe-it, or nutrition label.
  - The model only names foods and grams. Calories come from INDB on the phone, and you can correct every line
    (pick a candidate, search, or use ½×/−/+/2×). Oil is a separate line.
  - Offline scans go into a queue that you finish later.
  - It needs the proxy below.
- **Train**:
  - My Workouts plan builder (days, sets, rep range, rest, reorder) and 4 starter templates.
  - 40-exercise library with body map, two-frame demo drawings (23 lifts), cues and mistakes, swap, and custom exercises.
- **Live workout**:
  - Pre-filled from last time with double-progression suggestions ("you hit the top: try 42.5 kg").
  - Warm-up sets, a rest timer with a lock-screen notification, haptics, keep-awake.
  - PR detection and history.
- **Profile**. Weight trend, measurements (waist/chest/arm/thigh) with trends, progress photos with side-by-side compare,
  strength trend (estimated 1RM of your most-logged lifts), weekly muscle heatmap (hard sets per muscle).
- **Settings**. Proxy URL + invite token, eat-back %, recalculate targets, JSON backup export/restore, credits.
- **Brand**. Two-plates icon, splash, and a wordmark reveal on cold start (skipped with Reduce Motion).

Deliberately deferred to v2: Apple Health / Health Connect sync (needs a dev build + paid Apple account), 3D/looping
exercise animations, cloud sync between phones.

## v1.1 changes

- **All data is local.** Profile, food log, workouts, steps and photos live in the phone's SQLite database. There is no
  account or cloud server.
- **Train → Steps & games**:
  - **Steps:** synced from the iPhone's step counter (last 7 days), or typed in by hand. A number you type wins over the
    synced count. Only steps above your activity baseline (5,000 / 7,500 / 10,000) count, so walking isn't counted twice.
  - **Games:** Cricket, Badminton, Football, Basketball and Table tennis. Pick Medium or High intensity and the minutes
    played. Calories = (MET − 1) × weight × hours.
  - Both feed Journal → Burned.
- **Starter templates** sit behind a button on Train → Workouts.
- **Editable targets.** Tap the kcal/protein pill on Profile and type your own numbers. Carbs, fat and fiber follow.
  "Use suggested" restores the calculated values.
- **Scan meal → ChatGPT app** (no API key, no camera inside JimBuddy):
  1. "Open ChatGPT" opens it with the standard prompt filled in. The prompt is also copied, in case it doesn't fill in.
  2. Take the photo with ChatGPT's own camera and send.
  3. Copy the reply and switch back. JimBuddy spots the table on the clipboard and loads it automatically.
  - Camera/Gallery only show up when the optional proxy is set up (Settings → Advanced).
- The Home "protein fix" suggestion has been removed.

## Optional: in-app scan via your own proxy

The OpenAI key must never ship inside the app, so a tiny Cloudflare Worker sits in between. See `proxy/README.md` for details.

```bash
cd proxy
npm install
npx wrangler login
npx wrangler kv namespace create USAGE        # paste the id into wrangler.toml
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put INVITE_TOKENS         # comma-separated, one per friend
npx wrangler deploy
```

Then in the app: Profile → Settings → paste the worker URL + your token → Save and test.
Each token gets 20 scans a day (`DAILY_CAP` in `wrangler.toml`). `proxy/eval/run-eval.mjs` scores the model on your own
labelled meal photos.

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
npm test            # node:test: targets, portions, dates, trends, progression, grounding, balance
```

## Layout

```
src/app/            routes: (tabs)/home|journal|train|profile, add-food, scan, onboarding, exercise/[id], exercise-picker,
                    plan/[id], workout/[id], history, measurements, photos, settings
src/components/     ui kit, tab icons, BodyMap, BalanceBeam, ExerciseDemo, MiniLine, IntroReveal
src/data/           40-exercise library + templates, exercise drawing map
src/db/             migrations (PRAGMA user_version = 2), food/meal, training, body, settings queries
src/lib/            pure maths (targets, nutrition, dates, progress, training, grounding, balance) + ai, images, backup, restTimer
proxy/              Cloudflare Worker for the AI scan (+ eval script)
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
