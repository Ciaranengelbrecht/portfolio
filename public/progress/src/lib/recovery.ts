// Recovery model utilities
// NOTE: This is a heuristic model drawing from general resistance training recovery literature.
// It is NOT a medical tool. Parameters are intentionally conservative and configurable.

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
  hamstrings: 72,  // Large muscle group
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

// Isolation heuristic keywords; if exercise name contains one -> reduce stress 30%
const ISOLATION_KEYWORDS = /(curl|extension|raise|fly|pullover|pressdown|lateral|reverse fly|cable cross|rear delt)/i;

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

// Compute per-set stress with realistic fatigue modeling
// This calculates how much "fatigue" a set induces based on volume, intensity, and effort
function computeSetStress(set: SetEntry, exercise: Exercise, primary: MuscleGroup, whenMs: number): SetStressRecord[] {
  if (!set.reps || !set.weightKg || set.reps <= 0 || set.weightKg <= 0) return [];
  const reps = set.reps;
  const weight = set.weightKg;
  
  // Smart intensity calculation - uses relative intensity zones
  // Light: <60kg (0.5), Moderate: 60-100kg (0.7-1.0), Heavy: >100kg (1.2+)
  const intensityProxy = 0.5 + (Math.log(weight + 1) / Math.log(150)) * 0.7; // Logarithmic scaling
  
  // Volume factor: total work done (reps × weight × intensity)
  // Normalized to reasonable set volumes (8-12 reps × 50-80kg = baseline)
  const volumeLoad = (reps * weight * intensityProxy) / 600; // Normalized to moderate working set
  
  // Diminishing returns on very high volume (prevents absurd stress from ultra-high reps/weight)
  const volumeFactor = Math.min(volumeLoad, 2.5); // Cap at 2.5x baseline stress
  
  // Near-failure effort assumption (most lifters train 1-3 reps from failure)
  const effortFactor = 0.9; // Slightly reduced from 0.95 for more realistic training
  
  // Isolation exercises cause less systemic fatigue
  const isolationAdj = ISOLATION_KEYWORDS.test(exercise.name) ? 0.7 : 1;

  const muscles: MuscleGroup[] = [primary, ...(exercise.secondaryMuscles || []).filter(Boolean) as MuscleGroup[]];
  
  // Secondary muscles contribute 35% of primary fatigue (realistic synergist involvement)
  return muscles.map((m, idx) => {
    const base = volumeFactor * effortFactor * isolationAdj;
    const mod = MUSCLE_MOD[m] * (idx === 0 ? 1 : 0.35);
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
    
    let remaining = 0;
    let mostRecentWorkout = 0; // Track most recent training session
    
    for (const rec of list) {
      const age = now - rec.startMs;
      if (age < 0) continue; // Future timestamp, ignore
      const rem = rec.s0 * Math.exp(-age / tau);
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
