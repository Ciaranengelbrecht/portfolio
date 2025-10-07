import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "./GlassCard";
import { db } from "../lib/db";
import {
  getSettings,
  setDashboardPrefs,
  getDashboardPrefs,
} from "../lib/helpers";
import { Session, Settings, Exercise, UserProgram } from "../lib/types";
import { getProfileProgram } from '../lib/profile';
import {
  getWeekCompletion,
  getPhaseCompletion,
  isPhaseEnd,
} from "../features/progress/progress";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";

function Pill({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={clsx(
        "group relative overflow-hidden rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:outline focus-visible:outline-[rgba(59,130,246,0.65)] focus-visible:outline-offset-2",
        active
          ? "text-slate-900 shadow-[0_8px_22px_-14px_rgba(59,130,246,0.8)]"
          : "text-slate-200/80 border border-white/5 bg-slate-900/60 hover:border-white/15 hover:text-white"
      )}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      <span
        className={clsx(
          "absolute inset-0 opacity-0 transition-opacity duration-200",
          active
            ? "opacity-100 bg-gradient-to-r from-sky-400 via-[var(--accent)] to-indigo-500"
            : "group-hover:opacity-100 bg-gradient-to-r from-white/5 to-transparent"
        )}
      />
      <span className="relative z-10 flex items-center gap-1">
        <span>{label}</span>
        {active && (
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-slate-900/90 shadow-[0_0_0_3px_rgba(255,255,255,0.45)]"></span>
        )}
      </span>
    </button>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
  <div className="relative h-3 overflow-hidden rounded-full border border-white/10 bg-slate-900/70">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 via-[var(--accent)] to-indigo-500 shadow-[0_2px_8px_rgba(59,130,246,0.45)]"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_48%)]" />
    </div>
  );
}

export default function ProgressBars() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [settings, setSettingsState] = useState<Settings | undefined>();
  const [curPhase, setCurPhase] = useState(1);
  const [curWeek, setCurWeek] = useState(1);
  const [program,setProgram] = useState<UserProgram|undefined>();
  const [extraRestDays,setExtraRestDays] = useState<number[]>([]); // indices (in original base array tail) of injected ad-hoc rest days (append model)
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
  setSessions(await db.getAll("sessions"));
  const s = await getSettings();
      setSettingsState(s);
      setCurPhase(s.currentPhase || 1);
      const prefs = await getDashboardPrefs();
      if (prefs.lastLocation) setCurWeek(prefs.lastLocation.weekNumber);
  setExercises(await db.getAll('exercises'));
      try { const prog = await getProfileProgram(); setProgram(prog); } catch {}
    })();
  }, []);

  useEffect(() => {
    const onChange = (e: any) => {
      if (e?.detail?.table === "sessions" || e?.detail?.table === "settings")
        refresh();
    };
    window.addEventListener("sb-change", onChange as any);
    return () => window.removeEventListener("sb-change", onChange as any);
  }, []);

  const refresh = async () => {
  setSessions(await db.getAll("sessions"));
    const s = await getSettings();
    setSettingsState(s);
    setCurPhase(s.currentPhase || 1);
    try {
      const prefs = await getDashboardPrefs();
      if (prefs.lastLocation) setCurWeek(prefs.lastLocation.weekNumber);
    } catch {}
  setExercises(await db.getAll('exercises'));
  };

  const weeklyTarget = Math.max(
    3,
    Math.min(6, settings?.progress?.weeklyTargetDays ?? 6)
  );

  // Dynamic cycle day labels derived from current program weeklySplit; fallback to legacy weekday abbreviations
  const [programSplit,setProgramSplit] = useState<string[]|null>(null);
  useEffect(()=> { (async()=> {
    try {
      if(program){ setProgramSplit(program.weeklySplit.map(d=> d.customLabel || d.type)); return; }
      const sess = sessions.filter(s=> s.weekNumber===1).slice(0,10);
      if(sess.length){ const labels = sess.sort((a,b)=> a.id.localeCompare(b.id)).map(s=> s.dayName).filter((x): x is string=> !!x); if(labels.length>=5){ setProgramSplit(labels); return; } }
    } catch {}
    setProgramSplit(null);
  })(); },[sessions,program]);

  // Determine program metadata from inferred programSplit.
  const syntheticProgram: UserProgram | undefined = useMemo(()=> {
    if(program) return program;
    if(programSplit && programSplit.length>=5){
      return { id:'synthetic', name:'Program', weekLengthDays: programSplit.length, weeklySplit: programSplit.map(l=> ({ type: (/rest/i.test(l)? 'Rest':'Custom') as any, customLabel: (/rest/i.test(l)? undefined: l) })), mesoWeeks:9, deload:{mode:'last-week'}, createdAt:'', updatedAt:'', version:1 } as UserProgram;
    }
    return undefined;
  },[programSplit,program]);
  const week = useMemo(() => getWeekCompletion(curPhase, curWeek, sessions, { weeklyTargetDays: weeklyTarget, program: syntheticProgram && { weekLengthDays: syntheticProgram.weekLengthDays, weeklySplit: syntheticProgram.weeklySplit } as any }), [curPhase, curWeek, sessions, weeklyTarget, syntheticProgram]);
  const phase = useMemo(
    () =>
      getPhaseCompletion(curPhase, sessions, {
        weeklyTargetDays: weeklyTarget,
      }),
    [curPhase, sessions, weeklyTarget]
  );

  // Sparkline points (percent per completed week) limited to weeks with any data
  const sparklinePts = useMemo(()=> {
    const pts = phase.weekPercents.map((p,i)=> ({ x:i, y:p }));
    const maxIdx = pts.reduce((m,p,i)=> p.y>0? i: m, -1);
    return pts.slice(0, Math.max(maxIdx+1,0));
  },[phase.weekPercents]);

  const dayLabelsBase = programSplit || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayLabels = useMemo(()=> {
    if(!dayLabelsBase) return dayLabelsBase;
    if(!extraRestDays.length) return dayLabelsBase;
    // Our model simply appends rest days; represent them as virtual labels after base length
    return [...dayLabelsBase, ...extraRestDays.map(()=> 'Rest')];
  },[dayLabelsBase,extraRestDays]);
  const sessionForDay = (dayId: number) => sessions.find((s) => s.id === `${curPhase}-${curWeek}-${dayId}`);

  const openDay = async (dayId: number) => {
    // Navigate to sessions; Sessions page will create missing session
  try { sessionStorage.setItem('lastLocationIntent', '1'); } catch {}
    await setDashboardPrefs({
      lastLocation: {
        phaseNumber: curPhase,
        weekNumber: curWeek as any,
        dayId,
      },
    });
    navigate("/sessions");
  };

  const weekDots = Array.from({ length: 9 }, (_, i) => i);

  useEffect(() => {
    if (!settings || settings.progress?.gamification === false) return;
    if (week.completedDays >= weeklyTarget) {
      // simple celebratory toast; confetti can be integrated later if desired
      setToast("Week Complete!");
      const t = setTimeout(() => setToast(null), 1500);
      return () => clearTimeout(t);
    }
  }, [week.completedDays, weeklyTarget, settings?.progress?.gamification]);

  useEffect(() => {
    if (!settings || settings.progress?.gamification === false) return;
    if (phase.percent >= 100) {
      setToast("Phase complete!");
      const t = setTimeout(() => setToast(null), 1500);
      return () => clearTimeout(t);
    }
  }, [phase.percent, settings?.progress?.gamification]);

  const extraBeyondTarget = () => {
    // Count rest-day session as extra beyond target
    const rest = sessionForDay(6);
    return rest &&
      rest.entries?.some((e) => e.sets?.some((s) => (s.reps || 0) > 0))
      ? 1
      : 0;
  };

  const completedDaysWithExtras = week.completedDays + extraBeyondTarget();
  const weekSurplus = Math.max(0, completedDaysWithExtras - weeklyTarget);
  const weekRemaining = Math.max(0, weeklyTarget - completedDaysWithExtras);
  const weekStatusLabel = weekSurplus
    ? `Ahead by ${weekSurplus}`
    : weekRemaining
    ? `${weekRemaining} to go`
    : "Target met";

  // ----- Phase Checklist Modal State -----
  const [showChecklist, setShowChecklist] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Metrics for checklist
  const phaseSessions = useMemo(()=> sessions.filter(s=> (s.phaseNumber||s.phase||1)===curPhase),[sessions,curPhase]);
  const weeksElapsed = useMemo(()=> phase.weekPercents.reduce((m,p,i)=> p>0? i+1: m, 0),[phase.weekPercents]);
  const adherence = useMemo(()=> {
    if(!weeksElapsed) return 0;
    const totalPct = phase.weekPercents.slice(0,weeksElapsed).reduce((a,b)=> a+b,0);
    return totalPct / weeksElapsed; // average % of weeks
  },[phase.weekPercents,weeksElapsed]);
  const exerciseMap = useMemo(()=> new Map(exercises.map(e=> [e.id,e])),[exercises]);
  const muscleSetTotals = useMemo(()=> {
    const totals: Record<string, number> = {};
    phaseSessions.forEach(s=> s.entries.forEach(e=> {
      const ex = exerciseMap.get(e.exerciseId); const mg = ex?.muscleGroup || 'other';
      e.sets.forEach(st=> { if((st.reps||0)>0 || (st.weightKg||0)>0){ totals[mg] = (totals[mg]||0)+1; } });
    }));
    return totals;
  },[phaseSessions,exerciseMap]);
  const muscleAvgPerWeek = useMemo(()=> {
    const weeks = Math.max(1,weeksElapsed||1);
    return Object.entries(muscleSetTotals).map(([m,v])=> ({ muscle:m, avg:(v/weeks) }));
  },[muscleSetTotals,weeksElapsed]);
  const undertrainedMuscles = useMemo(()=> muscleAvgPerWeek.filter(r=> r.avg < 8).sort((a,b)=> a.avg - b.avg),[muscleAvgPerWeek]);
  // Simple plateau detector: last 4 sessions best set score stagnation
  const plateauCount = useMemo(()=> {
    const byEx: Record<string, number[]> = {};
    phaseSessions.sort((a,b)=> a.dateISO.localeCompare(b.dateISO)).forEach(s=> s.entries.forEach(e=> {
      const best = e.sets.reduce((m,st)=> Math.max(m,(st.weightKg||0)*(st.reps||0)),0);
      if(best>0){ (byEx[e.exerciseId] ||= []).push(best); }
    }));
    let count=0; Object.values(byEx).forEach(arr=> { if(arr.length>=4){ const last4 = arr.slice(-4); const first2 = (last4[0]+last4[1])/2; const last2 = (last4[2]+last4[3])/2; if(last2 <= first2*1.02) count++; } });
    return count;
  },[phaseSessions]);

  const advancePhaseConfirmed = async ()=> {
    setAdvancing(true);
    try {
      const s = await getSettings();
      const next = (s.currentPhase || 1) + 1;
      await db.put('settings',{ ...s, id:'app', currentPhase: next });
      setCurPhase(next);
      await setDashboardPrefs({ lastLocation: { phaseNumber: next, weekNumber: 1 as any, dayId:0 }});
      navigate('/sessions');
    } finally { setAdvancing(false); setShowChecklist(false); }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {toast && (
        <div className="md:col-span-2">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2 shadow-soft text-sm inline-block">
            {toast}
          </div>
        </div>
      )}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-gray-400/70">
                Week snapshot
              </p>
              <div className="mt-1 flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white/90">
                  Week {curWeek}
                </h3>
                {isPhaseEnd(curWeek) && (
                  <span className="badge badge-outline" data-variant="info">
                    Deload week
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Phase {curPhase}</p>
              <p className="mt-1 text-sm font-medium text-white/90">
                {completedDaysWithExtras}/{weeklyTarget} days
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-white/90">
                {week.percent}%
              </span>
              <span className="text-xs uppercase tracking-[0.28em] text-gray-400">
                Complete
              </span>
            </div>
            <span
              className={clsx(
                "badge",
                weekSurplus
                  ? undefined
                  : weekRemaining
                  ? "badge-outline"
                  : undefined
              )}
              data-variant={weekSurplus ? "success" : undefined}
            >
              {weekStatusLabel}
            </span>
          </div>
        </div>
        <ProgressBar percent={week.percent} />
        {week.completedDays === 0 && (
          <div className="mt-2 text-xs text-gray-400">
            No sessions yet.{" "}
            <button className="underline" onClick={() => openDay(0)}>
              Log first session
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {dayLabels.map((d, i) => {
            // If program has >7 days we only have sessions addressing those indexes; reuse id format `${phase}-${week}-${i}`
            const sess = sessionForDay(i);
            const isRest = /rest/i.test(d);
            const completed = week.dayMap.hasOwnProperty(i) ? (week.dayMap as any)[i] : !!(sess && sess.entries.some(e=> e.sets.some(st=> (st.reps||0)>0)));
            const tip = sess ? `${new Date(sess.dateISO).toLocaleDateString()} • ${sess.entries.length} exercises` : (isRest? 'Planned rest day':'No session yet');
            const isAdHoc = i >= dayLabelsBase.length; // appended rest indicator
            return (
              <div key={i} className="relative group">
                <Pill
                  active={completed}
                  label={d}
                  onClick={() => { if(isRest) return; openDay(i); }}
                  title={isAdHoc? 'Ad-hoc Rest (click X to remove)': tip}
                />
                {isAdHoc && (
                  <button
                    onClick={()=> setExtraRestDays(r=> r.slice(0,-1))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-slate-600 text-[9px] leading-4 text-gray-300 hover:bg-slate-700"
                    title="Remove ad-hoc rest day"
                  >×</button>
                )}
                {isAdHoc && (
                  <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-amber-400/70"></span>
                )}
              </div>
            );
          })}
          {programSplit && programSplit.length>7 && (
            <span className="text-[10px] text-gray-500 ml-1">Cycle {programSplit.length}d</span>
          )}
          <button
            className="text-[10px] px-2 py-1 rounded-full border border-dashed border-white/10 bg-slate-900/60 text-slate-200/80 transition-colors hover:border-white/25 hover:text-white"
            onClick={()=> setExtraRestDays(r=> [...r, dayLabels.length])}
            title="Insert ad-hoc Rest day (not persisted)"
          >+ Rest</button>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-gray-400/70">
              Phase overview
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white/90">
              Phase {curPhase}
            </h3>
          </div>
          <div className="text-right text-sm text-gray-400">
            Week {curWeek} of 9
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-white/90">
              {phase.percent}%
            </span>
            <span className="text-xs uppercase tracking-[0.28em] text-gray-400">
              Complete
            </span>
          </div>
          <span className="badge badge-outline">
            Avg. adherence {Math.round(adherence || 0)}%
          </span>
        </div>
        <ProgressBar percent={phase.percent} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {weekDots.map((i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full ${
                phase.weekPercents[i] > 0
                  ? "bg-[var(--accent)]"
                  : "bg-slate-700"
              } ${
                i + 1 === curWeek
                  ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-900"
                  : ""
              }`}
            ></div>
          ))}
        </div>
        {sparklinePts.length>1 && (
          <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-gray-400/70">
              <span>Trend</span>
              <span className="text-[10px] capitalize text-gray-400/60">
                consistency pulse
              </span>
            </div>
            <svg width="100%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none" className="overflow-visible">
              {(() => {
                const xs = sparklinePts.map(p=> p.x);
                const ys = sparklinePts.map(p=> p.y);
                const maxX = Math.max(...xs,1);
                const maxY = Math.max(...ys,100);
                const path = sparklinePts.map((p,i)=> {
                  const x = (p.x / maxX) * 100;
                  const y = 32 - (p.y / maxY) * 28 - 2; // padding
                  return `${i===0? 'M':'L'}${x.toFixed(2)},${y.toFixed(2)}`;
                }).join(' ');
                return <>
                  <path d={path} fill="none" stroke="url(#phase-gradient)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
                  {sparklinePts.map(p=> { const x=(p.x/Math.max(...xs,1))*100; const y=32-(p.y/Math.max(...ys,100))*28-2; return <circle key={p.x} cx={x} cy={y} r={1.8} fill="var(--accent)" stroke="rgba(255,255,255,0.65)" strokeWidth={0.35} /> })}
                </>
              })()}
              <defs>
                <linearGradient id="phase-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(56,189,248,0.8)" />
                  <stop offset="50%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="rgba(99,102,241,0.9)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}
        {curWeek < 9 &&
          phase.weekPercents.slice(0, 8).every((p) => p >= 100) &&
          (settings?.progress?.showDeloadHints ?? true) && (
            <div className="mt-2 text-xs text-gray-400">Deload next week</div>
          )}
        {curWeek === 9 && phase.weekPercents[8] >= 50 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm">Phase complete</span>
            <button
              className="text-xs rounded px-3 py-1 font-medium text-slate-900 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.55)] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 hover:brightness-105"
              onClick={()=> setShowChecklist(true)}
            >Start Phase {curPhase + 1}</button>
            {curPhase>1 && <button
              className="text-xs rounded px-3 py-1 border border-white/8 bg-slate-900/70 text-slate-200/85 transition hover:border-white/15"
              onClick={async ()=> {
                if(!window.confirm('Revert to phase '+(curPhase-1)+'?')) return;
                const s = await getSettings();
                const prev = Math.max(1,(s.currentPhase||1)-1);
                await db.put('settings', { ...s, id:'app', currentPhase: prev });
                setCurPhase(prev);
                await setDashboardPrefs({ lastLocation: { phaseNumber: prev, weekNumber: 1 as any, dayId: 0 }});
                navigate('/sessions');
              }}
            >Prev Phase ←</button>}
          </div>
        )}
      </GlassCard>
      <AnimatePresence>
      {showChecklist && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <motion.button aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=> !advancing && setShowChecklist(false)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
          <motion.div
            initial={{opacity:0, y: 28, scale:.92}}
            animate={{opacity:1, y:0, scale:1}}
            exit={{opacity:0, y:16, scale:.94}}
            transition={{ duration:.28, ease:[0.32,0.72,0.33,1] }}
            className="relative z-10 w-full max-w-md bg-slate-900/95 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <h4 className="text-title">Phase {curPhase} Review</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Weeks</div>
                <div className="font-medium">{weeksElapsed} / 9</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Adherence</div>
                <div className="font-medium">{adherence.toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Plateaus</div>
                <div className="font-medium">{plateauCount}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Undertrained</div>
                <div className="font-medium">{undertrainedMuscles.length}</div>
              </div>
            </div>
            <div className="text-xs max-h-40 overflow-auto rounded-lg border border-white/5 p-2 bg-slate-800/40">
              <div className="font-semibold mb-1">Avg Sets / Week by Muscle</div>
              {muscleAvgPerWeek.sort((a,b)=> b.avg - a.avg).map(r=> (
                <div key={r.muscle} className="flex items-center justify-between py-0.5">
                  <span className="capitalize">{r.muscle}</span>
                  <span className={r.avg<8? 'text-amber-400': 'text-gray-200'}>{r.avg.toFixed(1)}</span>
                </div>
              ))}
              {!muscleAvgPerWeek.length && <div className="text-gray-500">No logged sets.</div>}
            </div>
            {!!undertrainedMuscles.length && (
              <div className="text-[11px] text-amber-400">Consider adding volume for: {undertrainedMuscles.slice(0,5).map(m=> m.muscle).join(', ')}{undertrainedMuscles.length>5?'…':''}</div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button className="text-xs px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors" disabled={advancing} onClick={()=> setShowChecklist(false)}>Cancel</button>
              <button className="text-xs px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors" disabled={advancing} onClick={advancePhaseConfirmed}>{advancing? 'Advancing…':'Confirm & Advance'}</button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
