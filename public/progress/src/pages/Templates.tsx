import { useEffect, useState, useMemo, type MouseEvent } from "react";
import { db } from "../lib/db";
import { requestRealtime } from "../lib/supabaseSync";
import { waitForSession } from "../lib/supabase";
import { Exercise, Template, MuscleGroup } from "../lib/types";
import { nanoid } from "nanoid";
import { TemplatesSkeleton } from "../components/LoadingSkeletons";
import {
  readRecentSelections,
  rememberRecentSelection,
  sortByRecentSelection,
} from "../lib/recentSelections";

const TEMPLATE_COLLAPSE_KEY = "templates:collapsedState";
const SECONDARY_FACTOR = 0.5;
const TEMPLATE_ADD_EXERCISE_SCOPE = "templates:add-exercise";
type TemplatePlanEntry = NonNullable<Template["plan"]>[number];
const ICON_BTN_NEUTRAL =
  "flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[11px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40";
const ICON_BTN_DANGER =
  "flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/15 text-[11px] text-rose-100 transition-colors duration-150 hover:bg-rose-500/25";
const ICON_BTN_DANGER_ALT =
  "flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/45 bg-red-500/15 text-[11px] text-red-100 transition-colors duration-150 hover:bg-red-500/25";

/** Compute sets per muscle group from a template's planned sets */
function computeMuscleSets(
  template: Template,
  exerciseMap: Map<string, Exercise>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const exId of template.exerciseIds) {
    const ex = exerciseMap.get(exId);
    if (!ex) continue;
    const planEntry = template.plan?.find((p) => p.exerciseId === exId);
    const sets = planEntry?.plannedSets ?? ex.defaults?.sets ?? 3;
    const mg = ex.muscleGroup || "other";
    result[mg] = (result[mg] || 0) + sets;
    if (ex.secondaryMuscles) {
      for (const sm of ex.secondaryMuscles) {
        result[sm] = (result[sm] || 0) + sets * SECONDARY_FACTOR;
      }
    }
  }
  return result;
}

/** Format muscle counts for display (sorted by count desc) */
function formatMuscleCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => `${m}: ${Math.round(v * 10) / 10}`)
    .join(" · ");
}

export default function Templates() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [name, setName] = useState("");
  const [showAddFor, setShowAddFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [recentAddExerciseIds, setRecentAddExerciseIds] = useState<string[]>(
    []
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(TEMPLATE_COLLAPSE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {}
    return {};
  });

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
    let cancelled = false;
    (async () => {
      try {
        // Avoid blocking UI; rely on cached session or proceed optimistically
        const [exerciseRows, templateRows] = await Promise.all([
          db.getAll("exercises"),
          db.getAll("templates"),
        ]);
        if (cancelled) return;
        setExercises(exerciseRows);
        setTemplates(templateRows);
        setRecentAddExerciseIds(
          readRecentSelections(TEMPLATE_ADD_EXERCISE_SCOPE)
        );
        // subscribe only once needed
        requestRealtime("templates");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onAuth = (evt: any) => {
      if (!evt?.detail?.session) return;
      (async () => {
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
      if (tbl === "templates") db.getAll("templates").then(setTemplates);
    };
    window.addEventListener("sb-change", onChange as any);
    return () => window.removeEventListener("sb-change", onChange as any);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        TEMPLATE_COLLAPSE_KEY,
        JSON.stringify(collapsed)
      );
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    if (!templates.length) return;
    setCollapsed((prev) => {
      let changed = false;
      const next = { ...prev } as Record<string, boolean>;
      for (const tpl of templates) {
        if (next[tpl.id] === undefined) {
          next[tpl.id] = true;
          changed = true;
        }
      }
      for (const key of Object.keys(next)) {
        if (!templates.some((tpl) => tpl.id === key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [templates]);

  // Memoized exercise map for muscle calculations
  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e] as const)),
    [exercises]
  );

  const buildDefaultPlan = (ex: Exercise): TemplatePlanEntry => ({
    exerciseId: ex.id,
    plannedSets: ex.defaults?.sets || 3,
    repRange: ex.defaults?.targetRepRange || "8-12",
    progression: {
      scheme: "linear" as const,
      incrementKg: 2.5,
      addRepsFirst: true,
    },
  });

  const updateTemplatePlanEntry = (
    template: Template,
    ex: Exercise,
    mutate: (entry: TemplatePlanEntry) => TemplatePlanEntry
  ) => {
    const nextPlan = [...(template.plan || [])];
    const idxP = nextPlan.findIndex((p) => p.exerciseId === ex.id);
    const current: TemplatePlanEntry =
      idxP >= 0 ? nextPlan[idxP] : buildDefaultPlan(ex);
    const nextEntry = mutate(current);
    if (idxP >= 0) nextPlan[idxP] = nextEntry;
    else nextPlan.push(nextEntry);
    const nt: Template = { ...template, plan: nextPlan };
    setTemplates((prev) => prev.map((x) => (x.id === template.id ? nt : x)));
    void db.put("templates", nt);
  };

  const addTemplate = async () => {
    const raw = name || `Template ${templates.length + 1}`;
    const clean =
      raw.trim().replace(/\s+/g, " ").slice(0, 60) ||
      `Template ${templates.length + 1}`;
    const initial = exercises.slice(0, 4);
    const t: Template = {
      id: nanoid(),
      name: clean,
      exerciseIds: initial.map((e) => e.id),
      plan: initial.map(buildDefaultPlan),
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
      plan: t.plan ? t.plan.map((p) => ({ ...p })) : undefined,
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
    const nt: Template = {
      ...t,
      exerciseIds: [...t.exerciseIds, ex.id],
      plan: [...(t.plan || []), planEntry],
    };
    await db.put("templates", nt);
    setTemplates(templates.map((x) => (x.id === t.id ? nt : x)));
    setRecentAddExerciseIds(
      rememberRecentSelection(TEMPLATE_ADD_EXERCISE_SCOPE, ex.id, 16)
    );
    setShowAddFor(null);
    setQuery("");
  };

  const removeExerciseFromTemplate = async (t: Template, id: string) => {
    const nt: Template = {
      ...t,
      exerciseIds: t.exerciseIds.filter((x) => x !== id),
      plan: t.plan?.filter((p) => p.exerciseId !== id),
    };
    await db.put("templates", nt);
    setTemplates(templates.map((x) => (x.id === t.id ? nt : x)));
  };

  const toggleOptional = async (ex: Exercise) => {
    const next = { ...ex, isOptional: !ex.isOptional };
    await db.put("exercises", next);
    setExercises(exercises.map((e) => (e.id === ex.id ? next : e)));
  };

  const toggleTemplateCollapsed = (id: string, forced?: boolean) => {
    setCollapsed((prev) => {
      const current = prev[id];
      const nextValue =
        typeof forced === "boolean" ? forced : !(current ?? true);
      return { ...prev, [id]: nextValue };
    });
  };

  const handleTemplateSurfaceClick = (
    event: MouseEvent<HTMLDivElement>,
    templateId: string
  ) => {
    const current = collapsed[templateId] ?? true;
    if (!current) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "button, input, textarea, select, a, label, [data-prevent-card-toggle='true'], [contenteditable='true']"
      )
    ) {
      return;
    }
    toggleTemplateCollapsed(templateId, false);
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
  const fuzzyScore = (term: string, target: string) => {
    term = term.toLowerCase();
    target = target.toLowerCase();
    if (target.includes(term)) return term.length * 4; // direct substring boost
    // sequential character match score
    let ti = 0,
      score = 0;
    for (let i = 0; i < target.length && ti < term.length; i++) {
      if (target[i] === term[ti]) {
        score += 2;
        ti++;
      }
    }
    return ti === term.length ? score : 0;
  };
  // Multi-token + tag aware search: tokens separated by space. Support prefix filters:
  // tag:xyz (matches tags) mg:group sec:group eq:equipment (equipment tag)
  const searchedExercises = useMemo(() => {
    const raw = exerciseQuery.trim();
    const all = exercises;
    if (!raw) {
      return showAllExercises ? all : [];
    }
    const tokens = raw.split(/\s+/).slice(0, 6); // cap tokens
    const scored: { e: Exercise; score: number }[] = [];
    outer: for (const e of all) {
      const nameL = e.name.toLowerCase();
      const tags = (e.tags || []).map((t) => t.toLowerCase());
      let total = 0;
      for (const t of tokens) {
        const tl = t.toLowerCase();
        if (tl.startsWith("tag:")) {
          const want = tl.slice(4);
          if (!tags.some((x) => x === want)) continue outer;
          total += 30;
          continue;
        }
        if (tl.startsWith("mg:")) {
          const want = tl.slice(3);
          if (!tags.includes("mg:" + want)) continue outer;
          total += 25;
          continue;
        }
        if (tl.startsWith("sec:")) {
          const want = tl.slice(4);
          if (!tags.includes("sec:" + want)) continue outer;
          total += 15;
          continue;
        }
        // Plain token: match name OR tags subsequence
        const tagHit = tags.some((tag) => tag.includes(tl));
        const sName = fuzzyScore(tl, nameL);
        if (sName === 0 && !tagHit) {
          continue outer;
        }
        total += sName + (tagHit ? 10 : 0);
      }
      if (total > 0) scored.push({ e, score: total });
    }
    return scored
      .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
      .slice(0, 250)
      .map((x) => x.e);
  }, [exerciseQuery, exercises, showAllExercises]);

  const addExerciseResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? exercises.filter((exercise) =>
          exercise.name.toLowerCase().includes(term)
        )
      : exercises;
    return sortByRecentSelection(
      filtered,
      (exercise) => exercise.id,
      recentAddExerciseIds,
      (left, right) => left.name.localeCompare(right.name)
    ).slice(0, 300);
  }, [query, exercises, recentAddExerciseIds]);

  if (initialLoading) {
    return <TemplatesSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Templates</h2>
        <p className="text-xs text-white/65 leading-snug max-w-[70ch]">
          Build reusable workouts with cleaner compact controls. Keep planning
          inputs minimal, fast, and easy to scan.
        </p>
      </div>

      <div className="card-surface rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="input-app rounded-xl px-3 py-2.5 flex-1 sm:max-w-[320px]"
            placeholder="New template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn-primary px-3 py-2.5 rounded-xl text-sm font-semibold"
            onClick={addTemplate}
          >
            Add template
          </button>
        </div>
        {templates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <button
              className="btn-outline px-3 py-2 rounded-xl"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const t of templates) next[t.id] = true;
                setCollapsed(next);
              }}
            >
              Collapse all
            </button>
            <button
              className="btn-outline px-3 py-2 rounded-xl"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const t of templates) next[t.id] = false;
                setCollapsed(next);
              }}
              disabled={Object.keys(collapsed).length === 0}
            >
              Expand all
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {templates.map((t) => {
          const muscleCounts = computeMuscleSets(t, exerciseMap);
          const muscleEntries = Object.entries(muscleCounts)
            .filter(([_, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);

          return (
            <div
              key={t.id}
              className="card-surface rounded-2xl p-3 sm:p-4 shadow-soft relative transition"
              onClick={(event) => handleTemplateSurfaceClick(event, t.id)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    className={ICON_BTN_NEUTRAL}
                    onClick={() => toggleTemplateCollapsed(t.id)}
                    title={
                      collapsed[t.id] ? "Expand template" : "Collapse template"
                    }
                  >
                    {collapsed[t.id] ? "▸" : "▾"}
                  </button>
                  {collapsed[t.id] ? (
                    <div
                      className="truncate text-sm font-medium text-white/90"
                      title={t.name || "Untitled template"}
                    >
                      {t.name || "Untitled template"}
                    </div>
                  ) : (
                    <input
                      className="input-app h-9 flex-1 min-w-0 rounded-xl px-3 py-1 text-sm font-medium"
                      value={t.name}
                      placeholder="Untitled template"
                      onChange={(e) => {
                        const nt = { ...t, name: e.target.value };
                        setTemplates((prev) =>
                          prev.map((x) => (x.id === t.id ? nt : x))
                        );
                        void db.put("templates", nt);
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-white/10 bg-slate-900/45 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                    {t.exerciseIds.length} ex
                  </span>
                  <button
                    className="rounded-lg border border-white/10 bg-slate-800/70 px-2.5 py-1 text-[11px] text-white/80 transition-colors hover:bg-slate-700/70"
                    onClick={() => duplicate(t)}
                  >
                    Duplicate
                  </button>
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/50 px-2 py-1">
                    <span className="text-[10px] uppercase tracking-wide text-white/55">
                      Hidden
                    </span>
                    <InlineSwitch
                      checked={Boolean(t.hidden)}
                      onChange={() => void toggle(t)}
                      ariaLabel={`Toggle hidden for ${t.name || "template"}`}
                    />
                  </div>
                  <button
                    className={ICON_BTN_DANGER_ALT}
                    title="Delete template"
                    onClick={() => deleteTemplate(t)}
                  >
                    ×
                  </button>
                </div>
              </div>

              {collapsed[t.id] ? (
                <div className="mt-2 space-y-1.5">
                  {muscleEntries.length > 0 && (
                    <div
                      className="flex flex-wrap gap-1.5"
                      title={formatMuscleCounts(muscleCounts)}
                    >
                      {muscleEntries.slice(0, 6).map(([m, v]) => (
                        <span
                          key={m}
                          className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] capitalize text-indigo-300"
                        >
                          {m}: {Math.round(v * 10) / 10}
                        </span>
                      ))}
                      {muscleEntries.length > 6 && (
                        <span className="text-[10px] text-gray-500">
                          +{muscleEntries.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                  <div className="line-clamp-2 text-[11px] text-gray-400">
                    {t.exerciseIds
                      .map((id) => exerciseMap.get(id)?.name || "Unknown")
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              ) : (
                <>
                  {muscleEntries.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">
                        Projected Sets / Muscle
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {muscleEntries.map(([m, v]) => (
                          <span
                            key={m}
                            className="rounded-md bg-indigo-500/20 px-2 py-1 text-[10px] capitalize text-indigo-300"
                          >
                            {m}: {Math.round(v * 10) / 10}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-white/55">
                    Exercises: {t.exerciseIds.length}
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {t.exerciseIds.map((id, idx) => {
                      const ex = exerciseMap.get(id);
                      const planEntry = t.plan?.find((p) => p.exerciseId === id);
                      const plannedSets =
                        planEntry?.plannedSets ?? ex?.defaults?.sets ?? 3;
                      const repRange =
                        planEntry?.repRange ??
                        ex?.defaults?.targetRepRange ??
                        "8-12";
                      const incrementKg =
                        planEntry?.progression?.incrementKg ?? 2.5;
                      const addRepsFirst =
                        planEntry?.progression?.addRepsFirst ?? true;

                      return (
                        <div
                          key={id}
                          className="rounded-xl border border-white/8 bg-slate-900/45 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-white/90">
                                {ex?.name || "Unknown exercise"}
                              </div>
                              {ex?.muscleGroup && (
                                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/45">
                                  {ex.muscleGroup}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                className={ICON_BTN_NEUTRAL}
                                disabled={idx === 0}
                                onClick={() => moveExercise(t, idx, idx - 1)}
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                className={ICON_BTN_NEUTRAL}
                                disabled={idx === t.exerciseIds.length - 1}
                                onClick={() => moveExercise(t, idx, idx + 1)}
                                title="Move down"
                              >
                                ↓
                              </button>
                              {ex && (
                                <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/55 px-2 py-1">
                                  <span className="text-[10px] uppercase tracking-wide text-white/55">
                                    Optional
                                  </span>
                                  <InlineSwitch
                                    checked={Boolean(ex.isOptional)}
                                    onChange={() => void toggleOptional(ex)}
                                    ariaLabel={`Toggle optional for ${ex.name}`}
                                  />
                                </div>
                              )}
                              <button
                                className={ICON_BTN_DANGER}
                                title="Remove from template"
                                onClick={() => removeExerciseFromTemplate(t, id)}
                              >
                                −
                              </button>
                              {ex && (
                                <button
                                  className={ICON_BTN_DANGER_ALT}
                                  title="Delete exercise from library"
                                  onClick={() => deleteExercise(ex)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2 py-1.5">
                              <span className="text-[10px] uppercase tracking-wide text-white/55">
                                Sets
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={plannedSets}
                                onChange={(e) => {
                                  if (!ex) return;
                                  const v = Math.min(
                                    10,
                                    Math.max(1, Number(e.target.value) || 1)
                                  );
                                  updateTemplatePlanEntry(t, ex, (entry) => ({
                                    ...entry,
                                    plannedSets: v,
                                  }));
                                }}
                                className="w-11 rounded-md border border-white/10 bg-slate-900/70 px-1.5 py-1 text-right text-[11px] text-white outline-none focus:border-white/25"
                              />
                            </label>

                            <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2 py-1.5">
                              <span className="text-[10px] uppercase tracking-wide text-white/55">
                                Reps
                              </span>
                              <input
                                type="text"
                                value={repRange}
                                placeholder="8-12"
                                onChange={(e) => {
                                  if (!ex) return;
                                  const v = e.target.value
                                    .replace(/[^0-9\-–]/g, "")
                                    .slice(0, 9);
                                  updateTemplatePlanEntry(t, ex, (entry) => ({
                                    ...entry,
                                    repRange: v,
                                  }));
                                }}
                                className="w-16 rounded-md border border-white/10 bg-slate-900/70 px-1.5 py-1 text-center text-[11px] text-white outline-none focus:border-white/25"
                              />
                            </label>

                            <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2 py-1.5">
                              <span className="text-[10px] uppercase tracking-wide text-white/55">
                                +kg
                              </span>
                              <input
                                type="number"
                                step={0.5}
                                min={0}
                                value={incrementKg}
                                onChange={(e) => {
                                  if (!ex) return;
                                  const v = Math.max(0, Number(e.target.value) || 0);
                                  updateTemplatePlanEntry(t, ex, (entry) => ({
                                    ...entry,
                                    progression: {
                                      scheme: "linear",
                                      incrementKg: v,
                                      addRepsFirst:
                                        entry.progression?.addRepsFirst ?? true,
                                    },
                                  }));
                                }}
                                className="w-14 rounded-md border border-white/10 bg-slate-900/70 px-1.5 py-1 text-right text-[11px] text-white outline-none focus:border-white/25"
                              />
                            </label>

                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2 py-1.5">
                              <span className="text-[10px] uppercase tracking-wide text-white/55">
                                Reps first
                              </span>
                              <InlineSwitch
                                checked={addRepsFirst}
                                onChange={(next) => {
                                  if (!ex) return;
                                  updateTemplatePlanEntry(t, ex, (entry) => ({
                                    ...entry,
                                    progression: {
                                      scheme: "linear",
                                      incrementKg:
                                        entry.progression?.incrementKg ?? 2.5,
                                      addRepsFirst: next,
                                    },
                                  }));
                                }}
                                ariaLabel={`Toggle reps first for ${
                                  ex?.name || "exercise"
                                }`}
                              />
                            </div>

                            <div className="min-w-[150px] flex-1 text-[10px] leading-tight text-white/40">
                              Progression guidance can still be adjusted when you
                              import this template into a session.
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn-outline rounded-xl px-3 py-2 text-xs sm:text-sm"
                      onClick={() => setShowAddFor(t.id)}
                    >
                      Add exercise
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {showAddFor && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4"
          onClick={() => setShowAddFor(null)}
        >
          <div
            className="flex w-full max-h-[min(90dvh,calc(100dvh-0.75rem))] flex-col overflow-hidden rounded-t-2xl bg-card shadow-soft sm:rounded-2xl sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto p-4 pb-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-medium">Add exercise</div>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:text-white"
                  onClick={() => setShowAddFor(null)}
                >
                  Close
                </button>
              </div>
              <input
                autoFocus
                className="input-app w-full rounded-xl px-3 py-2.5"
                placeholder="Search or create exercise"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                spellCheck={false}
              />
              <div className="mt-3 max-h-[min(54dvh,380px)] overflow-y-auto space-y-2 pb-2">
                {/* Create option when no exact case-insensitive match */}
                {(() => {
                  const q = query.trim();
                  if (!q) return null;
                  const exact = findExerciseByName(q);
                  if (!exact) {
                    return (
                      <button
                        className="w-full rounded-xl bg-brand-600 px-3 py-2.5 text-left text-sm hover:bg-brand-700"
                        onClick={async () => {
                          const t = templates.find((x) => x.id === showAddFor)!;
                          const e = await createOrGetExercise(q);
                          await addExerciseToTemplate(t, e);
                        }}
                      >
                        Create "{q}"
                      </button>
                    );
                  }
                  return null;
                })()}
                {addExerciseResults.map((exercise) => {
                  const isRecent = recentAddExerciseIds.includes(exercise.id);
                  return (
                    <button
                      key={exercise.id}
                      className="w-full rounded-xl border border-white/8 bg-slate-800/80 px-3 py-2.5 text-left text-sm hover:bg-slate-700/80"
                      onClick={() => {
                        const t = templates.find((x) => x.id === showAddFor)!;
                        addExerciseToTemplate(t, exercise);
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{exercise.name}</span>
                        {isRecent && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                            Recent
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {!addExerciseResults.length && query.trim() && (
                  <div className="rounded-xl bg-slate-800/60 px-3 py-4 text-center text-sm text-slate-300/70">
                    No exercises match your search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Library Management */}
      <div className="card-surface rounded-2xl p-3 sm:p-4 shadow-soft">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="font-medium text-white/90">Exercise Library</div>
            <div className="text-[11px] text-white/55">
              Keep exercise metadata clean with compact controls.
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <input
              className="input-app w-full rounded-xl px-3 py-2 sm:w-[230px]"
              placeholder="Search exercises"
              value={exerciseQuery}
              onChange={(e) => setExerciseQuery(e.target.value)}
            />
            <button
              className="btn-outline rounded-xl px-3 py-2 text-xs"
              onClick={() => setShowAllExercises((v) => !v)}
            >
              {showAllExercises ? "Hide all" : "Show all"}
            </button>
          </div>
        </div>

        <div className="mb-2 text-[11px] text-white/55">
          {exerciseQuery
            ? searchedExercises.length
            : showAllExercises
            ? exercises.length
            : 0}{" "}
          exercise
          {(exerciseQuery
            ? searchedExercises.length
            : showAllExercises
            ? exercises.length
            : 0) === 1
            ? ""
            : "s"}{" "}
          shown
        </div>

        <div className="space-y-2">
          {searchedExercises.map((ex) => (
            <div
              key={ex.id}
              className="rounded-xl border border-white/8 bg-slate-900/45 px-3 py-2.5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white/90">
                    {ex.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/60">
                    <select
                      value={ex.muscleGroup}
                      onChange={async (e) => {
                        const next = {
                          ...ex,
                          muscleGroup: e.target.value as MuscleGroup,
                        };
                        await db.put("exercises", next);
                        setExercises((es) =>
                          es.map((x) => (x.id === ex.id ? next : x))
                        );
                      }}
                      className="rounded-md border border-white/10 bg-slate-800/80 px-1.5 py-1 text-[10px] capitalize"
                    >
                      {[
                        "chest",
                        "back",
                        "shoulders",
                        "triceps",
                        "biceps",
                        "legs",
                        "hamstrings",
                        "quads",
                        "glutes",
                        "calves",
                        "core",
                        "other",
                      ].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap items-center gap-1">
                      {(ex.secondaryMuscles || []).map((sec) => (
                        <span
                          key={sec}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-700/70 px-1.5 py-0.5 text-[10px]"
                        >
                          {sec}
                          <button
                            className="flex h-4 w-4 items-center justify-center rounded bg-black/20 text-[10px] text-white/75 transition-colors hover:bg-black/35"
                            onClick={async () => {
                              const next = {
                                ...ex,
                                secondaryMuscles: (ex.secondaryMuscles || []).filter(
                                  (s) => s !== sec
                                ),
                              };
                              await db.put("exercises", next);
                              setExercises((es) =>
                                es.map((x) => (x.id === ex.id ? next : x))
                              );
                            }}
                            title={`Remove ${sec}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <SecondaryMusclePicker
                        ex={ex}
                        update={async (next) => {
                          await db.put("exercises", next);
                          setExercises((es) =>
                            es.map((x) => (x.id === ex.id ? next : x))
                          );
                        }}
                      />
                    </div>
                  </div>

                  {ex.tags && ex.tags.length > 0 && (
                    <div className="mt-1 flex max-w-full flex-wrap gap-1">
                      {ex.tags.slice(0, 12).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-slate-700/70 px-1.5 py-0.5 text-[9px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/55 px-2 py-1">
                    <span className="text-[10px] uppercase tracking-wide text-white/55">
                      Optional
                    </span>
                    <InlineSwitch
                      checked={Boolean(ex.isOptional)}
                      onChange={() => void toggleOptional(ex)}
                      ariaLabel={`Toggle optional for ${ex.name}`}
                    />
                  </div>
                  <button
                    className={ICON_BTN_DANGER_ALT}
                    title="Delete exercise"
                    onClick={() => deleteExercise(ex)}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!searchedExercises.length && exerciseQuery.trim() && (
            <div className="rounded-xl border border-white/8 bg-slate-900/35 px-3 py-4 text-center text-sm text-white/60">
              No exercises match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors duration-150 ${
        checked
          ? "border-brand-400/65 bg-brand-500/55"
          : "border-white/18 bg-slate-700/65"
      }`}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Inline helper component to pick secondary muscles with quick-add chips
function SecondaryMusclePicker({
  ex,
  update,
}: {
  ex: Exercise;
  update: (next: Exercise) => void;
}) {
  const ALL: Exercise["muscleGroup"][] = [
    "chest",
    "back",
    "shoulders",
    "triceps",
    "biceps",
    "legs",
    "hamstrings",
    "quads",
    "glutes",
    "calves",
    "core",
    "other",
  ];
  const remaining = ALL.filter(
    (m) => m !== ex.muscleGroup && !(ex.secondaryMuscles || []).includes(m)
  );
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        className="text-[10px] bg-slate-700/60 hover:bg-slate-700 px-2 py-0.5 rounded"
        onClick={() => setOpen(true)}
      >
        + add
      </button>
    );
  return (
    <div className="flex flex-wrap gap-1">
      {remaining.map((m) => (
        <button
          key={m}
          className="text-[10px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded"
          onClick={() => {
            const next = {
              ...ex,
              secondaryMuscles: [...(ex.secondaryMuscles || []), m],
            };
            update(next);
          }}
        >
          {m}
        </button>
      ))}
      <button
        className="text-[10px] text-red-400 px-1.5"
        onClick={() => setOpen(false)}
      >
        ×
      </button>
    </div>
  );
}
