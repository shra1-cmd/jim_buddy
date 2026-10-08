# CLAUDE.md

@AGENTS.md

## Project at a glance

JimBuddy: a food × strength tracker. Expo SDK 57, React Native 0.86, Expo Router, local-first SQLite (`expo-sqlite`). There's no backend and no account.

- `src/app/`: routes only. Tabs live in `(tabs)/` (home, journal, train, profile).
- `src/components/`: UI. `ui.tsx` and `theme.ts` hold the pastel "clay" design system.
- `src/db/`: schema (`migrate.ts`), queries, and the seed data (`seed/foods.json`).
- `src/lib/`: pure logic (nutrition, training, balance, menu, ChatGPT hand-off). Tests in `tests/` exercise this code.
- `src/data/`: static exercise library.

Before declaring a task done, run:

```bash
npm run typecheck && npm run lint && npm test
```

## Session context

The context that should survive between sessions lives in `.claude/context/`. That way a new session (or one resumed after compaction) picks up where the last one stopped.

```
.claude/context/
├── CURRENT.md                    # live state of the active session (auto-loaded below)
└── sessions/
    └── YYYY-MM-DD-<slug>.md      # archived record of each finished session
```

@.claude/context/CURRENT.md

### Rules

1. **At session start**, read `CURRENT.md` (it's loaded above). If it describes unfinished work, briefly tell the user what was in progress and ask whether to continue or start something new. For details on older work, read the relevant file in `sessions/`.
2. **During the session**, update `CURRENT.md` at meaningful milestones, not after every edit:
   - a goal is agreed
   - a design decision is made, along with the reason for it
   - a feature lands
   - the user gives feedback that changes direction
   - something is found that a future session would otherwise have to rediscover

   Keep it short. It's a working note, not a log.
3. **At session end**, or when the user switches to an unrelated task:
   - Copy `CURRENT.md` to `sessions/<today>-<short-slug>.md` and fill in the outcome.
   - Reset `CURRENT.md` to the template, carrying over only the "Open threads" and "Next steps" that are still relevant.
4. **Store** decisions and their reasons, the user's preferences for this project, open bugs, and half-finished work with exact file paths.
5. **Don't store** things the code or git history already says, such as file contents, diffs, or commit lists. Don't store secrets or API keys either.
6. Convert relative dates ("tomorrow", "next week") to absolute ones before writing them down.
7. If a note conflicts with the code, the code wins. Fix or delete the stale note.

### CURRENT.md template

```markdown
# Current session

**Started:** YYYY-MM-DD
**Goal:** <one line>

## Decisions
- <decision>: <why>

## Progress
- [x] <done>
- [ ] <in progress / todo>

## Open threads
- <unresolved question, bug, or idea>

## Next steps
- <what the next session should do first>
```
