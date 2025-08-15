import { db } from "./db";
import {
  Exercise,
  Session,
  SessionEntry,
  Settings,
  Measurement,
} from "./types";
import { addDays, subDays, isAfter, parseISO } from "date-fns";

export async function getLastWorkingSets(
  exerciseId: string,
  weekNumber: number,
  phase?: number
) {
  const sessions = await db.getAll<Session>("sessions");
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
  return entry?.sets || [];
}

// Lightweight in-memory cache for settings to avoid repeated IndexedDB reads within a short interval
let _settingsCache: { value: Settings; ts: number } | null = null;
const SETTINGS_TTL_MS = 10_000; // safe short TTL; settings seldom change
export async function getSettings(): Promise<Settings> {
  const now = Date.now();
  if (_settingsCache && now - _settingsCache.ts < SETTINGS_TTL_MS) {
    return _settingsCache.value;
  }
  const base: Settings =
    (await db.get<Settings>("settings", "app")) || ({
      unit: "kg",
      deloadDefaults: { loadPct: 0.55, setPct: 0.5 },
      theme: "dark",
      themeV2: { key: "default-glass" },
    } as any);
  // Backfill new fields if missing
  if (base.reducedMotion == null) (base as any).reducedMotion = false;
  _settingsCache = { value: base, ts: now };
  return base;
}

export async function setSettings(s: Settings) {
  await db.put("settings", { ...s, id: "app" } as any);
  _settingsCache = { value: s, ts: Date.now() }; // update cache immediately
}

export async function getDeloadPrescription(
  exerciseId: string,
  weekNumber: number,
  opts?: { deloadWeeks?: Set<number> }
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
  const [sets, exercises, settings] = await Promise.all([
    getLastWorkingSets(exerciseId, weekNumber),
    db.getAll<Exercise>("exercises"),
    getSettings(),
  ]);
  const ex = exercises.find((e) => e.id === exerciseId);
  const specialW5 = weekNumber === 5;
  const loadPct =
    ex?.defaults.deloadLoadPct ??
    (specialW5 ? 0.55 : settings.deloadDefaults.loadPct);
  const setPct =
    ex?.defaults.deloadSetPct ??
    (specialW5 ? 0.5 : settings.deloadDefaults.setPct);
  const avg = sets.length
    ? sets.reduce((a, b) => a + (b.weightKg || 0), 0) / sets.length
    : 0;
  const targetWeight = Math.round(avg * loadPct);
  const targetSets = Math.max(1, Math.round((ex?.defaults.sets ?? 2) * setPct));
  return { targetWeight, targetSets, loadPct, setPct };
}

export async function volumeByMuscleGroup(weekNumber: number) {
  const [sessions, exercises] = await Promise.all([
    db.getAll<Session>("sessions"),
    db.getAll<Exercise>("exercises"),
  ]);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const acc: Record<string, { tonnage: number; sets: number }> = {};
  sessions
    .filter((s) => s.weekNumber === weekNumber)
    .forEach((s) => {
      s.entries.forEach((e: SessionEntry) => {
        const ex = exMap.get(e.exerciseId);
        const mg = ex?.muscleGroup || "other";
        const ton = e.sets.reduce((t, set) => t + set.weightKg * set.reps, 0);
        acc[mg] = acc[mg] || { tonnage: 0, sets: 0 };
        acc[mg].tonnage += ton;
        acc[mg].sets += e.sets.length;
      });
    });
  return acc;
}

export async function rollingPRs(exerciseId: string) {
  const sessions = await db.getAll<Session>("sessions");
  const allSets = sessions.flatMap((s) =>
    s.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
  );
  let best = 0;
  for (const s of allSets) best = Math.max(best, s.weightKg * s.reps);
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
  range: RangeKey
) {
  const sessions = await db.getAll<Session>("sessions");
  const days = sessions
    .map((s) => ({
      date: s.dateISO,
      entry: s.entries.find((e) => e.exerciseId === exerciseId),
    }))
    .filter((x) => x.entry)
    .map((x) => {
      const sets = (x.entry as SessionEntry).sets;
      const topWeight = sets.reduce((m, s) => Math.max(m, s.weightKg), 0);
      const avgWeight = sets.length
        ? Math.round(sets.reduce((a, b) => a + b.weightKg, 0) / sets.length)
        : 0;
      const repsTotal = sets.reduce((a, b) => a + b.reps, 0);
      const volume = sets.reduce((a, b) => a + b.weightKg * b.reps, 0);
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
  range: RangeKey
) {
  const list = (await db.getAll<Measurement>("measurements"))
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
