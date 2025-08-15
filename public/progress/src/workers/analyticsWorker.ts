// Web worker for heavy analytics calculations
// Receives: { sessions, exercises }
// Sends back: { volumeTrend, intensityDist, plateaus, undertrained }

interface SetEntry { weightKg: number; reps: number; }
interface SessionEntry { exerciseId: string; sets: SetEntry[]; }
interface Session { phaseNumber?: number; phase?: number; weekNumber: number; entries: SessionEntry[]; }
interface Exercise { id: string; muscleGroup?: string; name: string; }

self.onmessage = (e: MessageEvent) => {
  const { sessions, exercises } = e.data as { sessions: Session[]; exercises: Exercise[] };
  try {
    const exMap = new Map(exercises.map(e=> [e.id, e]));
    // Volume trend across weeks (aggregate set counts per muscle)
    const weekMuscle: Record<string, Record<string, number>> = {};
    sessions.forEach(s=> {
      const wk = `P${(s.phaseNumber||s.phase||1)}-W${s.weekNumber}`;
      if(!weekMuscle[wk]) weekMuscle[wk] = {};
      s.entries.forEach(e=> {
        const ex = exMap.get(e.exerciseId); const muscle = ex?.muscleGroup || 'other';
        const completedSets = e.sets.filter(st=> (st.reps||0)>0).length;
        if(completedSets>0) weekMuscle[wk][muscle] = (weekMuscle[wk][muscle]||0)+completedSets;
      });
    });
    const volumeTrend = Object.entries(weekMuscle)
      .sort((a,b)=> a[0].localeCompare(b[0]))
      .map(([wk, mus])=> ({ week:wk, ...mus }));

    // Undertrained detection (avg sets per week < threshold)
    const totals: Record<string, number> = {}; const weeksCount = Object.keys(weekMuscle).length || 1;
    Object.values(weekMuscle).forEach(mus=> { Object.entries(mus).forEach(([mg, val])=> { totals[mg]=(totals[mg]||0)+val; })});
    const undertrained = Object.entries(totals)
      .map(([mg,val])=> ({ muscle:mg, avgSets: val/weeksCount }))
      .filter(x=> x.avgSets < 8)
      .sort((a,b)=> a.avgSets - b.avgSets)
      .slice(0,5);

    // Intensity distribution (rep range buckets)
    const buckets: Record<string, number> = { '1-3':0,'4-6':0,'7-9':0,'10-12':0,'13+':0 };
    sessions.forEach(s=> s.entries.forEach(e=> e.sets.forEach(st=> { const r=st.reps||0; if(r===0) return; if(r<=3) buckets['1-3']++; else if(r<=6) buckets['4-6']++; else if(r<=9) buckets['7-9']++; else if(r<=12) buckets['10-12']++; else buckets['13+']++; }))); 
    const totalSetsLogged = Object.values(buckets).reduce((a,b)=> a+b,0)||1;
    const intensityDist = Object.entries(buckets).map(([bucket, sets])=> ({ bucket, sets: Math.round((sets/totalSetsLogged)*100) }));

    // Plateau detector
    const byExWeek: Record<string, { week:string; score:number }[]> = {};
    sessions.forEach(s=> { const wk=`${s.phaseNumber||s.phase||1}-${s.weekNumber}`; s.entries.forEach(e=> {
      const top = e.sets.reduce((m,st)=> Math.max(m,(st.weightKg||0)*(st.reps||0)),0);
      if(!byExWeek[e.exerciseId]) byExWeek[e.exerciseId]=[];
      byExWeek[e.exerciseId].push({ week:wk, score: top });
    })});
    const plateauList: { exercise:string; changePct:number }[] = [];
    Object.entries(byExWeek).forEach(([exId, arr])=> { if(arr.length<2) return; const byWeek: Record<string, number> = {}; arr.forEach(r=> { byWeek[r.week] = Math.max(byWeek[r.week]||0, r.score); }); const seq = Object.entries(byWeek).sort((a,b)=> a[0].localeCompare(b[0])); if(seq.length<4) return; const first = seq[0][1]; const last = seq[seq.length-1][1]; if(first>0){ const change = (last-first)/first; if(change < 0.01){ plateauList.push({ exercise: exMap.get(exId)?.name || exId, changePct: +(change*100).toFixed(1) }); } } });
    plateauList.sort((a,b)=> a.changePct - b.changePct);
    const plateaus = plateauList.slice(0,8);

    (self as any).postMessage({ volumeTrend, intensityDist, plateaus, undertrained });
  } catch (err:any) {
    (self as any).postMessage({ error: err?.message || String(err) });
  }
};
