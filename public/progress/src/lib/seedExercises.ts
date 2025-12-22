import { db } from './db';
import { Exercise, MuscleGroup } from './types';
import { nanoid } from 'nanoid';
import { getMuscleGroupFromName } from './exerciseMuscleMap';

// Massive seed catalogue (subset shown conceptually; extendable). Ensure names are unique (case-insensitive trimmed)
// Each entry: name, primary muscleGroup, secondaryMuscles (optional)
// Default sets=3 rep-range 8-12 for consistency; user can tailor later.
// NOTE: To keep file size reasonable while still extensive, list ~260 variations across major categories.

interface SeedItem { name: string; muscleGroup: MuscleGroup; secondaryMuscles?: MuscleGroup[] }

const RAW_EXERCISE_SEED: SeedItem[] = [
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
/** Additional expansion list (V2) bringing catalogue toward 400+ entries */
const RAW_ADDITIONAL_EXERCISES_V2: SeedItem[] = [
  // Olympic lift derivatives
  { name: 'Power Clean', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','core'] },
  { name: 'Hang Power Clean', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','core'] },
  { name: 'Clean Pull', muscleGroup: 'legs', secondaryMuscles: ['glutes','back'] },
  { name: 'Snatch Grip High Pull', muscleGroup: 'back', secondaryMuscles: ['hamstrings','glutes'] },
  { name: 'Snatch Pull', muscleGroup: 'back', secondaryMuscles: ['hamstrings','glutes'] },
  { name: 'Muscle Clean', muscleGroup: 'legs', secondaryMuscles: ['glutes','back'] },
  // Specialty bar presses / rows
  { name: 'Swiss Bar Bench Press', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Swiss Bar Overhead Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core'] },
  { name: 'Trap Bar Deadlift (High Handle)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back','quads'] },
  { name: 'Trap Bar Deadlift (Low Handle)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back','quads'] },
  { name: 'Trap Bar Carry', muscleGroup: 'other', secondaryMuscles: ['core','back','forearm' as any] },
  // Smith / Machine variants
  { name: 'Smith Machine Incline Bench', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Smith Machine RDL', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Smith Machine Calf Raise', muscleGroup: 'calves' },
  { name: 'Smith Machine Split Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Lever Row (Machine)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Chest Supported Machine Row (Neutral Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Hammer Strength Chest Press', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Hammer Strength Incline Press', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Hammer Strength Row', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Hammer Strength High Row', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Pendulum Squat (Machine)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Belt Squat (Machine)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  // Cable / unilateral & isolation expansion
  { name: 'Cable Lateral Raise (Single Arm)', muscleGroup: 'shoulders' },
  { name: 'Cable Lateral Raise (Dual)', muscleGroup: 'shoulders' },
  { name: 'Cable Chest Press (Standing)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Cable Chest Fly (Standing Mid)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Chest Fly (Low to High Single Arm)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Chest Fly (High to Low Single Arm)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Rear Delt Fly (Bent Over)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Cable Curl (Single Arm)', muscleGroup: 'biceps' },
  { name: 'Cable Overhead Triceps Extension (Single Arm)', muscleGroup: 'triceps' },
  { name: 'Cable Kickback (Single Arm)', muscleGroup: 'triceps' },
  { name: 'Cable Hip Abduction (Standing)', muscleGroup: 'glutes' },
  { name: 'Cable Hip Adduction (Standing)', muscleGroup: 'legs', secondaryMuscles: ['glutes'] },
  { name: 'Cable Woodchopper (High to Low)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Woodchopper (Low to High)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Pallof Press (Half Kneeling)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Romanian Deadlift', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'] },
  // Bodyweight / calisthenics expansion
  { name: 'Chin-Up (Weighted)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Pull-Up (Wide Grip Weighted)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Push-Up (Weighted Plate)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Ring Dip', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Ring Push-Up', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Ring Row', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Inverted Row (Feet Elevated)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Nordic Curl (Assisted Band)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'] },
  { name: 'Pistol Squat (Assisted)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Pistol Squat (Full)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Handstand Push-Up (Wall)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core'] },
  // Conditioning / carries / sleds
  { name: 'Farmer Carry (Trap Bar)', muscleGroup: 'other', secondaryMuscles: ['core','forearm' as any,'shoulders'] },
  { name: 'Sandbag Carry', muscleGroup: 'other', secondaryMuscles: ['core','back','glutes'] },
  { name: 'Sandbag Clean', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','core'] },
  { name: 'Sled Push (Light Speed)', muscleGroup: 'legs', secondaryMuscles: ['glutes','quads','hamstrings'] },
  { name: 'Sled Drag (Lateral)', muscleGroup: 'legs', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Yoke Carry (Run)', muscleGroup: 'other', secondaryMuscles: ['core','back','shoulders'] },
  { name: 'Kettlebell Swing (Russian)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','core'] },
  { name: 'Kettlebell Swing (American)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','core','shoulders'] },
  { name: 'Kettlebell Clean and Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core','glutes'] },
  { name: 'Kettlebell Snatch', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core','glutes'] },
  { name: 'Kettlebell Goblet Lateral Lunge', muscleGroup: 'legs', secondaryMuscles: ['glutes','hamstrings','core'] },
  // Plyometric / explosive
  { name: 'Box Jump', muscleGroup: 'legs', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Broad Jump', muscleGroup: 'legs', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Depth Jump', muscleGroup: 'legs', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Med Ball Slam', muscleGroup: 'core', secondaryMuscles: ['shoulders','back'] },
  { name: 'Med Ball Rotational Throw', muscleGroup: 'core', secondaryMuscles: ['shoulders','back'] },
  { name: 'Med Ball Chest Pass', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  // Rotator cuff / prehab
  { name: 'Cable External Rotation (Elbow 90)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Cable Internal Rotation (Elbow 90)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Band Pull-Apart', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Cuban Press', muscleGroup: 'shoulders', secondaryMuscles: ['back','triceps'] },
  { name: 'Scap Push-Up', muscleGroup: 'chest', secondaryMuscles: ['shoulders','core'] },
  // Core expansion
  { name: 'Hanging Knee Raise (Captain Chair)', muscleGroup: 'core', secondaryMuscles: ['hip flexors' as any] },
  { name: 'Reverse Crunch', muscleGroup: 'core' },
  { name: 'Dragon Flag (Progression)', muscleGroup: 'core', secondaryMuscles: ['shoulders','lats' as any] },
  { name: 'Cable Anti-Rotation Press (Standing)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Ab Wheel Rollout (Knees Elevated)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Weighted Plank (Plate Back)', muscleGroup: 'core', secondaryMuscles: ['shoulders','glutes'] },
  { name: 'Stir the Pot (Swiss Ball)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  // Glute / posterior chain extras
  { name: 'Single Leg Hip Thrust (Bench)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Single Leg RDL (Dumbbell)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','core'] },
  { name: 'Single Leg RDL (Barbell)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','core'] },
  { name: 'Cable Glute Pull-Through (Kneeling)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: '45 Degree Back Extension (Glute Bias)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings','back'] },
  // Arms extra isolation
  { name: 'Dumbbell Spider Curl', muscleGroup: 'biceps' },
  { name: 'Machine Preacher Curl', muscleGroup: 'biceps' },
  { name: 'Incline Hammer Curl', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Cable Reverse Curl (Straight Bar)', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Overhead Cable Curl', muscleGroup: 'biceps' },
  { name: 'Machine Dip Press', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  { name: 'Cable Triceps Extension (Straight Bar)', muscleGroup: 'triceps' },
  { name: 'Cable Triceps Extension (V Bar)', muscleGroup: 'triceps' },
  { name: 'Reverse Grip Triceps Pushdown', muscleGroup: 'triceps' },
  // Shoulder isolation extras
  { name: 'Dumbbell Upright Row (Wide Grip)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','back'] },
  { name: 'Cable Upright Row', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Machine Reverse Fly', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Incline Y Raise (Dumbbell)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  // Misc strongman / odd object
  { name: 'Sandbag Over Shoulder', muscleGroup: 'other', secondaryMuscles: ['glutes','back','core'] },
  { name: 'Sandbag to Shoulder (Alternating)', muscleGroup: 'other', secondaryMuscles: ['glutes','back','core'] },
  { name: 'Keg Carry', muscleGroup: 'other', secondaryMuscles: ['core','back','glutes'] },
  { name: 'Log Press (Clean and Press)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core','glutes'] },
  { name: 'Farmer Carry (Uneven)', muscleGroup: 'other', secondaryMuscles: ['core','forearm' as any,'shoulders'] },
  { name: 'Sled Row (Cable / Strap)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Sled Chest Press (Horizontal)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
];

/** Comprehensive expansion (V3) – broad coverage of common gym movements across equipment & variations */
const RAW_ADDITIONAL_EXERCISES_V3: SeedItem[] = [
  // Chest - additional presses
  { name: 'Barbell Bench Press (Touch and Go)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Barbell Bench Press (2-Count Pause)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Barbell Bench Press (Reverse Band)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Barbell Bench Press (Slingshot)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Barbell Bench Press (Board 2")', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Barbell Bench Press (Board 3")', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Close Grip Bench Press (Barbell)', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  { name: 'Wide Grip Bench Press (Barbell)', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Incline Bench Press (Dumbbell Neutral)', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps'] },
  { name: 'Decline Bench Press (Dumbbell)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Machine Chest Press (Converging)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Machine Chest Press (Decline)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Machine Chest Press (Vertical)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Smith Machine Bench Press (Incline)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Smith Machine Bench Press (Decline)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders'] },
  { name: 'Landmine Chest Press (Single Arm)', muscleGroup: 'chest', secondaryMuscles: ['shoulders','triceps','core'] },
  { name: 'Push-Up (Wide Grip)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Push-Up (Diamond)', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders','core'] },
  { name: 'Push-Up (Archer)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Push-Up (Deficit Parallettes)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Push-Up (Ring)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  { name: 'Push-Up (Plyometric)', muscleGroup: 'chest', secondaryMuscles: ['triceps','shoulders','core'] },
  // Chest - fly & adduction variants
  { name: 'Dumbbell Fly (Flat)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Dumbbell Fly (Incline)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Dumbbell Fly (Decline)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Dumbbell Fly (Stretch Focus)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Fly (High to Low Single Arm)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Fly (Low to High Single Arm)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Crossover (High to Low)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Crossover (Low to High)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Crossover (Mid)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Crossover (Single Arm High to Low)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Crossover (Single Arm Low to High)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Pec Deck (Reverse Grip Fly)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Machine Fly (Converging)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  { name: 'Machine Fly (Neutral Seat High)', muscleGroup: 'chest', secondaryMuscles: ['shoulders'] },
  // Back - pull-up / pulldown variations
  { name: 'Pull-Up (Wide)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Pull-Up (Close Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Pull-Up (Towel Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps','forearm' as any] },
  { name: 'Pull-Up (Thick Bar)', muscleGroup: 'back', secondaryMuscles: ['biceps','forearm' as any] },
  { name: 'Chin-Up (Close)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Lat Pulldown (Behind Neck)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Lat Pulldown (Underhand Close)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Lat Pulldown (Underhand Wide)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Lat Pulldown (Single Arm Kneeling)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Assisted Pull-Up (Machine)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Assisted Dip (Machine)', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  // Back - row variations
  { name: 'Barbell Row (Conventional)', muscleGroup: 'back', secondaryMuscles: ['biceps','hamstrings','glutes'] },
  { name: 'Barbell Row (Underhand)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Barbell Row (Wide Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Barbell Row (Paused)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Barbell Row (Chest Supported T-Bar)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Dumbbell Row (Kroc)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Dumbbell Row (Elbow Out)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders'] },
  { name: 'Cable Row (Wide Neutral Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Cable Row (Underhand)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Cable Row (High Row Kneeling)', muscleGroup: 'back', secondaryMuscles: ['biceps','shoulders','core'] },
  { name: 'Cable Row (Single Arm Chest Supported)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Machine Row (Iso-Lateral Single Arm)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Machine Row (Underhand)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'T-Bar Row (Meadows)', muscleGroup: 'back', secondaryMuscles: ['biceps'] },
  { name: 'Landmine Row (Single Arm)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Inverted Row (Supinated)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  { name: 'Inverted Row (Wide Grip)', muscleGroup: 'back', secondaryMuscles: ['biceps','core'] },
  // Back - isolation / rear delt / traps
  { name: 'Reverse Pec Deck (Rear Delt)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Rear Delt Raise (Incline Prone)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Rear Delt Row (Cable)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Face Pull (Low to High)', muscleGroup: 'shoulders', secondaryMuscles: ['back','biceps'] },
  { name: 'Prone Y Raise (Incline)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Prone T Raise (Incline)', muscleGroup: 'shoulders', secondaryMuscles: ['back'] },
  { name: 'Barbell Shrug', muscleGroup: 'back', secondaryMuscles: ['shoulders'] },
  { name: 'Dumbbell Shrug', muscleGroup: 'back', secondaryMuscles: ['shoulders'] },
  { name: 'Trap Bar Shrug', muscleGroup: 'back', secondaryMuscles: ['shoulders'] },
  { name: 'Smith Machine Shrug', muscleGroup: 'back', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Shrug', muscleGroup: 'back', secondaryMuscles: ['shoulders'] },
  // Shoulders - presses / specialty
  { name: 'Overhead Press (Z Press)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core'] },
  { name: 'Overhead Press (Seated Dumbbell Neutral)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'] },
  { name: 'Push Jerk', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','legs','core'] },
  { name: 'Split Jerk', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','legs','core'] },
  { name: 'Behind Neck Press (Light)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'] },
  { name: 'Landmine Press (Half Kneeling)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','core'] },
  { name: 'Arnold Press (Seated)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','chest'] },
  // Shoulders - raises & isolation
  { name: 'Lateral Raise (Seated)', muscleGroup: 'shoulders' },
  { name: 'Lateral Raise (Leaning Cable)', muscleGroup: 'shoulders' },
  { name: 'Lateral Raise (Partial Heavy)', muscleGroup: 'shoulders' },
  { name: 'Front Raise (Barbell)', muscleGroup: 'shoulders', secondaryMuscles: ['chest'] },
  { name: 'Front Raise (Cable)', muscleGroup: 'shoulders', secondaryMuscles: ['chest'] },
  { name: 'Front Raise (Alternating Plate)', muscleGroup: 'shoulders', secondaryMuscles: ['chest'] },
  { name: 'Upright Row (Barbell Narrow)', muscleGroup: 'shoulders', secondaryMuscles: ['biceps','back'] },
  // Biceps - extensive
  { name: 'Barbell Curl (Strict)', muscleGroup: 'biceps' },
  { name: 'Barbell Curl (Cheat)', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Barbell Curl (Tempo Slow)', muscleGroup: 'biceps' },
  { name: 'Drag Curl (Barbell)', muscleGroup: 'biceps' },
  { name: 'Preacher Curl (Barbell)', muscleGroup: 'biceps' },
  { name: 'Preacher Curl (Machine)', muscleGroup: 'biceps' },
  { name: 'Dumbbell Curl (Supinating)', muscleGroup: 'biceps' },
  { name: 'Dumbbell Curl (Cross Body Hammer)', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Hammer Curl (Cable Rope)', muscleGroup: 'biceps', secondaryMuscles: ['forearm' as any] },
  { name: 'Cable Curl (High Pulley Overhead)', muscleGroup: 'biceps' },
  { name: 'Cable Curl (Bayesian Single Arm)', muscleGroup: 'biceps' },
  { name: 'Incline Curl (Dumbbell Supinating)', muscleGroup: 'biceps' },
  { name: 'Spider Curl (EZ Bar)', muscleGroup: 'biceps' },
  // Triceps - extensive
  { name: 'Close Grip Bench Press (Paused)', muscleGroup: 'triceps', secondaryMuscles: ['chest','shoulders'] },
  { name: 'Skull Crusher (Flat Bench EZ)', muscleGroup: 'triceps', secondaryMuscles: ['chest'] },
  { name: 'Skull Crusher (Incline EZ)', muscleGroup: 'triceps', secondaryMuscles: ['chest'] },
  { name: 'Overhead Triceps Extension (EZ Bar)', muscleGroup: 'triceps', secondaryMuscles: ['shoulders'] },
  { name: 'Overhead Triceps Extension (Cable Straight Bar)', muscleGroup: 'triceps', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Pushdown (V Bar)', muscleGroup: 'triceps' },
  { name: 'Cable Pushdown (Reverse Grip)', muscleGroup: 'triceps' },
  { name: 'Cable Pushdown (Single Arm)', muscleGroup: 'triceps' },
  { name: 'Dumbbell Kickback (Incline Bench)', muscleGroup: 'triceps' },
  { name: 'Tate Press', muscleGroup: 'triceps', secondaryMuscles: ['chest'] },
  // Forearms / grip (classified other)
  { name: 'Wrist Curl (Barbell)', muscleGroup: 'other' },
  { name: 'Reverse Wrist Curl (Barbell)', muscleGroup: 'other' },
  { name: 'Wrist Curl (Dumbbell Single)', muscleGroup: 'other' },
  { name: 'Farmer Hold (Heavy)', muscleGroup: 'other', secondaryMuscles: ['core','forearm' as any] },
  { name: 'Plate Pinch Hold', muscleGroup: 'other', secondaryMuscles: ['forearm' as any] },
  // Squat & knee dominant - more
  { name: 'Back Squat (Paused 2s)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Back Squat (Pin)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Front Squat (Paused)', muscleGroup: 'quads', secondaryMuscles: ['glutes','core'] },
  { name: 'Front Squat (Tempo)', muscleGroup: 'quads', secondaryMuscles: ['glutes','core'] },
  { name: 'Overhead Squat', muscleGroup: 'legs', secondaryMuscles: ['core','shoulders','back'] },
  { name: 'Smith Machine Front Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes','core'] },
  { name: 'Hack Squat (Reverse Foot)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Leg Press (Feet High Narrow)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','quads'] },
  { name: 'Leg Press (Feet Low Wide)', muscleGroup: 'quads', secondaryMuscles: ['glutes'] },
  { name: 'Leg Press (Calf Press)', muscleGroup: 'calves', secondaryMuscles: ['quads'] },
  { name: 'Walking Lunge (Barbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Forward Lunge (Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Reverse Lunge (Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Lateral Lunge (Dumbbell)', muscleGroup: 'legs', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Cossack Squat (Bodyweight)', muscleGroup: 'legs', secondaryMuscles: ['glutes','hamstrings','core'] },
  { name: 'Step-Up (Low Box Barbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Step-Up (Lateral Dumbbell)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Split Squat (Front Foot Elevated)', muscleGroup: 'quads', secondaryMuscles: ['glutes','hamstrings'] },
  // Hip hinge / posterior chain extended
  { name: 'Deadlift (Paused Below Knee)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Deadlift (Block Pull Mid-Shin)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Rack Pull (Above Knee)', muscleGroup: 'back', secondaryMuscles: ['glutes','hamstrings'] },
  { name: 'Romanian Deadlift (Tempo Slow)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Good Morning (Safety Bar)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Good Morning (Seated)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Hip Thrust (B-Stance)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Hip Thrust (Single Leg)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Glute Bridge (Single Leg)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Reverse Hyperextension (Single Leg)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings','back'] },
  { name: 'GHD Raise', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes','back'] },
  { name: 'Nordic Curl (Eccentric Only)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'] },
  { name: 'Leg Curl (Cable Standing)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'] },
  { name: 'Leg Curl (Slider Single)', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'] },
  // Glute isolation extras
  { name: 'Hip Abduction (Seated Machine Lean Forward)', muscleGroup: 'glutes' },
  { name: 'Cable Abduction (Side Lying)', muscleGroup: 'glutes' },
  { name: 'Glute Bridge (Band)', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'] },
  { name: 'Monster Walk (Band)', muscleGroup: 'glutes' },
  { name: 'Lateral Band Walk (Hip)', muscleGroup: 'glutes' },
  // Calves / lower leg
  { name: 'Leg Press Calf Raise', muscleGroup: 'calves' },
  { name: 'Seated Calf Raise (Machine)', muscleGroup: 'calves' },
  { name: 'Tibialis Raise (Wall Lean)', muscleGroup: 'other' },
  { name: 'Tibialis Raise (Plate Dorsiflexion)', muscleGroup: 'other' },
  // Core - anti rotation / extension / flexion
  { name: 'Pallof Press (Standing)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Pallof Press (Half Kneeling)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Pallof Press (Split Stance)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Cable Woodchopper (Horizontal)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Ab Wheel Rollout (Standing Partial)', muscleGroup: 'core', secondaryMuscles: ['shoulders'] },
  { name: 'Plank (RKC)', muscleGroup: 'core', secondaryMuscles: ['shoulders','glutes'] },
  { name: 'Plank (Weighted Plate)', muscleGroup: 'core', secondaryMuscles: ['shoulders','glutes'] },
  { name: 'Side Plank (Weighted)', muscleGroup: 'core', secondaryMuscles: ['shoulders','glutes'] },
  { name: 'Hanging Leg Raise (Toes to Bar)', muscleGroup: 'core', secondaryMuscles: ['hip flexors' as any] },
  { name: 'Hanging Knee Raise (Twist)', muscleGroup: 'core', secondaryMuscles: ['hip flexors' as any] },
  { name: 'Reverse Crunch (Decline Bench)', muscleGroup: 'core' },
  { name: 'V-Up', muscleGroup: 'core' },
  { name: 'Windshield Wiper (Hanging)', muscleGroup: 'core', secondaryMuscles: ['hip flexors' as any] },
  { name: 'Russian Twist (Medicine Ball)', muscleGroup: 'core' },
  { name: 'Dead Bug (Opposite Arm/Leg)', muscleGroup: 'core' },
  { name: 'Bird Dog', muscleGroup: 'core', secondaryMuscles: ['back'] },
  // Carries & loaded movement
  { name: 'Suitcase Carry (Single Dumbbell)', muscleGroup: 'other', secondaryMuscles: ['core','forearm' as any] },
  { name: 'Overhead Carry (Dumbbell)', muscleGroup: 'other', secondaryMuscles: ['core','shoulders'] },
  { name: 'Front Rack Carry (Kettlebells)', muscleGroup: 'other', secondaryMuscles: ['core','shoulders'] },
  { name: 'Waiter Carry (Single Arm)', muscleGroup: 'other', secondaryMuscles: ['core','shoulders'] },
  { name: 'Sandbag Shoulder Carry', muscleGroup: 'other', secondaryMuscles: ['core','back','glutes'] },
  // Olympic lifts / power
  { name: 'Clean and Jerk', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','shoulders','triceps','core'] },
  { name: 'Power Jerk', muscleGroup: 'legs', secondaryMuscles: ['glutes','shoulders','triceps','core'] },
  { name: 'Split Jerk (From Rack)', muscleGroup: 'legs', secondaryMuscles: ['glutes','shoulders','triceps','core'] },
  { name: 'Snatch', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','shoulders','triceps','core'] },
  { name: 'Power Snatch', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','shoulders','core'] },
  { name: 'Hang Snatch (High Hang)', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','shoulders','core'] },
  { name: 'Muscle Snatch', muscleGroup: 'legs', secondaryMuscles: ['glutes','back','shoulders'] },
  { name: 'Snatch Balance', muscleGroup: 'legs', secondaryMuscles: ['glutes','shoulders','core'] },
  { name: 'Push Press (Barbell)', muscleGroup: 'shoulders', secondaryMuscles: ['triceps','legs','core'] },
];

// Normalize legacy muscle labels to the new specific groups
const normalizeLegacyMuscle = (group?: string): MuscleGroup | undefined => {
  if (!group) return undefined;
  const lower = group.toLowerCase();
  if (lower === 'back') return 'lats';
  if (lower === 'shoulders') return 'delts';
  if (lower === 'legs') return 'quads';
  if (lower === 'forearm' || lower === 'forearms') return 'forearms';
  if (lower === 'hip flexors') return 'core';
  if (lower === 'arms') return 'biceps';
  return lower as MuscleGroup;
};

// Use pattern-based mapping as source of truth for seed data
const normalizeSeedItem = (item: SeedItem): SeedItem => {
  const mapping = getMuscleGroupFromName(item.name);
  if (mapping.primary !== 'other') {
    return {
      ...item,
      muscleGroup: mapping.primary,
      secondaryMuscles: mapping.secondary,
    };
  }

  // Fallback: normalize legacy labels on provided data
  const primary = normalizeLegacyMuscle(item.muscleGroup) ?? 'other';
  const secondary = item.secondaryMuscles
    ?.map(m => normalizeLegacyMuscle(m))
    .filter((m): m is MuscleGroup => Boolean(m));

  return { ...item, muscleGroup: primary, secondaryMuscles: secondary };
};

// Normalized exports consumed by seed routines
export const EXERCISE_SEED: SeedItem[] = RAW_EXERCISE_SEED.map(normalizeSeedItem);
const ADDITIONAL_EXERCISES_V2: SeedItem[] = RAW_ADDITIONAL_EXERCISES_V2.map(normalizeSeedItem);
const ADDITIONAL_EXERCISES_V3: SeedItem[] = RAW_ADDITIONAL_EXERCISES_V3.map(normalizeSeedItem);

// Basic tag inference (deterministic, idempotent)
function inferTags(name: string, mg: MuscleGroup, secondary?: MuscleGroup[]): string[] {
  const n = name.toLowerCase();
  const tags = new Set<string>();
  // Equipment
  if(/barbell|smith/.test(n)) tags.add('barbell');
  if(/dumbbell|db /.test(n) || /dumbbell/.test(n)) tags.add('dumbbell');
  if(/cable|rope|pulldown/.test(n)) tags.add('cable');
  if(/machine|lever|hammer strength|pendulum|belt squat/.test(n)) tags.add('machine');
  if(/kettlebell|kb /.test(n)) tags.add('kettlebell');
  if(/trap bar/.test(n)) tags.add('trap-bar');
  if(/sled/.test(n)) tags.add('sled');
  if(/sandbag/.test(n)) tags.add('sandbag');
  if(/ring/.test(n)) tags.add('rings');
  if(/band/.test(n)) tags.add('band');
  if(/bodyweight|push-up|pull-up|chin-up|plank|row \(trx|inverted row/.test(n)) tags.add('bodyweight');
  // Movement pattern
  if(/squat|split squat|pistol|lunge|step-up|pendulum squat|belt squat/.test(n)) tags.add('squat');
  if(/deadlift|rdl|good morning|clean|snatch|pull|hip thrust|glute bridge|swing/.test(n)) tags.add('hinge');
  if(/bench|press|push-up|dip|chest press|overhead press|log press|machine dip/.test(n)) tags.add('press');
  if(/row|pulldown|pull-up|chin-up|upright row|face pull|meadows/.test(n)) tags.add('pull');
  if(/curl/.test(n)) tags.add('curl');
  if(/extension|kickback|skull crusher|jm press/.test(n)) tags.add('extension');
  if(/fly/.test(n)) tags.add('fly');
  if(/raise/.test(n)) tags.add('raise');
  if(/carry|farmer|yoke|sandbag carry|keg carry|trap bar carry/.test(n)) tags.add('carry');
  if(/woodchopper|rotational throw/.test(n)) tags.add('rotation');
  if(/pallof|anti-rotation/.test(n)) tags.add('anti-rotation');
  if(/plank|hollow|stir the pot|dragon flag|ab wheel|dead bug/.test(n)) tags.add('anti-extension');
  if(/swing|jump|throw|slam/.test(n)) tags.add('power');
  // Directional / plane heuristics
  if(/pulldown|pull-up|chin-up|overhead press|handstand/.test(n)) tags.add('vertical');
  if(/row|bench|chest press|push-up/.test(n)) tags.add('horizontal');
  // Unilateral
  if(/single|split|bulgarian|lunge|step-up|pistol|kickback|one arm|single arm/.test(n)) tags.add('unilateral');
  // Core classification
  if(mg==='core' || tags.has('anti-rotation') || tags.has('anti-extension')) tags.add('core');
  // Compound vs isolation (rough)
  const isIsolation = /(curl|extension|raise|fly|kickback|pullover|abduction|adduction|rotation)/.test(n) && !/(squat|deadlift|press|row|pull-up|chin-up|lunge|clean|snatch|thrust|swing)/.test(n);
  tags.add(isIsolation? 'isolation':'compound');
  // Primary muscle group tag for filtering ease
  tags.add('mg:'+mg);
  (secondary||[]).forEach(s=> tags.add('sec:'+s));
  return Array.from(tags);
}

export async function seedExercises() {
  // Phase 1 seed (original list)
  const existing = await db.getAll<Exercise>('exercises');
  const existingByName = new Map(existing.map(e=> [norm(e.name), e]));
  if(!localStorage.getItem('exerciseSeedV1')){
    const toInsert: Exercise[] = [];
    for(const item of EXERCISE_SEED){
      if(existingByName.has(norm(item.name))) continue;
      const ex: Exercise = {
        id: nanoid(),
        name: item.name,
        muscleGroup: item.muscleGroup,
        secondaryMuscles: item.secondaryMuscles,
        defaults: { sets: 3, targetRepRange: '8-12' },
        active: true,
      };
      toInsert.push(ex);
      existingByName.set(norm(ex.name), ex);
    }
    for(const ex of toInsert) await db.put('exercises', ex);
    if(toInsert.length) try { localStorage.setItem('exerciseSeedV1','1'); } catch {}
  }

  // Phase 2: expansion + tag inference
  if(!localStorage.getItem('exerciseSeedV2')){
    const toInsert: Exercise[] = [];
    for(const item of ADDITIONAL_EXERCISES_V2){
      if(existingByName.has(norm(item.name))) continue;
      const ex: Exercise = {
        id: nanoid(),
        name: item.name,
        muscleGroup: item.muscleGroup,
        secondaryMuscles: item.secondaryMuscles,
        defaults: { sets: 3, targetRepRange: '8-12' },
        active: true,
      };
      toInsert.push(ex);
      existingByName.set(norm(ex.name), ex);
    }
    for(const ex of toInsert) await db.put('exercises', ex);
    // Infer & attach tags for ALL (existing + new) where missing or outdated
    const allNow = await db.getAll<Exercise>('exercises');
    let updatedCount = 0;
    for(const ex of allNow){
      const inferred = inferTags(ex.name, ex.muscleGroup, ex.secondaryMuscles);
      // Merge (avoid overwrite of custom tags later?) For first pass just set if empty
      if(!ex.tags || ex.tags.length===0){
        const next = { ...ex, tags: inferred };
        await db.put('exercises', next);
        updatedCount++;
      }
    }
    if(toInsert.length || updatedCount){
      try { localStorage.setItem('exerciseSeedV2','1'); } catch {}
      try { window.dispatchEvent(new CustomEvent('sb-change',{ detail:{ table:'exercises' }})); } catch {}
    }
  }
  // Phase 3: comprehensive expansion
  if(!localStorage.getItem('exerciseSeedV3')){
    const toInsert: Exercise[] = [];
    for(const item of ADDITIONAL_EXERCISES_V3){
      if(existingByName.has(norm(item.name))) continue;
      const ex: Exercise = { id: nanoid(), name: item.name, muscleGroup: item.muscleGroup, secondaryMuscles: item.secondaryMuscles, defaults:{ sets:3, targetRepRange:'8-12' }, active:true };
      toInsert.push(ex); existingByName.set(norm(ex.name), ex);
    }
    for(const ex of toInsert) await db.put('exercises', ex);
    if(toInsert.length){
      // Tag inference for new ones only (existing already tagged in V2 step)
      for(const ex of toInsert){
        const inferred = inferTags(ex.name, ex.muscleGroup, ex.secondaryMuscles);
        const next = { ...ex, tags: inferred };
        await db.put('exercises', next);
      }
      try { localStorage.setItem('exerciseSeedV3','1'); } catch {}
      try { window.dispatchEvent(new CustomEvent('sb-change',{ detail:{ table:'exercises' }})); } catch {}
    }
  }

  // Phase 4: Muscle group specificity migration (back->lats, shoulders->delts/reardelts/traps)
  // Uses pattern matching to auto-correct muscle groups based on exercise names
  if(!localStorage.getItem('exerciseSeedV4')){
    const allExercises = await db.getAll<Exercise>('exercises');
    let updatedCount = 0;
    for(const ex of allExercises){
      const mapping = getMuscleGroupFromName(ex.name);
      // Only update if pattern matched something specific (not 'other' fallback)
      if(mapping.primary !== 'other'){
        const needsUpdate = 
          ex.muscleGroup !== mapping.primary ||
          JSON.stringify(ex.secondaryMuscles?.sort()) !== JSON.stringify(mapping.secondary?.sort());
        
        if(needsUpdate){
          const updated: Exercise = {
            ...ex,
            muscleGroup: mapping.primary,
            secondaryMuscles: mapping.secondary,
            // Re-infer tags with new muscle group
            tags: inferTags(ex.name, mapping.primary, mapping.secondary),
          };
          await db.put('exercises', updated);
          updatedCount++;
        }
      }
    }
    if(updatedCount > 0){
      console.log(`[seedExercises] V4 migration: Updated ${updatedCount} exercises with specific muscle groups`);
      try { window.dispatchEvent(new CustomEvent('sb-change',{ detail:{ table:'exercises' }})); } catch {}
    }
    try { localStorage.setItem('exerciseSeedV4','1'); } catch {}
  }

  // Phase 5: CORRECTED muscle group mappings - re-run pattern matching with fixed patterns
  // Key fix: Triceps patterns now checked BEFORE lats patterns to prevent pushdowns from matching pulldowns
  if(!localStorage.getItem('exerciseSeedV5')){
    const allExercises = await db.getAll<Exercise>('exercises');
    let updatedCount = 0;
    for(const ex of allExercises){
      const mapping = getMuscleGroupFromName(ex.name);
      // Only update if pattern matched something specific (not 'other' fallback)
      if(mapping.primary !== 'other'){
        const needsUpdate = 
          ex.muscleGroup !== mapping.primary ||
          JSON.stringify(ex.secondaryMuscles?.sort()) !== JSON.stringify(mapping.secondary?.sort());
        
        if(needsUpdate){
          const updated: Exercise = {
            ...ex,
            muscleGroup: mapping.primary,
            secondaryMuscles: mapping.secondary,
            // Re-infer tags with new muscle group
            tags: inferTags(ex.name, mapping.primary, mapping.secondary),
          };
          await db.put('exercises', updated);
          updatedCount++;
        }
      }
    }
    if(updatedCount > 0){
      console.log(`[seedExercises] V5 migration: Corrected ${updatedCount} exercises with fixed muscle group patterns`);
      try { window.dispatchEvent(new CustomEvent('sb-change',{ detail:{ table:'exercises' }})); } catch {}
    }
    try { localStorage.setItem('exerciseSeedV5','1'); } catch {}
  }
}
