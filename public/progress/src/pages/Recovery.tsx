import { useEffect, useState, useCallback } from 'react';
import { getRecovery, refreshRecovery, MuscleRecoveryState } from '../lib/recovery';
import { MUSCLE_ICON_PATHS } from '../lib/muscles';

interface ViewState {
  loading: boolean;
  error?: string;
  updatedAt?: number;
  muscles: MuscleRecoveryState[];
}

const ORDER: (keyof typeof MUSCLE_ICON_PATHS)[] = [
  'chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','other'
];

function formatETA(ms?: number){
  if(!ms) return '';
  const now = Date.now();
  if(ms <= now) return 'Ready';
  const diff = ms - now;
  const h = Math.floor(diff/3600000);
  const m = Math.floor((diff%3600000)/60000);
  if(h <= 0) return `${m}m`;
  if(h < 10) return `${h}h ${m}m`;
  return `${h}h`;
}

function statusColor(status: MuscleRecoveryState['status']){
  switch(status){
    case 'Ready': return 'from-emerald-400/70 to-emerald-500/70';
    case 'Near': return 'from-lime-300/70 to-amber-300/70';
    case 'Caution': return 'from-amber-400/60 to-orange-500/70';
    case 'Not Ready': return 'from-rose-500/70 to-red-600/70';
  }
}

function barBg(status: MuscleRecoveryState['status']){
  switch(status){
    case 'Ready': return 'bg-emerald-500/25';
    case 'Near': return 'bg-lime-400/25';
    case 'Caution': return 'bg-amber-500/25';
    case 'Not Ready': return 'bg-red-600/25';
  }
}

export default function RecoveryPage(){
  const [view, setView] = useState<ViewState>({ loading: true, muscles: [] });
  const load = useCallback(async(force?:boolean)=>{
    try {
      const data = await getRecovery(force);
      setView({ loading:false, muscles: data.muscles, updatedAt: data.updatedAt });
    } catch(e:any){
      setView(v=> ({...v, loading:false, error: e?.message||'Failed to compute recovery'}));
    }
  },[]);
  useEffect(()=>{ load(); },[load]);

  // Periodic refresh (hourly) + visibility change to keep fresh
  useEffect(()=>{
    const t = setInterval(()=> load(true), 60*60*1000);
    const onVis = ()=> { if(document.visibilityState==='visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return ()=> { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  },[load]);

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-baseline gap-4 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight">Recovery</h1>
        {view.updatedAt && <span className="text-xs text-slate-400">Updated {new Date(view.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
        <button onClick={()=> load(true)} className="ml-auto text-xs rounded-md bg-white/5 hover:bg-white/10 px-2 py-1 font-medium text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">Refresh</button>
      </header>
      {view.error && <div className="text-sm text-red-400">{view.error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ORDER.map(m=> {
          const rec = view.muscles.find(x=> x.muscle === m);
          const pct = rec? rec.percent: 100;
          const status = rec? rec.status: 'Ready';
          const eta = rec?.etaFull;
          return (
            <div key={m} className="relative rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/40 to-slate-900/60 p-4 flex flex-col gap-3 shadow-inner shadow-black/30">
              <div className="flex items-center gap-3">
                <img src={MUSCLE_ICON_PATHS[m]} alt="" className="w-10 h-10 object-contain opacity-80" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-medium capitalize tracking-wide">{m}</h2>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gradient-to-r ${statusColor(status)} text-slate-900 shadow`}>{status}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">{status === 'Ready'? 'Fully recovered or low residual fatigue' : status === 'Near'? 'Approaching readiness' : status === 'Caution'? 'Moderate residual fatigue' : 'High residual fatigue'}</div>
                </div>
                <div className="text-right text-sm font-semibold tabular-nums w-12">{pct.toFixed(0)}%</div>
              </div>
              <div className="relative h-3 rounded-md overflow-hidden bg-slate-700/40">
                <div className={`absolute inset-y-0 left-0 ${barBg(status)} bg-gradient-to-r ${statusColor(status)} backdrop-blur-sm`} style={{ width: pct+'%' }} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0)_100%)] bg-[length:180px_100%] animate-[shimmer_4s_linear_infinite] opacity-30 mix-blend-overlay" />
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>{pct>=99? 'Ready to train' : pct>=90? 'Trainable w/ normal volume' : pct>=75? 'Light / technique work OK' : pct>=50? 'Maybe isolate or low load' : 'Consider rest or deload'}</span>
                <span className="text-slate-300 font-medium">{formatETA(eta)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="pt-2 text-[10px] text-slate-500 leading-relaxed max-w-2xl">
        <p><strong className="font-semibold text-slate-300">Model Disclaimer:</strong> Heuristic recovery estimation using exponential decay of training stress (sets × reps × load proxy). Actual recovery varies with sleep, nutrition, stress, genetics. Treat as guidance not prescription.</p>
      </footer>
    </div>
  );
}
