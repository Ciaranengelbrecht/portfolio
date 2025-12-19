/**
 * Comprehensive exercise -> muscle group mapping
 * Uses pattern matching to auto-assign muscle groups based on exercise names
 * 
 * Muscle Groups:
 * - chest: Pec major/minor exercises
 * - lats: Back width exercises (pulldowns, rows, pull-ups)
 * - traps: Upper back/neck (shrugs, upright rows, face pulls partial)
 * - delts: Front & lateral deltoids (overhead press, lateral raises, front raises)
 * - reardelts: Rear deltoids (rear delt fly, face pulls, reverse pec deck)
 * - triceps: All tricep isolation and pressing assistance
 * - biceps: All bicep exercises
 * - forearms: Wrist curls, grip work
 * - quads: Knee extension dominant (squats, leg press, leg extension)
 * - hamstrings: Knee flexion & hip hinge (leg curls, RDL)
 * - glutes: Hip extension focus (hip thrust, glute bridges)
 * - calves: Ankle plantar flexion
 * - core: Abs, obliques, lower back
 */

import { MuscleGroup } from './types';

interface MuscleMapping {
  primary: MuscleGroup;
  secondary?: MuscleGroup[];
}

type PatternMapping = [RegExp, MuscleMapping];

// Order matters - more specific patterns should come first
const EXERCISE_PATTERNS: PatternMapping[] = [
  // === CHEST ===
  [/bench\s*press|chest\s*press|push.?up/i, { primary: 'chest', secondary: ['triceps', 'delts'] }],
  [/incline.*press|incline.*db|incline.*dumbbell/i, { primary: 'chest', secondary: ['triceps', 'delts'] }],
  [/decline.*press/i, { primary: 'chest', secondary: ['triceps'] }],
  [/pec\s*deck|pec\s*fly|chest\s*fly|cable\s*fly|fly\s*machine/i, { primary: 'chest' }],
  [/dip(?!.*tricep)/i, { primary: 'chest', secondary: ['triceps', 'delts'] }],
  
  // === TRAPS (must come before general back patterns) ===
  [/shrug/i, { primary: 'traps' }],
  [/upright\s*row/i, { primary: 'traps', secondary: ['delts'] }],
  
  // === REAR DELTS (must come before general back/shoulder patterns) ===
  [/rear\s*delt|reverse\s*fly|reverse\s*pec/i, { primary: 'reardelts' }],
  [/face\s*pull/i, { primary: 'reardelts', secondary: ['traps'] }],
  
  // === LATS (Back Width) ===
  [/lat\s*pulldown|pull.?down|pulldown/i, { primary: 'lats', secondary: ['biceps', 'reardelts'] }],
  [/pull.?up|chin.?up/i, { primary: 'lats', secondary: ['biceps', 'reardelts'] }],
  [/row(?!.*upright)/i, { primary: 'lats', secondary: ['biceps', 'reardelts', 'traps'] }],
  [/cable\s*row|seated\s*row|chest\s*supported\s*row|single\s*arm\s*row|t.?bar|barbell\s*row/i, { primary: 'lats', secondary: ['biceps', 'reardelts'] }],
  [/deadlift(?!.*romanian|.*rdl|.*stiff)/i, { primary: 'lats', secondary: ['hamstrings', 'glutes', 'traps'] }],
  
  // === DELTS (Front & Lateral) ===
  [/lateral\s*raise|side\s*raise|lat\s*raise/i, { primary: 'delts' }],
  [/front\s*raise/i, { primary: 'delts' }],
  [/overhead\s*press|ohp|military\s*press|shoulder\s*press|arnold\s*press/i, { primary: 'delts', secondary: ['triceps', 'traps'] }],
  [/db\s*press.*shoulder|dumbbell\s*press.*shoulder/i, { primary: 'delts', secondary: ['triceps'] }],
  
  // === TRICEPS ===
  [/tricep|pushdown|push.?down|skull\s*crush|close\s*grip|cgbp|overhead\s*extension|triceps/i, { primary: 'triceps' }],
  [/dip.*tricep/i, { primary: 'triceps', secondary: ['chest'] }],
  [/kickback/i, { primary: 'triceps' }],
  
  // === BICEPS ===
  [/curl(?!.*leg|.*ham|.*nordic)/i, { primary: 'biceps' }],
  [/bicep|bayesian|preacher|concentration|incline.*curl|hammer.*curl|ez.*curl|barbell.*curl/i, { primary: 'biceps' }],
  
  // === FOREARMS ===
  [/wrist\s*curl|forearm|reverse\s*curl|grip/i, { primary: 'forearms' }],
  
  // === QUADS ===
  [/squat(?!.*split)/i, { primary: 'quads', secondary: ['glutes', 'hamstrings'] }],
  [/leg\s*press/i, { primary: 'quads', secondary: ['glutes'] }],
  [/hack\s*squat/i, { primary: 'quads', secondary: ['glutes'] }],
  [/leg\s*extension|quad\s*extension/i, { primary: 'quads' }],
  [/lunge|split\s*squat|bulgarian/i, { primary: 'quads', secondary: ['glutes', 'hamstrings'] }],
  [/step.?up/i, { primary: 'quads', secondary: ['glutes'] }],
  [/sissy\s*squat/i, { primary: 'quads' }],
  
  // === HAMSTRINGS ===
  [/leg\s*curl|ham.*curl|seated.*curl|lying.*curl|nordic/i, { primary: 'hamstrings' }],
  [/rdl|romanian|stiff.?leg/i, { primary: 'hamstrings', secondary: ['glutes', 'lats'] }],
  [/good\s*morning/i, { primary: 'hamstrings', secondary: ['glutes', 'lats'] }],
  
  // === GLUTES ===
  [/hip\s*thrust|glute\s*bridge|glute\s*drive/i, { primary: 'glutes', secondary: ['hamstrings'] }],
  [/kickback.*glute|glute.*kickback|cable\s*pull.?through/i, { primary: 'glutes' }],
  [/hip\s*abduct|abductor/i, { primary: 'glutes' }],
  [/hip\s*adduct|adductor/i, { primary: 'glutes' }],
  
  // === CALVES ===
  [/calf|calve|gastrocnemius|soleus/i, { primary: 'calves' }],
  [/toe\s*raise|toe\s*press/i, { primary: 'calves' }],
  
  // === CORE ===
  [/ab\s*wheel|ab.*roll/i, { primary: 'core' }],
  [/crunch|sit.?up|leg\s*raise|hanging.*raise|plank|dead\s*bug|pallof|wood\s*chop/i, { primary: 'core' }],
  [/cable\s*crunch|decline.*crunch|reverse\s*crunch/i, { primary: 'core' }],
  [/oblique|side\s*bend|russian\s*twist/i, { primary: 'core' }],
  [/back\s*extension|hyper.*extension/i, { primary: 'core', secondary: ['hamstrings', 'glutes'] }],
];

/**
 * Determine muscle group from exercise name using pattern matching
 */
export function getMuscleGroupFromName(exerciseName: string): MuscleMapping {
  const name = exerciseName.toLowerCase().trim();
  
  for (const [pattern, mapping] of EXERCISE_PATTERNS) {
    if (pattern.test(name)) {
      return mapping;
    }
  }
  
  // Default fallback
  return { primary: 'other' };
}

/**
 * Get primary muscle group for an exercise
 */
export function getPrimaryMuscle(exerciseName: string): MuscleGroup {
  return getMuscleGroupFromName(exerciseName).primary;
}

/**
 * Get secondary muscles for an exercise
 */
export function getSecondaryMuscles(exerciseName: string): MuscleGroup[] {
  return getMuscleGroupFromName(exerciseName).secondary || [];
}

/**
 * Auto-correct muscle group assignment for an exercise
 * Returns updated exercise if correction needed, null otherwise
 */
export function autoCorrectExerciseMuscle(exercise: { name: string; muscleGroup: MuscleGroup; secondaryMuscles?: MuscleGroup[] }): {
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
} | null {
  const mapping = getMuscleGroupFromName(exercise.name);
  
  // Check if correction needed
  const needsCorrection = 
    exercise.muscleGroup !== mapping.primary ||
    JSON.stringify(exercise.secondaryMuscles?.sort()) !== JSON.stringify(mapping.secondary?.sort());
  
  if (needsCorrection) {
    return {
      muscleGroup: mapping.primary,
      secondaryMuscles: mapping.secondary,
    };
  }
  
  return null;
}
