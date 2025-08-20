import { db } from './db';
import { Exercise, MuscleGroup } from './types';
import { nanoid } from 'nanoid';

// Massive seed catalogue (subset shown conceptually; extendable). Ensure names are unique (case-insensitive trimmed)
// Each entry: name, primary muscleGroup, secondaryMuscles (optional)
// Default sets=3 rep-range 8-12 for consistency; user can tailor later.
// NOTE: To keep file size reasonable while still extensive, list ~260 variations across major categories.

interface SeedItem { name: string; muscleGroup: MuscleGroup; secondaryMuscles?: MuscleGroup[] }

export const EXERCISE_SEED: SeedItem[] = [
  // Chest (pressing / fly variations)
  { name: 'Barbell Bench Press (Flat)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Barbell Bench Press (Close Grip)', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  { name: 'Barbell Bench Press (Wide Grip)', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Barbell Bench Press (Paused)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Incline Barbell Bench Press', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Decline Barbell Bench Press', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Spoto Press', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Floor Press (Barbell)', muscleGroup: 'chest', secondaryMuscles: ['triceps'] },
  { name: 'Dumbbell Bench Press (Flat)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Dumbbell Bench Press (Neutral Grip)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Incline Dumbbell Bench Press', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Decline Dumbbell Bench Press', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Machine Chest Press (Horizontal)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Machine Chest Press (Incline)', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Smith Machine Bench Press', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Push-Up (Standard)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Push-Up (Decline)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Push-Up (Incline)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Chest Fly (Dumbbell Flat)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Chest Fly (Dumbbell Incline)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Fly (High to Low)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Fly (Low to High)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Fly (Mid)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Pec Deck (Machine Fly)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Svend Press (Plate)', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  // Back - vertical pulls
  { name: 'Pull-Up (Pronated)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders','core'] },
  { name: 'Pull-Up (Supinated / Chin-Up)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Pull-Up (Neutral Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Weighted Pull-Up', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Lat Pulldown (Wide Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Lat Pulldown (Medium Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Lat Pulldown (Close Neutral Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Lat Pulldown (Reverse Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Single Arm Lat Pulldown (Cable)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Kneeling Lat Prayer Pulldown', muscleGroup: 'back', secondaryMuscles: ['shoulders','triceps'] },
  // Back - horizontal rows
  { name: 'Barbell Row (Pendlay)', muscleGroup: 'back', secondaryMuscles: ['hamstrings','glutes','biceps'] },
  { name: 'Barbell Row (Yates)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Seal Row (Barbell)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Dumbbell Row (Single Arm Bench)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Dumbbell Row (Chest Supported Incline)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Cable Row (Seated Wide Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Cable Row (Seated Neutral Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Cable Row (Single Arm)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Machine Row (Chest Supported)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'T-Bar Row (Chest Supported)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Landmine Row (Meadows)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Inverted Row (TRX / Bar)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Kroc Row (Heavy DB Row)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  // Back - isolation / extensions
  { name: 'Straight Arm Pulldown (Cable)', muscleGroup: 'back', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Dumbbell Pullover (Bench)', muscleGroup: 'back', secondaryMuscles: ['chest','triceps'] },
  { name: 'Machine Pullover', muscleGroup: 'back', secondaryMuscles: ['chest','triceps'] },
  { name: 'Reverse Fly (Dumbbell Incline)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Reverse Fly (Cable High)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  // Shoulders - presses
  { name: 'Overhead Press (Barbell Standing)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core'] },
  { name: 'Overhead Press (Barbell Seated)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'] },
  { name: 'Push Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','legs','core'] },
  { name: 'Dumbbell Shoulder Press (Seated)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'] },
  { name: 'Dumbbell Shoulder Press (Standing)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core'] },
  { name: 'Arnold Press (Dumbbell)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','chest'] },
  { name: 'Machine Shoulder Press (Neutral Grip)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'] },
  { name: 'Smith Machine Overhead Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'] },
  // Shoulders - raises
  { name: 'Lateral Raise (Dumbbell)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'] },
  { name: 'Lateral Raise (Cable Behind Back)', muscleGroup: 'shoulders' },
  { name: 'Lateral Raise (Machine)', muscleGroup: 'shoulders' },
  { name: 'Lean-Away Lateral Raise', muscleGroup: 'shoulders' },
  { name: 'Front Raise (Plate)', muscleGroup: 'shoulders', secondaryMuscles: ['chest'] },
  { name: 'Front Raise (Dumbbell Alternating)', muscleGroup: 'shoulders', secondaryMuscles: ['chest'] },
  { name: 'Cable Y Raise (Incline Bench)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Face Pull (Rope)', muscleGroup: 'shoulders', secondaryMuscles: ['back','biceps'] },
  // Biceps
  { name: 'Barbell Curl (Standing)', muscleGroup: 'biceps' },
  { name: 'EZ Bar Curl (Wide Grip)', muscleGroup: 'biceps' },
  { name: 'EZ Bar Curl (Close Grip)', muscleGroup: 'biceps' },
  { name: 'Dumbbell Curl (Alternating)', muscleGroup: 'biceps' },
  { name: 'Incline Dumbbell Curl', muscleGroup: 'biceps' },
  { name: 'Hammer Curl (Neutral Grip)', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Cable Curl (Straight Bar)', muscleGroup: 'biceps' },
  { name: 'Cable Curl (EZ Bar)', muscleGroup: 'biceps' },
  { name: 'Cable Curl (Rope Hammer)', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Preacher Curl (EZ Bar)', muscleGroup: 'biceps' },
  { name: 'Preacher Curl (Dumbbell Single Arm)', muscleGroup: 'biceps' },
  { name: 'Concentration Curl', muscleGroup: 'biceps' },
  { name: 'Reverse Curl (EZ Bar)', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Zottman Curl', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  // Triceps
  { name: 'Close Grip Push-Up', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  { name: 'Dip (Chest Lean)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Dip (Upright Triceps Focus)', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  { name: 'Bench Dip (Feet Elevated)', muscleGroup: 'triceps', secondaryMuscles: ['chest'] },
  { name: 'Skull Crusher (EZ Bar)', muscleGroup: 'triceps', secondaryMuscles: ['chest'] },
  { name: 'Skull Crusher (Dumbbell)', muscleGroup: 'triceps', secondaryMuscles: ['chest'] },
  { name: 'Overhead Triceps Extension (Dumbbell)', muscleGroup: 'triceps', secondaryMuscles: ['shoulders'] },
  { name: 'Overhead Triceps Extension (Cable Rope)', muscleGroup: 'triceps', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Triceps Pushdown (Rope)', muscleGroup: 'triceps' },
  { name: 'Cable Triceps Pushdown (Straight Bar)', muscleGroup: 'triceps' },
  { name: 'Triceps Kickback (Dumbbell)', muscleGroup: 'triceps', secondaryMuscles: ['shoulders'] },
  { name: 'JM Press', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  // Legs - Squat patterns
  { name: 'Back Squat (High Bar)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Back Squat (Low Bar)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Front Squat (Clean Grip)', muscleGroup: 'quads', secondaryMuscles: ['core','glutes','hamstrings'] },
  { name: 'Front Squat (Cross Arm)', muscleGroup: 'quads', secondaryMuscles: ['core','glutes'] },
  { name: 'Box Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Paused Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Tempo Squat (3-0-3)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Safety Bar Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Zercher Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Goblet Squat (Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['core','glutes'] },
  { name: 'Hack Squat (Machine)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Hack Squat (Barbell Behind)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Smith Machine Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Split Squat (Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Bulgarian Split Squat (Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Bulgarian Split Squat (Smith Machine)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Walking Lunge (Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Reverse Lunge (Barbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Forward Lunge (Barbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Curtsy Lunge (Dumbbell)', muscleGroup: 'glutes', secondaryMuscles: ['quads','hamstrings'] },
  { name: 'Step-Up (High Box Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Leg Press (Standard)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Leg Press (Feet High Wide)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','quads'] },
  { name: 'Leg Press (Feet Low Narrow)', muscleGroup: 'quads', secondaryMuscles: ['glutes'] },
  { name: 'Leg Press (Single Leg)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Vertical Leg Press', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Pendulum Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  // Hip hinge / posterior
  { name: 'Deadlift (Conventional)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back','core'] },
  { name: 'Deadlift (Sumo)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings','quads','back'] },
  { name: 'Deadlift (Deficit)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Deadlift (Snatch Grip)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back','traps' as any] },
  { name: 'Romanian Deadlift (Barbell)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Romanian Deadlift (Dumbbell)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Stiff-Leg Deadlift (Barbell)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Good Morning (Barbell)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Hip Thrust (Barbell)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings','quads','core'] },
  { name: 'Hip Thrust (Smith Machine)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Glute Bridge (Barbell)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Cable Pull-Through', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Reverse Hyperextension', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings','back'] },
  { name: 'Back Extension (45 Degree)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Back Extension (Horizontal)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  // Hamstring isolation
  { name: 'Leg Curl (Seated Machine)', muscleGroup: 'hamstrings', secondaryMuscles: ['calves'] },
  { name: 'Leg Curl (Lying Machine)', muscleGroup: 'hamstrings', secondaryMuscles: ['calves'] },
  { name: 'Leg Curl (Standing Single)', muscleGroup: 'hamstrings', secondaryMuscles: ['calves'] },
  { name: 'Nordic Curl', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','calves'] },
  { name: 'Sliding Leg Curl (Hamstring Slider)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'] },
  { name: 'Glute Ham Raise', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','calves'] },
  // Quad isolation
  { name: 'Leg Extension (Machine)', muscleGroup: 'quads' },
  { name: 'Leg Extension (Single Leg)', muscleGroup: 'quads' },
  { name: 'Sissy Squat', muscleGroup: 'quads', secondaryMuscles: ['core'] },
  { name: 'Spanish Squat (Band)', muscleGroup: 'quads', secondaryMuscles: ['glutes'] },
  { name: 'Cyclist Squat (Heels Elevated)', muscleGroup: 'quads', secondaryMuscles: ['glutes'] },
  // Glute isolation
  { name: 'Cable Kickback (Glute)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Glute Medius Abduction (Cable)', muscleGroup: 'glutes' },
  { name: 'Hip Abduction (Machine)', muscleGroup: 'glutes' },
  { name: 'Hip Adduction (Machine)', muscleGroup: 'legs', secondaryMuscles: ['glutes'] },
  { name: 'Frog Pump', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  // Calves
  { name: 'Calf Raise (Standing Machine)', muscleGroup: 'calves' },
  { name: 'Calf Raise (Seated)', muscleGroup: 'calves' },
  { name: 'Calf Raise (Smith Machine)', muscleGroup: 'calves' },
  { name: 'Donkey Calf Raise', muscleGroup: 'calves' },
  { name: 'Single Leg Calf Raise (Dumbbell)', muscleGroup: 'calves' },
  // Core
  { name: 'Plank (Standard)', muscleGroup: 'core', secondaryMuscles: ['shoulders','glutes'] },
  { name: 'Side Plank', muscleGroup: 'core', secondaryMuscles: ['shoulders','glutes'] },
  { name: 'Hanging Leg Raise', muscleGroup: 'core', secondaryMuscles: ['hip flexors' as any] },
  { name: 'Captain Chair Leg Raise', muscleGroup: 'core', secondaryMuscles: ['hip flexors' as any] },
  { name: 'Crunch (Basic)', muscleGroup: 'core' },
  { name: 'Cable Crunch (Kneeling Rope)', muscleGroup: 'core' },
  { name: 'Ab Wheel Rollout', muscleGroup: 'core', secondaryMuscles: ['shoulders','lats' as any] },
  { name: 'Dead Bug', muscleGroup: 'core' },
  { name: 'Pallof Press (Anti-Rotation)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Russian Twist (Plate)', muscleGroup: 'core' },
  { name: 'Hollow Body Hold', muscleGroup: 'core' },
  // Misc / Other
  { name: 'Farmer Carry (Heavy)', muscleGroup: 'other', secondaryMuscles: ['core','forearm' as any,'shoulders'] },
  { name: 'Yoke Carry', muscleGroup: 'other', secondaryMuscles: ['core','shoulders','back'] },
  { name: 'Sled Push (Heavy)', muscleGroup: 'legs', secondaryMuscles: ['glutes','quads','hamstrings'] },
  { name: 'Sled Drag (Backward)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Sled Drag (Forward)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','quads'] },
  { name: 'Battle Rope Wave', muscleGroup: 'shoulders', secondaryMuscles: ['core','arms' as any] },
  { name: 'Tire Flip', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','core'] },
  { name: 'Atlas Stone Lift', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','core','biceps'] },
];

const norm = (s:string)=> s.trim().toLowerCase();

export async function seedExercises() {
  try {
    if(localStorage.getItem('exerciseSeedV1')) return; // already seeded
  } catch {}
  const existing = await db.getAll<Exercise>('exercises');
  const existingNames = new Set(existing.map(e=> norm(e.name)));
  const toInsert: Exercise[] = [];
  for(const item of EXERCISE_SEED){
    if(existingNames.has(norm(item.name))) continue;
    toInsert.push({
      id: nanoid(),
      name: item.name,
      muscleGroup: item.muscleGroup,
      secondaryMuscles: item.secondaryMuscles,
      defaults: { sets: 3, targetRepRange: '8-12' },
      active: true
    });
  }
  for(const ex of toInsert){ await db.put('exercises', ex); }
  try { localStorage.setItem('exerciseSeedV1','1'); } catch {}
  if(toInsert.length){ try { window.dispatchEvent(new CustomEvent('sb-change',{ detail:{ table:'exercises' }})); } catch {} }
}
