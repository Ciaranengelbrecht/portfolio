import { Exercise, Session } from './types';

export interface StartingWeightRule {
  exerciseId: string;
  weightKg: number;
  source: 'recent_top' | 'percent_recent' | 'default_min';
}

/** Compute suggested starting working set weight per exercise based on last N sessions (defaults). */
export function computeStartingWeights(exercises: Exercise[], sessions: Session[], opts: { lookback?: number, percent?: number } = {}): StartingWeightRule[] {
  const look = opts.lookback ?? 6;
  const pct = opts.percent ?? 0.9; // start at 90% of most recent top by default
  const recent = sessions.slice(-look);
  const map: StartingWeightRule[] = [];
  for(const ex of exercises){
    const logged: { w:number; r:number; date:string }[] = [];
    for(const s of recent){
      const entry = s.entries.find(e=> e.exerciseId === ex.id);
      if(!entry) continue;
      for(const st of entry.sets){
        const w = st.weightKg || 0; const r = st.reps || 0;
        if(w>0 && r>0) logged.push({ w, r, date: s.dateISO });
      }
    }
    if(!logged.length){
      map.push({ exerciseId: ex.id, weightKg: 0, source: 'default_min' });
      continue;
    }
    // Use most recent day only (avoid stale older peak overweighting)
    logged.sort((a,b)=> a.date.localeCompare(b.date));
    const lastDate = logged[logged.length-1].date;
    const lastDay = logged.filter(l=> l.date === lastDate).sort((a,b)=> (b.w*b.r)-(a.w*a.r));
    const top = lastDay[0];
    const anchored = Math.max(0.5, roundTo(top.w * pct, 0.5));
    map.push({ exerciseId: ex.id, weightKg: anchored, source: 'percent_recent' });
  }
  return map;
}

function roundTo(v:number, step:number){ return Math.round(v/step)*step; }
