// The standard library: 40 exercises (36 strength + 4 cardio). Fixed ids so plans can be shared later.
// Muscle slugs match react-native-body-highlighter.

export type MuscleSlug =
  | 'chest' | 'deltoids' | 'biceps' | 'triceps' | 'forearm' | 'abs' | 'obliques' | 'quadriceps'
  | 'hamstring' | 'gluteal' | 'calves' | 'adductors' | 'trapezius' | 'upper-back' | 'lower-back';

export type Group =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'core' | 'cardio';

export type LogType = 'weight_reps' | 'reps' | 'assisted' | 'time' | 'distance_time';

export interface Exercise {
  id: string;
  name: string;
  group: Group;
  primary: MuscleSlug[];
  secondary: MuscleSlug[];
  equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'cardio machine';
  logType: LogType;
  reps: string; // default rep range or duration
  restSec: number;
  incrementKg: number;
  met: number; // 2024 Adult Compendium for strength; cardio values approximate
  cues: [string, string, string];
  mistakes: [string, string];
  alternatives: string[];
}

export const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Chest', deltoids: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearm: 'Forearms', abs: 'Abs',
  obliques: 'Obliques', quadriceps: 'Quads', hamstring: 'Hamstrings', gluteal: 'Glutes', calves: 'Calves',
  adductors: 'Adductors', trapezius: 'Traps', 'upper-back': 'Upper back', 'lower-back': 'Lower back',
};

export const GROUPS: { id: Group; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'quads', label: 'Quads & glutes' },
  { id: 'hamstrings', label: 'Hamstrings, glutes & calves' },
  { id: 'core', label: 'Core' },
  { id: 'cardio', label: 'Cardio' },
];

const S = 3.5; // resistance training, multiple exercises, 8–15 reps
const H = 5.0; // squats / deadlifts

export const EXERCISES: Exercise[] = [
  // Chest
  { id: 'bench_press_bb', name: 'Barbell bench press', group: 'chest', primary: ['chest'], secondary: ['triceps', 'deltoids'], equipment: 'barbell', logType: 'weight_reps', reps: '6–10', restSec: 150, incrementKg: 2.5, met: S,
    cues: ['Shoulder blades pinned back and down', 'Bar touches lower chest', 'Feet planted, press up and slightly back'], mistakes: ['Bouncing the bar off the chest', 'Elbows flared to 90°'], alternatives: ['incline_db_press', 'machine_chest_press', 'push_up'] },
  { id: 'incline_db_press', name: 'Incline dumbbell press', group: 'chest', primary: ['chest'], secondary: ['deltoids', 'triceps'], equipment: 'dumbbell', logType: 'weight_reps', reps: '8–12', restSec: 120, incrementKg: 2, met: S,
    cues: ['Bench at 30°', 'Lower to upper chest, elbows ~45°', 'Press up and slightly together'], mistakes: ['Bench too steep (turns into a shoulder press)', 'Cutting the range short'], alternatives: ['bench_press_bb', 'machine_chest_press'] },
  { id: 'machine_chest_press', name: 'Machine chest press', group: 'chest', primary: ['chest'], secondary: ['triceps', 'deltoids'], equipment: 'machine', logType: 'weight_reps', reps: '10–12', restSec: 90, incrementKg: 5, met: S,
    cues: ['Handles at mid-chest height', 'Back flat on the pad', 'Control the return'], mistakes: ['Shoulders rolling forward', 'Letting the stack slam'], alternatives: ['bench_press_bb', 'push_up'] },
  { id: 'cable_fly', name: 'Cable fly', group: 'chest', primary: ['chest'], secondary: ['deltoids'], equipment: 'cable', logType: 'weight_reps', reps: '12–15', restSec: 75, incrementKg: 2.5, met: S,
    cues: ['Slight bend in the elbows, kept fixed', 'Hug a big tree', 'Squeeze for a second at the middle'], mistakes: ['Turning it into a press', 'Going too heavy and shrugging'], alternatives: ['incline_db_press'] },
  { id: 'push_up', name: 'Push-up', group: 'chest', primary: ['chest'], secondary: ['triceps', 'deltoids', 'abs'], equipment: 'bodyweight', logType: 'reps', reps: '10–20', restSec: 60, incrementKg: 0, met: S,
    cues: ['Body in one straight line', 'Hands just outside shoulders', 'Chest to a fist from the floor'], mistakes: ['Hips sagging', 'Half reps'], alternatives: ['bench_press_bb', 'machine_chest_press'] },
  // Back
  { id: 'pull_up', name: 'Pull-up (assisted is fine)', group: 'back', primary: ['upper-back'], secondary: ['biceps', 'forearm'], equipment: 'bodyweight', logType: 'assisted', reps: '5–10', restSec: 120, incrementKg: 2.5, met: S,
    cues: ['Start from a dead hang', 'Pull elbows down to your ribs', 'Chin over the bar'], mistakes: ['Kipping and swinging', 'Stopping halfway down'], alternatives: ['lat_pulldown'] },
  { id: 'lat_pulldown', name: 'Lat pulldown', group: 'back', primary: ['upper-back'], secondary: ['biceps'], equipment: 'cable', logType: 'weight_reps', reps: '8–12', restSec: 90, incrementKg: 5, met: S,
    cues: ['Grip a little wider than shoulders', 'Pull the bar to upper chest', 'Lean back slightly, chest up'], mistakes: ['Pulling behind the neck', 'Leaning way back to use momentum'], alternatives: ['pull_up', 'seated_cable_row'] },
  { id: 'barbell_row', name: 'Barbell row', group: 'back', primary: ['upper-back'], secondary: ['lower-back', 'biceps', 'trapezius'], equipment: 'barbell', logType: 'weight_reps', reps: '6–10', restSec: 120, incrementKg: 2.5, met: S,
    cues: ['Hinge to about 45°, back flat', 'Pull to the belly button', 'Lower under control'], mistakes: ['Standing up as you pull', 'Rounding the lower back'], alternatives: ['seated_cable_row', 'lat_pulldown'] },
  { id: 'seated_cable_row', name: 'Seated cable row', group: 'back', primary: ['upper-back'], secondary: ['biceps', 'trapezius'], equipment: 'cable', logType: 'weight_reps', reps: '10–12', restSec: 90, incrementKg: 5, met: S,
    cues: ['Sit tall, slight knee bend', 'Lead with the elbows', 'Squeeze shoulder blades together'], mistakes: ['Rocking the torso', 'Shrugging the shoulders up'], alternatives: ['barbell_row', 'lat_pulldown'] },
  { id: 'deadlift', name: 'Deadlift', group: 'back', primary: ['lower-back', 'gluteal', 'hamstring'], secondary: ['upper-back', 'trapezius', 'forearm', 'quadriceps'], equipment: 'barbell', logType: 'weight_reps', reps: '3–6', restSec: 180, incrementKg: 5, met: H,
    cues: ['Bar over mid-foot, shins close', 'Brace hard, push the floor away', 'Lock out with hips, not by leaning back'], mistakes: ['Rounded back off the floor', 'Bar drifting away from the legs'], alternatives: ['romanian_deadlift', 'hip_thrust'] },
  // Shoulders
  { id: 'seated_db_press', name: 'Seated dumbbell press', group: 'shoulders', primary: ['deltoids'], secondary: ['triceps'], equipment: 'dumbbell', logType: 'weight_reps', reps: '8–12', restSec: 90, incrementKg: 2, met: S,
    cues: ['Back against the pad', 'Dumbbells start at ear height', 'Press up without clashing'], mistakes: ['Arching the lower back', 'Dropping elbows below shoulder level fast'], alternatives: ['ohp_bb'] },
  { id: 'ohp_bb', name: 'Barbell overhead press', group: 'shoulders', primary: ['deltoids'], secondary: ['triceps', 'trapezius', 'abs'], equipment: 'barbell', logType: 'weight_reps', reps: '5–8', restSec: 150, incrementKg: 2.5, met: S,
    cues: ['Squeeze glutes, brace the core', 'Bar path straight, head moves back then through', 'Lock out overhead'], mistakes: ['Leaning back into a standing bench press', 'Flared elbows at the start'], alternatives: ['seated_db_press'] },
  { id: 'lateral_raise', name: 'Lateral raise', group: 'shoulders', primary: ['deltoids'], secondary: ['trapezius'], equipment: 'dumbbell', logType: 'weight_reps', reps: '12–20', restSec: 60, incrementKg: 1, met: S,
    cues: ['Slight forward lean', 'Lead with the elbows', 'Stop at shoulder height'], mistakes: ['Swinging the weights up', 'Shrugging into the traps'], alternatives: ['face_pull'] },
  { id: 'face_pull', name: 'Face pull', group: 'shoulders', primary: ['deltoids'], secondary: ['trapezius', 'upper-back'], equipment: 'cable', logType: 'weight_reps', reps: '12–15', restSec: 60, incrementKg: 2.5, met: S,
    cues: ['Rope at face height', 'Pull to your forehead, hands apart', 'Finish with thumbs pointing back'], mistakes: ['Pulling to the chest', 'Using the lower back'], alternatives: ['reverse_pec_deck'] },
  { id: 'reverse_pec_deck', name: 'Reverse pec-deck', group: 'shoulders', primary: ['deltoids'], secondary: ['upper-back', 'trapezius'], equipment: 'machine', logType: 'weight_reps', reps: '12–15', restSec: 60, incrementKg: 2.5, met: S,
    cues: ['Chest on the pad', 'Arms slightly bent, sweep wide', 'Pause at the back'], mistakes: ['Squeezing shoulder blades instead of moving the arms', 'Going too heavy'], alternatives: ['face_pull'] },
  // Biceps
  { id: 'barbell_curl', name: 'Barbell curl', group: 'biceps', primary: ['biceps'], secondary: ['forearm'], equipment: 'barbell', logType: 'weight_reps', reps: '8–12', restSec: 75, incrementKg: 2.5, met: S,
    cues: ['Elbows pinned to your sides', 'Curl to shoulder height', 'Lower for two seconds'], mistakes: ['Swinging with the hips', 'Elbows drifting forward'], alternatives: ['cable_curl', 'hammer_curl'] },
  { id: 'incline_db_curl', name: 'Incline dumbbell curl', group: 'biceps', primary: ['biceps'], secondary: ['forearm'], equipment: 'dumbbell', logType: 'weight_reps', reps: '10–12', restSec: 60, incrementKg: 1, met: S,
    cues: ['Bench at 45–60°, arms hanging', 'Curl without moving the upper arm', 'Full stretch at the bottom'], mistakes: ['Shoulders rolling forward', 'Cutting the stretch'], alternatives: ['barbell_curl'] },
  { id: 'hammer_curl', name: 'Hammer curl', group: 'biceps', primary: ['biceps', 'forearm'], secondary: [], equipment: 'dumbbell', logType: 'weight_reps', reps: '10–12', restSec: 60, incrementKg: 1, met: S,
    cues: ['Thumbs up the whole time', 'Elbows still', 'Control the way down'], mistakes: ['Swinging', 'Rushing the negative'], alternatives: ['barbell_curl'] },
  { id: 'cable_curl', name: 'Cable curl', group: 'biceps', primary: ['biceps'], secondary: ['forearm'], equipment: 'cable', logType: 'weight_reps', reps: '12–15', restSec: 60, incrementKg: 2.5, met: S,
    cues: ['Step back so tension starts at the bottom', 'Elbows by your sides', 'Squeeze at the top'], mistakes: ['Leaning back', 'Letting the stack yank the arms straight'], alternatives: ['barbell_curl'] },
  // Triceps
  { id: 'rope_pushdown', name: 'Rope pushdown', group: 'triceps', primary: ['triceps'], secondary: [], equipment: 'cable', logType: 'weight_reps', reps: '10–15', restSec: 60, incrementKg: 2.5, met: S,
    cues: ['Elbows pinned to your sides', 'Spread the rope at the bottom', 'Lock out fully'], mistakes: ['Elbows flaring forward', 'Leaning over the stack'], alternatives: ['overhead_cable_ext', 'dips'] },
  { id: 'overhead_cable_ext', name: 'Overhead cable extension', group: 'triceps', primary: ['triceps'], secondary: [], equipment: 'cable', logType: 'weight_reps', reps: '10–15', restSec: 60, incrementKg: 2.5, met: S,
    cues: ['Face away from the stack', 'Elbows point forward, stay still', 'Full stretch behind the head'], mistakes: ['Elbows drifting wide', 'Arching the back'], alternatives: ['rope_pushdown'] },
  { id: 'close_grip_bench', name: 'Close-grip bench press', group: 'triceps', primary: ['triceps'], secondary: ['chest', 'deltoids'], equipment: 'barbell', logType: 'weight_reps', reps: '6–10', restSec: 120, incrementKg: 2.5, met: S,
    cues: ['Hands shoulder-width', 'Elbows tucked close', 'Bar to lower chest'], mistakes: ['Grip too narrow (wrist pain)', 'Flaring elbows'], alternatives: ['dips', 'rope_pushdown'] },
  { id: 'dips', name: 'Dips', group: 'triceps', primary: ['triceps'], secondary: ['chest', 'deltoids'], equipment: 'bodyweight', logType: 'assisted', reps: '6–12', restSec: 90, incrementKg: 2.5, met: S,
    cues: ['Stay fairly upright for triceps', 'Lower until elbows reach 90°', 'Press back to lockout'], mistakes: ['Dropping too deep with shoulders rolled', 'Swinging the legs'], alternatives: ['close_grip_bench', 'rope_pushdown'] },
  // Quads & glutes
  { id: 'back_squat', name: 'Back squat', group: 'quads', primary: ['quadriceps', 'gluteal'], secondary: ['adductors', 'lower-back', 'hamstring'], equipment: 'barbell', logType: 'weight_reps', reps: '5–8', restSec: 180, incrementKg: 2.5, met: H,
    cues: ['Brace before every rep', 'Knees track over toes', 'Hip crease below the knee if mobility allows'], mistakes: ['Heels lifting', 'Knees caving in'], alternatives: ['leg_press', 'bulgarian_split_squat'] },
  { id: 'leg_press', name: 'Leg press', group: 'quads', primary: ['quadriceps', 'gluteal'], secondary: ['adductors'], equipment: 'machine', logType: 'weight_reps', reps: '10–15', restSec: 120, incrementKg: 10, met: S,
    cues: ['Feet shoulder-width on the platform', 'Lower until knees reach about 90°', 'Push through the whole foot'], mistakes: ['Lower back lifting off the pad', 'Locking the knees hard'], alternatives: ['back_squat'] },
  { id: 'bulgarian_split_squat', name: 'Bulgarian split squat', group: 'quads', primary: ['quadriceps', 'gluteal'], secondary: ['adductors'], equipment: 'dumbbell', logType: 'weight_reps', reps: '8–12 / leg', restSec: 90, incrementKg: 2, met: S,
    cues: ['Rear foot on a bench, front foot well forward', 'Drop the back knee straight down', 'Drive through the front heel'], mistakes: ['Front foot too close', 'Wobbling knee'], alternatives: ['back_squat', 'leg_press'] },
  { id: 'leg_extension', name: 'Leg extension', group: 'quads', primary: ['quadriceps'], secondary: [], equipment: 'machine', logType: 'weight_reps', reps: '12–15', restSec: 60, incrementKg: 5, met: S,
    cues: ['Knee lined up with the machine pivot', 'Squeeze at the top for a second', 'Lower slowly'], mistakes: ['Kicking the weight up', 'Hips lifting off the seat'], alternatives: ['leg_press'] },
  // Hamstrings, glutes & calves
  { id: 'romanian_deadlift', name: 'Romanian deadlift', group: 'hamstrings', primary: ['hamstring', 'gluteal'], secondary: ['lower-back'], equipment: 'barbell', logType: 'weight_reps', reps: '8–10', restSec: 120, incrementKg: 2.5, met: H,
    cues: ['Soft knees, push the hips back', 'Bar slides down the thighs', 'Stop when the hamstrings are stretched'], mistakes: ['Rounding the back to go lower', 'Turning it into a squat'], alternatives: ['leg_curl', 'hip_thrust'] },
  { id: 'leg_curl', name: 'Leg curl', group: 'hamstrings', primary: ['hamstring'], secondary: ['calves'], equipment: 'machine', logType: 'weight_reps', reps: '10–15', restSec: 60, incrementKg: 5, met: S,
    cues: ['Knee lined up with the pivot', 'Curl all the way', 'Lower under control'], mistakes: ['Hips lifting', 'Half range'], alternatives: ['romanian_deadlift'] },
  { id: 'hip_thrust', name: 'Hip thrust', group: 'hamstrings', primary: ['gluteal'], secondary: ['hamstring', 'quadriceps'], equipment: 'barbell', logType: 'weight_reps', reps: '8–12', restSec: 90, incrementKg: 5, met: S,
    cues: ['Upper back on a bench, bar padded', 'Chin tucked, ribs down', 'Squeeze glutes hard at the top'], mistakes: ['Arching the lower back at the top', 'Feet too far away'], alternatives: ['romanian_deadlift'] },
  { id: 'standing_calf_raise', name: 'Standing calf raise', group: 'hamstrings', primary: ['calves'], secondary: [], equipment: 'machine', logType: 'weight_reps', reps: '10–15', restSec: 60, incrementKg: 5, met: S,
    cues: ['Full stretch at the bottom', 'Rise to the big toe', 'Pause one second at the top'], mistakes: ['Bouncing', 'Bending the knees'], alternatives: [] },
  // Core
  { id: 'plank', name: 'Plank', group: 'core', primary: ['abs'], secondary: ['obliques'], equipment: 'bodyweight', logType: 'time', reps: '30–60 s', restSec: 60, incrementKg: 0, met: S,
    cues: ['Elbows under shoulders', 'Squeeze glutes, tuck the ribs', 'Breathe steadily'], mistakes: ['Hips sagging', 'Hips piked high'], alternatives: ['dead_bug', 'side_plank'] },
  { id: 'hanging_knee_raise', name: 'Hanging knee raise', group: 'core', primary: ['abs'], secondary: ['obliques', 'forearm'], equipment: 'bodyweight', logType: 'reps', reps: '10–15', restSec: 60, incrementKg: 0, met: S,
    cues: ['Dead hang, shoulders engaged', 'Curl the pelvis up, not just the knees', 'Lower slowly, no swing'], mistakes: ['Swinging', 'Only lifting the knees to hip height'], alternatives: ['cable_crunch'] },
  { id: 'cable_crunch', name: 'Cable crunch', group: 'core', primary: ['abs'], secondary: ['obliques'], equipment: 'cable', logType: 'weight_reps', reps: '10–15', restSec: 60, incrementKg: 2.5, met: S,
    cues: ['Kneel, rope by your head', 'Crunch ribs toward hips', 'Hips stay still'], mistakes: ['Pulling with the arms', 'Sitting back on the heels'], alternatives: ['hanging_knee_raise'] },
  { id: 'dead_bug', name: 'Dead bug', group: 'core', primary: ['abs'], secondary: ['obliques'], equipment: 'bodyweight', logType: 'reps', reps: '8–12 / side', restSec: 45, incrementKg: 0, met: S,
    cues: ['Lower back pressed to the floor', 'Extend opposite arm and leg slowly', 'Exhale as you reach'], mistakes: ['Back arching off the floor', 'Moving too fast'], alternatives: ['plank'] },
  { id: 'side_plank', name: 'Side plank', group: 'core', primary: ['obliques'], secondary: ['abs', 'gluteal'], equipment: 'bodyweight', logType: 'time', reps: '20–45 s / side', restSec: 45, incrementKg: 0, met: S,
    cues: ['Elbow under shoulder', 'Body in a straight line', 'Push the hip up'], mistakes: ['Hip dropping', 'Rolling forward'], alternatives: ['plank'] },
  // Cardio
  { id: 'incline_walk', name: 'Incline treadmill walk', group: 'cardio', primary: ['calves', 'gluteal'], secondary: ['hamstring'], equipment: 'cardio machine', logType: 'distance_time', reps: '20–30 min', restSec: 0, incrementKg: 0, met: 5.0,
    cues: ['Incline 8–12%, brisk pace', 'Let go of the handrails', 'Upright posture'], mistakes: ['Holding the rails (cuts the work)', 'Leaning back'], alternatives: ['stair_climber', 'stationary_bike'] },
  { id: 'stationary_bike', name: 'Stationary bike', group: 'cardio', primary: ['quadriceps'], secondary: ['gluteal', 'calves'], equipment: 'cardio machine', logType: 'distance_time', reps: '20–30 min', restSec: 0, incrementKg: 0, met: 6.0,
    cues: ['Seat at hip height', 'Knee slightly bent at the bottom', 'Steady cadence'], mistakes: ['Seat too low', 'Bouncing in the saddle'], alternatives: ['incline_walk', 'rowing_machine'] },
  { id: 'rowing_machine', name: 'Rowing machine', group: 'cardio', primary: ['upper-back', 'quadriceps'], secondary: ['biceps', 'gluteal', 'hamstring'], equipment: 'cardio machine', logType: 'distance_time', reps: '10–20 min', restSec: 0, incrementKg: 0, met: 5.0,
    cues: ['Legs, then back, then arms', 'Reverse on the way back', 'Chest tall'], mistakes: ['Pulling with arms first', 'Rounding the back'], alternatives: ['stationary_bike'] },
  { id: 'stair_climber', name: 'Stair climber', group: 'cardio', primary: ['gluteal', 'quadriceps'], secondary: ['calves'], equipment: 'cardio machine', logType: 'distance_time', reps: '15–20 min', restSec: 0, incrementKg: 0, met: 9.0,
    cues: ['Whole foot on each step', 'Light hands on the rails', 'Steady pace you can hold'], mistakes: ['Leaning on the rails', 'Tiptoe steps'], alternatives: ['incline_walk'] },
];

// Custom exercises (from the database) are registered here so every screen can look them up synchronously.
let CUSTOM: Exercise[] = [];
export function setCustomExercises(list: Exercise[]) {
  CUSTOM = list;
}
export const allExercises = () => [...EXERCISES, ...CUSTOM];
export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id) ?? CUSTOM.find((e) => e.id === id);

export function makeCustomExercise(row: { id: string; name: string; grp: string; equipment: string; log_type: string }): Exercise {
  const muscle: Record<string, MuscleSlug> = {
    chest: 'chest', back: 'upper-back', shoulders: 'deltoids', biceps: 'biceps', triceps: 'triceps',
    quads: 'quadriceps', hamstrings: 'hamstring', core: 'abs', cardio: 'quadriceps',
  };
  return {
    id: row.id, name: row.name, group: row.grp as Group, primary: [muscle[row.grp] ?? 'abs'], secondary: [],
    equipment: row.equipment as Exercise['equipment'], logType: row.log_type as LogType, reps: row.log_type === 'time' ? '30–60 s' : '8–12',
    restSec: row.grp === 'cardio' ? 0 : 90, incrementKg: row.log_type === 'weight_reps' || row.log_type === 'assisted' ? 2.5 : 0,
    met: row.grp === 'cardio' ? 6 : 3.5, cues: ['Your own exercise', 'Add cues in a later version', 'Log it like any other'],
    mistakes: ['—', '—'], alternatives: [],
  };
}

export function exercisesForMuscle(slug: string): Exercise[] {
  const all = allExercises();
  const primary = all.filter((e) => e.primary.includes(slug as MuscleSlug));
  const secondary = all.filter((e) => !e.primary.includes(slug as MuscleSlug) && e.secondary.includes(slug as MuscleSlug));
  return [...primary, ...secondary];
}

export const STARTER_TEMPLATES: { name: string; days: string; exercises: string[] }[] = [
  { name: 'Full Body A', days: '2–3 days a week, alternate with B', exercises: ['back_squat', 'bench_press_bb', 'barbell_row', 'lateral_raise', 'rope_pushdown', 'plank'] },
  { name: 'Full Body B', days: '2–3 days a week, alternate with A', exercises: ['romanian_deadlift', 'seated_db_press', 'lat_pulldown', 'leg_press', 'hammer_curl', 'hanging_knee_raise'] },
  { name: 'Upper', days: '4 days a week with Lower', exercises: ['bench_press_bb', 'barbell_row', 'seated_db_press', 'lat_pulldown', 'barbell_curl', 'rope_pushdown'] },
  { name: 'Lower', days: '4 days a week with Upper', exercises: ['back_squat', 'romanian_deadlift', 'leg_press', 'leg_curl', 'standing_calf_raise', 'cable_crunch'] },
];
