import { useEffect, useState, useMemo } from "react";
import { volumeByMuscleGroup } from "../lib/helpers";
import { loadRecharts } from "../lib/loadRecharts";
import { db } from "../lib/db";
import { Measurement, Session, Settings, Exercise, UserProgram } from "../lib/types";
import { getProfileProgram } from '../lib/profile';
import UnifiedTooltip from "../components/UnifiedTooltip";
// Recharts is lazy loaded; see RC state
import DashboardDeloadTable from "./DashboardDeloadTable";
import ProgressBars from "../components/ProgressBars";

// Lightweight animated number hook respecting reduced motion
function useAnimatedNumber(value:number, duration=600){
  const [display,setDisplay]=useState(value);
  useEffect(()=>{ if((document.documentElement.getAttribute('data-reduced-motion')==='true')){ setDisplay(value); return; } let start:number|undefined; const from=display; const diff=value-from; if(diff===0) return; const d= Math.max(200,duration); function step(ts:number){ if(start==null) start=ts; const t = (ts-start)/d; const eased = t<1? (1-Math.pow(1-t,3)):1; setDisplay(from + diff*eased); if(t<1) requestAnimationFrame(step); else setDisplay(value); } const r = requestAnimationFrame(step); return ()=> cancelAnimationFrame(r); },[value]);
  return Math.round(display*100)/100;
}

export default function Dashboard() {
  const [week, setWeek] = useState(1);
  const [volume, setVolume] = useState<
    Record<string, { tonnage: number; sets: number }>
  >({});
  const [weights, setWeights] = useState<{ date: string; weight: number }[]>(
    []
  );
  const [waist, setWaist] = useState<{ date: string; value: number }[]>([]);
  const [arm, setArm] = useState<{ date: string; value: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [targetDays, setTargetDays] = useState(6);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [weeklyRecap, setWeeklyRecap] = useState<{ volume:number; prCount:number; bodyDelta?:number; adherence:number }|null>(null);
  // Analytics
  const [volumeTrend, setVolumeTrend] = useState<any[]>([]); // per week aggregated sets per muscle
  const [intensityDist, setIntensityDist] = useState<{ bucket:string; sets:number }[]>([]);
  const [plateaus, setPlateaus] = useState<{ exercise:string; changePct:number }[]>([]);
  const [undertrained, setUndertrained] = useState<{ muscle:string; avgSets:number }[]>([]);
  const [RC, setRC] = useState<any | null>(null);
  useEffect(() => { loadRecharts().then(m => setRC(m)); }, []);

  useEffect(() => {
    volumeByMuscleGroup(week).then(setVolume);
  }, [week]);
  useEffect(() => {
    (async () => {
      const m = await db.getAll<Measurement>("measurements");
      setWeights(
        m
          .filter((x) => x.weightKg)
          .map((x) => ({ date: x.dateISO.slice(5), weight: x.weightKg! }))
      );
      setWaist(
        m
          .filter((x) => x.waist)
          .map((x) => ({ date: x.dateISO.slice(5), value: x.waist! }))
      );
      setArm(
        m
          .filter((x) => x.upperArm)
          .map((x) => ({ date: x.dateISO.slice(5), value: x.upperArm! }))
      );
      // streaks / xp / achievements
      const sessions = await db.getAll<Session>('sessions');
      // simple streak: consecutive days with at least one session entry (weight or reps logged) ending today
      const today = new Date();
      const dayKey = (d:Date)=> d.toISOString().slice(0,10);
      const sessionDays = new Set<string>();
      sessions.forEach(s=> { if(s.entries.some(e=> e.sets.some(st=> (st.reps||0)>0 || (st.weightKg||0)>0))) sessionDays.add(s.dateISO.slice(0,10)); });
      let curStreak=0; let cursor = new Date();
      while(sessionDays.has(dayKey(cursor))){ curStreak++; cursor.setDate(cursor.getDate()-1); }
      setStreak(curStreak);
  // target days derived from program (non-Rest days) else settings fallback
  const settings = await db.get<Settings>('settings','app');
  let program: UserProgram | undefined;
  try { program = await getProfileProgram(); } catch {}
  const nonRest = program ? program.weeklySplit.filter(d=> d.type!=='Rest').length : undefined;
  setTargetDays(nonRest || settings?.progress?.weeklyTargetDays || 6);
      // simple XP: total sets logged * 5 + PR count * 20
      let totalSets=0; let prCount=0; // naive: PR if heaviest set weight*reps highest for exercise in history
      const byEx: Record<string, number> = {};
      sessions.forEach(s=> s.entries.forEach(e=> e.sets.forEach(st=> {
        totalSets++; const score=(st.weightKg||0)*(st.reps||0); if(score>0){ if(score > (byEx[e.exerciseId]||0)){ byEx[e.exerciseId]=score; prCount++; } }
      })));
      const earnedXp = totalSets*5 + prCount*20;
      setXp(earnedXp);
      setLevel(Math.max(1, Math.floor(Math.sqrt(earnedXp)/3)+1));
      const ach:string[] = [];
      if(curStreak>=7) ach.push('7 Day Streak');
      if(curStreak>=21) ach.push('21 Day Streak');
      if(prCount>=10) ach.push('10 PRs');
      if(totalSets>=400) ach.push('Volume Grinder');
      setAchievements(ach);
      // weekly recap for last 7 days
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-6);
      let weekVolume=0; let weekSessions=0; let weekPR=0;
      sessions.filter(s=> new Date(s.dateISO)>=weekAgo).forEach(s=> { let sessionVol=0; s.entries.forEach(e=> e.sets.forEach(st=> { weekVolume += (st.weightKg||0)*(st.reps||0); sessionVol += (st.weightKg||0)*(st.reps||0);})); if(sessionVol>0) weekSessions++; });
      weekPR = prCount; // reuse naive count
  const windowLen = program ? program.weeklySplit.length : 7;
  const loggedInWindow = Array.from({length: windowLen},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return sessionDays.has(dayKey(d)); }).filter(Boolean).length;
  const denominator = targetDays || 6;
  const adherence = (loggedInWindow/denominator)*100;
      const bwLast7 = m.filter(x=> new Date(x.dateISO)>=weekAgo).sort((a,b)=> a.dateISO.localeCompare(b.dateISO));
      let bodyDelta: number|undefined = undefined;
      if(bwLast7.length>=2) bodyDelta = (bwLast7[bwLast7.length-1].weightKg||0) - (bwLast7[0].weightKg||0);
      setWeeklyRecap({ volume: weekVolume, prCount: weekPR, bodyDelta, adherence });

      // ----- Analytics & Insight Features (web worker) -----
      const exercises = await db.getAll<Exercise>('exercises');
      try {
        const worker = new Worker(new URL('../workers/analyticsWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (evt) => {
          const { volumeTrend, intensityDist, plateaus, undertrained, error } = evt.data || {};
            if(error){ console.warn('[AnalyticsWorker] error', error); worker.terminate(); return; }
            if(volumeTrend) setVolumeTrend(volumeTrend);
            if(intensityDist) setIntensityDist(intensityDist);
            if(plateaus) setPlateaus(plateaus);
            if(undertrained) setUndertrained(undertrained);
            worker.terminate();
        };
        worker.postMessage({ sessions, exercises });
      } catch(err){
        console.warn('[Dashboard] worker fallback', err);
      }
    })();
  }, []);

  const volData = useMemo(
    () =>
      Object.entries(volume).map(([k, v]) => ({
        group: k,
        tonnage: v.tonnage,
        sets: v.sets,
      })),
    [volume]
  );

  // Build min/max metadata for line series
  const weightMinMax = useMemo(()=>{ if(!weights.length) return undefined; const vals=weights.map(w=> w.weight); return { weight: { min: Math.min(...vals), max: Math.max(...vals) } }; },[weights]);
  const waistMinMax = useMemo(()=>{ if(!waist.length) return undefined; const vals=waist.map(w=> w.value); return { value: { min: Math.min(...vals), max: Math.max(...vals) } }; },[waist]);
  const armMinMax = useMemo(()=>{ if(!arm.length) return undefined; const vals=arm.map(w=> w.value); return { value: { min: Math.min(...vals), max: Math.max(...vals) } }; },[arm]);
  const volumeTrendMinMax = useMemo(()=>{ if(!volumeTrend.length) return undefined; const out: Record<string,{min:number;max:number}> = {}; volumeTrend.forEach(row=> { Object.keys(row).forEach(k=> { if(k==='week') return; const v=row[k]; if(typeof v!=='number' || isNaN(v)) return; if(!out[k]) out[k]={min:v,max:v}; else { if(v<out[k].min) out[k].min=v; if(v>out[k].max) out[k].max=v; } }); }); return out; },[volumeTrend]);
  const prevPoint = (series:string,label:any, rows:any[], keyField:string)=> { const idx = rows.findIndex(r=> r[keyField]===label); if(idx>0){ const prev = rows[idx-1]; return prev?.[series]; } return undefined; };

  const animXp = useAnimatedNumber(xp);
  const animWeekVol = useAnimatedNumber(weeklyRecap?.volume||0);
  const animPR = useAnimatedNumber(weeklyRecap?.prCount||0);
  const animAdh = useAnimatedNumber(weeklyRecap?.adherence||0);
  return (
    <div className="space-y-6">
      <ProgressBars />
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <select
          className="bg-card rounded-xl px-3 py-2"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
        >
          {Array.from({ length: 9 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2 flex items-center justify-between">Streak & XP <span className="text-xs text-gray-400">Lvl {level}</span></h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Current streak</span>
              <span className="font-medium">{streak}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Target / week</span>
              <span>{targetDays}d</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">XP</div>
              <div className="h-3 bg-slate-700/50 rounded overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-[width] duration-300" style={{width: `${Math.min(100, (xp % 1000)/10)}%`}} />
              </div>
              <div className="text-[10px] text-gray-500 mt-1 tabular-nums">{animXp.toFixed(0)} XP</div>
            </div>
            {achievements.length>0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Achievements</div>
                <div className="flex flex-wrap gap-1">
                  {achievements.map(a=> <span key={a} className="badge" data-variant="info">{a}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Weekly Recap</h3>
          {weeklyRecap ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Volume</div>
                <div className="font-semibold tabular-nums">{Math.round(animWeekVol)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">PRs</div>
                <div className="font-semibold tabular-nums">{Math.round(animPR)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">BW Δ</div>
                <div className="font-semibold tabular-nums">{weeklyRecap.bodyDelta?.toFixed(1) ?? '—'} kg</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Adherence</div>
                <div className="font-semibold tabular-nums">{Math.round(animAdh)}%</div>
              </div>
            </div>
          ): <div className="text-xs text-gray-500">Need more data for recap.</div>}
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Weekly Volume by Muscle Group</h3>
          <div className="h-56">
            {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.BarChart data={volData}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="group" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip content={({active,payload,label}:any)=> <UnifiedTooltip active={active} payload={payload} label={label} context={{ seriesMinMax: weightMinMax, previousPointLookup:(s,l)=> prevPoint(s,l,weights,'date') }} />} />
                  <RC.Bar dataKey="tonnage" fill="#3b82f6" name="Tonnage" />
                  <RC.Bar dataKey="sets" fill="#f59e0b" name="Sets" />
                </RC.BarChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Bodyweight (kg)</h3>
          <div className="h-56">
            {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={weights}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="date" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip content={({active,payload,label}:any)=> <UnifiedTooltip active={active} payload={payload} label={label} context={{ seriesMinMax: waistMinMax, previousPointLookup:(s,l)=> prevPoint(s,l,waist,'date') }} />} />
                  <RC.Line type="monotone" dataKey="weight" stroke="#3b82f6" dot={false} />
                    {/* PR marker (max weight) */}
                    {weights.length>1 && (()=> { const max = Math.max(...weights.map(w=> w.weight)); const idx = weights.findIndex(w=> w.weight===max); if(idx>=0){ const pt = weights[idx]; return <RC.Scatter data={[pt]} shape={(props:any)=> <rect x={props.cx-3} y={props.cy-3} width={6} height={6} className="pr-marker" /> } /> } return null; })()}
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Waist (cm)</h3>
          <div className="h-56">
            {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={waist}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="date" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip content={({active,payload,label}:any)=> <UnifiedTooltip active={active} payload={payload} label={label} context={{ seriesMinMax: armMinMax, previousPointLookup:(s,l)=> prevPoint(s,l,arm,'date') }} />} />
                  <RC.Line type="monotone" dataKey="value" stroke="#ef4444" dot={false} />
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Upper Arm (cm)</h3>
          <div className="h-56">
            {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={arm}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="date" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip content={({active,payload,label}:any)=> <UnifiedTooltip active={active} payload={payload} label={label} context={{ seriesMinMax: volumeTrendMinMax, previousPointLookup:(s,l)=> prevPoint(s,l,volumeTrend,'week') }} />} />
                  <RC.Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} />
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <DashboardDeloadTable />

      {/* Analytics & Insights */}
      <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft xl:col-span-2">
          <h3 className="font-medium mb-2 flex items-center justify-between">Muscle Volume Trend<span className="text-[10px] text-gray-500">Sets / completed</span></h3>
          <div className="h-64">
            {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={volumeTrend}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="week" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip content={({active,payload,label}:any)=> <UnifiedTooltip active={active} payload={payload} label={label} />} />
                  <RC.Legend />
                  {['chest','back','legs','shoulders','arms','core','glutes'].filter(m=> volumeTrend.some(r=> r[m])).map((m,i)=> {
                    const palette=['#f87171','#60a5fa','#34d399','#fbbf24','#c084fc','#f472b6','#a3e635'];
                    return <RC.Line key={m} type="monotone" dataKey={m} name={m} stroke={palette[i%palette.length]} dot={false} />
                  })}
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
          {!!undertrained.length && (
            <div className="mt-3 text-[11px] flex flex-wrap gap-2">
              {undertrained.map(u=> <span key={u.muscle} className="badge" data-variant="danger">{u.muscle}: {u.avgSets.toFixed(1)} avg</span>)}
            </div>
          )}
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Intensity Distribution</h3>
          <div className="h-64">
            {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.BarChart data={intensityDist}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="bucket" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip content={({active,payload,label}:any)=> <UnifiedTooltip active={active} payload={payload} label={label} />} />
                  <RC.Bar dataKey="sets" name="% Sets" fill="#6366f1" />
                </RC.BarChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft xl:col-span-3">
          <h3 className="font-medium mb-2">Plateau Watch</h3>
          {!plateaus.length && <div className="text-xs text-gray-500">No plateaus detected (need ≥4 weeks history).</div>}
          {!!plateaus.length && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
              {plateaus.map(p=> (
                <div key={p.exercise} className="bg-white/5 rounded px-2 py-2 flex items-center justify-between">
                  <span className="truncate max-w-[140px]" title={p.exercise}>{p.exercise}</span>
                  <span className="text-danger">{p.changePct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
