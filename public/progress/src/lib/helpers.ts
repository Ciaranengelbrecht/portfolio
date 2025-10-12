import { db } from "./db";
import {
  Exercise,
  Session,
  SessionEntry,
  Settings,
  Measurement,
} from "./types";
import { addDays, subDays, isAfter, parseISO } from "date-fns";

// Optionally inject pre-fetched sessions to avoid repeated full-table reads (prevents N+1)
export async function getLastWorkingSets(
  exerciseId: string,
  weekNumber: number,
  phase?: number,
  deps?: { sessions?: Session[] }
) {
  const sessions = deps?.sessions || (await db.getAll<Session>("sessions"));
  // try same phase first (if provided), then earlier phases
  const candidates = sessions
    .filter(
      (s) =>
        (phase ? s.phase === phase : true) &&
        s.weekNumber < weekNumber &&
        s.entries.some((e) => e.exerciseId === exerciseId)
    )
    .sort((a, b) => b.weekNumber - a.weekNumber);
  let prev = candidates[0];
  if (!prev) {
    const older = sessions
      .filter(
        (s) =>
          (phase ? (s.phase || 1) < phase : true) &&
          s.entries.some((e) => e.exerciseId === exerciseId)
      )
      .sort(
        (a, b) => (b.phase || 1) - (a.phase || 1) || b.weekNumber - a.weekNumber
      );
    prev = older[0];
  }
  const entry = prev?.entries.find((e) => e.exerciseId === exerciseId);
  if (!entry?.sets) return [];
  return entry.sets.map((set, idx) => ({
    setNumber: idx + 1,
    weightKg: set.weightKg ?? null,
    reps: set.reps ?? null,
    rpe: set.rpe,
  }));
}

// Lightweight in-memory cache for settings to avoid repeated IndexedDB reads within a short interval
let _settingsCache: { value: Settings; ts: number } | null = null;
const SETTINGS_TTL_MS = 10_000; // safe short TTL; settings seldom change
export async function getSettings(): Promise<Settings> {
  const now = Date.now();
  if (_settingsCache && now - _settingsCache.ts < SETTINGS_TTL_MS) {
    return _settingsCache.value;
  }
  let base: Settings =
    (await db.get<Settings>("settings", "app")) ||
    ({
      unit: "kg",
      deloadDefaults: { loadPct: 0.55, setPct: 0.5 },
      theme: "dark",
      themeV2: { key: "default-glass" },
    } as any);
  let mutated = false;
  if (!base.theme || base.theme !== "dark") {
    base = { ...base, theme: "dark" };
    mutated = true;
  }
  if (!base.ui || base.ui.themeMode !== "dark") {
    (base as any).ui = { ...(base.ui as any), themeMode: "dark" };
    mutated = true;
  }
  // Backfill new fields if missing
  if (base.reducedMotion == null) (base as any).reducedMotion = false;
  if ((base as any).restTimerTargetSeconds == null)
    (base as any).restTimerTargetSeconds = 90;
  if (!base.progress?.guidedSetup) {
    base = {
      ...base,
      progress: {
        ...(base.progress || {}),
        guidedSetup: { completed: false },
      },
    };
    mutated = true;
  }
  if (mutated) {
    await db.put("settings", { ...base, id: "app" } as any);
  }
  _settingsCache = { value: base, ts: now };
  return base;
}

export async function setSettings(s: Settings) {
  const enforced = {
    ...s,
    theme: "dark",
    ui: { ...(s.ui || {}), themeMode: "dark" },
  } as Settings;
  await db.put("settings", { ...enforced, id: "app" } as any);
  _settingsCache = { value: enforced, ts: Date.now() }; // update cache immediately
}

// Accept optional injected datasets to remove N+1 patterns (sessions/exercises/settings)
export async function getDeloadPrescription(
  exerciseId: string,
  weekNumber: number,
  opts?: { deloadWeeks?: Set<number> },
  deps?: { sessions?: Session[]; exercises?: Exercise[]; settings?: Settings }
) {
  // Determine if this week is a deload via provided set (program-aware) else legacy heuristic (week 5 or 9 previously)
  const isDeload = opts?.deloadWeeks
    ? opts.deloadWeeks.has(weekNumber)
    : [5, 9].includes(weekNumber);
  if (!isDeload) {
    // return a pseudo prescription indicating no deload (weight stays, sets default)
    return {
      targetWeight: 0,
      targetSets: 0,
      loadPct: 1,
      setPct: 1,
      inactive: true,
    } as const;
  }
  // default rule: 50–60% of average working weight from prior week, default 55% & 50% sets; allow overrides per exercise
  const [sessions, exercises, settings] = await Promise.all([
    (async () => deps?.sessions || (await db.getAll<Session>("sessions")))(),
    (async () => deps?.exercises || (await db.getAll<Exercise>("exercises")))(),
    (async () => deps?.settings || (await getSettings()))(),
  ]);
  const sets = await getLastWorkingSets(exerciseId, weekNumber, undefined, {
    sessions,
  });
  const ex = exercises.find((e) => e.id === exerciseId);
  const specialW5 = weekNumber === 5;
  const loadPct =
    ex?.defaults.deloadLoadPct ??
    (specialW5 ? 0.55 : settings.deloadDefaults.loadPct);
  const setPct =
    ex?.defaults.deloadSetPct ??
    (specialW5 ? 0.5 : settings.deloadDefaults.setPct);
  const workingWeights = sets
    .map((s) => s.weightKg || 0)
    .filter((w) => Number.isFinite(w) && w > 0);
  const referenceWeight = workingWeights.length
    ? Math.max(...workingWeights)
    : sets.length
    ? sets.reduce((a, b) => a + (b.weightKg || 0), 0) / sets.length
    : 0;
  const baseWeight = Math.round(referenceWeight);
  const targetWeight = Math.round(referenceWeight * loadPct);
  const rawSetsBase = ex?.defaults.sets ?? 2;
  const rawTargetSets = rawSetsBase * setPct;
  const targetSets =
    rawTargetSets > 0 ? Math.max(1, Math.floor(rawTargetSets)) : 0;
  return { targetWeight, targetSets, loadPct, setPct, baseWeight };
}

// Batch helper: compute deload prescriptions for many exercises with shared datasets (prevents N+1)
export async function getDeloadPrescriptionsBulk(
  exerciseIds: string[],
  weekNumber: number,
  opts?: { deloadWeeks?: Set<number> },
  deps?: { sessions?: Session[]; exercises?: Exercise[]; settings?: Settings }
) {
  const [sessions, exercises, settings] = await Promise.all([
    (async () => deps?.sessions || (await db.getAll<Session>("sessions")))(),
    (async () => deps?.exercises || (await db.getAll<Exercise>("exercises")))(),
    (async () => deps?.settings || (await getSettings()))(),
  ]);
  const out: Record<string, any> = {};
  for (const id of exerciseIds) {
    out[id] = await getDeloadPrescription(id, weekNumber, opts, {
      sessions,
      exercises,
      settings,
    });
  }
  return out as Record<
    string,
    ReturnType<typeof getDeloadPrescription> extends Promise<infer R>
      ? R
      : never
  >;
}

export async function volumeByMuscleGroup(
  weekNumber: number,
  deps?: { sessions?: Session[]; exercises?: Exercise[] },
  opts?: { phases?: number[] }
) {
  const [sessions, exercises] = await Promise.all([
    (async () => deps?.sessions || (await db.getAll<Session>("sessions")))(),
    (async () => deps?.exercises || (await db.getAll<Exercise>("exercises")))(),
  ]);
  const phaseSet =
    opts?.phases && opts.phases.length ? new Set(opts.phases) : null;
  const filteredSessions = phaseSet
    ? sessions.filter((s) =>
        phaseSet.has((s.phaseNumber ?? s.phase ?? 1) as number)
      )
    : sessions;
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const acc: Record<string, { tonnage: number; sets: number }> = {};
  filteredSessions
    .filter((s) => s.weekNumber === weekNumber)
    .forEach((s) => {
      s.entries.forEach((e: SessionEntry) => {
        const ex = exMap.get(e.exerciseId);
        const mg = ex?.muscleGroup || "other";
        const ton = e.sets.reduce(
          (t, set) => t + (set.weightKg ?? 0) * (set.reps ?? 0),
          0
        );
        acc[mg] = acc[mg] || { tonnage: 0, sets: 0 };
        acc[mg].tonnage += ton;
        acc[mg].sets += e.sets.length;
      });
    });
  // Derived overarching groups (non-destructive)
  const sumGroups = (
    groups: string[]
  ): { tonnage: number; sets: number } | null => {
    let ton = 0,
      sets = 0,
      any = false;
    for (const g of groups) {
      if (acc[g]) {
        ton += acc[g].tonnage;
        sets += acc[g].sets;
        any = true;
      }
    }
    return any ? { tonnage: ton, sets } : null;
  };
  const arms = sumGroups(["biceps", "triceps", "forearms"]);
  if (arms) acc["arms"] = arms;
  const legs = sumGroups(["quads", "hamstrings", "calves"]);
  if (legs) acc["legs"] = legs;
  return acc;
}

export async function rollingPRs(
  exerciseId: string,
  deps?: { sessions?: Session[] }
) {
  const sessions = deps?.sessions || (await db.getAll<Session>("sessions"));
  const allSets = sessions.flatMap((s) =>
    s.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
  );
  let best = 0;
  for (const s of allSets)
    best = Math.max(best, (s.weightKg ?? 0) * (s.reps ?? 0));
  return { estimated1RM: Math.round(best), bestTonnageSet: best };
}

export type RangeKey = "4w" | "8w" | "12w" | "all";

function sliceByRange<T extends { dateISO?: string; date?: string }>(
  rows: T[],
  range: RangeKey
) {
  if (range === "all") return rows;
  const weeks = { "4w": 28, "8w": 56, "12w": 84 }[range];
  const cutoff = subDays(new Date(), weeks);
  return rows.filter((r) =>
    isAfter(parseISO((r as any).dateISO ?? (r as any).date), cutoff)
  );
}

export async function getExerciseTimeSeries(
  exerciseId: string,
  range: RangeKey,
  deps?: { sessions?: Session[] }
) {
  const sessions = deps?.sessions || (await db.getAll<Session>("sessions"));
  const days = sessions
    .map((s) => ({
      date: (s as any).localDate
        ? (s as any).localDate + "T00:00:00"
        : s.dateISO,
      entry: s.entries.find((e) => e.exerciseId === exerciseId),
    }))
    .filter((x) => x.entry)
    .map((x) => {
      const sets = (x.entry as SessionEntry).sets;
      const topWeight = sets.reduce((m, s) => Math.max(m, s.weightKg ?? 0), 0);
      const avgWeight = sets.length
        ? Math.round(
            sets.reduce((a, b) => a + (b.weightKg ?? 0), 0) / sets.length
          )
        : 0;
      const repsTotal = sets.reduce((a, b) => a + (b.reps ?? 0), 0);
      const volume = sets.reduce(
        (a, b) => a + (b.weightKg ?? 0) * (b.reps ?? 0),
        0
      );
      return {
        date: x.date.slice(0, 10),
        topWeight,
        avgWeight,
        repsTotal,
        volume,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return sliceByRange(days as any, range);
}

export async function getMeasurementTimeSeries(
  metric: keyof Measurement,
  range: RangeKey,
  deps?: { measurements?: Measurement[] }
) {
  const list = (
    deps?.measurements || (await db.getAll<Measurement>("measurements"))
  )
    .filter((m) => (m as any)[metric] != null)
    .map((m) => ({
      date: m.dateISO.slice(0, 10),
      value: (m as any)[metric] as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return sliceByRange(list as any, range);
}

export async function getDashboardPrefs() {
  const s = await getSettings();
  return s.dashboardPrefs || { range: "8w" as RangeKey };
}

export async function setDashboardPrefs(
  next: Partial<NonNullable<Settings["dashboardPrefs"]>>
) {
  const s = await getSettings();
  const prefs = { ...(s.dashboardPrefs || {}), ...next };
  await setSettings({ ...s, dashboardPrefs: prefs });
  return prefs;
}
