import { useEffect, useMemo, useState } from "react";
import { db } from "../lib/db";
import { waitForSession } from "../lib/supabase";
import {
  Exercise,
  Session,
  SessionEntry,
  SetEntry,
  Template,
  Settings,
} from "../lib/types";
import { useProgram } from "../state/program";
import { computeDeloadWeeks, programSummary } from "../lib/program";
import { buildPrevBestMap, getPrevBest } from "../lib/prevBest";
import { nanoid } from "nanoid";
import { getDeloadPrescription, getLastWorkingSets } from "../lib/helpers";
import { getSettings, setSettings } from "../lib/helpers";
import PhaseStepper from "../components/PhaseStepper";
import ImportTemplateDialog from "../features/sessions/ImportTemplateDialog";
import { rollingPRs } from "../lib/helpers";
import { setLastAction, undo as undoLast } from "../lib/undo";
import Snackbar from "../components/Snackbar";

const DAYS = [
  "Upper A",
  "Lower A",
  "Upper B",
  "Lower B",
  "Upper C",
  "Lower C",
  "Rest",
];

export default function Sessions() {
  const { program } = useProgram();
  const [week, setWeek] = useState<any>(1);
  const [phase, setPhase] = useState<number>(1);
  const [day, setDay] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [dragEntryIdx, setDragEntryIdx] = useState<number | null>(null);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    undo?: () => void;
  }>({ open: false, msg: "" });
  const [showImport, setShowImport] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [prevBestMap, setPrevBestMap] = useState<{
    [id: string]: { week: number; set: SetEntry };
  } | null>(null);
  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const [autoNavDone, setAutoNavDone] = useState(false);
  const [restTimers, setRestTimers] = useState<Record<string,{start:number;elapsed:number;running:boolean}>>({}); // ephemeral per-set timers
  const [readinessPct, setReadinessPct] = useState(0);

  useEffect(() => {
    (async () => {
      // load current phase from settings
      const s = await getSettings();
      setPhase(s.currentPhase || 1);
      const last = s.dashboardPrefs?.lastLocation;
      if (last) {
        setWeek(last.weekNumber as any);
        setDay(last.dayId);
      }
    })();
  }, []);

  // Auto navigation logic: stay on the most recent week within current phase that has ANY real data (weight or reps > 0).
  // Do not auto-advance to next phase until user manually creates data in week 1 of the next phase.
  useEffect(() => {
    (async () => {
      if (autoNavDone) return;
      const all = await db.getAll<Session>("sessions");
      if (!all.length) {
        setAutoNavDone(true);
        return;
      }
      // Filter by current phase (legacy sessions may store phase or phaseNumber)
      const byPhase = all.filter(
        (s) => (s.phaseNumber || s.phase || 1) === phase
      );
      // Determine weeks with real data (any set with weight>0 or reps>0)
      const weekHasData = new Map<number, boolean>();
      for (const s of byPhase) {
        const real = s.entries.some((e) =>
          e.sets.some((st) => (st.weightKg || 0) > 0 || (st.reps || 0) > 0)
        );
        if (real) {
          weekHasData.set(s.weekNumber, true);
        }
      }
      if (weekHasData.size === 0) {
        // stay on current (default 1)
        setAutoNavDone(true);
        return;
      }
      // Highest week in this phase with data
      const targetWeek = [...weekHasData.keys()].sort((a, b) => a - b).pop()!;
      if (targetWeek !== week) {
        setWeek(targetWeek);
      }
      setAutoNavDone(true);
    })();
  }, [phase, autoNavDone]);

  // Guard against accidental phase increment: override phase if settings jumped forward without week1 data in next phase
  useEffect(() => {
    (async () => {
      const all = await db.getAll<Session>("sessions");
      const curPhaseSessions = all.filter(
        (s) => (s.phaseNumber || s.phase || 1) === phase
      );
      // If user is beyond phase 1 and there is zero real data in phase weeks, revert to previous phase with data
      if (phase > 1) {
        const haveReal = curPhaseSessions.some((s) =>
          s.entries.some((e) =>
            e.sets.some((st) => (st.weightKg || 0) > 0 || (st.reps || 0) > 0)
          )
        );
        if (!haveReal) {
          // find latest phase that has data
          const phasesWithData = new Set<number>();
          for (const s of all) {
            if (
              s.entries.some((e) =>
                e.sets.some(
                  (st) => (st.weightKg || 0) > 0 || (st.reps || 0) > 0
                )
              )
            )
              phasesWithData.add(s.phaseNumber || s.phase || 1);
          }
          if (phasesWithData.size) {
            const back = [...phasesWithData].sort((a, b) => b - a)[0];
            if (back !== phase) {
              setPhase(back);
              const settings = await getSettings();
              await setSettings({ ...settings, currentPhase: back });
            }
          }
        }
      }
    })();
  }, [phase]);

  // Phase readiness calculation
  useEffect(()=>{ (async()=>{
    if(!program){ setReadinessPct(0); return }
    const all = await db.getAll<Session>('sessions');
    const cur = all.filter(s=> (s.phaseNumber||s.phase||1)===phase);
    const weeks = new Set<number>();
    for(const s of cur){ if(s.entries.some(e=> e.sets.some(st=> (st.weightKg||0)>0 || (st.reps||0)>0))) weeks.add(s.weekNumber) }
    setReadinessPct(Math.min(100, Math.round((weeks.size/(program.mesoWeeks||1))*100)));
  })() }, [phase, week, session?.id, program]);

  // Keyboard shortcuts
  useEffect(()=>{ const handler=(e:KeyboardEvent)=>{ if(e.key==='/'&&!e.metaKey&&!e.ctrlKey){ e.preventDefault(); setShowAdd(true) } if(e.key==='Enter'&&e.shiftKey){ const active=document.activeElement as HTMLElement|null; if(active?.tagName==='INPUT'){ const inputs=[...document.querySelectorAll('input[data-set-input="true"]')] as HTMLInputElement[]; const idx=inputs.indexOf(active as HTMLInputElement); if(idx>=0&&idx<inputs.length-1){ inputs[idx+1].focus(); e.preventDefault(); } } } if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){ const active=document.activeElement as HTMLElement|null; const entryId=active?.dataset.entryId; const setNumber=Number(active?.dataset.setNumber); if(entryId&&setNumber){ const ent=session?.entries.find(en=>en.id===entryId); const src=ent?.sets.find(s=> s.setNumber===setNumber); if(ent&&src){ const clone: SetEntry={...src,setNumber: ent.sets.length+1}; updateEntry({...ent, sets:[...ent.sets, clone]}); e.preventDefault(); } } } }; window.addEventListener('keydown', handler); return ()=> window.removeEventListener('keydown', handler) }, [session]);

  // Rest timer: high-res 60fps-ish update; auto-clears when stopped or another set's rest is started.
  useEffect(()=>{ const id=setInterval(()=>{ setRestTimers(prev=>{ let changed=false; const next:{[k:string]:any}={}; for(const [k,v] of Object.entries(prev)){ if(v.running){ next[k]={...v, elapsed: Date.now()-v.start, running:true}; changed=true } else if(v.elapsed>0 && v.elapsed < 300) { /* just finished, keep for a brief flash */ next[k]=v } else { changed=true; /* drop */ } } return changed?next:prev }) }, 80); return ()=> clearInterval(id) },[])
  const toggleRestTimer = (entryId:string,setNumber:number)=>{
    const key=`${entryId}:${setNumber}`;
    setRestTimers(prev=>{
      // Clear all other timers when starting a new one
      const cur=prev[key];
      // If clicking active timer -> stop and remove
      if(cur?.running){ const { [key]:_, ...rest } = prev; return rest }
      const cleared: Record<string, any> = {};
      return { ...cleared, [key]: { start: Date.now(), elapsed:0, running:true } };
    })
  }
  const restTimerDisplay = (entryId:string,setNumber:number)=>{ const t=restTimers[`${entryId}:${setNumber}`]; if(!t) return null; const ms = t.elapsed; const totalSecs = ms/1000; const mm = Math.floor(totalSecs/60); const ss = Math.floor(totalSecs)%60; const msec = Math.floor(ms%1000/10); return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/70 border border-emerald-600/40 shadow-inner ${t.running?'text-emerald-300':'text-slate-400'}`}>{mm}:{String(ss).padStart(2,'0')}.<span className="opacity-70">{String(msec).padStart(2,'0')}</span></span> }
  const duplicateLastSet = (entry: SessionEntry)=>{ const last=[...entry.sets].pop(); if(!last) return; const clone: SetEntry={...last, setNumber: entry.sets.length+1}; updateEntry({ ...entry, sets:[...entry.sets, clone] }) }

  // Adjust week clamp if program changes
  useEffect(() => {
    if (program) {
      if (week > program.mesoWeeks) setWeek(1);
      if (day >= program.weekLengthDays) setDay(0);
    }
  }, [program]);

  useEffect(() => {
    (async () => {
      const id = `${phase}-${week}-${day}`;
      let s = await db.get<Session>("sessions", id);
      if (!s) {
        // fallback: try old id format (week-day) and migrate
        const oldId = `${week}-${day}`;
        const old = await db.get<Session>("sessions", oldId);
        if (old) {
          s = { ...old, id, phase };
          await db.delete("sessions", oldId);
          await db.put("sessions", s);
        }
      }
      if (!s) {
        const templateMeta = program ? program.weeklySplit[day] : undefined;
        const templateName = templateMeta
          ? templateMeta.customLabel || templateMeta.type || "Day"
          : DAYS[day];
        s = {
          id,
          dateISO: new Date().toISOString(),
          weekNumber: week,
          phase,
          phaseNumber: phase,
          dayName: templateName,
          entries: [],
          templateId: templateMeta?.templateId,
          programId: program?.id,
        };
        await db.put("sessions", s);
        // If there is a templateId, auto-import it
        if (templateMeta?.templateId) {
          try {
            const t = await db.get("templates", templateMeta.templateId);
            if (t) {
              // Reuse import logic manually (append false since brand new)
              const exs = await db.getAll("exercises");
              const settings = await getSettings();
              const exMap = new Map(exs.map((e: any) => [e.id, e]));
              const rows = (exId: string) =>
                Math.max(
                  1,
                  Math.min(
                    6,
                    settings.defaultSetRows ??
                      exMap.get(exId)?.defaults.sets ??
                      3
                  )
                );
              const newEntries = (t.exerciseIds || []).map((exId: string) => ({
                id: nanoid(),
                exerciseId: exId,
                sets: Array.from({ length: rows(exId) }, (_, i) => ({
                  setNumber: i + 1,
                  weightKg: 0,
                  reps: 0,
                })),
              }));
              s = {
                ...s,
                entries: newEntries,
                autoImportedTemplateId: templateMeta.templateId,
              };
              await db.put("sessions", s);
            }
          } catch (e) {
            console.warn("[Sessions] auto-import template failed", e);
          }
        }
      }
      setSession(s);
      const settings = await getSettings();
      await setSettings({
        ...settings,
        dashboardPrefs: {
          ...(settings.dashboardPrefs || {}),
          lastLocation: {
            phaseNumber: phase,
            weekNumber: week,
            dayId: day,
            sessionId: s.id,
          },
        },
      });
    })();
  }, [phase, week, day]);

  useEffect(() => {
    (async () => {
      console.log("[Sessions] init: waitForSession then fetch lists");
      await waitForSession({ timeoutMs: 4000 });
      const t = await db.getAll("templates");
      const e = await db.getAll("exercises");
      console.log(
        "[Sessions] init: templates",
        t.length,
        "exercises",
        e.length
      );
      setTemplates(t);
      setExercises(e);
      // Preload sessions for prev best map
      const allSessions = await db.getAll<Session>("sessions");
      setPrevBestMap(buildPrevBestMap(allSessions, week, phase));
      const st = await getSettings();
      setSettingsState(st as any);
    })();
  }, []);

  // Refetch data when auth session changes (e.g., token refresh or resume)
  useEffect(() => {
    const onAuth = () => {
      (async () => {
        console.log("[Sessions] sb-auth: waitForSession then refetch lists");
        await waitForSession({ timeoutMs: 4000 });
        const t = await db.getAll("templates");
        const e = await db.getAll("exercises");
        console.log(
          "[Sessions] sb-auth: templates",
          t.length,
          "exercises",
          e.length
        );
        setTemplates(t);
        setExercises(e);
        if (session) {
          const fresh = await db.get<Session>("sessions", session.id);
          console.log(
            "[Sessions] sb-auth: refreshed session entries",
            fresh?.entries?.length || 0
          );
          if (fresh) setSession(fresh);
        }
      })();
    };
    window.addEventListener("sb-auth", onAuth);
    return () => window.removeEventListener("sb-auth", onAuth);
  }, [session?.id]);

  // Lightweight realtime auto-refresh: refetch lists when tables change
  useEffect(() => {
    const onChange = (e: any) => {
      const tbl = e?.detail?.table;
      if (tbl === "templates") db.getAll("templates").then(setTemplates);
      if (tbl === "exercises") db.getAll("exercises").then(setExercises);
      if (tbl === "sessions" && session)
        db.get<Session>("sessions", session.id).then((s) => s && setSession(s));
    };
    window.addEventListener("sb-change", onChange as any);
    return () => window.removeEventListener("sb-change", onChange as any);
  }, [session?.id]);

  // Recompute prev best map whenever week or phase changes
  useEffect(() => {
    (async () => {
      const allSessions = await db.getAll<Session>("sessions");
      setPrevBestMap(buildPrevBestMap(allSessions, week, phase));
    })();
  }, [week, phase]);

  const deloadWeeks = program ? computeDeloadWeeks(program) : new Set<number>();
  const isDeloadWeek = deloadWeeks.has(week);

  // Backfill programId on existing loaded session if missing (one-time effect per session)
  useEffect(() => {
    (async () => {
      if (session && program && !session.programId) {
        const updated = { ...session, programId: program.id };
        await db.put("sessions", updated);
        setSession(updated);
      }
    })();
  }, [session?.id, program?.id]);

  const addSet = (entry: SessionEntry) => {
    const next: SetEntry = {
      setNumber: entry.sets.length + 1,
      weightKg: 0,
      reps: 0,
    };
    updateEntry({ ...entry, sets: [...entry.sets, next] });
  };

  const deleteSet = (entry: SessionEntry, idx: number) => {
    const removed = entry.sets[idx];
    const after = entry.sets
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    const prev = session;
    updateEntry({ ...entry, sets: after });
    setSnack({
      open: true,
      msg: "Set deleted",
      undo: async () => {
        if (prev) {
          await db.put("sessions", prev);
          setSession(prev);
        }
      },
    });
  };

  const reorderSet = (entry: SessionEntry, from: number, to: number) => {
    const arr = [...entry.sets];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const renum = arr.map((s, i) => ({ ...s, setNumber: i + 1 }));
    updateEntry({ ...entry, sets: renum });
  };

  const updateEntry = async (entry: SessionEntry) => {
    if (!session) return;
    const newEntries = session.entries.map((e) =>
      e.id === entry.id ? entry : e
    );
    const updated = { ...session, entries: newEntries };
    setSession(updated);
    await db.put("sessions", updated);
    try {
      window.dispatchEvent(
        new CustomEvent("sb-change", { detail: { table: "sessions" } })
      );
    } catch {}
    const s = await getSettings();
    await setSettings({
      ...s,
      dashboardPrefs: {
        ...(s.dashboardPrefs || {}),
        lastLocation: {
          phaseNumber: phase,
          weekNumber: week,
          dayId: day,
          sessionId: updated.id,
        },
      },
    });
  };

  const removeEntry = async (entryId: string) => {
    if (!session) return;
    const cfg = await getSettings();
    if (cfg.confirmDestructive) {
      const exName =
        exercises.find(
          (e) =>
            e.id === session.entries.find((x) => x.id === entryId)?.exerciseId
        )?.name || "exercise";
      if (!window.confirm(`Remove ${exName} from this session?`)) return;
    }
    const prev = session;
    const updated = {
      ...session,
      entries: session.entries.filter((e) => e.id !== entryId),
    };
    setSession(updated);
    await db.put("sessions", updated);
    const undo = async () => {
      setSession(prev);
      await db.put("sessions", prev);
    };
    setLastAction({ undo });
    setSnack({ open: true, msg: "Exercise removed", undo });
  };

  const addExerciseToSession = async (ex: Exercise) => {
    if (!session) return;
    let sets: SetEntry[] = [];
    const lastSets = await getLastWorkingSets(ex.id, week, phase);
    if (isDeloadWeek) {
      const dl = await getDeloadPrescription(ex.id, week, { deloadWeeks });
      const avgReps = lastSets.length
        ? Math.round(
            lastSets.reduce((a, b) => a + (b.reps || 8), 0) / lastSets.length
          )
        : 8;
      sets = Array.from({ length: dl.targetSets }, (_, i) => ({
        setNumber: i + 1,
        weightKg: dl.targetWeight,
        reps: avgReps,
      }));
    } else {
      sets = lastSets.length
        ? lastSets
        : [{ setNumber: 1, weightKg: 0, reps: 0 }];
    }
    const entry: SessionEntry = { id: nanoid(), exerciseId: ex.id, sets };
    const updated = { ...session, entries: [...session.entries, entry] };
    setSession(updated);
    await db.put("sessions", updated);
    try {
      window.dispatchEvent(
        new CustomEvent("sb-change", { detail: { table: "sessions" } })
      );
    } catch {}
    const s = await getSettings();
    await setSettings({
      ...s,
      dashboardPrefs: {
        ...(s.dashboardPrefs || {}),
        lastLocation: {
          phaseNumber: phase,
          weekNumber: week,
          dayId: day,
          sessionId: updated.id,
        },
      },
    });
  };

  const createCustomExercise = async (name: string) => {
    const ex: Exercise = {
      id: nanoid(),
      name,
      muscleGroup: "other",
      defaults: { sets: 3, targetRepRange: "8-12" },
    };
    await db.put("exercises", ex);
    setExercises([ex, ...exercises]);
    await addExerciseToSession(ex);
  };

  const deloadInfo = async (exerciseId: string) =>
    getDeloadPrescription(exerciseId, week, { deloadWeeks });

  const reorderEntry = async (from: number, to: number) => {
    if (
      !session ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= session.entries.length ||
      to >= session.entries.length
    )
      return;
    const arr = [...session.entries];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const updated = { ...session, entries: arr };
    setSession(updated);
    await db.put("sessions", updated);
  };

  return (
    <div className="space-y-4">
      {/* Header toolbar - responsive */}
  <div className="flex flex-wrap items-center gap-2 sticky-toolbar rounded-b-xl">
        <h2 className="text-xl font-semibold">Sessions</h2>
        <PhaseStepper
          value={phase}
          onChange={async (p) => {
            setPhase(p);
            const s = await getSettings();
            await setSettings({ ...s, currentPhase: p });
          }}
        />
  <div className="flex items-center gap-2">
          <select
            className="bg-card rounded-xl px-2 py-1"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {(program
              ? Array.from({ length: program.mesoWeeks }, (_, i) => i + 1)
              : Array.from({ length: 9 }, (_, i) => i + 1)
            ).map((w) => (
              <option key={w} value={w}>
                Week {w}
                {program && deloadWeeks.has(w) ? " (Deload)" : ""}
              </option>
            ))}
          </select>
          <select
            className="bg-card rounded-xl px-2 py-1"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {(program
              ? program.weeklySplit.map((d: any) => d.customLabel || d.type)
              : DAYS
            ).map((d: string, i: number) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
          {program && (
            <button
              className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
              onClick={() => (window.location.hash = "#/settings/program")}
              title="Edit program"
            >
              {programSummary(program)}
            </button>
          )}
          {session?.autoImportedTemplateId && (
            <span className="badge" title="Auto-imported template applied">Template</span>
          )}
        </div>
        {/* Desktop: show all actions */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl"
            onClick={() => setShowImport(true)}
          >
            Import from Template
          </button>
          <button
            className="bg-emerald-700 px-3 py-2 rounded-xl"
            title="Start next 9-week phase"
            onClick={async () => {
              // Require at least one real set in current phase before moving unless user confirms override.
              const all = await db.getAll<Session>('sessions');
              const curPhaseSessions = all.filter(s=> (s.phaseNumber||s.phase||1)===phase);
              const hasReal = curPhaseSessions.some(s=> s.entries.some(e=> e.sets.some(st=> (st.weightKg||0)>0 || (st.reps||0)>0)));
              if(!hasReal){
                if(!window.confirm('No real training data logged in this phase. Advance anyway?')) return;
              } else {
                if(!window.confirm('Advance to next phase? This will reset week to 1.')) return;
              }
              const s = await getSettings();
              const next = (s.currentPhase || 1) + 1;
              await setSettings({ ...s, currentPhase: next });
              setPhase(next as number);
              setWeek(1 as any);
              setDay(0);
            }}
          >Next phase →</button>
          {phase>1 && <button
            className="bg-slate-700 px-3 py-2 rounded-xl"
            title="Revert to previous phase"
            onClick={async ()=> {
              if(!window.confirm('Revert to phase '+(phase-1)+'?')) return;
              const s = await getSettings();
              const prev = Math.max(1, (s.currentPhase||1)-1);
              await setSettings({ ...s, currentPhase: prev });
              setPhase(prev);
              setWeek(1 as any);
              setDay(0);
            }}
          >← Prev phase</button>}
          <button
            className="bg-slate-700 px-3 py-2 rounded-xl"
            onClick={async () => {
              if (!session) return;
              const prevId = `${phase}-${Math.max(
                1,
                (week as number) - 1
              )}-${day}`;
              let prev = await db.get<Session>("sessions", prevId);
              if (!prev && week === 1 && phase > 1) {
                prev = await db.get<Session>(
                  "sessions",
                  `${phase - 1}-9-${day}`
                );
              }
              if (prev) {
                const copy: Session = {
                  ...session,
                  entries: prev.entries.map((e) => ({
                    ...e,
                    id: nanoid(),
                    sets: e.sets.map((s, i) => ({ ...s, setNumber: i + 1 })),
                  })),
                };
                setSession(copy);
                await db.put("sessions", copy);
              }
            }}
          >
            Copy last session
          </button>
        </div>
        {/* Mobile: collapse actions into More */}
        <div className="sm:hidden">
          <button
            className="bg-slate-700 px-3 py-2 rounded-xl"
            onClick={() => setMoreOpen((o) => !o)}
          >
            {moreOpen ? "Close" : "More"}
          </button>
        </div>
        {moreOpen && (
          <div className="w-full sm:hidden grid grid-cols-1 gap-2">
            <button
              className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl"
              onClick={() => {
                setShowImport(true);
                setMoreOpen(false);
              }}
            >
              Import from Template
            </button>
            <button
              className="bg-emerald-700 px-3 py-2 rounded-xl"
              title="Start next 9-week phase"
              onClick={async () => {
                const s = await getSettings();
                const next = (s.currentPhase || 1) + 1;
                await setSettings({ ...s, currentPhase: next });
                setPhase(next as number);
                setWeek(1 as any);
                setDay(0);
                setMoreOpen(false);
              }}
            >
              Next phase →
            </button>
            {phase>1 && <button
              className="bg-slate-700 px-3 py-2 rounded-xl"
              onClick={async ()=>{
                if(!window.confirm('Revert to phase '+(phase-1)+'?')) return;
                const s = await getSettings();
                const prev = Math.max(1,(s.currentPhase||1)-1);
                await setSettings({ ...s, currentPhase: prev });
                setPhase(prev);
                setWeek(1 as any);
                setDay(0);
                setMoreOpen(false);
              }}
            >Prev phase ←</button>}
            <button
              className="bg-slate-700 px-3 py-2 rounded-xl"
              onClick={async () => {
                if (!session) return;
                const prevId = `${phase}-${Math.max(
                  1,
                  (week as number) - 1
                )}-${day}`;
                let prev = await db.get<Session>("sessions", prevId);
                if (!prev && week === 1 && phase > 1) {
                  prev = await db.get<Session>(
                    "sessions",
                    `${phase - 1}-9-${day}`
                  );
                }
                if (prev) {
                  const copy: Session = {
                    ...session,
                    entries: prev.entries.map((e) => ({
                      ...e,
                      id: nanoid(),
                      sets: e.sets.map((s, i) => ({ ...s, setNumber: i + 1 })),
                    })),
                  };
                  setSession(copy);
                  await db.put("sessions", copy);
                }
                setMoreOpen(false);
              }}
            >
              Copy last session
            </button>
          </div>
        )}
      </div>
      {isDeloadWeek && (
        <div
          className="text-xs text-amber-300 fade-in inline-flex items-center gap-1"
          data-shape="deload"
          aria-label="Deload week adjustments are active"
        >
          Deload adjustments active
        </div>
      )}

  <div className="space-y-3">
        {session?.entries.map((entry, entryIdx) => {
          const ex = exercises.find((e) => e.id === entry.exerciseId);
          // derive previous best + nudge
          const prev = prevBestMap
            ? getPrevBest(prevBestMap, entry.exerciseId)
            : undefined;
          const currentBest = (() => {
            const best = [...entry.sets].sort((a, b) => {
              if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
              return (b.reps || 0) - (a.reps || 0);
            })[0];
            return best;
          })();
          const showPrevHints = settingsState?.progress?.showPrevHints ?? true;
          const showNudge = !!(
            showPrevHints &&
            prev &&
            currentBest &&
            currentBest.weightKg === prev.set.weightKg &&
            currentBest.reps === prev.set.reps
          );
          return (
            <div
              key={entry.id}
              className="bg-card rounded-2xl p-4 shadow-soft fade-in"
              draggable
              onDragStart={() => setDragEntryIdx(entryIdx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragEntryIdx != null) {
                  reorderEntry(dragEntryIdx, entryIdx);
                  setDragEntryIdx(null);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium flex items-center gap-2">
                  {ex?.name || "Exercise"}
                  {ex?.isOptional && (
                    <span className="text-[10px] text-gray-400">optional</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isDeloadWeek && (
                    <span data-shape="deload">
                      <AsyncChip promise={deloadInfo(entry.exerciseId)} />
                    </span>
                  )}
                  <button
                    aria-label="Remove exercise"
                    className="text-xs bg-slate-800 rounded-xl px-2 py-1"
                    onClick={() => removeEntry(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {showPrevHints && prev && (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span
                    className="prev-hint-pill"
                    aria-label={`Previous best set: ${prev.set.weightKg} kilograms for ${prev.set.reps} reps`}
                    title="Last logged best set"
                  >
                    <span className="opacity-70">Prev:</span>
                    <span>{prev.set.weightKg}</span>
                    <span>×</span>
                    <span>{prev.set.reps}</span>
                  </span>
                  {showNudge && (
                    <span className="prev-hint-pill" data-nudge="true">
                      Try +1 rep or +2.5kg?
                    </span>
                  )}
                </div>
              )}

              {/* Sets - mobile friendly list */}
              <div className="mt-3 sm:hidden space-y-2">
                {entry.sets.map((set, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-800 px-2 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <span className="text-gray-300">
                          Set {set.setNumber}
                        </span>
                        <PRChip
                          exerciseId={entry.exerciseId}
                          score={set.weightKg * set.reps}
                          week={week}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-[11px] bg-slate-700 rounded px-2 py-1"
                          disabled={idx === 0}
                          onClick={() => reorderSet(entry, idx, idx - 1)}
                        >
                          Up
                        </button>
                        <button
                          className="text-[11px] bg-slate-700 rounded px-2 py-1"
                          disabled={idx === entry.sets.length - 1}
                          onClick={() => reorderSet(entry, idx, idx + 1)}
                        >
                          Down
                        </button>
                        <button
                          className="text-[11px] bg-red-600 rounded px-2 py-1"
                          onClick={() => deleteSet(entry, idx)}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-900/40 rounded-xl px-2 py-2">
                        <div className="text-[11px] text-gray-400 mb-1">
                          Weight
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        weightKg: Math.max(
                                          0,
                                          (s.weightKg || 0) - 2.5
                                        ),
                                      }
                                    : s
                                ),
                              })
                            }
                          >
                            -
                          </button>
                          <input
                            inputMode="decimal"
                            aria-label="Weight"
                            className="bg-slate-900 rounded-xl px-3 py-2 w-full text-center"
                            data-set-input="true"
                            data-entry-id={entry.id}
                            data-set-number={set.setNumber}
                            value={set.weightKg}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                updateEntry({
                                  ...entry,
                                  sets: entry.sets.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          weightKg: (s.weightKg || 0) + 2.5,
                                        }
                                      : s
                                  ),
                                });
                              } else if (e.key === "ArrowDown") {
                                e.preventDefault();
                                updateEntry({
                                  ...entry,
                                  sets: entry.sets.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          weightKg: Math.max(
                                            0,
                                            (s.weightKg || 0) - 2.5
                                          ),
                                        }
                                      : s
                                  ),
                                });
                              }
                            }}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        weightKg: v === "" ? 0 : Number(v),
                                      }
                                    : s
                                ),
                              });
                            }}
                          />
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        weightKg: (s.weightKg || 0) + 2.5,
                                      }
                                    : s
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="bg-slate-900/40 rounded-xl px-2 py-2">
                        <div className="text-[11px] text-gray-400 mb-1">
                          Reps
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        reps: Math.max(0, (s.reps || 0) - 1),
                                      }
                                    : s
                                ),
                              })
                            }
                          >
                            -
                          </button>
                          <input
                            inputMode="numeric"
                            aria-label="Reps"
                            className="bg-slate-900 rounded-xl px-3 py-2 w-full text-center"
                            data-set-input="true"
                            data-entry-id={entry.id}
                            data-set-number={set.setNumber}
                            value={set.reps}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                updateEntry({
                                  ...entry,
                                  sets: entry.sets.map((s, i) =>
                                    i === idx
                                      ? { ...s, reps: (s.reps || 0) + 1 }
                                      : s
                                  ),
                                });
                              } else if (e.key === "ArrowDown") {
                                e.preventDefault();
                                updateEntry({
                                  ...entry,
                                  sets: entry.sets.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          reps: Math.max(0, (s.reps || 0) - 1),
                                        }
                                      : s
                                  ),
                                });
                              }
                            }}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!/^\d*$/.test(v)) return;
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? { ...s, reps: v === "" ? 0 : Number(v) }
                                    : s
                                ),
                              });
                            }}
                          />
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? { ...s, reps: (s.reps || 0) + 1 }
                                    : s
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <button className="px-2 py-1 rounded bg-slate-700" onClick={()=>toggleRestTimer(entry.id,set.setNumber)}>Rest</button>
                      {restTimerDisplay(entry.id,set.setNumber)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sets grid with drag-and-drop (desktop) */}
              <div className="mt-3 hidden sm:grid grid-cols-[auto,1fr,1fr,auto] gap-2 items-center" role="list" aria-label={`Sets for exercise ${entry.exerciseId}`}> 
                <div className="text-sm text-gray-400">Set</div>
                <div className="text-sm text-gray-400">Weight</div>
                <div className="text-sm text-gray-400">Reps</div>
                <div></div>
                {entry.sets.map((set, idx) => (
                  <div
                    key={idx}
                    className="contents"
                    role="listitem"
                    aria-roledescription="Draggable set row"
                    aria-label={`Set ${set.setNumber} weight ${set.weightKg||0} reps ${set.reps||0}`}
                    draggable
                    onDragStart={(ev) => {
                      (entry as any)._dragSet = idx;
                      ev.dataTransfer.setData('text/plain', String(idx));
                      ev.currentTarget.setAttribute('aria-grabbed','true');
                    }}
                    onDragEnd={(ev)=> ev.currentTarget.removeAttribute('aria-grabbed')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const from = (entry as any)._dragSet;
                      if (typeof from === "number") {
                        reorderSet(entry, from, idx);
                        (entry as any)._dragSet = undefined;
                      }
                    }}
                  >
                    <div className="px-2">{set.setNumber}</div>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    weightKg: Math.max(
                                      0,
                                      (s.weightKg || 0) - 2.5
                                    ),
                                  }
                                : s
                            ),
                          })
                        }
                      >
                        -
                      </button>
                      <input
                        inputMode="decimal"
                        aria-label="Weight"
                        className="bg-slate-800 rounded-xl px-3 py-2 w-24"
                        data-set-input="true"
                        data-entry-id={entry.id}
                        data-set-number={set.setNumber}
                        value={set.weightKg}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            updateEntry({
                              ...entry,
                              sets: entry.sets.map((s, i) =>
                                i === idx
                                  ? { ...s, weightKg: (s.weightKg || 0) + 2.5 }
                                  : s
                              ),
                            });
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            updateEntry({
                              ...entry,
                              sets: entry.sets.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      weightKg: Math.max(
                                        0,
                                        (s.weightKg || 0) - 2.5
                                      ),
                                    }
                                  : s
                              ),
                            });
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? { ...s, weightKg: v === "" ? 0 : Number(v) }
                                : s
                            ),
                          });
                        }}
                      />
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? { ...s, weightKg: (s.weightKg || 0) + 2.5 }
                                : s
                            ),
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? { ...s, reps: Math.max(0, (s.reps || 0) - 1) }
                                : s
                            ),
                          })
                        }
                      >
                        -
                      </button>
                      <input
                        inputMode="numeric"
                        aria-label="Reps"
                        className="bg-slate-800 rounded-xl px-3 py-2 w-20"
                        data-set-input="true"
                        data-entry-id={entry.id}
                        data-set-number={set.setNumber}
                        value={set.reps}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            updateEntry({
                              ...entry,
                              sets: entry.sets.map((s, i) =>
                                i === idx
                                  ? { ...s, reps: (s.reps || 0) + 1 }
                                  : s
                              ),
                            });
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            updateEntry({
                              ...entry,
                              sets: entry.sets.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      reps: Math.max(0, (s.reps || 0) - 1),
                                    }
                                  : s
                              ),
                            });
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!/^\d*$/.test(v)) return;
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? { ...s, reps: v === "" ? 0 : Number(v) }
                                : s
                            ),
                          });
                        }}
                      />
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx ? { ...s, reps: (s.reps || 0) + 1 } : s
                            ),
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <PRChip
                        exerciseId={entry.exerciseId}
                        score={set.weightKg * set.reps}
                        week={week}
                      />
                      <button
                        className="text-[10px] bg-slate-700 rounded px-2 py-0.5"
                        disabled={idx === 0}
                        onClick={() => reorderSet(entry, idx, idx - 1)}
                      >
                        Up
                      </button>
                      <button
                        className="text-[10px] bg-slate-700 rounded px-2 py-0.5"
                        disabled={idx === entry.sets.length - 1}
                        onClick={() => reorderSet(entry, idx, idx + 1)}
                      >
                        Down
                      </button>
                      <button
                        className="text-[10px] bg-red-600 rounded px-2 py-0.5"
                        onClick={() => deleteSet(entry, idx)}
                      >
                        Del
                      </button>
                      <button className="text-[10px] bg-slate-700 rounded px-2 py-0.5" onClick={()=>toggleRestTimer(entry.id,set.setNumber)}>Rest</button>
                      {restTimerDisplay(entry.id,set.setNumber)}
                      {idx===entry.sets.length-1 && <button className="text-[10px] bg-emerald-700 rounded px-2 py-0.5" onClick={()=>duplicateLastSet(entry)}>Dup</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Session summary footer */}
      {session && !!session.entries.length && (
        <SessionSummary session={session} exercises={exercises} />
      )}

      <div className="bg-card rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm">Add exercise</div>
          <button
            className="text-xs sm:text-sm bg-slate-800 rounded-xl px-3 py-2"
            onClick={() => setShowAdd(true)}
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto sm:overflow-visible sm:flex-nowrap sm:overflow-x-auto">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              className="px-3 py-2 bg-slate-800 rounded-xl whitespace-nowrap"
              onClick={() => addExerciseToSession(ex)}
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add dialog */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg p-4 shadow-xl border border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Add exercise</div>
              <button
                className="text-xs bg-slate-800 rounded px-2 py-1"
                onClick={() => setShowAdd(false)}
              >
                Close
              </button>
            </div>
            <input
              className="w-full bg-slate-800 rounded-xl px-3 py-2"
              placeholder="Search or type a new exercise name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  createCustomExercise(query.trim());
                  setShowAdd(false);
                  setQuery("");
                }
              }}
            />
            <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-2">
              {exercises
                .filter((e) =>
                  e.name.toLowerCase().includes(query.toLowerCase())
                )
                .map((e) => (
                  <button
                    key={e.id}
                    className="w-full text-left px-3 py-3 bg-slate-800 rounded-xl"
                    onClick={() => {
                      addExerciseToSession(e);
                      setShowAdd(false);
                      setQuery("");
                    }}
                  >
                    {e.name}
                  </button>
                ))}
              {query && (
                <button
                  className="w-full text-left px-3 py-3 bg-brand-600 rounded-xl"
                  onClick={() => {
                    createCustomExercise(query.trim());
                    setShowAdd(false);
                    setQuery("");
                  }}
                >
                  Create "{query}"
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <button className="text-xs underline" onClick={() => undoLast()}>
          Undo last action
        </button>
      </div>

      <Snackbar
        open={snack.open}
        message={snack.msg}
        actionLabel={snack.undo ? "Undo" : undefined}
        onAction={() => {
          snack.undo?.();
          setSnack({ open: false, msg: "" });
        }}
        onClose={() => setSnack({ open: false, msg: "" })}
      />
      <ImportTemplateDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        session={session as any}
        weekNumber={week}
        onImported={(updated, count, name) => {
          setSession(updated);
          setSnack({
            open: true,
            msg: `Imported ${count} exercises from "${name}"`,
          });
        }}
      />
    </div>
  );
}

// Lightweight summary component
function SessionSummary({ session, exercises }: { session: Session; exercises: Exercise[] }) {
  const exMap = useMemo(()=> new Map(exercises.map(e=>[e.id,e])), [exercises])
  const totals = useMemo(()=>{
    let sets = 0, volume = 0, prs = 0
    for(const entry of session.entries){
      for(const s of entry.sets){
        sets++
        const ton = (s.weightKg||0) * (s.reps||0)
        volume += ton
        // naive PR heuristic: ton > 0 & reps*weight above simple threshold
        if(ton > 0 && ton >=  (exMap.get(entry.exerciseId)?.defaults.sets||3) * 50) prs++
      }
    }
    return { sets, volume, prs }
  }, [session, exMap])
  const estTonnage = totals.volume
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft mt-4 fade-in">
      <div className="flex flex-wrap gap-4 text-xs">
        <div><span className="text-muted">Sets:</span> {totals.sets}</div>
        <div><span className="text-muted">Volume:</span> {estTonnage}</div>
        <div><span className="text-muted">PR Signals:</span> {totals.prs}</div>
      </div>
    </div>
  )
}

function AsyncChip({ promise }: { promise: Promise<any> }) {
  const [text, setText] = useState("…");
  useEffect(() => {
    promise.then((r) =>
      setText(`DL: ${Math.round(r.loadPct * 100)}% × ${r.targetSets} sets`)
    );
  }, [promise]);
  return (
    <span className="text-xs bg-slate-800 rounded-xl px-2 py-1">{text}</span>
  );
}

function PRChip({
  exerciseId,
  score,
  week,
}: {
  exerciseId: string;
  score: number;
  week: number;
}) {
  const [best, setBest] = useState(0);
  useEffect(() => {
    (async () => {
      const r = await rollingPRs(exerciseId);
      setBest(r.bestTonnageSet);
    })();
  }, [exerciseId, week]);
  if (score <= 0 || best <= 0 || score < best) return null;
  return (
    <span className="text-[10px] rounded px-2 py-0.5 inline-flex items-center gap-1 bg-yellow-500 text-black border border-yellow-300" data-shape="pr" aria-label="Personal record set">
      <span className="w-2 h-2 rounded-full bg-black" aria-hidden="true"></span>
      PR
    </span>
  );
}
