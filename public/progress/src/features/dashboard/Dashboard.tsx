import ChartPanel from "../../components/ChartPanel";
import GlassCard from "../../components/GlassCard";
import ProgressBars from "../../components/ProgressBars";
import { useEffect, useState } from "react";
import { db } from "../../lib/db";
import { computeLoggedSetVolume } from "../../lib/volume";
import { getDashboardPrefs } from "../../lib/helpers";

export default function Dashboard() {
  const [phase, setPhase] = useState(1);
  const [week, setWeek] = useState(1);
  const [muscleWeek, setMuscleWeek] = useState<Record<string, number>>({});
  const [muscleTotals, setMuscleTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const prefs = await getDashboardPrefs();
      if (prefs.lastLocation) {
        setPhase(prefs.lastLocation.phaseNumber);
        setWeek(prefs.lastLocation.weekNumber);
      }
      // compute logged sets
      const phaseNum = prefs.lastLocation?.phaseNumber || 1;
      const { perWeek, totals } = await computeLoggedSetVolume(phaseNum);
      setMuscleWeek(perWeek[prefs.lastLocation?.weekNumber || 1] || {});
      setMuscleTotals(totals);
    })();
  }, []);
  // refresh when sessions change realtime
  useEffect(()=>{
    const onChange = (e:any)=>{ if(['sessions','exercises'].includes(e?.detail?.table)){ (async()=>{ const { perWeek, totals } = await computeLoggedSetVolume(phase); setMuscleWeek(perWeek[week]||{}); setMuscleTotals(totals); })(); } };
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
            {Object.entries(muscleWeek).sort((a,b)=> b[1]-a[1]).map(([m,v])=> { const max=Math.max(1,...Object.values(muscleWeek)); const pct=(v/max)*100; return (
              <div key={m} className="bg-white/5 rounded-lg px-2 py-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400"><span className="capitalize">{m}</span><span className="tabular-nums">{v.toFixed(1)}</span></div>
                <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden"><div className="h-full bg-emerald-500" style={{width:`${pct}%`}} /></div>
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
    </div>
  );
}
