/**
 * Comprehensive exercise -> muscle group mapping
 * Uses pattern matching to auto-assign muscle groups based on exercise names
 * 
 * ISOLATION exercises = PRIMARY MUSCLE ONLY (no secondary)
 * COMPOUND exercises = PRIMARY + SECONDARY muscles
 * 
 * Muscle Groups:
 * - chest: Pec major/minor exercises
 * - lats: Back width exercises (pulldowns, rows, pull-ups)
 * - traps: Upper back/neck (shrugs, upright rows)
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

// Order matters - more specific patterns MUST come first
// IMPORTANT: Triceps patterns must come BEFORE any patterns containing "down"
const EXERCISE_PATTERNS: PatternMapping[] = [
  // ========================================
  // === TRICEPS (ISOLATION - must be first to catch pushdown before lats patterns) ===
  // ========================================
  [/tricep.*pushdown|triceps.*pushdown|pushdown.*tricep/i, { primary: 'triceps' }], // Specific tricep pushdowns
  [/cable.*pushdown|rope.*pushdown|bar.*pushdown|v.?bar.*pushdown/i, { primary: 'triceps' }], // Cable pushdowns
  [/pushdown|push.?down/i, { primary: 'triceps' }], // Generic pushdowns = triceps isolation
  [/tricep.*extension|triceps.*extension|overhead.*extension/i, { primary: 'triceps' }], // Tricep extensions
  [/skull\s*crush|skullcrusher/i, { primary: 'triceps' }], // Skull crushers
  [/tricep.*kickback|kickback/i, { primary: 'triceps' }], // Kickbacks
  [/close\s*grip.*bench|cgbp/i, { primary: 'triceps', secondary: ['chest'] }], // Close grip bench (compound)
  [/tricep.*dip|dip.*tricep/i, { primary: 'triceps', secondary: ['chest'] }], // Tricep focused dips
  [/french\s*press/i, { primary: 'triceps' }], // French press
  [/jm\s*press/i, { primary: 'triceps', secondary: ['chest'] }], // JM Press
  
  // ========================================
  // === BICEPS (ISOLATION) ===
  // ========================================
  [/bicep|biceps/i, { primary: 'biceps' }], // Anything with bicep in name
  [/(?<!leg.{0,20})(?<!ham.{0,20})(?<!nordic.{0,20})(?<!wrist.{0,20})curl(?!.*leg)(?!.*ham)(?!.*nordic)(?!.*wrist)/i, { primary: 'biceps' }], // Curls (not leg/ham/wrist curls)
  [/bayesian/i, { primary: 'biceps' }], // Bayesian curl
  [/preacher/i, { primary: 'biceps' }], // Preacher curl
  [/concentration/i, { primary: 'biceps' }], // Concentration curl
  [/hammer.*curl|hammer\s*curl/i, { primary: 'biceps' }], // Hammer curls
  [/ez.*curl|ez\s*bar/i, { primary: 'biceps' }], // EZ bar curls
  [/spider.*curl/i, { primary: 'biceps' }], // Spider curls
  [/incline.*curl/i, { primary: 'biceps' }], // Incline curls
  
  // ========================================
  // === FOREARMS (ISOLATION) ===
  // ========================================
  [/wrist\s*curl|wrist.*curl/i, { primary: 'forearms' }], // Wrist curls
  [/reverse\s*curl/i, { primary: 'forearms' }], // Reverse curls
  [/forearm/i, { primary: 'forearms' }], // Forearm exercises
  [/grip.*strength|grip.*train/i, { primary: 'forearms' }], // Grip training
  
  // ========================================
  // === TRAPS (ISOLATION - must come before back patterns) ===
  // ========================================
  [/shrug/i, { primary: 'traps' }], // All shrugs = traps isolation
  [/upright\s*row/i, { primary: 'traps', secondary: ['delts'] }], // Upright rows (compound)
  
  // ========================================
  // === REAR DELTS (ISOLATION - must come before back/shoulder patterns) ===
  // ========================================
  [/rear\s*delt|reverse.*fly|reverse.*pec/i, { primary: 'reardelts' }], // Rear delt isolation
  [/face\s*pull/i, { primary: 'reardelts', secondary: ['traps'] }], // Face pulls
  [/band\s*pull.?apart/i, { primary: 'reardelts' }], // Band pull aparts
  
  // ========================================
  // === DELTS - LATERAL/FRONT (ISOLATION) ===
  // ========================================
  [/lateral\s*raise|side\s*raise|lat\s*raise/i, { primary: 'delts' }], // Lateral raises = isolation
  [/front\s*raise/i, { primary: 'delts' }], // Front raises = isolation
  [/y\s*raise|cable.*y.*raise/i, { primary: 'delts' }], // Y raises
  
  // ========================================
  // === DELTS - PRESSING (COMPOUND) ===
  // ========================================
  [/overhead\s*press|ohp|military\s*press|shoulder\s*press/i, { primary: 'delts', secondary: ['triceps'] }],
  [/arnold\s*press/i, { primary: 'delts', secondary: ['triceps'] }],
  [/db\s*press.*shoulder|dumbbell.*shoulder.*press/i, { primary: 'delts', secondary: ['triceps'] }],
  [/seated.*press(?!.*chest|.*bench)/i, { primary: 'delts', secondary: ['triceps'] }], // Seated press (not chest)
  
  // ========================================
  // === LATS (Back Width - COMPOUND) ===
  // ========================================
  [/(?<!tricep.{0,20})(?<!triceps.{0,20})(?<!push.{0,20})(lat\s*pulldown|lat\s*pull)/i, { primary: 'lats', secondary: ['biceps'] }], // Lat pulldowns (not tricep-related)
  [/pull.?up|chin.?up/i, { primary: 'lats', secondary: ['biceps'] }], // Pull-ups/chin-ups
  [/(?<!tricep.{0,20})(?<!triceps.{0,20})(?<!push.{0,20})pulldown(?!.*tricep)(?!.*push)/i, { primary: 'lats', secondary: ['biceps'] }], // Generic pulldowns (NOT pushdowns or tricep-related)
  [/row(?!.*upright)/i, { primary: 'lats', secondary: ['biceps', 'reardelts'] }], // All rows except upright
  [/t.?bar/i, { primary: 'lats', secondary: ['biceps', 'reardelts'] }], // T-bar rows
  [/cable.*row|seated.*row/i, { primary: 'lats', secondary: ['biceps'] }], // Cable/seated rows
  [/chest.*supported.*row/i, { primary: 'lats', secondary: ['biceps'] }], // Chest supported rows
  [/single\s*arm.*row|one\s*arm.*row/i, { primary: 'lats', secondary: ['biceps'] }], // Single arm rows
  [/straight\s*arm.*pulldown|pullover/i, { primary: 'lats' }], // Straight arm pulldown (isolation-ish)
  
  // ========================================
  // === CHEST - ISOLATION ===
  // ========================================
  [/pec\s*deck|pec\s*fly/i, { primary: 'chest' }], // Pec deck = isolation
  [/chest\s*fly|cable\s*fly|fly\s*machine|dumbbell\s*fly/i, { primary: 'chest' }], // Flyes = isolation
  [/cable\s*crossover|cable\s*cross/i, { primary: 'chest' }], // Cable crossovers
  
  // ========================================
  // === CHEST - PRESSING (COMPOUND) ===
  // ========================================
  [/bench\s*press|chest\s*press/i, { primary: 'chest', secondary: ['triceps', 'delts'] }],
  [/incline.*press|incline.*bench/i, { primary: 'chest', secondary: ['triceps', 'delts'] }],
  [/decline.*press|decline.*bench/i, { primary: 'chest', secondary: ['triceps'] }],
  [/push.?up/i, { primary: 'chest', secondary: ['triceps', 'delts'] }], // Push-ups
  [/dip(?!.*tricep)/i, { primary: 'chest', secondary: ['triceps', 'delts'] }], // Dips (chest focused)
  [/floor\s*press/i, { primary: 'chest', secondary: ['triceps'] }],
  
  // ========================================
  // === QUADS - ISOLATION ===
  // ========================================
  [/leg\s*extension|quad\s*extension/i, { primary: 'quads' }], // Leg extension = isolation
  [/sissy\s*squat/i, { primary: 'quads' }], // Sissy squat = isolation
  
  // ========================================
  // === QUADS - COMPOUND ===
  // ========================================
  [/squat(?!.*split)/i, { primary: 'quads', secondary: ['glutes', 'hamstrings'] }],
  [/leg\s*press/i, { primary: 'quads', secondary: ['glutes'] }],
  [/hack\s*squat/i, { primary: 'quads', secondary: ['glutes'] }],
  [/lunge|split\s*squat|bulgarian/i, { primary: 'quads', secondary: ['glutes', 'hamstrings'] }],
  [/step.?up/i, { primary: 'quads', secondary: ['glutes'] }],
  [/front\s*squat/i, { primary: 'quads', secondary: ['glutes', 'core'] }],
  
  // ========================================
  // === HAMSTRINGS - ISOLATION ===
  // ========================================
  [/leg\s*curl|ham.*curl|seated.*curl|lying.*curl/i, { primary: 'hamstrings' }], // Leg curls = isolation
  [/nordic/i, { primary: 'hamstrings' }], // Nordic curls
  [/glute.?ham.*raise|ghr/i, { primary: 'hamstrings', secondary: ['glutes'] }],
  
  // ========================================
  // === HAMSTRINGS - COMPOUND ===
  // ========================================
  [/rdl|romanian.*deadlift/i, { primary: 'hamstrings', secondary: ['glutes'] }],
  [/stiff.?leg/i, { primary: 'hamstrings', secondary: ['glutes'] }],
  [/good\s*morning/i, { primary: 'hamstrings', secondary: ['glutes'] }],
  [/deadlift(?!.*romanian|.*rdl|.*stiff)/i, { primary: 'hamstrings', secondary: ['glutes', 'lats', 'traps'] }], // Conventional deadlift
  
  // ========================================
  // === GLUTES - ISOLATION ===
  // ========================================
  [/hip\s*thrust|glute\s*bridge|glute\s*drive/i, { primary: 'glutes', secondary: ['hamstrings'] }],
  [/glute.*kickback|cable.*kickback.*glute/i, { primary: 'glutes' }],
  [/hip\s*abduct|abductor/i, { primary: 'glutes' }],
  [/hip\s*adduct|adductor/i, { primary: 'glutes' }],
  [/cable\s*pull.?through/i, { primary: 'glutes', secondary: ['hamstrings'] }],
  [/frog\s*pump/i, { primary: 'glutes' }],
  
  // ========================================
  // === CALVES (ISOLATION) ===
  // ========================================
  [/calf|calve|calf\s*raise/i, { primary: 'calves' }],
  [/toe\s*raise|toe\s*press/i, { primary: 'calves' }],
  [/donkey.*calf/i, { primary: 'calves' }],
  [/seated.*calf|standing.*calf/i, { primary: 'calves' }],
  
  // ========================================
  // === CORE (mostly isolation) ===
  // ========================================
  [/ab\s*wheel|ab.*roll/i, { primary: 'core' }],
  [/crunch|sit.?up/i, { primary: 'core' }],
  [/leg\s*raise|hanging.*raise|knee.*raise/i, { primary: 'core' }],
  [/plank/i, { primary: 'core' }],
  [/dead\s*bug/i, { primary: 'core' }],
  [/pallof/i, { primary: 'core' }],
  [/wood\s*chop/i, { primary: 'core' }],
  [/oblique|side\s*bend|russian\s*twist/i, { primary: 'core' }],
  [/back\s*extension|hyper.*extension/i, { primary: 'core', secondary: ['hamstrings', 'glutes'] }],
  [/hollow.*hold/i, { primary: 'core' }],
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
