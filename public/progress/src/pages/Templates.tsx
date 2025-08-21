import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/db";
import { waitForSession } from "../lib/supabase";
import { Exercise, Template } from "../lib/types";
import { nanoid } from "nanoid";

export default function Templates() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [showAddFor, setShowAddFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [showAllExercises, setShowAllExercises] = useState(false);
  // UI-only collapsed state (not persisted)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  const findExerciseByName = (n: string) => {
    const target = norm(n);
    return exercises.find((e) => norm(e.name) === target);
  };
  const createOrGetExercise = async (rawName: string): Promise<Exercise> => {
    const clean = rawName.trim();
    if (!clean) throw new Error("Exercise name required");
    const existing = findExerciseByName(clean);
    if (existing) return existing;
    const e: Exercise = {
      id: nanoid(),
      name: clean,
      muscleGroup: "other",
      defaults: { sets: 3, targetRepRange: "8-12" },
      active: true,
    };
    await db.put("exercises", e);
    setExercises([e, ...exercises]);
    return e;
  };

  useEffect(() => {
    (async () => {
      await waitForSession({ timeoutMs: 4000 });
      setExercises(await db.getAll("exercises"));
      setTemplates(await db.getAll("templates"));
    })();
  }, []);

  useEffect(() => {
    const onAuth = () => {
      (async () => {
        await waitForSession({ timeoutMs: 4000 });
        setExercises(await db.getAll("exercises"));
        setTemplates(await db.getAll("templates"));
      })();
    };
    window.addEventListener("sb-auth", onAuth);
    return () => window.removeEventListener("sb-auth", onAuth);
  }, []);

  // Realtime auto-refresh
  useEffect(() => {
    const onChange = (e: any) => {
      const tbl = e?.detail?.table;
      if (tbl === "exercises") db.getAll("exercises").then(setExercises);
      if (tbl === "templates") db.getAll("templates").then(setTemplates);
    };
    window.addEventListener("sb-change", onChange as any);
    return () => window.removeEventListener("sb-change", onChange as any);
  }, []);

  const buildDefaultPlan = (ex: Exercise) => ({
    exerciseId: ex.id,
    plannedSets: ex.defaults?.sets || 3,
    repRange: ex.defaults?.targetRepRange || "8-12",
    progression: { scheme: 'linear' as const, incrementKg: 2.5, addRepsFirst: true }
  });

  const addTemplate = async () => {
    const raw = name || `Template ${templates.length + 1}`;
    const clean = raw.trim().replace(/\s+/g,' ').slice(0,60) || `Template ${templates.length + 1}`;
    const initial = exercises.slice(0, 4);
    const t: Template = {
      id: nanoid(),
      name: clean,
      exerciseIds: initial.map((e) => e.id),
      plan: initial.map(buildDefaultPlan)
    };
    await db.put("templates", t);
    setTemplates([t, ...templates]);
    setName("");
  };

  const toggle = async (t: Template) => {
    const nt = { ...t, hidden: !t.hidden };
    await db.put("templates", nt);
    setTemplates(templates.map((x) => (x.id === t.id ? nt : x)));
  };

  const duplicate = async (t: Template) => {
    const copy: Template = {
      id: nanoid(),
      name: `${t.name} (copy)`,
      exerciseIds: [...t.exerciseIds],
      plan: t.plan ? t.plan.map(p=> ({ ...p })) : undefined,
    };
    await db.put("templates", copy);
    setTemplates([copy, ...templates]);
  };

  const moveExercise = async (t: Template, from: number, to: number) => {
    const arr = [...t.exerciseIds];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    const nt = { ...t, exerciseIds: arr };
    await db.put("templates", nt);
    setTemplates(templates.map((x) => (x.id === t.id ? nt : x)));
  };

  const addExerciseToTemplate = async (t: Template, ex: Exercise) => {
    if (t.exerciseIds.includes(ex.id)) {
      setShowAddFor(null);
      setQuery("");
      return;
    }
    const planEntry = buildDefaultPlan(ex);
    const nt: Template = { ...t, exerciseIds: [...t.exerciseIds, ex.id], plan: [...(t.plan||[]), planEntry] };
    await db.put("templates", nt);
    setTemplates(templates.map((x) => (x.id === t.id ? nt : x)));
    setShowAddFor(null);
    setQuery("");
  };

  const removeExerciseFromTemplate = async (t: Template, id: string) => {
    const nt: Template = { ...t, exerciseIds: t.exerciseIds.filter((x) => x !== id), plan: t.plan?.filter(p=> p.exerciseId!==id) };
    await db.put("templates", nt);
    setTemplates(templates.map((x) => (x.id === t.id ? nt : x)));
  };

  const toggleOptional = async (ex: Exercise) => {
    const next = { ...ex, isOptional: !ex.isOptional };
    await db.put("exercises", next);
    setExercises(exercises.map((e) => (e.id === ex.id ? next : e)));
  };

  const deleteTemplate = async (t: Template) => {
    const cfg = await db.get("settings", "app");
    if (
      cfg?.confirmDestructive &&
      !confirm(`Delete template "${t.name}"? This cannot be undone.`)
    )
      return;
    await db.delete("templates", t.id);
    setTemplates(templates.filter((x) => x.id !== t.id));
  };

  const deleteExercise = async (ex: Exercise) => {
    const cfg = await db.get("settings", "app");
    if (
      cfg?.confirmDestructive &&
      !confirm(
        `Delete exercise "${ex.name}"? It will be removed from all templates.`
      )
    )
      return;
    await db.delete("exercises", ex.id);
    // Remove from local list
    const nextExercises = exercises.filter((e) => e.id !== ex.id);
    setExercises(nextExercises);
    // Remove from all templates and persist
    const changed: Template[] = [];
    const nextTemplates = templates.map((t) => {
      if (!t.exerciseIds.includes(ex.id)) return t;
      const nt = {
        ...t,
        exerciseIds: t.exerciseIds.filter((id) => id !== ex.id),
      };
      changed.push(nt);
      return nt;
    });
    setTemplates(nextTemplates);
    await Promise.all(changed.map((t) => db.put("templates", t)));
  };

  // Lightweight fuzzy matcher: returns score (higher = better)
  const fuzzyScore = (term:string, target:string)=> {
    term = term.toLowerCase(); target = target.toLowerCase();
    if(target.includes(term)) return term.length * 4; // direct substring boost
    // sequential character match score
    let ti=0, score=0;
    for(let i=0;i<target.length && ti<term.length;i++){
      if(target[i]===term[ti]){ score+=2; ti++; }
    }
    return ti===term.length? score : 0;
  };
  // Multi-token + tag aware search: tokens separated by space. Support prefix filters:
  // tag:xyz (matches tags) mg:group sec:group eq:equipment (equipment tag)
  const searchedExercises = useMemo(()=> {
    const raw = exerciseQuery.trim();
    const all = exercises;
    if(!raw){ return showAllExercises? all : []; }
    const tokens = raw.split(/\s+/).slice(0,6); // cap tokens
    const scored: { e: Exercise; score: number }[] = [];
    outer: for(const e of all){
      const nameL = e.name.toLowerCase();
      const tags = (e.tags||[]).map(t=> t.toLowerCase());
      let total = 0;
      for(const t of tokens){
        const tl = t.toLowerCase();
        if(tl.startsWith('tag:')){
          const want = tl.slice(4);
            if(!tags.some(x=> x===want)) continue outer;
            total += 30;
            continue;
        }
        if(tl.startsWith('mg:')){
          const want = tl.slice(3);
          if(!tags.includes('mg:'+want)) continue outer;
          total += 25; continue;
        }
        if(tl.startsWith('sec:')){
          const want = tl.slice(4);
          if(!tags.includes('sec:'+want)) continue outer;
          total += 15; continue;
        }
        // Plain token: match name OR tags subsequence
        const tagHit = tags.some(tag=> tag.includes(tl));
        const sName = fuzzyScore(tl, nameL);
        if(sName===0 && !tagHit){ continue outer; }
        total += sName + (tagHit? 10:0);
      }
      if(total>0) scored.push({ e, score: total });
    }
    return scored.sort((a,b)=> b.score - a.score || a.e.name.localeCompare(b.e.name)).slice(0, 250).map(x=> x.e);
  }, [exerciseQuery, exercises, showAllExercises]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Templates</h2>
      <div className="bg-card rounded-2xl p-3">
        <div className="flex gap-2">
          <input
            className="bg-slate-800 rounded-xl px-3 py-3 flex-1"
            placeholder="New template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="bg-brand-600 hover:bg-brand-700 px-3 py-3 rounded-xl"
            onClick={addTemplate}
          >
            Add
          </button>
        </div>
        {templates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <button
              className="bg-slate-800 hover:bg-slate-700 rounded-xl px-3 py-2"
              onClick={() => {
                // Collapse all
                const next: Record<string, boolean> = {};
                for (const t of templates) next[t.id] = true;
                setCollapsed(next);
              }}
            >
              Collapse All
            </button>
            <button
              className="bg-slate-800 hover:bg-slate-700 rounded-xl px-3 py-2"
              onClick={() => setCollapsed({})}
              disabled={Object.keys(collapsed).length === 0}
            >
              Expand All
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-card rounded-2xl p-4 shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  className="text-xs bg-slate-800 rounded-md px-2 py-1 shrink-0"
                  onClick={() => setCollapsed(c => ({ ...c, [t.id]: !c[t.id] }))}
                  title={collapsed[t.id] ? 'Expand template' : 'Collapse template'}
                >
                  {collapsed[t.id] ? '▶' : '▼'}
                </button>
                <input
                  className="bg-transparent font-medium flex-1 min-w-0"
                  value={t.name}
                  onChange={(e) => {
                    const nt = { ...t, name: e.target.value };
                    setTemplates(templates.map((x) => (x.id === t.id ? nt : x)));
                    db.put("templates", nt);
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[11px] opacity-70">{t.exerciseIds.length} ex</div>
                <button
                  className="text-xs sm:text-sm bg-slate-800 rounded-xl px-3 py-2"
                  onClick={() => duplicate(t)}
                >
                  Duplicate
                </button>
                <button
                  className="text-xs sm:text-sm bg-slate-800 rounded-xl px-3 py-2"
                  onClick={() => toggle(t)}
                >
                  {t.hidden ? "Show" : "Hide"}
                </button>
                <button
                  className="text-xs sm:text-sm bg-red-600 rounded-xl px-3 py-2"
                  onClick={() => deleteTemplate(t)}
                >
                  Delete
                </button>
              </div>
            </div>
            {collapsed[t.id] ? (
              <div className="mt-2 text-[11px] text-gray-400 line-clamp-2">
                {(t.exerciseIds.map(id => exercises.find(e=> e.id===id)?.name || 'Unknown').filter(Boolean)).join(', ')}
              </div>
            ) : (
              <>
                <div className="mt-2 text-sm text-gray-300">
                  Exercises: {t.exerciseIds.length}
                </div>
                <div className="mt-3 space-y-2">
                  {t.exerciseIds.map((id, idx) => {
                    const ex = exercises.find((e) => e.id === id);
                    const planEntry = t.plan?.find(p=> p.exerciseId===id);
                    return (
                      <div key={id} className="bg-slate-800 rounded-xl px-3 py-3 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="w-full sm:flex-1 text-sm sm:text-base break-words">
                            {ex?.name || "Unknown"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              className="text-[11px] sm:text-xs bg-slate-700 rounded-xl px-2 py-1 sm:px-3 sm:py-2 disabled:opacity-50"
                              disabled={idx === 0}
                              onClick={() => moveExercise(t, idx, idx - 1)}
                            >
                              Up
                            </button>
                            <button
                              className="text-[11px] sm:text-xs bg-slate-700 rounded-xl px-2 py-1 sm:px-3 sm:py-2 disabled:opacity-50"
                              disabled={idx === t.exerciseIds.length - 1}
                              onClick={() => moveExercise(t, idx, idx + 1)}
                            >
                              Down
                            </button>
                            <button
                              className="text-[11px] sm:text-xs bg-slate-700 rounded-xl px-2 py-1 sm:px-3 sm:py-2"
                              onClick={() => ex && toggleOptional(ex)}
                            >
                              {ex?.isOptional ? (
                                <>
                                  <span className="hidden sm:inline">Optional ✓</span>
                                  <span className="inline sm:hidden">Opt ✓</span>
                                </>
                              ) : (
                                <>
                                  <span className="hidden sm:inline">Optional</span>
                                  <span className="inline sm:hidden">Opt</span>
                                </>
                              )}
                            </button>
                            <button
                              className="text-[11px] sm:text-xs bg-red-600 rounded-xl px-2 py-1 sm:px-3 sm:py-2"
                              onClick={() => removeExerciseFromTemplate(t, id)}
                            >
                              Remove
                            </button>
                            {ex && (
                              <button
                                className="text-[11px] sm:text-xs bg-red-700 rounded-xl px-2 py-1 sm:px-3 sm:py-2"
                                onClick={() => deleteExercise(ex)}
                              >
                                <span className="hidden sm:inline">Delete exercise</span>
                                <span className="inline sm:hidden">Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-5 gap-2 text-[11px] sm:text-xs bg-slate-900/40 rounded-lg p-2">
                          <label className="flex flex-col gap-1">
                            <span className="opacity-70">Sets</span>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={planEntry?.plannedSets ?? ex?.defaults.sets ?? 3}
                              onChange={(e)=> {
                                const v = Math.min(10, Math.max(1, Number(e.target.value)||1));
                                const nextPlan = [...(t.plan||[])];
                                const idxP = nextPlan.findIndex(p=> p.exerciseId===id);
                                if(idxP>=0) nextPlan[idxP] = { ...nextPlan[idxP], plannedSets: v };
                                else nextPlan.push({ ...buildDefaultPlan(ex!), plannedSets: v });
                                const nt: Template = { ...t, plan: nextPlan };
                                setTemplates(templates.map(x=> x.id===t.id? nt: x));
                                db.put('templates', nt);
                              }}
                              className="bg-slate-700 rounded px-2 py-1"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="opacity-70">Rep Range</span>
                            <input
                              type="text"
                              value={planEntry?.repRange ?? ex?.defaults.targetRepRange ?? '8-12'}
                              onChange={(e)=> {
                                const v = e.target.value.replace(/[^0-9\-–]/g,'').slice(0,9);
                                const nextPlan = [...(t.plan||[])];
                                const idxP = nextPlan.findIndex(p=> p.exerciseId===id);
                                if(idxP>=0) nextPlan[idxP] = { ...nextPlan[idxP], repRange: v };
                                else nextPlan.push({ ...buildDefaultPlan(ex!), repRange: v });
                                const nt: Template = { ...t, plan: nextPlan };
                                setTemplates(templates.map(x=> x.id===t.id? nt: x));
                                db.put('templates', nt);
                              }}
                              placeholder="8-12"
                              className="bg-slate-700 rounded px-2 py-1"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="opacity-70">Increment (kg)</span>
                            <input
                              type="number"
                              step={0.5}
                              value={planEntry?.progression?.incrementKg ?? 2.5}
                              onChange={(e)=> {
                                const v = Number(e.target.value)||0;
                                const nextPlan = [...(t.plan||[])];
                                const idxP = nextPlan.findIndex(p=> p.exerciseId===id);
                                if(idxP>=0) nextPlan[idxP] = { ...nextPlan[idxP], progression: { ...(nextPlan[idxP].progression||{ scheme:'linear'}), incrementKg: v } };
                                else nextPlan.push({ ...buildDefaultPlan(ex!), progression: { scheme:'linear', incrementKg: v, addRepsFirst: true } });
                                const nt: Template = { ...t, plan: nextPlan };
                                setTemplates(templates.map(x=> x.id===t.id? nt: x));
                                db.put('templates', nt);
                              }}
                              className="bg-slate-700 rounded px-2 py-1"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="opacity-70">Reps First?</span>
                            <select
                              value={String(planEntry?.progression?.addRepsFirst ?? true)}
                              onChange={(e)=> {
                                const v = e.target.value === 'true';
                                const nextPlan = [...(t.plan||[])];
                                const idxP = nextPlan.findIndex(p=> p.exerciseId===id);
                                if(idxP>=0) nextPlan[idxP] = { ...nextPlan[idxP], progression: { ...(nextPlan[idxP].progression||{ scheme:'linear'}), addRepsFirst: v } };
                                else nextPlan.push({ ...buildDefaultPlan(ex!), progression: { scheme:'linear', incrementKg: 2.5, addRepsFirst: v } });
                                const nt: Template = { ...t, plan: nextPlan };
                                setTemplates(templates.map(x=> x.id===t.id? nt: x));
                                db.put('templates', nt);
                              }}
                              className="bg-slate-700 rounded px-2 py-1"
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          </label>
                          <div className="flex flex-col gap-1 text-[10px] sm:text-xs justify-end">
                            <div className="opacity-60 leading-tight">Guides next session progression (editable on import)</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="text-xs sm:text-sm bg-slate-800 rounded-xl px-3 py-2"
                      onClick={() => setShowAddFor(t.id)}
                    >
                      Add exercise
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showAddFor && (
        <div
          className="fixed inset-0 z-50 bg-black/60 grid place-items-end sm:place-items-center"
          onClick={() => setShowAddFor(null)}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl p-4 shadow-soft w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium mb-2">Add exercise</div>
            <input
              autoFocus
              className="w-full bg-slate-800 rounded-xl px-3 py-3"
              placeholder="Search or create exercise"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-2">
              {/* Create option when no exact case-insensitive match */}
              {(() => {
                const q = query.trim();
                if (!q) return null;
                const exact = findExerciseByName(q);
                if (!exact) {
                  return (
                    <button
                      className="w-full text-left px-3 py-3 rounded-xl bg-brand-600 hover:bg-brand-700"
                      onClick={async () => {
                        const t = templates.find((x) => x.id === showAddFor)!;
                        const e = await createOrGetExercise(q);
                        await addExerciseToTemplate(t, e);
                      }}
                    >
                      Create “{q}”
                    </button>
                  );
                }
                return null;
              })()}
              {exercises
                .filter((e) =>
                  e.name.toLowerCase().includes(query.toLowerCase())
                )
                .map((e) => (
                  <button
                    key={e.id}
                    className="w-full text-left px-3 py-3 bg-slate-800 rounded-xl"
                    onClick={() => {
                      const t = templates.find((x) => x.id === showAddFor)!;
                      addExerciseToTemplate(t, e);
                    }}
                  >
                    {e.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Exercise Library Management */}
      <div className="bg-card rounded-2xl p-4 shadow-soft">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="font-medium">Exercise Library</div>
          <input
            className="bg-slate-800 rounded-xl px-3 py-3"
            placeholder="Search"
            value={exerciseQuery}
            onChange={(e) => setExerciseQuery(e.target.value)}
          />
        </div>
        <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-3 flex-wrap">
          <span>{exerciseQuery? searchedExercises.length : (showAllExercises? exercises.length: 0)} exercise{(exerciseQuery? searchedExercises.length : (showAllExercises? exercises.length:0))===1?'':'s'} shown</span>
          <button className="px-2 py-1 rounded bg-slate-700 text-[10px]" onClick={()=> setShowAllExercises(v=> !v)}>{showAllExercises? 'Hide All':'Show All'}</button>
        </div>
        <div className="grid gap-2">
          {searchedExercises.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-3"
              >
                <div className="flex-1 min-w-[140px]">
                  <div className="truncate text-sm">{ex.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                    <select
                      value={ex.muscleGroup}
                      onChange={async(e)=> { const next={...ex, muscleGroup: e.target.value as any}; await db.put('exercises', next); setExercises(es=> es.map(x=> x.id===ex.id? next: x)); }}
                      className="bg-slate-700 rounded px-1 py-0.5"
                    >
                      {['chest','back','shoulders','triceps','biceps','legs','hamstrings','quads','glutes','calves','core','other'].map(m=> <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-1 items-center">
                      {(ex.secondaryMuscles||[]).map(sec=> (
                        <span key={sec} className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                          {sec}
                          <button
                            className="opacity-70 hover:opacity-100"
                            onClick={async()=> { const next={...ex, secondaryMuscles: (ex.secondaryMuscles||[]).filter(s=> s!==sec)}; await db.put('exercises', next); setExercises(es=> es.map(x=> x.id===ex.id? next: x)); }}
                          >×</button>
                        </span>
                      ))}
                      <SecondaryMusclePicker ex={ex} update={async(next)=> { await db.put('exercises', next); setExercises(es=> es.map(x=> x.id===ex.id? next: x)); }} />
                    </div>
                  </div>
                  {ex.tags && ex.tags.length>0 && (
                    <div className="mt-1 flex flex-wrap gap-1 max-w-full">
                      {ex.tags.slice(0,12).map(tag=> (
                        <span key={tag} className="text-[9px] bg-slate-700/70 px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="text-xs sm:text-sm bg-slate-700 rounded-xl px-3 py-2"
                  onClick={() => toggleOptional(ex)}
                >
                  {ex.isOptional ? "Optional \u2713" : "Optional"}
                </button>
                <button
                  className="text-xs sm:text-sm bg-red-600 rounded-xl px-3 py-2"
                  onClick={() => deleteExercise(ex)}
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// Inline helper component to pick secondary muscles with quick-add chips
function SecondaryMusclePicker({ ex, update }: { ex: Exercise; update: (next: Exercise)=> void }) {
  const ALL: Exercise['muscleGroup'][] = ['chest','back','shoulders','triceps','biceps','legs','hamstrings','quads','glutes','calves','core','other'];
  const remaining = ALL.filter(m=> m!==ex.muscleGroup && !(ex.secondaryMuscles||[]).includes(m));
  const [open,setOpen] = useState(false);
  if(!open) return <button className="text-[10px] bg-slate-700/60 hover:bg-slate-700 px-2 py-0.5 rounded" onClick={()=> setOpen(true)}>+ add</button>;
  return (
    <div className="flex flex-wrap gap-1">
      {remaining.map(m=> (
        <button key={m} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded"
          onClick={()=> { const next={...ex, secondaryMuscles: [...(ex.secondaryMuscles||[]), m]}; update(next); }}>
          {m}
        </button>
      ))}
      <button className="text-[10px] text-red-400 px-1.5" onClick={()=> setOpen(false)}>×</button>
    </div>
  );
}
