import { Session, Exercise } from './types';

export interface NextSetSuggestion {
  weightKg?: number;
  reps?: number;
}

export interface ProgressionContext {
  recentSessions: Session[]; // ordered oldest -> newest
  exercise: Exercise;
  repRange?: string; // template planned rep range
  incrementKg?: number; // default 2.5
  addRepsFirst?: boolean; // default true (legacy simple mode)
  adaptive?: boolean; // enable smoothing / miss & plateau logic (default true)
  requireDoubleTop?: boolean; // only increase weight after hitting top reps twice (default true)
  plateauSessions?: number; // sessions with no rep progress before micro-adjust (default 3)
  lookbackSessions?: number; // how many sessions to inspect for adaptive heuristics (default 6)
  minDeloadPct?: number; // percent to remove on repeated misses (default 0.07 i.e. 7%)
}

// Parse rep range like "8-12" returning [min,max]
function parseRange(r?: string): [number,number] | null {
  if(!r) return null; const m = r.match(/(\d+)\s*[-–]\s*(\d+)/); if(!m) return null; return [Number(m[1]), Number(m[2])];
}

/** Compute suggestion for next session first working set based on last top set. */
export function suggestNext(ctx: ProgressionContext): NextSetSuggestion | null {
  const {
    recentSessions,
    exercise,
    repRange,
    incrementKg = 2.5,
    addRepsFirst = true,
    adaptive = true,
    requireDoubleTop = true,
    plateauSessions = 3,
    lookbackSessions = 6,
    minDeloadPct = 0.07,
  } = ctx;
  if(!recentSessions.length) return null;

  // Collect top set history (weight*reps) for this exercise from newest backwards
  const range = parseRange(repRange) || parseRange(exercise.defaults.targetRepRange) || [8,12];
  const [lo, hi] = range;
  const tops: { weight: number; reps: number }[] = [];
  for(let i=recentSessions.length-1; i>=0 && tops.length < lookbackSessions; i--) {
    const s = recentSessions[i];
    const entry = s.entries.find(e=> e.exerciseId === exercise.id);
    if(!entry) continue;
    const logged = entry.sets.filter(st=> (st.reps||0)>0 && (st.weightKg||0)>0);
    if(!logged.length) continue;
    const top = logged.slice().sort((a,b)=> ((b.weightKg||0)*(b.reps||0)) - ((a.weightKg||0)*(a.reps||0)))[0];
    tops.push({ weight: top.weightKg||0, reps: top.reps||0 });
  }
  if(!tops.length) return null;
  const last = tops[0];
  const prev = tops[1];
  const prev2 = tops[2];

  // Non-adaptive legacy simple logic
  if(!adaptive){
    if(addRepsFirst){
      if(last.reps < hi) return { weightKg: last.weight, reps: Math.min(hi, last.reps+1) };
      return { weightKg: last.weight + incrementKg, reps: lo };
    } else {
      if(last.weight === 0) return { weightKg: (exercise as any)?.defaults?.startWeight || 0, reps: lo };
      if(last.reps < ((lo+hi)/2|0)) return { weightKg: last.weight, reps: last.reps+1 };
      return { weightKg: last.weight + incrementKg, reps: lo };
    }
  }

  // Adaptive heuristics
  const hitTop = last.reps >= hi;
  const prevHitTop = prev ? prev.reps >= hi : false;
  const sameWeight = prev ? last.weight === prev.weight : false;
  const sameWeightPrev2 = prev2 ? last.weight === prev2.weight : false;
  const plateau = sameWeight && sameWeightPrev2 && prev && prev2 && last.reps === prev.reps && prev.reps === prev2.reps && last.reps < hi; // 3 identical outcomes below top
  const belowMin = last.reps < lo;
  const consecutiveBelowMin = belowMin && prev && prev.reps < lo;

  // 1. Repeated miss below lower bound -> micro deload (reduce weight) then target lower bound
  if(consecutiveBelowMin) {
    const reduce = Math.max(incrementKg, Math.round(last.weight * minDeloadPct * 2) / 2); // round to 0.5
    const nextWeight = Math.max(0, last.weight - reduce);
    return { weightKg: nextWeight, reps: lo };
  }

  // 2. Single miss below min: attempt to reach min reps first (keep weight)
  if(belowMin) {
    const targetReps = Math.min(lo, last.reps + 1); // nudge upward
    return { weightKg: last.weight, reps: targetReps };
  }

  // 3. Top reps achieved: require confirmation if enabled before weight increase
  if(hitTop) {
    if(requireDoubleTop && (!prevHitTop || !sameWeight)) {
      // Hold weight for confirmation session
      return { weightKg: last.weight, reps: hi };
    }
    // Increase weight and reset reps to lower bound
    return { weightKg: last.weight + incrementKg, reps: lo };
  }

  // 4. Plateau detection (no rep change for plateauSessions sessions at same weight below top)
  if(plateau) {
    // Option A: micro weight bump (half increment) if feasible; else push reps by 1
    const micro = incrementKg/2;
    if(micro >= 1) {
      return { weightKg: last.weight + micro, reps: Math.max(lo, Math.min(hi, last.reps)) };
    }
    // else just push reps by 1 if room
    if(last.reps < hi) return { weightKg: last.weight, reps: Math.min(hi, last.reps+1) };
  }

  // 5. Normal progression within band (add a rep)
  if(last.reps < hi) {
    return { weightKg: last.weight, reps: Math.min(hi, last.reps+1) };
  }

  // Fallback: increment weight
  return { weightKg: last.weight + incrementKg, reps: lo };
}

/** Build a map exerciseId -> suggestion for quick lookup in session UI */
export function buildSuggestions(
  exercises: Exercise[],
  sessions: Session[],
  opts: {
    window?: number;
    addRepsFirst?: boolean;
    adaptive?: boolean;
    matchTemplateId?: string | null | undefined; // only consider sessions from same template (preferred)
    matchDayName?: string | null | undefined; // fallback identity if templateId not present
    onlyExerciseIds?: string[]; // optional whitelist of exercise ids to build suggestions for
  } = {}
) {
  const windowN = opts.window ?? 6; // look back N sessions (per matching day identity)
  let filtered = sessions;
  if (opts.matchTemplateId) {
    filtered = filtered.filter(s => s.templateId === opts.matchTemplateId);
  } else if (opts.matchDayName) {
    filtered = filtered.filter(s => s.dayName === opts.matchDayName);
  }
  const recent = filtered.slice(-windowN);
  const onlySet = opts.onlyExerciseIds ? new Set(opts.onlyExerciseIds) : null;
  const map = new Map<string, NextSetSuggestion>();
  for (const ex of exercises) {
    if (onlySet && !onlySet.has(ex.id)) continue;
    const sugg = suggestNext({ recentSessions: recent, exercise: ex, addRepsFirst: opts.addRepsFirst, adaptive: opts.adaptive });
    if (sugg) map.set(ex.id, sugg);
  }
  return map;
}
