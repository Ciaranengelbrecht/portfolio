import ChartPanel from "../../components/ChartPanel";
import GlassCard from "../../components/GlassCard";
import ProgressBars from "../../components/ProgressBars";
import { useEffect, useState } from "react";
import { db } from "../../lib/db";
import { computeLoggedSetVolume } from "../../lib/volume";
import { getDashboardPrefs, getSettings } from "../../lib/helpers";

export default function Dashboard() {
  const [phase, setPhase] = useState(1);
  const [week, setWeek] = useState(1);
  const [muscleWeek, setMuscleWeek] = useState<Record<string, number>>({});
  const [muscleTotals, setMuscleTotals] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [perWeek, setPerWeek] = useState<Record<number, Record<string, number>>>({});
  useEffect(() => {
    (async () => {
      const prefs = await getDashboardPrefs();
      if (prefs.lastLocation) {
        setPhase(prefs.lastLocation.phaseNumber);
        setWeek(prefs.lastLocation.weekNumber);
      }
      // compute logged sets
      const phaseNum = prefs.lastLocation?.phaseNumber || 1;
  const settings = await getSettings();
  setTargets(settings.volumeTargets || {});
  const { perWeek, totals } = await computeLoggedSetVolume(phaseNum);
  setPerWeek(perWeek);
  setMuscleWeek(perWeek[prefs.lastLocation?.weekNumber || 1] || {});
  setMuscleTotals(totals);
    })();
  }, []);
  // refresh when sessions change realtime
  useEffect(()=>{
  const onChange = (e:any)=>{ if(['sessions','exercises','settings'].includes(e?.detail?.table)){ (async()=>{ const settings = await getSettings(); setTargets(settings.volumeTargets || {}); const { perWeek, totals } = await computeLoggedSetVolume(phase); setPerWeek(perWeek); setMuscleWeek(perWeek[week]||{}); setMuscleTotals(totals); })(); } };
    window.addEventListener('sb-change', onChange as any);
    return ()=> window.removeEventListener('sb-change', onChange as any);
  }, [phase, week]);
  return (
    <div className="space-y-4">
      <ProgressBars />
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Training</div>
          <ChartPanel kind="exercise" />
        </div>
        <div>
          <div className="font-medium mb-2">Body</div>
          <ChartPanel kind="measurement" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="font-medium">Week {week} Logged Volume (Weighted Sets)</div>
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
        </div>
        <div className="space-y-2">
          <div className="font-medium">Phase Totals (Weighted Sets)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(muscleTotals).sort((a,b)=> b[1]-a[1]).map(([m,v])=> { const max=Math.max(1,...Object.values(muscleTotals)); const pct=(v/max)*100; return (
              <div key={m} className="bg-white/5 rounded-lg px-2 py-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400"><span className="capitalize">{m}</span><span className="tabular-nums">{v.toFixed(1)}</span></div>
                <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{width:`${pct}%`}} /></div>
              </div>
            ); })}
            {!Object.keys(muscleTotals).length && <div className="col-span-full text-[11px] text-gray-500">No logged sets yet.</div>}
          </div>
        </div>
      </div>
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="font-medium">Phase Weekly Compliance</div>
  <div className="text-[11px] text-gray-400">Color shows adherence vs target (green &gt;=100%, amber 70-99%, red &lt;70%).</div>
        <div className="space-y-2">
          {Object.keys(targets).filter(m=> targets[m]>0).sort().map(m=> {
            const rows = Object.entries(perWeek).sort((a,b)=> Number(a[0])-Number(b[0]));
            return (
              <div key={m} className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 flex justify-between"><span>{m}</span><span className="tabular-nums">{targets[m]}</span></div>
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
      </div>
    </div>
  );
}
