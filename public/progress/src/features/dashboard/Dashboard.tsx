import ChartPanel from "../../components/ChartPanel";
import GlassCard from "../../components/GlassCard";
import ProgressBars from "../../components/ProgressBars";
import { useEffect, useState } from "react";
import { db } from "../../lib/db";
import { computeLoggedSetVolume } from "../../lib/volume";
import { getDashboardPrefs, getSettings, setDashboardPrefs } from "../../lib/helpers";
import { getAllCached } from "../../lib/dataCache";
import { Settings } from "../../lib/types";
import { useAggregates } from '../../lib/useAggregates';

export default function Dashboard() {
  const [phase, setPhase] = useState(1);
  const [week, setWeek] = useState(1);
  const [muscleWeek, setMuscleWeek] = useState<Record<string, number>>({});
  const [muscleTotals, setMuscleTotals] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [perWeek, setPerWeek] = useState<Record<number, Record<string, number>>>({});
  const [hidden,setHidden] = useState<NonNullable<Settings['dashboardPrefs']>['hidden']>({});
  const [weeklyBar,setWeeklyBar] = useState<{muscle:string; value:number}[]>([]);
  const [loading,setLoading] = useState(true);
  const { data: aggs } = useAggregates();
  useEffect(() => {
    (async () => {
      const prefs = await getDashboardPrefs();
      if (prefs.lastLocation) {
        setPhase(prefs.lastLocation.phaseNumber);
        setWeek(prefs.lastLocation.weekNumber);
      }
      setHidden(prefs.hidden || {});
      // compute logged sets (preload data once to avoid duplicate queries)
      const phaseNum = prefs.lastLocation?.phaseNumber || 1;
      const settings = await getSettings();
      setTargets(settings.volumeTargets || {});
      const [sessions, exercises] = await Promise.all([
        getAllCached('sessions'),
        getAllCached('exercises')
      ]);
      const { perWeek, totals } = await computeLoggedSetVolume(phaseNum, { sessions, exercises });
      setPerWeek(perWeek);
      const wkNum = prefs.lastLocation?.weekNumber || 1;
      // Prefer precomputed weekly volume (aggregates) if available
      if(aggs){
        const key = `P${phaseNum}-W${wkNum}`;
        setMuscleWeek(aggs.weeklyVolume[key] || {});
      } else {
        setMuscleWeek(perWeek[wkNum] || {});
      }
      setMuscleTotals(totals);
  const wk = aggs ? (aggs.weeklyVolume[`P${phaseNum}-W${wkNum}`]||{}) : (perWeek[wkNum] || {});
      setWeeklyBar(Object.entries(wk).map(([m,v])=> ({ muscle:m, value:v })).sort((a,b)=> b.value-a.value));
      setLoading(false);
    })();
  }, []);
  // refresh when sessions change realtime
  useEffect(()=>{
  const onChange = (e:any)=>{ if(['sessions','exercises','settings'].includes(e?.detail?.table)){ (async()=>{ const settings = await getSettings(); setTargets(settings.volumeTargets || {}); const [sessions, exercises] = await Promise.all([getAllCached('sessions',{force:true}), getAllCached('exercises',{force:true})]); const { perWeek, totals } = await computeLoggedSetVolume(phase, { sessions, exercises }); setPerWeek(perWeek); setMuscleWeek(perWeek[week]||{}); setMuscleTotals(totals); const wk=perWeek[week]||{}; setWeeklyBar(Object.entries(wk).map(([m,v])=> ({muscle:m,value:v})).sort((a,b)=> b.value-a.value)); })(); } };
  window.addEventListener('sb-change', onChange as any);
    return ()=> window.removeEventListener('sb-change', onChange as any);
  }, [phase, week]);
  const toggle = async (key: HiddenKey) => {
    const next = { ...(hidden||{}), [key]: !hidden?.[key] };
    setHidden(next);
    await setDashboardPrefs({ hidden: next });
  };

  type HiddenKey = 'trainingChart' | 'bodyChart' | 'weekVolume' | 'phaseTotals' | 'compliance' | 'weeklyMuscleBar';
  const SectionToggle = ({label, flag}:{label:string; flag:HiddenKey}) => (
    <button onClick={()=> toggle(flag)} className={`text-[10px] px-2 py-1 rounded-lg border ${hidden?.[flag]? 'bg-slate-800 text-gray-400 border-white/5':'bg-emerald-600/70 text-white border-emerald-500/40'}`}>{hidden?.[flag]? `Show ${label}`:`Hide ${label}`}</button>
  );

  const WeeklyMuscleBar = () => (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm">Weekly Muscle Volume</div>
        <SectionToggle label="Weekly Bar" flag="weeklyMuscleBar" />
      </div>
      <div className="h-48 flex items-end gap-2 overflow-x-auto pb-2">
        {weeklyBar.map(r=> { const max = Math.max(1,...weeklyBar.map(x=> x.value)); const h = (r.value/max)*100; return (
          <div key={r.muscle} className="flex flex-col items-center w-10">
            <div className="w-full bg-slate-700/50 rounded-t-md relative" style={{height: `${h}%`}}>
              <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white/80">{r.value.toFixed(1)}</div>
            </div>
            <div className="text-[9px] mt-1 capitalize truncate w-full text-center">{r.muscle}</div>
          </div>
        ); })}
        {!weeklyBar.length && <div className="text-[11px] text-gray-500">No data.</div>}
      </div>
    </GlassCard>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-label">
        <SectionToggle label="Training" flag="trainingChart" />
        <SectionToggle label="Body" flag="bodyChart" />
        <SectionToggle label="Week Volume" flag="weekVolume" />
        <SectionToggle label="Phase Totals" flag="phaseTotals" />
        <SectionToggle label="Compliance" flag="compliance" />
        <SectionToggle label="Weekly Bar" flag="weeklyMuscleBar" />
      </div>
      {!hidden?.trainingChart && <div className="space-y-2">
        <div className="text-subtitle">Training</div>
        {loading ? <div className="h-60 rounded-xl bg-white/5 animate-pulse" /> : <ChartPanel kind="exercise" />}
      </div>}
      {!hidden?.bodyChart && <div className="space-y-2">
        <div className="text-subtitle">Body</div>
        {loading ? <div className="h-60 rounded-xl bg-white/5 animate-pulse" /> : <ChartPanel kind="measurement" />}
      </div>}
  {!hidden?.weekVolume && <div className="space-y-3">
        <div className="text-title">Week {week} Logged Volume <span className="text-body-sm text-slate-400 ml-1 align-middle">(Weighted Sets)</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(muscleWeek).sort((a,b)=> b[1]-a[1]).map(([m,v])=> { const tgt = targets[m]||0; const pct = tgt? Math.min(100,(v/tgt)*100): 100; const status = tgt? (v>=tgt? 'bg-emerald-500':'bg-amber-500'): 'bg-emerald-500'; return (
            <div key={m} className="bg-white/5 rounded-lg px-2 py-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400"><span className="capitalize">{m}</span><span className="tabular-nums">{v.toFixed(1)}{tgt?`/${tgt}`:''}</span></div>
              <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden relative">
                <div className={`h-full ${status}`} style={{width:`${pct}%`}} />
                {tgt? <span className="absolute inset-y-0 right-0 text-[8px] text-white/60 pr-1 flex items-center">{Math.round(pct)}%</span>: null}
              </div>
            </div>
          ); })}
          {!Object.keys(muscleWeek).length && <div className="col-span-full text-[11px] text-gray-500">No logged sets yet.</div>}
        </div>
      </div>}
  {!hidden?.phaseTotals && <div className="space-y-3">
        <div className="text-title">Phase Totals <span className="text-body-sm text-slate-400 ml-1 align-middle">(Weighted Sets)</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(muscleTotals).sort((a,b)=> b[1]-a[1]).map(([m,v])=> { const max=Math.max(1,...Object.values(muscleTotals)); const pct=(v/max)*100; return (
            <div key={m} className="bg-white/5 rounded-lg px-2 py-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400"><span className="capitalize">{m}</span><span className="tabular-nums">{v.toFixed(1)}</span></div>
              <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{width:`${pct}%`}} /></div>
            </div>
          ); })}
          {!Object.keys(muscleTotals).length && <div className="col-span-full text-[11px] text-gray-500">No logged sets yet.</div>}
        </div>
      </div>}
  {!hidden?.weeklyMuscleBar && <div className="space-y-3"><WeeklyMuscleBar /></div>}
  {!hidden?.compliance && <div className="bg-card rounded-2xl p-5 shadow-soft space-y-4">
    <div className="text-title">Phase Weekly Compliance</div>
  <div className="text-body-sm text-gray-400">Color shows adherence vs target (green &gt;=100%, amber 70-99%, red &lt;70%).</div>
        <div className="space-y-2">
          {Object.keys(targets).filter(m=> targets[m]>0).sort().map(m=> {
            const rows = Object.entries(perWeek).sort((a,b)=> Number(a[0])-Number(b[0]));
            return (
              <div key={m} className="space-y-1">
        <div className="text-label text-gray-500 flex justify-between"><span>{m}</span><span className="tabular-nums">{targets[m]}</span></div>
                <div className="flex gap-1">
                  {rows.map(([wk, rec])=> { const v = rec[m]||0; const tgt=targets[m]; const ratio = tgt? v/tgt:1; const color = ratio>=1? 'bg-emerald-600': ratio>=0.7? 'bg-amber-500':'bg-red-600'; return (
                    <div key={wk} className="flex-1">
                      <div className="h-8 rounded-md relative overflow-hidden bg-slate-700/40">
                        <div className={`${color} absolute bottom-0 left-0 w-full`} style={{height:`${Math.min(100,ratio*100)}%`}} />
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white/80 font-medium">{v.toFixed(1)}</div>
                      </div>
                      <div className="text-center text-[8px] mt-0.5 text-gray-500">W{wk}</div>
                    </div>
                  ); })}
                </div>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
