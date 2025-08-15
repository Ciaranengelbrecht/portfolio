import { useEffect, useMemo, useState } from "react";
import { db } from "../lib/db";
import { waitForSession } from "../lib/supabase";
import { Exercise, Session, SessionEntry, SetEntry, Template, Settings } from "../lib/types";
import { useProgram } from '../state/program'
import { computeDeloadWeeks, programSummary } from '../lib/program'
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
  const { program } = useProgram()
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
  const [prevBestMap, setPrevBestMap] = useState<{[id:string]: { week:number; set:SetEntry }} | null>(null)
  const [settingsState, setSettingsState] = useState<Settings | null>(null)

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

  // Adjust week clamp if program changes
  useEffect(()=>{
    if(program){
      if(week > program.mesoWeeks) setWeek(1)
      if(day >= program.weekLengthDays) setDay(0)
    }
  },[program])

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
        const templateName = templateMeta ? (templateMeta.customLabel || templateMeta.type || 'Day') : DAYS[day];
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
        if(templateMeta?.templateId){
          try {
            const t = await db.get('templates', templateMeta.templateId)
            if(t){
              // Reuse import logic manually (append false since brand new)
              const exs = await db.getAll('exercises')
              const settings = await getSettings()
              const exMap = new Map(exs.map((e:any)=>[e.id,e]))
              const rows = (exId: string) => Math.max(1, Math.min(6, settings.defaultSetRows ?? (exMap.get(exId)?.defaults.sets ?? 3)))
              const newEntries = (t.exerciseIds||[]).map((exId:string)=>({ id: nanoid(), exerciseId: exId, sets: Array.from({ length: rows(exId) }, (_,i)=>({ setNumber: i+1, weightKg: 0, reps: 0 })) }))
              s = { ...s, entries: newEntries, autoImportedTemplateId: templateMeta.templateId }
              await db.put('sessions', s)
            }
          } catch(e){ console.warn('[Sessions] auto-import template failed', e) }
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
      const allSessions = await db.getAll<Session>("sessions")
      setPrevBestMap(buildPrevBestMap(allSessions, week, phase))
  const st = await getSettings();
  setSettingsState(st as any)
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
  useEffect(() => { (async () => {
    const allSessions = await db.getAll<Session>('sessions')
    setPrevBestMap(buildPrevBestMap(allSessions, week, phase))
  })() }, [week, phase])

  const deloadWeeks = program ? computeDeloadWeeks(program) : new Set<number>()
  const isDeloadWeek = deloadWeeks.has(week)

  // Backfill programId on existing loaded session if missing (one-time effect per session)
  useEffect(()=>{ (async()=>{
    if(session && program && !session.programId){
      const updated = { ...session, programId: program.id }
      await db.put('sessions', updated)
      setSession(updated)
    }
  })() }, [session?.id, program?.id])

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
      const exName = exercises.find(
        (e) => e.id === session.entries.find((x) => x.id === entryId)?.exerciseId
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
      <div className="flex flex-wrap items-center gap-2">
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
            {(program ? program.weeklySplit.map((d) => d.customLabel || d.type) : DAYS).map(
              (d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              )
            )}
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
              const s = await getSettings();
              const next = (s.currentPhase || 1) + 1;
              await setSettings({ ...s, currentPhase: next });
              setPhase(next as number);
              setWeek(1 as any);
              setDay(0);
            }}
          >
            Next phase →
          </button>
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
        <div className="text-xs text-amber-300">Deload adjustments active</div>
      )}

      <div className="space-y-3">
        {session?.entries.map((entry, entryIdx) => {
          const ex = exercises.find((e) => e.id === entry.exerciseId);
          // derive previous best + nudge
          const prev = prevBestMap ? getPrevBest(prevBestMap, entry.exerciseId) : undefined;
          const currentBest = (() => {
            const best = [...entry.sets].sort((a, b) => {
              if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
              return (b.reps || 0) - (a.reps || 0);
            })[0];
            return best;
          })();
          const showPrevHints = (settingsState?.progress?.showPrevHints ?? true);
          const showNudge = !!(showPrevHints && prev && currentBest && currentBest.weightKg === prev.set.weightKg && currentBest.reps === prev.set.reps);
          return (
            <div
              key={entry.id}
              className="bg-card rounded-2xl p-4 shadow-soft"
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
                    <AsyncChip promise={deloadInfo(entry.exerciseId)} />
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
                  </div>
                ))}
              </div>

              {/* Sets grid with drag-and-drop (desktop) */}
              <div className="mt-3 hidden sm:grid grid-cols-[auto,1fr,1fr,auto] gap-2 items-center">
                <div className="text-sm text-gray-400">Set</div>
                <div className="text-sm text-gray-400">Weight</div>
                <div className="text-sm text-gray-400">Reps</div>
                <div></div>
                {entry.sets.map((set, idx) => (
                  <div
                    key={idx}
                    className="contents"
                    draggable
                    onDragStart={() => {
                      (entry as any)._dragSet = idx;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
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
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <button
                  className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl"
                  onClick={() => addSet(entry)}
                  disabled={!session}
                >
                  + Add set
                </button>
              </div>

              <div className="mt-3">
                <input
                  className="w-full bg-slate-800 rounded-xl px-3 py-2"
                  placeholder="Notes (optional)"
                  value={entry.notes || ""}
                  onChange={(e) =>
                    updateEntry({ ...entry, notes: e.target.value })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

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
        <div
          className="fixed inset-0 z-50 bg-black/60 grid place-items-end sm:place-items-center"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl p-4 shadow-soft w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium mb-2">Add exercise</div>
            <input
              autoFocus
              className="w-full bg-slate-800 rounded-xl px-3 py-3"
              placeholder="Search or type a new exercise"
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
    <span className="text-[10px] bg-yellow-600 text-black rounded px-2 py-0.5">
      PR
    </span>
  );
}
