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
  addRepsFirst?: boolean; // default true
}

// Parse rep range like "8-12" returning [min,max]
function parseRange(r?: string): [number,number] | null {
  if(!r) return null; const m = r.match(/(\d+)\s*[-–]\s*(\d+)/); if(!m) return null; return [Number(m[1]), Number(m[2])];
}

/** Compute suggestion for next session first working set based on last top set. */
export function suggestNext(ctx: ProgressionContext): NextSetSuggestion | null {
  const { recentSessions, exercise, repRange, incrementKg = 2.5, addRepsFirst = true } = ctx;
  if(!recentSessions.length) return null;
  // Find most recent logged set with non-zero weight
  for(let i=recentSessions.length-1;i>=0;i--){
    const s = recentSessions[i];
    const entry = s.entries.find(e=> e.exerciseId === exercise.id);
    if(!entry) continue;
    const logged = entry.sets.filter(st=> (st.reps||0)>0 && (st.weightKg||0)>0);
    if(!logged.length) continue;
    // choose best weight*reps
    const top = logged.slice().sort((a,b)=> ((b.weightKg||0)*(b.reps||0)) - ((a.weightKg||0)*(a.reps||0)))[0];
    const range = parseRange(repRange) || parseRange(exercise.defaults.targetRepRange) || [8,12];
    const [lo, hi] = range;
    if(addRepsFirst){
      if((top.reps||0) < hi){ return { weightKg: top.weightKg||0, reps: Math.min(hi, (top.reps||0)+1) }; }
      // cap reached -> increase weight and drop reps to lower bound
      return { weightKg: (top.weightKg||0)+ incrementKg, reps: lo };
    } else {
      // add weight then reps within band
      if((top.weightKg||0) === 0) return { weightKg: (exercise.defaults as any)?.startWeight || 0, reps: lo };
      // If at lower half of range push reps first to midpoint
      if((top.reps||0) < ((lo+hi)/2|0)) return { weightKg: top.weightKg||0, reps: (top.reps||0)+1 };
      return { weightKg: (top.weightKg||0)+ incrementKg, reps: lo };
    }
  }
  return null;
}

/** Build a map exerciseId -> suggestion for quick lookup in session UI */
export function buildSuggestions(exercises: Exercise[], sessions: Session[], opts: { window?: number, addRepsFirst?: boolean } = {}) {
  const windowN = opts.window ?? 6; // look back N sessions
  const recent = sessions.slice(-windowN);
  const map = new Map<string, NextSetSuggestion>();
  for(const ex of exercises){
    const sugg = suggestNext({ recentSessions: recent, exercise: ex, addRepsFirst: opts.addRepsFirst });
    if(sugg) map.set(ex.id, sugg);
  }
  return map;
}
