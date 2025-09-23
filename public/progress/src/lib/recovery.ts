// Recovery model utilities
// NOTE: This is a heuristic model drawing from general resistance training recovery literature.
// It is NOT a medical tool. Parameters are intentionally conservative and configurable.

import type { Session, SessionEntry, SetEntry, Exercise } from './types';
import { getAllCached } from './dataCache';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'other';

// Baseline half-life hours (time to ~50% recovery of induced stress) per muscle group.
// Shoulder / arms recover faster; large lower body muscles recover slower.
export const BASELINE_HOURS: Record<MuscleGroup, number> = {
  shoulders: 18,
  forearms: 18,
  biceps: 20,
  core: 20,
  triceps: 22,
  calves: 30,
  chest: 36,
  back: 40,
  glutes: 44,
  hamstrings: 48,
  quads: 48,
  other: 36,
};

// Additional per-muscle stress modifier (applied to initial set stress) to bias threshold scaling
export const MUSCLE_MOD: Record<MuscleGroup, number> = {
  shoulders: 0.85,
  forearms: 0.85,
  biceps: 0.9,
  core: 0.9,
  triceps: 1.0,
  calves: 1.05,
  chest: 1.15,
  back: 1.2,
  glutes: 1.2,
  hamstrings: 1.25,
  quads: 1.25,
  other: 1.0,
};

// Isolation heuristic keywords; if exercise name contains one -> reduce stress 25%
const ISOLATION_KEYWORDS = /(curl|extension|raise|fly|pullover|pressdown|lateral|reverse fly|cable cross|rear delt)/i;

// Rolling window (ms) to inspect past sessions; 5 days = 120h
const WINDOW_MS = 1000 * 60 * 60 * 120;

// Stress threshold baseline (per muscle) used to map remaining stress -> percent recovered.
// Higher for large muscle groups; scaled by muscle modifier.
export function muscleThreshold(m: MuscleGroup): number {
  return 12 * MUSCLE_MOD[m]; // approx. multi-session hard-set capacity over 3-4 training days
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

// Compute per-set stress. Assumes set near failure (EffortFactor ~0.95) per user guidance.
function computeSetStress(set: SetEntry, exercise: Exercise, primary: MuscleGroup, whenMs: number): SetStressRecord[] {
  if (!set.reps || !set.weightKg || set.reps <= 0 || set.weightKg <= 0) return [];
  const reps = set.reps;
  const weight = set.weightKg;
  // Intensity proxy (no 1RM): relative to moderate reference load (40kg) with diminishing sqrt scaling
  const intensityProxy = Math.sqrt(Math.max(0.5, Math.min(1.6, weight / 40)));
  const volumeFactor = Math.min((reps * weight * intensityProxy) / 800, 3); // saturate high volume
  const effortFactor = 0.95; // near failure assumption
  const isolationAdj = ISOLATION_KEYWORDS.test(exercise.name) ? 0.75 : 1;

  const muscles: MuscleGroup[] = [primary, ...(exercise.secondaryMuscles || []).filter(Boolean) as MuscleGroup[]];
  // Secondary muscles contribute reduced stress (40%)
  return muscles.map((m, idx) => {
    const base = volumeFactor * effortFactor * isolationAdj;
    const mod = MUSCLE_MOD[m] * (idx === 0 ? 1 : 0.4);
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
    const tau = tauFromHalfLife(BASELINE_HOURS[m]);
    let remaining = 0;
    let maxRem = 0; // track largest remaining component for ETA
    let maxTau = tau; // tau same for all sets of muscle; kept for clarity
    let latestDecayZero = now; // for fallback ETA if already low
    for (const rec of list) {
      const age = now - rec.startMs;
      if (age < 0) continue; // future??? ignore
      const rem = rec.s0 * Math.exp(-age / tau);
      remaining += rem;
      if (rem > maxRem) maxRem = rem;
      if (rec.startMs > latestDecayZero) latestDecayZero = rec.startMs;
    }
    // Map to recovered percent
    const percent = Math.max(0, Math.min(100, 100 * (1 - remaining / threshold)));

    // ETA: solve remaining * exp(-dt / tau) <= 0.01 * threshold => dt >= tau * ln(remaining / (0.01*threshold))
    let etaFull: number | undefined = undefined;
    if (remaining <= 0.01 * threshold) etaFull = now;
    else if (remaining > 0) {
      const dt = maxTau * Math.log(remaining / (0.01 * threshold));
      if (isFinite(dt) && dt > 0) etaFull = now + dt;
    }

    let status: MuscleRecoveryState['status'];
    if (percent >= 90) status = 'Ready';
    else if (percent >= 75) status = 'Near';
    else if (percent >= 50) status = 'Caution';
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
const RECOMPUTE_MS = 1000 * 60 * 30; // 30 min cadence (lighter than 1h for fresher feel)

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
