import ChartPanel from "../../components/ChartPanel";
import GlassCard from "../../components/GlassCard";
import ProgressBars from "../../components/ProgressBars";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { fadeSlideUp, maybeDisable } from '../../lib/motion';
import { db } from "../../lib/db";
import { computeLoggedSetVolume } from "../../lib/volume";
import { getDashboardPrefs, getSettings, setDashboardPrefs } from "../../lib/helpers";
import { getAllCached } from "../../lib/dataCache";
import { Settings, UserProgram } from "../../lib/types";
import { getProfileProgram } from '../../lib/profile';
import { loadRecharts } from '../../lib/loadRecharts';
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
  const [sessionsState, setSessionsState] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [highlightWeek, setHighlightWeek] = useState<number | null>(null);
  const [dayVolumes, setDayVolumes] = useState<Record<number, Record<number, number>>>({}); // week -> day -> volume
  const [program, setProgram] = useState<UserProgram | null>(null);
  const [dayLabels, setDayLabels] = useState<string[]>([]); // derived from program.weeklySplit
  const [RC,setRC] = useState<any|null>(null);
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
      setSessionsState(sessions as any[]);
      const { perWeek, totals } = await computeLoggedSetVolume(phaseNum, { sessions, exercises });
      setPerWeek(perWeek);
      // build day volume matrix (tonnage)
      const dv: Record<number, Record<number, number>> = {};
      (sessions as any[]).filter(s=> (s.phaseNumber || s.phase || 1) === phaseNum).forEach(sess=> {
        const w = sess.weekNumber;
        const dayId = Number((sess.id||'').split('-')[2]) || 0;
        let vol = 0;
        for(const entry of (sess.entries||[])){
          for(const set of (entry.sets||[])){
            if(typeof set.weightKg === 'number' && typeof set.reps === 'number' && (set.weightKg||0) > 0 && (set.reps||0) > 0){
              vol += (set.weightKg||0) * (set.reps||0);
            }
          }
        }
        if(!dv[w]) dv[w] = {};
        dv[w][dayId] = (dv[w][dayId]||0) + vol;
      });
  setDayVolumes(dv);
  // load program for day labels
  try { const prog = await getProfileProgram(); setProgram(prog); } catch {}
  // lazy load recharts bundle for improved visualization
  loadRecharts().then(m=> setRC(m));
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
  const onChange = (e:any)=>{ if(['sessions','exercises','settings'].includes(e?.detail?.table)){ (async()=>{ const settings = await getSettings(); setTargets(settings.volumeTargets || {}); const [sessions, exercises] = await Promise.all([getAllCached('sessions',{force:true}), getAllCached('exercises',{force:true})]); setSessionsState(sessions as any[]); const { perWeek, totals } = await computeLoggedSetVolume(phase, { sessions, exercises }); setPerWeek(perWeek); setMuscleWeek(perWeek[week]||{}); setMuscleTotals(totals); const wk=perWeek[week]||{}; setWeeklyBar(Object.entries(wk).map(([m,v])=> ({muscle:m,value:v})).sort((a,b)=> b.value-a.value)); // recompute day volumes
    const dv: Record<number, Record<number, number>> = {}; (sessions as any[]).filter(s=> (s.phaseNumber || s.phase || 1) === phase).forEach(sess=> { const w = sess.weekNumber; const dayId = Number((sess.id||'').split('-')[2]) || 0; let vol = 0; for(const entry of (sess.entries||[])){ for(const set of (entry.sets||[])){ if(typeof set.weightKg === 'number' && typeof set.reps === 'number' && (set.weightKg||0)>0 && (set.reps||0)>0){ vol += (set.weightKg||0)*(set.reps||0); } } } if(!dv[w]) dv[w] = {}; dv[w][dayId] = (dv[w][dayId]||0) + vol; }); setDayVolumes(dv); })(); } };
  window.addEventListener('sb-change', onChange as any);
    return ()=> window.removeEventListener('sb-change', onChange as any);
  }, [phase, week]);
  // derive day labels whenever program changes
  useEffect(()=>{
    if(program?.weeklySplit){
      setDayLabels(program.weeklySplit.map(d=> d.customLabel || d.type));
    } else {
      // fallback: infer from existing day ids in data (D1..)
      const ids = Array.from(new Set(Object.values(dayVolumes).flatMap(rec=> Object.keys(rec).map(Number)))).sort((a,b)=> a-b);
      setDayLabels(ids.map(id=> `D${id+1}`));
    }
  },[program?.id, (program as any)?.weeklySplit?.length, Object.keys(dayVolumes).length]);

  const toggle = async (key: HiddenKey) => {
    const next = { ...(hidden||{}), [key]: !hidden?.[key] };
    setHidden(next);
    await setDashboardPrefs({ hidden: next });
  };

  type HiddenKey = 'trainingChart' | 'bodyChart' | 'weekVolume' | 'phaseTotals' | 'compliance' | 'weeklyMuscleBar' | 'sessionVolumeTrend';
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
        <SectionToggle label="Session Volume" flag="sessionVolumeTrend" />
      </div>
      <AnimatePresence initial={false}>
      {!hidden?.trainingChart && <motion.div key="training" className="space-y-2" variants={maybeDisable(fadeSlideUp)} initial="initial" animate="animate" exit="exit">
        <div className="text-subtitle">Training</div>
        {loading ? <div className="h-60 rounded-xl bg-white/5 animate-pulse" /> : <ChartPanel kind="exercise" />}
      </motion.div>}
      {!hidden?.bodyChart && <motion.div key="body" className="space-y-2" variants={maybeDisable(fadeSlideUp)} initial="initial" animate="animate" exit="exit">
        <div className="text-subtitle">Body</div>
        {loading ? <div className="h-60 rounded-xl bg-white/5 animate-pulse" /> : <ChartPanel kind="measurement" />}
      </motion.div>}
  {!hidden?.weekVolume && <motion.div key="weekVol" className="space-y-3" variants={maybeDisable(fadeSlideUp)} initial="initial" animate="animate" exit="exit">
        <div className="text-title">Week {week} Logged Volume <span className="text-body-sm text-slate-400 ml-1 align-middle">(Weighted Sets)</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(muscleWeek).sort((a,b)=> b[1]-a[1]).map(([m,v])=> {
            const tgt = targets[m]||0;
            const pct = tgt? Math.min(100,(v/tgt)*100): 100;
            const status = tgt? (v>=tgt? 'bg-emerald-500':'bg-amber-500'): 'bg-emerald-500';
            const prev = (perWeek[week-1] && perWeek[week-1][m]) || 0;
            const delta = v - prev;
            const arrow = delta>0? '▲': delta<0? '▼':'–';
            const deltaClass = delta>0? 'text-emerald-400': delta<0? 'text-red-400':'text-gray-400';
            return (
              <motion.div key={m} className="bg-white/5 rounded-lg px-2 py-2 space-y-1" initial={{opacity:0, y:12}} animate={{opacity:1, y:0}} exit={{opacity:0, y:4}} transition={{duration:.25}} title={`Prev Week: ${prev.toFixed(1)} | Delta: ${delta>=0?'+':''}${delta.toFixed(1)}`}>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="capitalize flex items-center gap-1">
                    {m}
                    <span className={`inline-flex items-center gap-0.5 ${deltaClass} font-medium`}>
                      <span className="leading-none">{arrow}</span>
                      <span className="tabular-nums">{delta===0? '0.0': `${delta>0?'+':''}${delta.toFixed(1)}`}</span>
                    </span>
                  </span>
                  <span className="tabular-nums">{v.toFixed(1)}{tgt?`/${tgt}`:''}</span>
                </div>
                <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden relative">
                  <motion.div className={`h-full ${status}`} initial={{width:0}} animate={{width:`${pct}%`}} transition={{type:'spring', stiffness:150, damping:26}} />
                  {tgt? <span className="absolute inset-y-0 right-0 text-[8px] text-white/60 pr-1 flex items-center">{Math.round(pct)}%</span>: null}
                </div>
              </motion.div>
            ); })}
          {!Object.keys(muscleWeek).length && <div className="col-span-full text-[11px] text-gray-500">No logged sets yet.</div>}
        </div>
      </motion.div>}
  {!hidden?.phaseTotals && <motion.div key="phaseTotals" className="space-y-3" variants={maybeDisable(fadeSlideUp)} initial="initial" animate="animate" exit="exit">
        <div className="text-title">Phase Totals <span className="text-body-sm text-slate-400 ml-1 align-middle">(Weighted Sets)</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(muscleTotals).sort((a,b)=> b[1]-a[1]).map(([m,v])=> { const max=Math.max(1,...Object.values(muscleTotals)); const pct=(v/max)*100; return (
            <motion.div key={m} className="bg-white/5 rounded-lg px-2 py-2 space-y-1" initial={{opacity:0, y:12}} animate={{opacity:1, y:0}} exit={{opacity:0, y:4}} transition={{duration:.25}}>
              <div className="flex items-center justify-between text-[10px] text-gray-400"><span className="capitalize">{m}</span><span className="tabular-nums">{v.toFixed(1)}</span></div>
              <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden"><motion.div className="h-full bg-indigo-500" initial={{width:0}} animate={{width:`${pct}%`}} transition={{type:'spring', stiffness:150, damping:26}} /></div>
            </motion.div>
          ); })}
          {!Object.keys(muscleTotals).length && <div className="col-span-full text-[11px] text-gray-500">No logged sets yet.</div>}
        </div>
      </motion.div>}
  {!hidden?.weeklyMuscleBar && <motion.div key="weeklyBar" className="space-y-3" variants={maybeDisable(fadeSlideUp)} initial="initial" animate="animate" exit="exit"><WeeklyMuscleBar /></motion.div>}
  {!hidden?.sessionVolumeTrend && <motion.div key="sessionVolTrend" className="space-y-3" variants={maybeDisable(fadeSlideUp)} initial="initial" animate="animate" exit="exit">
        <GlassCard>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="font-medium text-sm">Session Tonnage Trend <span className="text-xs text-slate-400 ml-1">(per selected day across weeks)</span></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <label className="flex items-center gap-1">Day
                <select className="bg-slate-700 rounded px-1 py-0.5" value={selectedDay} onChange={e=> { setSelectedDay(Number(e.target.value)); }}>
                  {dayLabels.map((lbl,idx)=> <option key={idx} value={idx}>{lbl}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">Highlight
                <select className="bg-slate-700 rounded px-1 py-0.5" value={highlightWeek ?? ''} onChange={e=> setHighlightWeek(e.target.value? Number(e.target.value): null)}>
                  <option value="">None</option>
                  {Object.keys(dayVolumes).map(w=> <option key={w} value={w}>W{w}</option>)}
                </select>
              </label>
              <button onClick={()=> setHighlightWeek(Object.keys(dayVolumes).map(Number).sort((a,b)=> a-b).pop()||null)} className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600">Last</button>
            </div>
          </div>
          {(() => {
            const weeks = Object.keys(dayVolumes).map(Number).sort((a,b)=> a-b);
            const rows = weeks.map(w=> ({ week: w, vol: dayVolumes[w]?.[selectedDay] || 0 }));
            const vols = rows.map(r=> r.vol).filter(v=> v>0);
            const avg = vols.length? (vols.reduce((a,b)=> a+b,0)/vols.length):0;
            const best = vols.length? Math.max(...vols):0;
            const last = rows.length? rows[rows.length-1].vol:0;
            const prev = rows.length>1? rows[rows.length-2].vol:0;
            const delta = prev? ((last-prev)/prev)*100:0;
            let slope=0; if(rows.length>1){ const n=rows.length; const sx = rows.reduce((a,r)=> a+r.week,0); const sy= rows.reduce((a,r)=> a+r.vol,0); const sxx = rows.reduce((a,r)=> a+r.week*r.week,0); const sxy = rows.reduce((a,r)=> a+r.week*r.vol,0); const denom = (n*sxx - sx*sx)||1; slope = (n*sxy - sx*sy)/denom; }
            const avgLine = avg; // constant reference line
            const Chart = RC?.BarChart;
            const Bar = RC?.Bar; const XAxis = RC?.XAxis; const YAxis = RC?.YAxis; const Tooltip = RC?.Tooltip; const ResponsiveContainer = RC?.ResponsiveContainer; const ReferenceLine = RC?.ReferenceLine; const CartesianGrid = RC?.CartesianGrid;
            return (
              <div>
                <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 mb-2">
                  <div>Avg <span className="text-slate-200 font-medium tabular-nums">{avg.toFixed(0)}</span></div>
                  <div>Best <span className="text-slate-200 font-medium tabular-nums">{best.toFixed(0)}</span></div>
                  <div>Last <span className="text-slate-200 font-medium tabular-nums">{last.toFixed(0)}</span></div>
                  <div>ΔPrev <span className={`font-medium tabular-nums ${delta>0?'text-emerald-400': delta<0?'text-red-400':'text-slate-300'}`}>{prev? (delta>0?'+':'')+delta.toFixed(1)+'%':'–'}</span></div>
                  <div>Slope <span className={`font-medium tabular-nums ${slope>0?'text-emerald-400': slope<0?'text-red-400':'text-slate-300'}`}>{slope.toFixed(1)}</span></div>
                </div>
                <div className="h-56">
                  {RC && rows.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <Chart data={rows} margin={{left:4,right:4,top:10,bottom:4}} barSize={32}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="week" tick={{fill:'#94a3b8', fontSize:10}} tickFormatter={(v:number)=> 'W'+v} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'#94a3b8', fontSize:10}} width={40} axisLine={false} tickLine={false} tickFormatter={(v:number)=> v>=1000? (v/1000).toFixed(1)+'k': v.toFixed(0)} />
                        <Tooltip cursor={{fill:'rgba(255,255,255,0.06)'}} content={({active,payload,label}:any)=>{
                          if(!active || !payload?.length) return null;
                          const r = payload[0].payload as any; const prevIdx = rows.findIndex(x=> x.week===r.week)-1; const prevVol = prevIdx>=0? rows[prevIdx].vol:0; const dPct = prevVol? ((r.vol-prevVol)/prevVol)*100:0;
                          return <div className="text-[11px] bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-md px-2 py-1 space-y-0.5">
                            <div className="font-medium text-slate-200">Week {r.week}</div>
                            <div className="tabular-nums">Tonnage: <span className="text-slate-100 font-semibold">{r.vol.toFixed(0)}</span></div>
                            <div className="tabular-nums">ΔPrev: <span className={dPct>0? 'text-emerald-400': dPct<0? 'text-red-400':'text-slate-300'}>{prevVol? (dPct>0?'+':'')+dPct.toFixed(1)+'%':'–'}</span></div>
                            <div className="tabular-nums">vs Avg: <span className={r.vol>=avg? 'text-emerald-400':'text-amber-400'}>{avg? ((r.vol-avg)/avg*100).toFixed(1)+'%':'–'}</span></div>
                          </div>;
                        }} />
                        <ReferenceLine y={avgLine} stroke="#10b981" strokeDasharray="3 3" ifOverflow="extendDomain" />
                        <Bar dataKey="vol" radius={[4,4,0,0]} fill="#6366f1">
                          {rows.map((entry,i)=>{
                            const hl = highlightWeek === entry.week;
                            return <RC.Cell key={entry.week} fill={hl? 'url(#gradHighlight)': (entry.vol===best? '#10b981':'#6366f1')} />;
                          })}
                        </Bar>
                        <defs>
                          <linearGradient id="gradHighlight" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#059669" />
                            <stop offset="100%" stopColor="#065f46" />
                          </linearGradient>
                        </defs>
                      </Chart>
                    </ResponsiveContainer>
                  ): (
                    <div className="h-full flex items-center justify-center text-[11px] text-gray-500">{rows.length? 'Loading chart...':'No data.'}</div>
                  )}
                </div>
              </div>
            );
          })()}
        </GlassCard>
      </motion.div>}
  {!hidden?.compliance && <motion.div key="compliance" className="bg-card rounded-2xl p-5 shadow-soft space-y-4" variants={maybeDisable(fadeSlideUp)} initial="initial" animate="animate" exit="exit">
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
                        <motion.div className={`${color} absolute bottom-0 left-0 w-full`} initial={{height:0}} animate={{height:`${Math.min(100,ratio*100)}%`}} transition={{type:'spring', stiffness:150, damping:26}} />
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
      </motion.div>}
      </AnimatePresence>
    </div>
  );
}
