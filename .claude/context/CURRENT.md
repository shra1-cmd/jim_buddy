# Current session

**Started:** 2026-10-08
**Goal:** Run the app on a device via Expo Go, review it, then make changes based on what the user sees.

## Decisions
- Menu "Add to journal" logs to the selected weekday's date in the current Mon–Sun week, not always today.
- Removed `customTargets`; all five targets are now entered directly.
- Session context lives in `.claude/context/` (see CLAUDE.md): `CURRENT.md` is auto-loaded, and finished sessions are archived to `sessions/`.

## Progress
- [x] Dev server started with `npx expo start --lan` → `exp://10.10.2.246:8081`  (stopped, then restarted 2026-10-08)
- [x] Added CLAUDE.md with the session-context protocol
- [x] Profile → targets editor: carbs, fat and fiber are editable now. Shows the calories implied by the macros, and a "Chat with ChatGPT" link that sends the user's body stats (`targetsPrompt`).
- [x] Muscle map checked: it counts finished workouts since Monday, ticked non-warm-up sets, primary muscles 1 and secondary 0.5. Fixed custom exercises not loading on the Profile screen.
- [x] Weekly menu: removed the photo upload. Flow is now ChatGPT (photo → day-by-day review → "final") → paste table → Mon–Sun review → save. Each meal has "＋ Add to journal", plus "Add all of <day>"; dishes are logged at medium portions to that weekday's date this week, with a warning before adding them twice.

- [x] Journal calorie card: replaced the Eaten / Ring / Burned row with `components/Seesaw.tsx`: clay kettlebells on the beam ends, with the number inside each bell and the label under the beam end. Eaten is on the left, Burned on the right, and a "Daily need" pill sits under the stand; the heavier side dips, up to ±12°. The ring is now `components/CalorieRing.tsx` and shows eaten − allowance: "−1650" in teal means still to eat, "+130" in red means over. The label is just "kcal". It has a gradient arc, an end knob, a red second lap when over, and an inner clay well. The equation line was removed at the user's request; the stand shows a "Daily need" pill instead. Removed the Scan meal button from Journal; scanning is still in the + → Add food sheet.
- [x] Journal meal cards: tapping the header opens and closes the item list; collapsed by default, with a chevron. The summary line is now "X kcal · Y g carbs · Z g protein", replacing the per-meal budget. Item rows show qty · carbs · protein, with kcal on the right.
- [x] Train → plan screen: the sets/reps/rest steppers are removed. Each exercise is now a card (number badge, name, primary muscles or "x/y sets done") with a Start / Continue / Done pill. Tapping it calls `startPlanExercise`, which joins the active session or creates an empty one named after the plan, and opens `/workout/[id]?focus=<exerciseId>`, a single-exercise logger with "Done · next exercise" and "Finish whole workout". Long-press a card to move or remove it. The bottom button is "Start full workout", or "Review & finish workout" while a session is active.
- [x] Workout clock: `startSessionClock` resets started_at at the first ticked set, so the clock, duration and kcal ignore time spent before the first set. The header shows the exercise name (focus, or the first exercise with sets left) and never the plan name; a teal timer pill appears top-right once the clock runs. Plan card pills replaced with round icon buttons: ▶ start (coral), ⏸ in progress (teal), ✓ done (green); the `pause` glyph was added.
- [x] **No start/stop or time tracking, at the user's request.** A plan is now a list of exercises; tap one to open `components/ExerciseLog.tsx` and type kg and reps (last time shows as placeholder). Each set saves on blur via `saveLoggedSet`, into a per-plan, per-day `workout_session` (status 'done') that is created lazily; `deleteLoggedSet` removes the day log once it's empty. Kcal is estimated at `MINUTES_PER_SET` = 2.5 min per working set (`refreshLogKcal`). Removed: play/pause icons, Start/Start full workout, the "＋ Empty workout" FAB, rest timer and keep-awake from the plan flow, and minutes in History. Home CTA is "Log workout" → plan; the exercise page button is "Add to a plan". Set-input helpers live in `lib/setFields.ts`.
- [x] Home: "Log a meal" in the top box now opens a row of four meal buttons (Breakfast/Lunch/Snacks/Dinner, with the current meal outlined) instead of jumping to dinner. Tapping "Macros today" opens `components/MacroSheet.tsx`, a bottom sheet with macros vs targets, a by-meal breakdown, and a micronutrients list from `data/micros.ts` (approx. ICMR-NIN 2020 targets with Indian food sources). Micros are not tracked, because foods only have kcal/P/C/F/fiber. The menu banner copy no longer says "Upload".
- [x] Steps: `stepsKcal(steps)` = steps × 0.033, i.e. 100 steps ≈ 3.3 kcal. Every step counts and there is no activity baseline anymore. The step bar goal is 10,000.
- [x] Home: removed the "Today's meals" card and the "Plan your mess week" banner.
- [x] 2026-10-09: committed as `7875b4e` on master (there is no git remote) and published via `eas update` to branch `main` with runtime exposdk:57.0.0, group `1e621846-859b-4995-a6f4-8a2c956412ca`. It shows in Expo Go as @shravs143/jimbuddy.
- [ ] The user's last message was cut off at "...but why it is and plan your mess". Ask what they wanted about the "Plan your mess week" banner.
- [ ] `/workout/[id]` still exists for History views and any legacy active session; it still has its own copy of the draft helpers (could switch to `lib/setFields`).
- [ ] Seesaw not yet seen on a device: the web preview hangs on the expo-sqlite loader.

- [x] 2026-10-26: upgraded to **SDK 58** (expo 58.0.19, RN 0.88.0, React 19.3.0). Committed on master; the update on the `main` branch is still on SDK 57. Code changes: removed `initialRouteName` from the tabs layout because SDK 58 dropped it. `ClayTabBar` now uses `emitter` + `navigateToTab(route.key)`, since the tab bar no longer gets a `navigation` prop. `AppText` refs use `ComponentRef<typeof …>`. The `AndroidImportance` line in `restTimer.ts` has an eslint-disable for an import/namespace false positive. Lockfile regenerated, because a stale nested expo-symbols@57 blocked `expo install --fix`.
- [x] 2026-10-26: Profile → new **Body profile** section after "Muscles this week". A button toggles a front-only figure (`components/BodyProfile.tsx`, male/female from profile) with 12 main tape callouts, a Height/Weight/BMI/Body fat row, ratio tiles, an expandable "All measurements" list, and "Updated <date>" at the bottom. DB v5 adds 18 columns to body_entry. `arm_cm`/`thigh_cm` are now the **right** biceps/thigh, so older single values keep their history. Field list and maths are in `lib/measures.ts`: ratios use the natural waist, falling back to the navel waist. Body fat is the logged number, else the US Navy tape estimate marked "tape est.". Height comes from the profile, weight from weigh-ins. The Measurements screen logs all fields, grouped. Committed as `f523378`.
- [x] 2026-10-26: `eas update` → branch `main`, runtime exposdk:58.0.0, group `bb0720b4-cb20-4b56-a5c6-48e3bf1dd729` (needs `--environment production` in non-interactive mode).
- [x] 2026-10-26: pushed to https://github.com/shra1-cmd/jim_buddy (PUBLIC). Local branch renamed master → main, tracking origin/main. GitHub's initial commit was merged with `-s ours`, keeping the project's README/LICENSE. LICENSE is still Expo's template MIT ("650 Industries"); the user may want their own.

## Open threads
- Earlier the user wanted the online EAS project removed. On 2026-10-09 they asked to deploy it again, so it is live on branch `main`.
- Uncommitted config changes:
  - `expo-updates` was added.
  - EAS project id, owner, and the updates URL are set in `app.json`.
  - `app.json` has `android.permission.RECORD_AUDIO` listed twice, which is a likely mistake.

## Next steps
- Apply the user's change requests from their on-device review.
