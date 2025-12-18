// Recovery model utilities - Enhanced v2
// NOTE: This is a heuristic model drawing from general resistance training recovery literature.
// It is NOT a medical tool. Parameters are intentionally conservative and configurable.
// 
// Key improvements in v2:
// - RPE-based effort scaling for sets with recorded RPE
// - Compound vs isolation classification with exercise-specific modifiers
// - High-fatigue exercise detection (deadlifts, squats, etc.)
// - Non-linear fatigue accumulation for frequent training
// - Secondary muscle contribution based on exercise type

import type { Session, SessionEntry, SetEntry, Exercise } from './types';
import { getAllCached } from './dataCache';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'other';

// Baseline recovery time hours (time to full recovery from a single hard session) per muscle group.
// Based on research: smaller muscles 24-48h, larger muscles 48-72h for full recovery.
// These are realistic recovery windows for natural lifters.
export const BASELINE_HOURS: Record<MuscleGroup, number> = {
  forearms: 24,    // Small muscles, recover quickly
  biceps: 36,      // Small muscles
  triceps: 36,     // Small muscles
  shoulders: 48,   // Medium muscles, complex joint
  calves: 48,      // Stubborn but small
  core: 48,        // Used daily, adapts well
  chest: 48,       // Large muscle, but simpler movement
  back: 60,        // Large, complex muscle group
  quads: 72,       // Very large muscle group
  hamstrings: 72,  // Large muscle group, high eccentric stress
  glutes: 72,      // Large muscle group
  other: 48,
};

// Training intensity modifier - affects how much stress a workout induces
// Higher values = more stress = longer recovery needed
export const MUSCLE_MOD: Record<MuscleGroup, number> = {
  forearms: 0.7,
  biceps: 0.8,
  triceps: 0.8,
  shoulders: 0.9,
  calves: 0.9,
  core: 0.85,
  chest: 1.0,
  back: 1.1,
  quads: 1.2,
  hamstrings: 1.15,
  glutes: 1.15,
  other: 1.0,
};

// ==== EXERCISE CLASSIFICATION ====

// Isolation exercises - reduced systemic stress (0.65x modifier)
const ISOLATION_KEYWORDS = /(curl|extension|raise|fly|pullover|pressdown|lateral|reverse fly|cable cross|rear delt|kickback|concentration|preacher|scott|spider|hammer curl|wrist|calf raise|leg curl|leg extension|pec deck|machine fly)/i;

// High-fatigue compound exercises - increased stress and longer recovery (1.3x modifier)
// These exercises cause significant CNS fatigue and systemic stress
const HIGH_FATIGUE_KEYWORDS = /(deadlift|squat|clean|snatch|thruster|front squat|back squat|sumo|conventional|romanian|rdl|stiff.?leg|good morning|hip thrust|barbell row|pendlay|t-bar)/i;

// Heavy compound exercises - moderate extra stress (1.15x modifier)
const COMPOUND_HEAVY_KEYWORDS = /(bench press|overhead press|military press|incline press|decline press|dip|pull.?up|chin.?up|lat pulldown|row|press)/i;

// Exercises with high eccentric stress - slower recovery (1.2x recovery time)
const HIGH_ECCENTRIC_KEYWORDS = /(romanian|rdl|stiff.?leg|nordic|negative|eccentric|tempo|pause|deficit)/i;

// Convert RPE (1-10) to effort factor (0.5-1.0)
// RPE 10 = failure = 1.0 effort
// RPE 6 = 4 reps in reserve = 0.65 effort
function rpeToEffort(rpe: number | undefined | null): number {
  if (rpe == null || rpe <= 0) return 0.85; // Default assumption: ~2 RIR
  // Clamp RPE to 5-10 range
  const clampedRpe = Math.max(5, Math.min(10, rpe));
  // Linear mapping: RPE 5 = 0.5, RPE 10 = 1.0
  return 0.5 + (clampedRpe - 5) * 0.1;
}

// Classify exercise and return stress modifiers
interface ExerciseModifiers {
  stressMultiplier: number;    // Applied to set stress
  recoveryMultiplier: number;  // Applied to recovery time
  secondaryContribution: number; // How much secondary muscles contribute (0-1)
}

function classifyExercise(exerciseName: string): ExerciseModifiers {
  const name = exerciseName.toLowerCase();
  
  // High-fatigue compounds (deadlifts, squats, Olympic lifts)
  if (HIGH_FATIGUE_KEYWORDS.test(name)) {
    return {
      stressMultiplier: 1.35,
      recoveryMultiplier: 1.25,
      secondaryContribution: 0.45, // Secondary muscles work hard
    };
  }
  
  // Heavy compound movements
  if (COMPOUND_HEAVY_KEYWORDS.test(name)) {
    return {
      stressMultiplier: 1.1,
      recoveryMultiplier: 1.1,
      secondaryContribution: 0.4,
    };
  }
  
  // Isolation exercises
  if (ISOLATION_KEYWORDS.test(name)) {
    return {
      stressMultiplier: 0.65,
      recoveryMultiplier: 0.9,
      secondaryContribution: 0.2, // Minimal secondary involvement
    };
  }
  
  // Default: moderate compound
  return {
    stressMultiplier: 1.0,
    recoveryMultiplier: 1.0,
    secondaryContribution: 0.35,
  };
}

// Check if exercise has high eccentric component
function hasHighEccentric(exerciseName: string): boolean {
  return HIGH_ECCENTRIC_KEYWORDS.test(exerciseName.toLowerCase());
}

// Rolling window (ms) to inspect past sessions; 7 days = 168h
const WINDOW_MS = 1000 * 60 * 60 * 168;

// Realistic stress threshold per muscle - represents max accumulated fatigue before overtraining
// Lowered significantly to give more realistic recovery times
export function muscleThreshold(m: MuscleGroup): number {
  return 4.5 * MUSCLE_MOD[m]; // Capacity for ~1-2 hard sessions before needing recovery
}

// Exponential time constant deriving from half-life: Tau = t_half / ln(2)
function tauFromHalfLife(halfHours: number): number {
  return (halfHours * 3600 * 1000) / Math.log(2);
}

export interface SetStressRecord {
  muscle: MuscleGroup;
  startMs: number; // completion timestamp in ms
  s0: number; // initial stress value before decay
}

export interface MuscleRecoveryState {
  muscle: MuscleGroup;
  percent: number; // 0-100 (% recovered)
  remaining: number; // remaining stress units
  threshold: number; // threshold units for full recovery mapping
  etaFull?: number; // timestamp (ms) when we expect >= ~99% recovery
  status: 'Ready' | 'Near' | 'Caution' | 'Not Ready';
}

export interface RecoveryBundle {
  updatedAt: number;
  muscles: MuscleRecoveryState[];
  byMuscle: Record<MuscleGroup, MuscleRecoveryState>;
}

// Compute per-set stress with realistic fatigue modeling (v2)
// This calculates how much "fatigue" a set induces based on:
// - Volume (reps × weight)
// - Intensity (relative load)
// - Effort (RPE-based or assumed)
// - Exercise type (compound vs isolation, high-fatigue movements)
// - Eccentric stress considerations
function computeSetStress(set: SetEntry, exercise: Exercise, primary: MuscleGroup, whenMs: number): SetStressRecord[] {
  if (!set.reps || !set.weightKg || set.reps <= 0 || set.weightKg <= 0) return [];
  const reps = set.reps;
  const weight = set.weightKg;
  
  // ==== INTENSITY CALCULATION ====
  // Smart intensity calculation - uses relative intensity zones
  // Light: <60kg (0.5), Moderate: 60-100kg (0.7-1.0), Heavy: >100kg (1.2+)
  const intensityProxy = 0.5 + (Math.log(weight + 1) / Math.log(150)) * 0.7;
  
  // ==== REP RANGE FATIGUE MODIFIER ====
  // Different rep ranges cause different types of fatigue:
  // - Low reps (1-5): High neural fatigue, moderate muscle damage
  // - Moderate reps (6-12): Balanced fatigue profile
  // - High reps (13+): High metabolic stress, extended recovery
  let repRangeMod = 1.0;
  if (reps <= 5) {
    repRangeMod = 1.1; // Heavy singles/triples are CNS taxing
  } else if (reps >= 15) {
    repRangeMod = 1.15; // High rep sets cause significant metabolic stress
  }
  
  // ==== VOLUME CALCULATION ====
  // Volume factor: total work done (reps × weight × intensity)
  // Normalized to reasonable set volumes (8-12 reps × 50-80kg = baseline)
  const volumeLoad = (reps * weight * intensityProxy * repRangeMod) / 600;
  
  // Diminishing returns on very high volume (prevents absurd stress from ultra-high reps/weight)
  const volumeFactor = Math.min(volumeLoad, 2.5);
  
  // ==== EFFORT FACTOR (RPE-BASED) ====
  // Use actual RPE if recorded, otherwise assume ~2 RIR (RPE 8)
  const effortFactor = rpeToEffort(set.rpe);
  
  // ==== EXERCISE TYPE MODIFIERS ====
  const exerciseModifiers = classifyExercise(exercise.name);
  const stressMult = exerciseModifiers.stressMultiplier;
  
  // ==== ECCENTRIC STRESS MODIFIER ====
  // Exercises with high eccentric component cause more muscle damage
  const eccentricMod = hasHighEccentric(exercise.name) ? 1.15 : 1.0;

  const muscles: MuscleGroup[] = [primary, ...(exercise.secondaryMuscles || []).filter(Boolean) as MuscleGroup[]];
  
  // Secondary muscles use exercise-specific contribution rate
  return muscles.map((m, idx) => {
    const isPrimary = idx === 0;
    const base = volumeFactor * effortFactor * stressMult * eccentricMod;
    const secondaryContrib = isPrimary ? 1 : exerciseModifiers.secondaryContribution;
    const mod = MUSCLE_MOD[m] * secondaryContrib;
    const s0 = base * mod;
    return { muscle: m, startMs: whenMs, s0 };
  });
}

export async function computeRecovery(nowMs?: number): Promise<RecoveryBundle> {
  const [sessions, exercises] = await Promise.all([
    getAllCached<Session>('sessions', { swr: true }),
    getAllCached<Exercise>('exercises', { swr: true })
  ]);
  const now = nowMs ?? Date.now();
  const exerciseMap = new Map<string, Exercise>();
  exercises.forEach(e => exerciseMap.set(e.id, e));

  const cutoff = now - WINDOW_MS;
  const records: SetStressRecord[] = [];
  for (const s of sessions) {
    // Use loggedEndAt or date to approximate mid-session if individual set timestamps missing
    for (const entry of s.entries) {
      const ex = exerciseMap.get(entry.exerciseId);
      if (!ex) continue;
      const primary = (ex.muscleGroup as MuscleGroup) || 'other';
      for (const set of entry.sets) {
        const ts = set.completedAt ? Date.parse(set.completedAt) : (s.loggedEndAt ? Date.parse(s.loggedEndAt) : Date.parse(s.dateISO));
        if (!ts || isNaN(ts)) continue;
        if (ts < cutoff) continue;
        records.push(...computeSetStress(set, ex, primary, ts));
      }
    }
  }

  const groups: Record<MuscleGroup, SetStressRecord[]> = {
    chest: [], back: [], shoulders: [], biceps: [], triceps: [], forearms: [], quads: [], hamstrings: [], glutes: [], calves: [], core: [], other: []
  };
  records.forEach(r => { groups[r.muscle].push(r); });

  const muscles: MuscleRecoveryState[] = [];
  (Object.keys(groups) as MuscleGroup[]).forEach(m => {
    const list = groups[m];
    const threshold = muscleThreshold(m);
    if (!list.length) {
      muscles.push({ muscle: m, percent: 100, remaining: 0, threshold, etaFull: now, status: 'Ready' });
      return;
    }
    
    // Use realistic recovery time constant
    // BASELINE_HOURS now represents full recovery time, not half-life
    // Convert to time constant: tau = recovery_time / 4.6 (for ~99% recovery)
    const fullRecoveryHours = BASELINE_HOURS[m];
    const tau = (fullRecoveryHours * 3600 * 1000) / 4.6; // 4.6 = -ln(0.01) for 99% recovery
    
    // ==== TRAINING FREQUENCY ANALYSIS ====
    // Count distinct training sessions in last 72h for this muscle
    const last72h = now - (72 * 3600 * 1000);
    const recentSessionTimes = new Set<number>();
    list.forEach(rec => {
      if (rec.startMs > last72h) {
        // Group into 2h windows to count distinct sessions
        recentSessionTimes.add(Math.floor(rec.startMs / (2 * 3600 * 1000)));
      }
    });
    const recentSessions = recentSessionTimes.size;
    
    // Frequency fatigue multiplier - training same muscle frequently accumulates fatigue
    // 1 session = 1.0x, 2 sessions = 1.15x, 3+ sessions = 1.35x
    let frequencyMod = 1.0;
    if (recentSessions >= 3) {
      frequencyMod = 1.35; // High frequency - significant accumulated fatigue
    } else if (recentSessions >= 2) {
      frequencyMod = 1.15; // Moderate frequency
    }
    
    let remaining = 0;
    let mostRecentWorkout = 0; // Track most recent training session
    
    for (const rec of list) {
      const age = now - rec.startMs;
      if (age < 0) continue; // Future timestamp, ignore
      // Apply frequency modifier to stress decay
      const rem = rec.s0 * frequencyMod * Math.exp(-age / tau);
      remaining += rem;
      if (rec.startMs > mostRecentWorkout) mostRecentWorkout = rec.startMs;
    }
    
    // Map to recovered percent - more lenient curve for realistic percentages
    // Uses smoother mapping: percent = 100 * (1 - remaining^0.7 / threshold^0.7)
    const stressRatio = Math.min(1, remaining / threshold);
    const percent = Math.max(0, Math.min(100, 100 * (1 - Math.pow(stressRatio, 0.75))));

    // Smart ETA calculation - realistic recovery timeline
    let etaFull: number | undefined = undefined;
    
    if (remaining <= 0.05 * threshold) {
      // Already recovered (< 5% stress remaining)
      etaFull = now;
    } else if (remaining > 0) {
      // Calculate time needed for stress to decay to 5% of threshold (essentially recovered)
      // remaining * exp(-dt / tau) = 0.05 * threshold
      // dt = tau * ln(remaining / (0.05 * threshold))
      const targetStress = 0.05 * threshold;
      const dt = tau * Math.log(Math.max(1, remaining / targetStress));
      
      if (isFinite(dt) && dt > 0) {
        // Cap maximum recovery time at 2x baseline hours (prevents absurd values)
        const maxRecoveryMs = fullRecoveryHours * 2 * 3600 * 1000;
        const clampedDt = Math.min(dt, maxRecoveryMs);
        etaFull = now + clampedDt;
      } else {
        // Fallback: use baseline recovery time from most recent workout
        etaFull = mostRecentWorkout + (fullRecoveryHours * 3600 * 1000);
      }
    }

    let status: MuscleRecoveryState['status'];
    if (percent >= 90) status = 'Ready';
    else if (percent >= 70) status = 'Near';       // Lowered from 75
    else if (percent >= 45) status = 'Caution';     // Lowered from 50
    else status = 'Not Ready';

    muscles.push({ muscle: m, percent, remaining, threshold, etaFull, status });
  });

  muscles.sort((a, b) => a.muscle.localeCompare(b.muscle));
  const byMuscle = muscles.reduce((acc, m) => { acc[m.muscle] = m; return acc; }, {} as Record<MuscleGroup, MuscleRecoveryState>);
  return { updatedAt: now, muscles, byMuscle };
}

// Simple in-memory cache + interval recomputation
let cached: RecoveryBundle | null = null;
let computing: Promise<RecoveryBundle> | null = null;
let lastCompute = 0;
const RECOMPUTE_MS = 1000 * 60 * 10; // 10 min cadence for fresh recovery tracking

export async function getRecovery(force?: boolean): Promise<RecoveryBundle> {
  const now = Date.now();
  if (!force && cached && (now - lastCompute) < RECOMPUTE_MS) return cached;
  if (computing) return computing;
  computing = computeRecovery().then(res => { cached = res; lastCompute = Date.now(); computing = null; return res; }).catch(err => { computing = null; throw err; });
  return computing;
}

// Hook-style helper (no React import here to keep util pure). Consumer page can poll.
export async function refreshRecovery(){ return getRecovery(true); }

// Optional: listen for cache refresh events to invalidate
if (typeof window !== 'undefined') {
  window.addEventListener('cache-refresh', (e: any) => {
    const store = e?.detail?.store;
    if (store === 'sessions' || store === 'exercises') {
      cached = null; lastCompute = 0;
    }
  });
  window.addEventListener('sb-change', (e: any) => {
    const tbl = e?.detail?.table;
    if (tbl === 'sessions' || tbl === 'exercises') { cached = null; lastCompute = 0; }
  });
}
