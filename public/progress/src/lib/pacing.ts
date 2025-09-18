import { Session } from './types';

export interface RestStats {
  exerciseId: string;
  intervals: number[]; // ms
  averageMs: number;
  medianMs: number;
  longestMs: number;
  count: number;
}
export interface SessionPacingSummary {
  exercises: RestStats[];
  overall: { averageMs: number; medianMs: number; longestMs: number; count: number };
}

function median(nums: number[]): number { if(!nums.length) return 0; const s=[...nums].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2? s[m] : Math.round((s[m-1]+s[m])/2); }

// Compute rest intervals using consecutive completedAt timestamps within an exercise's sets.
export function computeSessionPacing(session: Session): SessionPacingSummary {
  const byExercise: RestStats[] = [];
  for (const entry of session.entries) {
    const stamps = entry.sets.map(s => s.completedAt).filter(Boolean) as string[];
    const intervals: number[] = [];
    for (let i=1;i<stamps.length;i++){
      const prev = new Date(stamps[i-1]).getTime();
      const cur = new Date(stamps[i]).getTime();
      if(!isNaN(prev) && !isNaN(cur) && cur>=prev){
        const delta = cur - prev;
        // Ignore extremely long gaps > 45 min (likely session break / navigation) to keep stats relevant
        if(delta <= 45*60*1000) intervals.push(delta);
      }
    }
    const averageMs = intervals.length ? Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length) : 0;
    const medianMs = median(intervals);
    const longestMs = intervals.length ? Math.max(...intervals) : 0;
    byExercise.push({ exerciseId: entry.exerciseId, intervals, averageMs, medianMs, longestMs, count: intervals.length });
  }
  const all = byExercise.flatMap(e=> e.intervals);
  const overall = {
    averageMs: all.length ? Math.round(all.reduce((a,b)=>a+b,0)/all.length) : 0,
    medianMs: median(all),
    longestMs: all.length ? Math.max(...all) : 0,
    count: all.length,
  };
  return { exercises: byExercise, overall };
}
