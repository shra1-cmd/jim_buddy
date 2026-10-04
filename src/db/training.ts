import type { SQLiteDatabase } from 'expo-sqlite';
import { STARTER_TEMPLATES, exerciseById, makeCustomExercise, setCustomExercises, type Exercise } from '../data/exercises';
import { todayKey } from '../lib/dates';
import { stepBaseline, stepsKcal } from '../lib/activity';
import { sessionKcal, suggestLoad, type LogType } from '../lib/training';

const now = () => new Date().toISOString();
const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export interface Plan {
  id: string;
  name: string;
  days: string; // "1,3,5" (Mon=1 … Sun=7)
}
export interface PlanExercise {
  id: number;
  plan_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_s: number;
}
export interface Session {
  id: number;
  plan_id: string | null;
  name: string;
  local_date: string;
  started_at: string;
  ended_at: string | null;
  kcal: number;
  status: 'active' | 'done';
  kind?: 'lift' | 'sport';
}
export interface SetRow {
  id: number;
  session_id: number;
  exercise_id: string;
  position: number;
  set_no: number;
  kg: number | null;
  reps: number | null;
  seconds: number | null;
  distance_m: number | null;
  is_warmup: number;
  done: number;
  rep_min: number | null;
  rep_max: number | null;
  rest_s: number | null;
  done_at: string | null;
}

// ---------- custom exercises ----------

export async function loadCustomExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; grp: string; equipment: string; log_type: string }>(
    'SELECT * FROM custom_exercise ORDER BY name',
  );
  const list = rows.map(makeCustomExercise);
  setCustomExercises(list);
  return list;
}

export async function createCustomExercise(db: SQLiteDatabase, name: string, grp: string, equipment: string, logType: LogType) {
  const id = newId('cx');
  await db.runAsync('INSERT INTO custom_exercise (id, name, grp, equipment, log_type, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, name, grp, equipment, logType, now());
  await loadCustomExercises(db);
  return id;
}

// ---------- plans ----------

export async function listPlans(db: SQLiteDatabase): Promise<(Plan & { count: number })[]> {
  return db.getAllAsync(
    `SELECT p.*, (SELECT COUNT(*) FROM plan_exercise pe WHERE pe.plan_id = p.id) AS count FROM workout_plan p ORDER BY p.created_at`,
  );
}

export async function getPlan(db: SQLiteDatabase, id: string) {
  const plan = await db.getFirstAsync<Plan>('SELECT * FROM workout_plan WHERE id = ?', id);
  const items = await db.getAllAsync<PlanExercise>('SELECT * FROM plan_exercise WHERE plan_id = ? ORDER BY position', id);
  return { plan, items };
}

function parseReps(range: string): [number, number] {
  const m = range.match(/(\d+)\D+(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [8, 12];
}

export async function createPlan(db: SQLiteDatabase, name: string, exerciseIds: string[] = [], days = ''): Promise<string> {
  const id = newId('plan');
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO workout_plan (id, name, days, created_at) VALUES (?, ?, ?, ?)', id, name, days, now());
    for (const exId of exerciseIds) await addPlanExercise(db, id, exId);
  });
  return id;
}

export async function createPlanFromTemplate(db: SQLiteDatabase, index: number) {
  const t = STARTER_TEMPLATES[index];
  return createPlan(db, t.name, t.exercises);
}

export async function updatePlan(db: SQLiteDatabase, id: string, name: string, days: string) {
  await db.runAsync('UPDATE workout_plan SET name = ?, days = ? WHERE id = ?', name, days, id);
}

export async function deletePlan(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM plan_exercise WHERE plan_id = ?', id);
    await db.runAsync('DELETE FROM workout_plan WHERE id = ?', id);
  });
}

export async function addPlanExercise(db: SQLiteDatabase, planId: string, exerciseId: string) {
  const ex = exerciseById(exerciseId);
  const [lo, hi] = parseReps(ex?.reps ?? '8–12');
  const pos = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM plan_exercise WHERE plan_id = ?', planId);
  await db.runAsync(
    'INSERT INTO plan_exercise (plan_id, exercise_id, position, sets, rep_min, rep_max, rest_s) VALUES (?, ?, ?, ?, ?, ?, ?)',
    planId, exerciseId, (pos?.p ?? -1) + 1, ex?.group === 'cardio' ? 1 : 3, lo, hi, ex?.restSec ?? 90,
  );
}

export async function updatePlanExercise(db: SQLiteDatabase, pe: PlanExercise) {
  await db.runAsync(
    'UPDATE plan_exercise SET sets = ?, rep_min = ?, rep_max = ?, rest_s = ?, position = ? WHERE id = ?',
    pe.sets, pe.rep_min, pe.rep_max, pe.rest_s, pe.position, pe.id,
  );
}

export async function removePlanExercise(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM plan_exercise WHERE id = ?', id);
}

export async function movePlanExercise(db: SQLiteDatabase, planId: string, id: number, dir: -1 | 1) {
  const items = await db.getAllAsync<PlanExercise>('SELECT * FROM plan_exercise WHERE plan_id = ? ORDER BY position', planId);
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  const a = items[i], b = items[j];
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plan_exercise SET position = ? WHERE id = ?', b.position, a.id);
    await db.runAsync('UPDATE plan_exercise SET position = ? WHERE id = ?', a.position, b.id);
  });
}

// ---------- sessions ----------

export async function activeSession(db: SQLiteDatabase): Promise<Session | null> {
  return db.getFirstAsync<Session>("SELECT * FROM workout_session WHERE status = 'active' ORDER BY started_at DESC LIMIT 1");
}

/** Last completed sets for an exercise (most recent session that had it). */
export async function lastSetsFor(db: SQLiteDatabase, exerciseId: string, beforeSessionId?: number): Promise<SetRow[]> {
  const s = await db.getFirstAsync<{ session_id: number }>(
    `SELECT sl.session_id FROM set_log sl JOIN workout_session ws ON ws.id = sl.session_id
     WHERE sl.exercise_id = ? AND sl.done = 1 AND ws.status = 'done' ${beforeSessionId ? 'AND ws.id != ?' : ''}
     ORDER BY ws.started_at DESC LIMIT 1`,
    ...(beforeSessionId ? [exerciseId, beforeSessionId] : [exerciseId]),
  );
  if (!s) return [];
  return db.getAllAsync<SetRow>('SELECT * FROM set_log WHERE session_id = ? AND exercise_id = ? ORDER BY set_no', s.session_id, exerciseId);
}

async function addExerciseSets(db: SQLiteDatabase, sessionId: number, exerciseId: string, position: number, sets: number, repMin: number, repMax: number, restS: number) {
  const ex = exerciseById(exerciseId);
  const last = await lastSetsFor(db, exerciseId, sessionId);
  const sug = suggestLoad(last, repMax, ex?.incrementKg ?? 2.5, ex?.logType ?? 'weight_reps');
  const working = last.filter((x) => x.done && !x.is_warmup);
  for (let n = 1; n <= sets; n++) {
    const prev = working[Math.min(n - 1, working.length - 1)];
    await db.runAsync(
      `INSERT INTO set_log (session_id, exercise_id, position, set_no, kg, reps, seconds, distance_m, rep_min, rep_max, rest_s)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sessionId, exerciseId, position, n,
      sug.kg ?? prev?.kg ?? null,
      sug.progressed ? repMin : prev?.reps ?? null,
      prev?.seconds ?? null, prev?.distance_m ?? null, repMin, repMax, restS,
    );
  }
}

export async function startSession(db: SQLiteDatabase, planId: string | null): Promise<number> {
  const existing = await activeSession(db);
  if (existing) return existing.id;
  let name = 'Workout';
  let items: PlanExercise[] = [];
  if (planId) {
    const p = await getPlan(db, planId);
    name = p.plan?.name ?? name;
    items = p.items;
  }
  const r = await db.runAsync(
    "INSERT INTO workout_session (plan_id, name, local_date, started_at, status) VALUES (?, ?, ?, ?, 'active')",
    planId, name, todayKey(), now(),
  );
  const sessionId = r.lastInsertRowId;
  for (const it of items) await addExerciseSets(db, sessionId, it.exercise_id, it.position, it.sets, it.rep_min, it.rep_max, it.rest_s);
  return sessionId;
}

export async function addExerciseToSession(db: SQLiteDatabase, sessionId: number, exerciseId: string) {
  const ex = exerciseById(exerciseId);
  const [lo, hi] = parseReps(ex?.reps ?? '8–12');
  const pos = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM set_log WHERE session_id = ?', sessionId);
  await addExerciseSets(db, sessionId, exerciseId, (pos?.p ?? -1) + 1, ex?.group === 'cardio' ? 1 : 3, lo, hi, ex?.restSec ?? 90);
}

export async function getSession(db: SQLiteDatabase, id: number) {
  const session = await db.getFirstAsync<Session>('SELECT * FROM workout_session WHERE id = ?', id);
  const sets = await db.getAllAsync<SetRow>('SELECT * FROM set_log WHERE session_id = ? ORDER BY position, set_no', id);
  return { session, sets };
}

export async function updateSet(db: SQLiteDatabase, s: Pick<SetRow, 'id' | 'kg' | 'reps' | 'seconds' | 'distance_m' | 'is_warmup' | 'done'>) {
  await db.runAsync(
    'UPDATE set_log SET kg = ?, reps = ?, seconds = ?, distance_m = ?, is_warmup = ?, done = ?, done_at = ? WHERE id = ?',
    s.kg, s.reps, s.seconds, s.distance_m, s.is_warmup, s.done, s.done ? now() : null, s.id,
  );
}

export async function addSet(db: SQLiteDatabase, sessionId: number, exerciseId: string) {
  const last = await db.getFirstAsync<SetRow>(
    'SELECT * FROM set_log WHERE session_id = ? AND exercise_id = ? ORDER BY set_no DESC LIMIT 1', sessionId, exerciseId,
  );
  if (!last) return addExerciseToSession(db, sessionId, exerciseId);
  await db.runAsync(
    `INSERT INTO set_log (session_id, exercise_id, position, set_no, kg, reps, seconds, distance_m, rep_min, rep_max, rest_s)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sessionId, exerciseId, last.position, last.set_no + 1, last.kg, last.reps, last.seconds, last.distance_m, last.rep_min, last.rep_max, last.rest_s,
  );
}

export async function removeSet(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM set_log WHERE id = ?', id);
}

export async function removeExerciseFromSession(db: SQLiteDatabase, sessionId: number, exerciseId: string) {
  await db.runAsync('DELETE FROM set_log WHERE session_id = ? AND exercise_id = ?', sessionId, exerciseId);
}

export async function finishSession(db: SQLiteDatabase, id: number, weightKg: number): Promise<number> {
  const { session, sets } = await getSession(db, id);
  if (!session) return 0;
  const minutes = (Date.now() - Date.parse(session.started_at)) / 60000;
  const kcal = sessionKcal(sets, (eid) => exerciseById(eid)?.met ?? 3.5, weightKg, minutes);
  await db.runAsync(
    "UPDATE workout_session SET status = 'done', ended_at = ?, kcal = ? WHERE id = ?", now(), kcal, id,
  );
  await db.runAsync('DELETE FROM set_log WHERE session_id = ? AND done = 0', id); // drop untouched sets
  return kcal;
}

export async function discardSession(db: SQLiteDatabase, id: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM set_log WHERE session_id = ?', id);
    await db.runAsync('DELETE FROM workout_session WHERE id = ?', id);
  });
}

export async function sessionsHistory(db: SQLiteDatabase, limit = 50) {
  return db.getAllAsync<Session & { sets: number; volume: number }>(
    `SELECT ws.*, COUNT(sl.id) AS sets, COALESCE(SUM(CASE WHEN sl.is_warmup = 0 THEN COALESCE(sl.kg,0) * COALESCE(sl.reps,0) ELSE 0 END), 0) AS volume
     FROM workout_session ws LEFT JOIN set_log sl ON sl.session_id = ws.id AND sl.done = 1
     WHERE ws.status = 'done' GROUP BY ws.id ORDER BY ws.started_at DESC LIMIT ?`,
    limit,
  );
}

export interface Burn {
  workouts: number; // gym sessions
  sports: number;
  steps: number; // kcal from steps above the baseline
  stepCount: number;
  total: number;
}

/** Everything burned on a day: workouts + games + extra steps (all net of resting). */
export async function burnBreakdown(db: SQLiteDatabase, date: string): Promise<Burn> {
  const [w, st, p] = await Promise.all([
    db.getAllAsync<{ kind: string; k: number | null }>(
      "SELECT kind, SUM(kcal) AS k FROM workout_session WHERE local_date = ? AND status = 'done' GROUP BY kind", date,
    ),
    db.getFirstAsync<{ steps: number }>('SELECT steps FROM step_day WHERE local_date = ?', date),
    db.getFirstAsync<{ weight_kg: number; activity: number }>('SELECT weight_kg, activity FROM user_profile WHERE id = 1'),
  ]);
  const workouts = Math.round(w.find((r) => r.kind !== 'sport')?.k ?? 0);
  const sports = Math.round(w.find((r) => r.kind === 'sport')?.k ?? 0);
  const stepCount = st?.steps ?? 0;
  const steps = p ? stepsKcal(stepCount, p.weight_kg, stepBaseline(p.activity)) : 0;
  return { workouts, sports, steps, stepCount, total: workouts + sports + steps };
}

export async function burnedOn(db: SQLiteDatabase, date: string): Promise<number> {
  return (await burnBreakdown(db, date)).total;
}

export async function doneSetsSince(db: SQLiteDatabase, fromDate: string) {
  return db.getAllAsync<SetRow>(
    `SELECT sl.* FROM set_log sl JOIN workout_session ws ON ws.id = sl.session_id
     WHERE ws.status = 'done' AND ws.local_date >= ? AND sl.done = 1`,
    fromDate,
  );
}

export async function sessionsSince(db: SQLiteDatabase, fromDate: string): Promise<Session[]> {
  return db.getAllAsync<Session>("SELECT * FROM workout_session WHERE status = 'done' AND local_date >= ? ORDER BY local_date", fromDate);
}

/** Per-session best e1RM inputs for one exercise, oldest first. */
export async function exerciseHistory(db: SQLiteDatabase, exerciseId: string, limit = 30) {
  return db.getAllAsync<{ local_date: string; session_id: number; kg: number | null; reps: number | null; is_warmup: number; done: number; seconds: number | null; distance_m: number | null }>(
    `SELECT ws.local_date, sl.session_id, sl.kg, sl.reps, sl.is_warmup, sl.done, sl.seconds, sl.distance_m
     FROM set_log sl JOIN workout_session ws ON ws.id = sl.session_id
     WHERE sl.exercise_id = ? AND ws.status = 'done' AND sl.done = 1
     ORDER BY ws.started_at DESC LIMIT ?`,
    exerciseId, limit * 8,
  );
}
