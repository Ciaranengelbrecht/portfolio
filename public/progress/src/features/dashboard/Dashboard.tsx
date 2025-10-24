import ChartPanel from "../../components/ChartPanel";
import GlassCard from "../../components/GlassCard";
import ProgressBars from "../../components/ProgressBars";
import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeSlideUp, maybeDisable } from "../../lib/motion";
import { db } from "../../lib/db";
import { computeLoggedSetVolume } from "../../lib/volume";
import {
  getDashboardPrefs,
  getSettings,
  setDashboardPrefs,
  volumeByMuscleGroup,
} from "../../lib/helpers";
import { getAllCached } from "../../lib/dataCache";
import { Exercise, Session, Settings, UserProgram } from "../../lib/types";
import { getProfileProgram } from "../../lib/profile";
import { loadRecharts } from "../../lib/loadRecharts";
import { useAggregates } from "../../lib/useAggregates";
import { getMuscleIconPath } from "../../lib/muscles";

type HiddenKey =
  | "trainingChart"
  | "bodyChart"
  | "weekVolume"
  | "phaseTotals"
  | "compliance"
  | "weeklyMuscleBar"
  | "sessionVolumeTrend";

const DASHBOARD_DEFAULT_HIDDEN: Record<HiddenKey, boolean> = {
  trainingChart: true,
  bodyChart: true,
  weekVolume: true,
  phaseTotals: true,
  compliance: true,
  weeklyMuscleBar: true,
  sessionVolumeTrend: true,
};

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  return COMPACT_FORMATTER.format(value)
    .replace(/\.0([A-Za-z])/, "$1")
    .replace(/\.0$/, "");
}

function formatHours(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0h";
  if (value >= 100) return `${Math.round(value)}h`;
  if (value >= 10) return `${value.toFixed(1)}h`;
  if (value >= 1) return `${value.toFixed(1)}h`;
  const minutes = Math.round(value * 60);
  return `${minutes}m`;
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1000) return formatCompact(value);
  return Math.round(value).toLocaleString();
}

type MuscleDetailExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  tonnage: number;
  muscle: string;
};

type MuscleDetailSession = {
  sessionId: string;
  label: string;
  dateISO: string;
  totalSets: number;
  totalTonnage: number;
  exercises: MuscleDetailExercise[];
};

type MuscleDetail = {
  key: string;
  label: string;
  totalSets: number;
  totalTonnage: number;
  sessions: MuscleDetailSession[];
};

type MuscleVolumeStat = {
  key: string;
  label: string;
  tonnage: number;
  sets: number;
};

function humanizeMuscleName(value: string): string {
  return value
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeMuscleKey(value: string | null | undefined): string {
  const normalized = (value ?? "other")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "other";
}

const RAW_AGGREGATED_MUSCLE_GROUPS: Record<string, string[]> = {
  arms: ["biceps", "triceps", "forearms"],
  legs: ["quads", "hamstrings", "calves"],
};

const NORMALIZED_AGGREGATED_GROUPS: Record<string, string[]> =
  Object.fromEntries(
    Object.entries(RAW_AGGREGATED_MUSCLE_GROUPS).map(([group, members]) => [
      normalizeMuscleKey(group),
      members.map((m) => normalizeMuscleKey(m)),
    ])
  );

async function buildMuscleDetailData({
  sessions,
  exercises,
  weekNumber,
  phaseNumber,
  formatter,
}: {
  sessions: Session[];
  exercises: Exercise[];
  weekNumber: number | null;
  phaseNumber: number | null;
  formatter: Intl.DateTimeFormat;
}): Promise<{
  detailMap: Record<string, MuscleDetail>;
  summaryMap: Record<string, MuscleVolumeStat>;
}> {
  const detailAccumulator: Record<string, MuscleDetail> = {};
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  if (weekNumber != null) {
    const filteredSessions = sessions.filter((session) => {
      const phase = (session.phaseNumber ?? session.phase ?? 1) as number;
      if (phaseNumber != null && phase !== phaseNumber) return false;
      return session.weekNumber === weekNumber;
    });

    const ensureDetail = (rawGroupKey: string, labelHint?: string) => {
      const key = normalizeMuscleKey(rawGroupKey);
      let detail = detailAccumulator[key];
      if (!detail) {
        detail = {
          key,
          label: humanizeMuscleName(labelHint || rawGroupKey),
          totalSets: 0,
          totalTonnage: 0,
          sessions: [],
        };
        detailAccumulator[key] = detail;
      } else if (labelHint) {
        const hintLabel = humanizeMuscleName(labelHint);
        if (detail.label !== hintLabel) detail.label = hintLabel;
      }
      return detail;
    };

    const ensureSessionDetail = (detail: MuscleDetail, session: Session) => {
      let existing = detail.sessions.find((s) => s.sessionId === session.id);
      if (existing) return existing;
      const dateKey =
        session.localDate || session.dateISO.slice(0, 10) || session.id;
      let formattedDate = dateKey;
      if (dateKey) {
        try {
          formattedDate = formatter.format(new Date(`${dateKey}T00:00:00Z`));
        } catch {
          formattedDate = dateKey;
        }
      }
      const label = session.dayName
        ? `${session.dayName}${formattedDate ? ` • ${formattedDate}` : ""}`
        : formattedDate || "Session";
      const created: MuscleDetailSession = {
        sessionId: session.id,
        label,
        dateISO: dateKey,
        totalSets: 0,
        totalTonnage: 0,
        exercises: [],
      };
      detail.sessions.push(created);
      return created;
    };

    filteredSessions.forEach((session) => {
      session.entries.forEach((entry) => {
        const ex = exMap.get(entry.exerciseId);
        const baseGroup = ex?.muscleGroup || "other";
        const muscleKey = normalizeMuscleKey(baseGroup);
        const validSets = entry.sets.length;
        if (!validSets) return;
        const tonnage = entry.sets.reduce(
          (sum, set) =>
            sum + Math.max(0, set.weightKg || 0) * Math.max(0, set.reps || 0),
          0
        );
        const detail = ensureDetail(baseGroup, ex?.muscleGroup || baseGroup);
        detail.totalSets += validSets;
        detail.totalTonnage += tonnage;
        const sessionDetail = ensureSessionDetail(detail, session);
        sessionDetail.totalSets += validSets;
        sessionDetail.totalTonnage += tonnage;
        sessionDetail.exercises.push({
          exerciseId: entry.exerciseId,
          name: ex?.name || entry.exerciseId,
          sets: validSets,
          tonnage,
          muscle: muscleKey,
        });
      });
    });

    Object.values(detailAccumulator).forEach((detail) => {
      detail.sessions = detail.sessions
        .map((session) => ({
          ...session,
          exercises: session.exercises
            .slice()
            .sort(
              (a, b) =>
                b.sets - a.sets ||
                b.tonnage - a.tonnage ||
                a.name.localeCompare(b.name)
            ),
        }))
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    });

    for (const [aggKey, partKeys] of Object.entries(
      NORMALIZED_AGGREGATED_GROUPS
    )) {
      const relevant = partKeys.filter((key) => detailAccumulator[key]);
      if (!relevant.length) continue;
      const sessionsMap = new Map<string, MuscleDetailSession>();
      let totalSets = 0;
      let totalTonnage = 0;
      relevant.forEach((key) => {
        const source = detailAccumulator[key]!;
        totalSets += source.totalSets;
        totalTonnage += source.totalTonnage;
        source.sessions.forEach((session) => {
          let combined = sessionsMap.get(session.sessionId);
          if (!combined) {
            combined = {
              sessionId: session.sessionId,
              label: session.label,
              dateISO: session.dateISO,
              totalSets: 0,
              totalTonnage: 0,
              exercises: [],
            };
            sessionsMap.set(session.sessionId, combined);
          }
          combined.totalSets += session.totalSets;
          combined.totalTonnage += session.totalTonnage;
          combined.exercises.push(
            ...session.exercises.map((exercise) => ({ ...exercise }))
          );
        });
      });
      if (!sessionsMap.size) continue;
      const combinedSessions = Array.from(sessionsMap.values())
        .map((session) => ({
          ...session,
          exercises: session.exercises
            .slice()
            .sort(
              (a, b) =>
                b.sets - a.sets ||
                b.tonnage - a.tonnage ||
                a.name.localeCompare(b.name)
            ),
        }))
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      detailAccumulator[aggKey] = {
        key: aggKey,
        label: humanizeMuscleName(aggKey),
        totalSets,
        totalTonnage,
        sessions: combinedSessions,
      };
    }
  }

  const summaryMap: Record<string, MuscleVolumeStat> = {};
  if (weekNumber != null) {
    const rawSummary = await volumeByMuscleGroup(
      weekNumber,
      { sessions, exercises },
      { phases: phaseNumber != null ? [phaseNumber] : undefined }
    );
    for (const [rawKey, summary] of Object.entries(rawSummary)) {
      const key = normalizeMuscleKey(rawKey);
      const existing = summaryMap[key];
      if (!existing) {
        summaryMap[key] = {
          key,
          label: humanizeMuscleName(rawKey),
          tonnage: summary?.tonnage ?? 0,
          sets: summary?.sets ?? 0,
        };
      } else {
        existing.tonnage += summary?.tonnage ?? 0;
        existing.sets += summary?.sets ?? 0;
      }
    }
  }

  Object.values(summaryMap).forEach((entry) => {
    if (!detailAccumulator[entry.key]) {
      detailAccumulator[entry.key] = {
        key: entry.key,
        label: entry.label,
        totalSets: entry.sets,
        totalTonnage: entry.tonnage,
        sessions: [],
      };
    }
  });

  return { detailMap: detailAccumulator, summaryMap };
}

function computeSessionDurationMs(session: Session): number {
  const cap = 1000 * 60 * 60 * 12;
  const clamp = (ms: number) => Math.max(0, Math.min(ms, cap));
  const log = session.workLog;
  if (log && Object.keys(log).length) {
    const entries = Object.values(log)
      .filter(Boolean)
      .map((item) => ({
        first: new Date(item.first || 0).getTime(),
        last: new Date(item.last || 0).getTime(),
      }))
      .filter(
        (item) =>
          !Number.isNaN(item.first) &&
          !Number.isNaN(item.last) &&
          item.last >= item.first
      )
      .sort((a, b) => b.last - b.first);
    const top = entries[0];
    if (top) return clamp(top.last - top.first);
  }
  if (session.loggedStartAt && session.loggedEndAt) {
    const start = new Date(session.loggedStartAt).getTime();
    const end = new Date(session.loggedEndAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return clamp(end - start);
    }
  }
  return 0;
}

export default function Dashboard() {
  const [phase, setPhase] = useState(1);
  const [week, setWeek] = useState(1);
  const [muscleWeek, setMuscleWeek] = useState<Record<string, number>>({});
  const [muscleTotals, setMuscleTotals] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [perWeek, setPerWeek] = useState<
    Record<number, Record<string, number>>
  >({});
  const [hidden, setHidden] = useState<
    NonNullable<Settings["dashboardPrefs"]>["hidden"]
  >({});
  const [weeklyBar, setWeeklyBar] = useState<
    { muscle: string; value: number }[]
  >([]);
  const [sessionsState, setSessionsState] = useState<any[]>([]);
  const [exercisesState, setExercisesState] = useState<Exercise[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [highlightWeek, setHighlightWeek] = useState<number | null>(null);
  const [dayVolumes, setDayVolumes] = useState<
    Record<number, Record<number, number>>
  >({}); // week -> day -> volume
  const [program, setProgram] = useState<UserProgram | null>(null);
  const [dayLabels, setDayLabels] = useState<string[]>([]); // derived from program.weeklySplit
  const [RC, setRC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const [tonnageUnit, setTonnageUnit] = useState<"kg" | "lb">("kg");
  const [lifetimeStats, setLifetimeStats] = useState({
    workouts: 0,
    sets: 0,
    hours: 0,
    tonnage: 0,
  });
  const [weeklyStats, setWeeklyStats] = useState({
    workouts: 0,
    sets: 0,
    hours: 0,
    tonnage: 0,
    weekNumber: null as number | null,
    phaseNumber: null as number | null,
  });
  const [muscleDetailMap, setMuscleDetailMap] = useState<
    Record<string, MuscleDetail>
  >({});
  const [muscleVolumeSummary, setMuscleVolumeSummary] = useState<
    Record<string, MuscleVolumeStat>
  >({});
  const [activeMuscle, setActiveMuscle] = useState<string | null>(null);
  const { data: aggs } = useAggregates();
  const tonnageUnitMultiplier = tonnageUnit === "lb" ? 2.2046226218 : 1;
  const sessionDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    []
  );

  const activeMuscleDetail = useMemo(
    () => (activeMuscle ? muscleDetailMap[activeMuscle] || null : null),
    [activeMuscle, muscleDetailMap]
  );

  const activeMuscleSummary = useMemo(
    () => (activeMuscle ? muscleVolumeSummary[activeMuscle] || null : null),
    [activeMuscle, muscleVolumeSummary]
  );

  const activeMuscleMembers = useMemo(() => {
    if (!activeMuscle) return null;
    return NORMALIZED_AGGREGATED_GROUPS[activeMuscle] || null;
  }, [activeMuscle]);

  const openMuscleDetail = useCallback(
    (group: string) => {
      if (!group) {
        console.warn("[Dashboard] openMuscleDetail received falsy group", {
          group,
        });
        return;
      }
      const normalized = normalizeMuscleKey(group);
      const detailExists = Boolean(muscleDetailMap[normalized]);
      const summaryExists = Boolean(muscleVolumeSummary[normalized]);
      console.log("[Dashboard] openMuscleDetail invoked", {
        source: "dashboard-feature",
        group,
        normalized,
        detailExists,
        summaryExists,
        aggregatedMembers: NORMALIZED_AGGREGATED_GROUPS[normalized] || null,
        availableDetailKeys: detailExists
          ? undefined
          : Object.keys(muscleDetailMap),
        availableSummaryKeys: summaryExists
          ? undefined
          : Object.keys(muscleVolumeSummary),
      });
      setActiveMuscle(normalized);
    },
    [muscleDetailMap, muscleVolumeSummary]
  );

  const closeMuscleDetail = useCallback(() => {
    setActiveMuscle(null);
  }, []);

  useEffect(() => {
    if (!activeMuscle) {
      console.log("[Dashboard] Active muscle cleared");
      return;
    }
    const detail = muscleDetailMap[activeMuscle];
    const summary = muscleVolumeSummary[activeMuscle];
    console.log("[Dashboard] Active muscle set", {
      activeMuscle,
      detailExists: Boolean(detail),
      summaryExists: Boolean(summary),
      detailSessionCount: detail?.sessions.length ?? 0,
      detailTotalSets: detail?.totalSets ?? 0,
      summarySets: summary?.sets ?? 0,
      aggregatedMembers: NORMALIZED_AGGREGATED_GROUPS[activeMuscle] || null,
    });
    if (!detail && !summary) {
      console.warn("[Dashboard] Active muscle missing detail and summary", {
        activeMuscle,
        availableDetailKeys: Object.keys(muscleDetailMap),
        availableSummaryKeys: Object.keys(muscleVolumeSummary),
      });
    }
  }, [activeMuscle, muscleDetailMap, muscleVolumeSummary]);

  useEffect(() => {
    if (!activeMuscle) return undefined;
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") closeMuscleDetail();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeMuscle, closeMuscleDetail]);

  const modalMuscleKey = activeMuscle;
  const modalGroupLabel =
    activeMuscleDetail?.label ||
    activeMuscleSummary?.label ||
    (activeMuscle ? humanizeMuscleName(activeMuscle) : "");
  const modalIconKey =
    activeMuscleDetail?.key ||
    activeMuscleSummary?.key ||
    modalMuscleKey ||
    "other";
  const modalTotalSets =
    activeMuscleDetail?.totalSets ?? activeMuscleSummary?.sets ?? 0;
  const modalTotalTonnage =
    activeMuscleDetail?.totalTonnage ?? activeMuscleSummary?.tonnage ?? 0;
  const modalSessions = activeMuscleDetail?.sessions ?? [];
  const modalSessionCount = modalSessions.length;
  const modalHasDetail = modalSessionCount > 0;
  useEffect(() => {
    (async () => {
      const prefs = await getDashboardPrefs();
      const mergedHidden: Record<HiddenKey, boolean> = {
        ...DASHBOARD_DEFAULT_HIDDEN,
        ...(prefs.hidden || {}),
      };
      setHidden(mergedHidden);
      const missingHiddenDefaults = Object.keys(DASHBOARD_DEFAULT_HIDDEN).some(
        (key) => (prefs.hidden as any)?.[key] === undefined
      );
      if (!prefs.hidden || missingHiddenDefaults) {
        await setDashboardPrefs({ hidden: mergedHidden });
      }
      if (prefs.lastLocation) {
        setPhase(prefs.lastLocation.phaseNumber);
        setWeek(prefs.lastLocation.weekNumber);
      }
      // compute logged sets (preload data once to avoid duplicate queries)
      const phaseNum = prefs.lastLocation?.phaseNumber || 1;
      const settings = await getSettings();
      setSettingsState(settings);
      setTargets(settings.volumeTargets || {});
      const [sessions, exercises] = await Promise.all([
        getAllCached("sessions"),
        getAllCached("exercises"),
      ]);
      setSessionsState(sessions as any[]);
      setExercisesState(exercises as Exercise[]);
      const { perWeek, totals } = await computeLoggedSetVolume(phaseNum, {
        sessions,
        exercises,
      });
      setPerWeek(perWeek);
      // build day volume matrix (tonnage)
      const dv: Record<number, Record<number, number>> = {};
      (sessions as any[])
        .filter((s) => (s.phaseNumber || s.phase || 1) === phaseNum)
        .forEach((sess) => {
          const w = sess.weekNumber;
          const dayId = Number((sess.id || "").split("-")[2]) || 0;
          let vol = 0;
          for (const entry of sess.entries || []) {
            for (const set of entry.sets || []) {
              if (
                typeof set.weightKg === "number" &&
                typeof set.reps === "number" &&
                (set.weightKg || 0) > 0 &&
                (set.reps || 0) > 0
              ) {
                vol += (set.weightKg || 0) * (set.reps || 0);
              }
            }
          }
          if (!dv[w]) dv[w] = {};
          dv[w][dayId] = (dv[w][dayId] || 0) + vol;
        });
      setDayVolumes(dv);
      // load program for day labels
      try {
        const prog = await getProfileProgram();
        setProgram(prog);
      } catch {}
      // lazy load recharts bundle for improved visualization
      loadRecharts().then((m) => setRC(m));
      const wkNum = prefs.lastLocation?.weekNumber || 1;
      // Prefer precomputed weekly volume (aggregates) if available
      if (aggs) {
        const key = `P${phaseNum}-W${wkNum}`;
        setMuscleWeek(aggs.weeklyVolume[key] || {});
      } else {
        setMuscleWeek(perWeek[wkNum] || {});
      }
      setMuscleTotals(totals);
      const wk = aggs
        ? aggs.weeklyVolume[`P${phaseNum}-W${wkNum}`] || {}
        : perWeek[wkNum] || {};
      setWeeklyBar(
        Object.entries(wk)
          .map(([m, v]) => ({ muscle: m, value: v }))
          .sort((a, b) => b.value - a.value)
      );
      setLoading(false);
    })();
  }, []);
  // refresh when sessions change realtime
  useEffect(() => {
    const onChange = (e: any) => {
      if (["sessions", "exercises", "settings"].includes(e?.detail?.table)) {
        (async () => {
          const settings = await getSettings();
          setSettingsState(settings);
          setTargets(settings.volumeTargets || {});
          const [sessions, exercises] = await Promise.all([
            getAllCached("sessions", { force: true }),
            getAllCached("exercises", { force: true }),
          ]);
          setSessionsState(sessions as any[]);
          setExercisesState(exercises as Exercise[]);
          setExercisesState(exercises as Exercise[]);
          const { perWeek, totals } = await computeLoggedSetVolume(phase, {
            sessions,
            exercises,
          });
          setPerWeek(perWeek);
          setMuscleWeek(perWeek[week] || {});
          setMuscleTotals(totals);
          const wk = perWeek[week] || {};
          setWeeklyBar(
            Object.entries(wk)
              .map(([m, v]) => ({ muscle: m, value: v }))
              .sort((a, b) => b.value - a.value)
          ); // recompute day volumes
          const dv: Record<number, Record<number, number>> = {};
          (sessions as any[])
            .filter((s) => (s.phaseNumber || s.phase || 1) === phase)
            .forEach((sess) => {
              const w = sess.weekNumber;
              const dayId = Number((sess.id || "").split("-")[2]) || 0;
              let vol = 0;
              for (const entry of sess.entries || []) {
                for (const set of entry.sets || []) {
                  if (
                    typeof set.weightKg === "number" &&
                    typeof set.reps === "number" &&
                    (set.weightKg || 0) > 0 &&
                    (set.reps || 0) > 0
                  ) {
                    vol += (set.weightKg || 0) * (set.reps || 0);
                  }
                }
              }
              if (!dv[w]) dv[w] = {};
              dv[w][dayId] = (dv[w][dayId] || 0) + vol;
            });
          setDayVolumes(dv);
        })();
      }
    };
    window.addEventListener("sb-change", onChange as any);
    return () => window.removeEventListener("sb-change", onChange as any);
  }, [phase, week]);
  useEffect(() => {
    let cancelled = false;
    const sessions = Array.isArray(sessionsState)
      ? (sessionsState as Session[])
      : [];
    const exercises = Array.isArray(exercisesState) ? exercisesState : [];
    const currentWeek = Number.isFinite(week) ? week : null;
    const currentPhase = Number.isFinite(phase) ? phase : null;
    if (!sessions.length || !exercises.length || currentWeek == null) {
      setMuscleDetailMap({});
      setMuscleVolumeSummary({});
      return;
    }
    (async () => {
      try {
        const { detailMap, summaryMap } = await buildMuscleDetailData({
          sessions,
          exercises,
          weekNumber: currentWeek,
          phaseNumber: currentPhase,
          formatter: sessionDateFormatter,
        });
        if (cancelled) return;
        setMuscleDetailMap(detailMap);
        setMuscleVolumeSummary(summaryMap);
      } catch (error) {
        if (cancelled) return;
        console.warn("[Dashboard] Failed to build muscle detail", error);
        setMuscleDetailMap({});
        setMuscleVolumeSummary({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionsState, exercisesState, week, phase, sessionDateFormatter]);
  // derive day labels whenever program changes
  useEffect(() => {
    if (program?.weeklySplit) {
      setDayLabels(program.weeklySplit.map((d) => d.customLabel || d.type));
    } else {
      // fallback: infer from existing day ids in data (D1..)
      const ids = Array.from(
        new Set(
          Object.values(dayVolumes).flatMap((rec) =>
            Object.keys(rec).map(Number)
          )
        )
      ).sort((a, b) => a - b);
      setDayLabels(ids.map((id) => `D${id + 1}`));
    }
  }, [
    program?.id,
    (program as any)?.weeklySplit?.length,
    Object.keys(dayVolumes).length,
  ]);

  useEffect(() => {
    const sessions = Array.isArray(sessionsState)
      ? (sessionsState as Session[])
      : [];
    const currentWeek = Number.isFinite(week) ? week : null;
    const currentPhase = Number.isFinite(phase) ? phase : null;
    const usesLb = (settingsState?.unit ?? "kg") === "lb";
    const tonnageMultiplier = usesLb ? 2.2046226218 : 1;
    setTonnageUnit(usesLb ? "lb" : "kg");

    if (!sessions.length) {
      setLifetimeStats({ workouts: 0, sets: 0, hours: 0, tonnage: 0 });
      setWeeklyStats({
        workouts: 0,
        sets: 0,
        hours: 0,
        tonnage: 0,
        weekNumber: currentWeek,
        phaseNumber: currentPhase,
      });
      return;
    }

    let lifetimeWorkouts = 0;
    let lifetimeSets = 0;
    let lifetimeVolume = 0;
    let lifetimeDuration = 0;

    let weeklyWorkouts = 0;
    let weeklySets = 0;
    let weeklyVolume = 0;
    let weeklyDuration = 0;

    for (const session of sessions) {
      if (!session || session.deletedAt) continue;
      let sessionSets = 0;
      let sessionVolume = 0;
      let hasWork = false;

      for (const entry of session.entries || []) {
        for (const set of entry.sets || []) {
          const reps = Math.max(0, set?.reps ?? 0);
          const weight = Math.max(0, set?.weightKg ?? 0);
          if (reps === 0 && weight === 0) continue;

          hasWork = true;
          sessionSets += 1;
          lifetimeSets += 1;
          if (reps > 0 && weight > 0) {
            sessionVolume += weight * reps;
          }
        }
      }

      if (!hasWork) continue;

      const durationMs = computeSessionDurationMs(session) || 0;
      lifetimeWorkouts += 1;
      lifetimeVolume += sessionVolume;
      lifetimeDuration += durationMs;

      if (
        currentWeek != null &&
        session.weekNumber === currentWeek &&
        (currentPhase == null ||
          (session.phaseNumber ?? session.phase ?? currentPhase) ===
            currentPhase)
      ) {
        weeklyWorkouts += 1;
        weeklySets += sessionSets;
        weeklyVolume += sessionVolume;
        weeklyDuration += durationMs;
      }
    }

    setLifetimeStats({
      workouts: lifetimeWorkouts,
      sets: lifetimeSets,
      hours: lifetimeDuration / (1000 * 60 * 60),
      tonnage: lifetimeVolume * tonnageMultiplier,
    });

    setWeeklyStats({
      workouts: weeklyWorkouts,
      sets: weeklySets,
      hours: weeklyDuration / (1000 * 60 * 60),
      tonnage: weeklyVolume * tonnageMultiplier,
      weekNumber: currentWeek,
      phaseNumber: currentPhase,
    });
  }, [sessionsState, week, phase, settingsState]);

  const toggle = async (key: HiddenKey) => {
    const next = { ...(hidden || {}), [key]: !hidden?.[key] };
    setHidden(next);
    await setDashboardPrefs({ hidden: next });
  };
  const SectionToggle = ({
    label,
    flag,
  }: {
    label: string;
    flag: HiddenKey;
  }) => (
    <button
      onClick={() => toggle(flag)}
      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
        hidden?.[flag]
          ? "bg-slate-800 text-gray-400 border-white/5"
          : "badge-primary"
      }`}
    >
      {hidden?.[flag] ? `Show ${label}` : `Hide ${label}`}
    </button>
  );

  const lifetimeHasData =
    lifetimeStats.workouts > 0 ||
    lifetimeStats.sets > 0 ||
    lifetimeStats.tonnage > 0 ||
    lifetimeStats.hours > 0;

  const weeklyHasData =
    weeklyStats.workouts > 0 ||
    weeklyStats.sets > 0 ||
    weeklyStats.tonnage > 0 ||
    weeklyStats.hours > 0;

  const lifetimeMetricBlocks = useMemo(
    () => [
      {
        key: "workouts",
        label: "Workouts",
        value: formatCount(lifetimeStats.workouts),
        caption: "sessions",
      },
      {
        key: "sets",
        label: "Sets",
        value: formatCount(lifetimeStats.sets),
        caption: "logged",
      },
      {
        key: "hours",
        label: "Active Time",
        value: formatHours(lifetimeStats.hours),
        caption: "tracked",
      },
      {
        key: "volume",
        label: "Volume",
        value: formatCompact(lifetimeStats.tonnage),
        caption: `${tonnageUnit} lifted`,
      },
    ],
    [lifetimeStats, tonnageUnit]
  );

  const weeklyMetricBlocks = useMemo(
    () => [
      {
        key: "workouts",
        label: "Workouts",
        value: formatCount(weeklyStats.workouts),
        caption: "logged",
      },
      {
        key: "sets",
        label: "Sets",
        value: formatCount(weeklyStats.sets),
        caption: "valid",
      },
      {
        key: "hours",
        label: "Active Time",
        value: formatHours(weeklyStats.hours),
        caption: "this week",
      },
      {
        key: "volume",
        label: "Volume",
        value: formatCompact(weeklyStats.tonnage),
        caption: `${tonnageUnit} lifted`,
      },
    ],
    [weeklyStats, tonnageUnit]
  );

  const weeklyTitle = useMemo(() => {
    if (!weeklyStats.weekNumber) return "Current Week";
    if (weeklyStats.phaseNumber)
      return `Phase ${weeklyStats.phaseNumber} • Week ${weeklyStats.weekNumber}`;
    return `Week ${weeklyStats.weekNumber}`;
  }, [weeklyStats.phaseNumber, weeklyStats.weekNumber]);

  const WeeklyMuscleBar = () => (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm">Weekly Muscle Volume</div>
        <SectionToggle label="Weekly Bar" flag="weeklyMuscleBar" />
      </div>
      <div className="h-48 flex items-end gap-2 overflow-x-auto pb-2">
        {weeklyBar.map((r) => {
          const max = Math.max(1, ...weeklyBar.map((x) => x.value));
          const h = (r.value / max) * 100;
          const normalizedKey = normalizeMuscleKey(r.muscle);
          const detailExists = Boolean(muscleDetailMap[normalizedKey]);
          const summaryExists = Boolean(muscleVolumeSummary[normalizedKey]);
          const handleClick = () => {
            console.log("[Dashboard] Weekly bar clicked", {
              muscle: r.muscle,
              normalizedKey,
              value: r.value,
              detailExists,
              summaryExists,
            });
            openMuscleDetail(r.muscle);
          };
          return (
            <button
              key={r.muscle}
              type="button"
              onClick={handleClick}
              className="flex flex-col items-center w-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <div
                className="w-full bg-slate-700/50 rounded-t-md relative"
                style={{ height: `${h}%` }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white/80">
                  {r.value.toFixed(1)}
                </div>
              </div>
              <div className="text-[9px] mt-1 capitalize truncate w-full text-center">
                {r.muscle}
              </div>
            </button>
          );
        })}
        {!weeklyBar.length && (
          <div className="text-[11px] text-gray-500">No data.</div>
        )}
      </div>
    </GlassCard>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900/70 to-slate-950 p-6 text-slate-100 shadow-[0_30px_80px_-45px_rgba(56,189,248,0.6)]">
            <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-12 -bottom-16 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.38em] text-white/60">
                  Lifetime
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  Training Ledger
                </h2>
              </div>
              {lifetimeHasData ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {lifetimeMetricBlocks.map((item) => (
                    <div key={item.key} className="space-y-2">
                      <span className="text-[10px] uppercase tracking-[0.4em] text-white/40">
                        {item.label}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold text-white/90">
                          {item.value}
                        </span>
                        {item.caption && (
                          <span className="text-xs uppercase tracking-[0.32em] text-white/50">
                            {item.caption}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/70">
                  Log your first session to unlock lifetime insights.
                </p>
              )}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/85 p-6 text-slate-100 shadow-[0_25px_70px_-50px_rgba(59,130,246,0.55)]">
            <div className="pointer-events-none absolute -right-16 top-8 h-44 w-44 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.38em] text-emerald-200/70">
                  Current Focus
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white/90">
                  {weeklyTitle}
                </h2>
              </div>
              {weeklyHasData ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {weeklyMetricBlocks.map((item) => (
                    <div
                      key={item.key}
                      className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3"
                    >
                      <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">
                        {item.label}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-semibold text-white">
                          {item.value}
                        </span>
                        {item.caption && (
                          <span className="text-[11px] uppercase tracking-[0.28em] text-white/50">
                            {item.caption}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-300/80">
                  No tracked sessions for this week yet. Log a workout to see
                  trends instantly.
                </p>
              )}
            </div>
          </div>
        </div>
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
          {!hidden?.trainingChart && (
            <motion.div
              key="training"
              className="space-y-2"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="text-subtitle">Training</div>
              {loading ? (
                <div className="h-60 rounded-xl bg-white/5 animate-pulse" />
              ) : (
                <ChartPanel kind="exercise" />
              )}
            </motion.div>
          )}
          {!hidden?.bodyChart && (
            <motion.div
              key="body"
              className="space-y-2"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="text-subtitle">Body</div>
              {loading ? (
                <div className="h-60 rounded-xl bg-white/5 animate-pulse" />
              ) : (
                <ChartPanel kind="measurement" />
              )}
            </motion.div>
          )}
          {!hidden?.weekVolume && (
            <motion.div
              key="weekVol"
              className="space-y-3"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="text-title">
                Week {week} Logged Volume{" "}
                <span className="text-body-sm text-slate-400 ml-1 align-middle">
                  (Weighted Sets)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(muscleWeek)
                  .sort((a, b) => b[1] - a[1])
                  .map(([m, v]) => {
                    const tgt = targets[m] || 0;
                    const pct = tgt ? Math.min(100, (v / tgt) * 100) : 100;
                    const status = tgt
                      ? v >= tgt
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                      : "bg-emerald-500";
                    const prev =
                      (perWeek[week - 1] && perWeek[week - 1][m]) || 0;
                    const delta = v - prev;
                    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
                    const deltaClass =
                      delta > 0
                        ? "text-emerald-400"
                        : delta < 0
                        ? "text-red-400"
                        : "text-gray-400";
                    const normalizedKey = normalizeMuscleKey(m);
                    const detailExists = Boolean(
                      muscleDetailMap[normalizedKey]
                    );
                    const summaryExists = Boolean(
                      muscleVolumeSummary[normalizedKey]
                    );
                    const handleClick = () => {
                      console.log("[Dashboard] Week card clicked", {
                        muscle: m,
                        normalizedKey,
                        sets: v,
                        prevSets: prev,
                        detailExists,
                        summaryExists,
                      });
                      openMuscleDetail(m);
                    };
                    return (
                      <motion.div
                        key={m}
                        role="button"
                        tabIndex={0}
                        onClick={handleClick}
                        onKeyDown={(evt) => {
                          if (evt.key === "Enter" || evt.key === " ") {
                            evt.preventDefault();
                            handleClick();
                          }
                        }}
                        className="bg-white/5 rounded-lg px-2 py-2 space-y-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.25 }}
                        title={`Prev Week: ${prev.toFixed(1)} | Delta: ${
                          delta >= 0 ? "+" : ""
                        }${delta.toFixed(1)}`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span className="capitalize flex items-center gap-1">
                            {m}
                            <span
                              className={`inline-flex items-center gap-0.5 ${deltaClass} font-medium`}
                            >
                              <span className="leading-none">{arrow}</span>
                              <span className="tabular-nums">
                                {delta === 0
                                  ? "0.0"
                                  : `${delta > 0 ? "+" : ""}${delta.toFixed(
                                      1
                                    )}`}
                              </span>
                            </span>
                          </span>
                          <span className="tabular-nums">
                            {v.toFixed(1)}
                            {tgt ? `/${tgt}` : ""}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden relative">
                          <motion.div
                            className={`h-full ${status}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 150,
                              damping: 26,
                            }}
                          />
                          {tgt ? (
                            <span className="absolute inset-y-0 right-0 text-[8px] text-white/60 pr-1 flex items-center">
                              {Math.round(pct)}%
                            </span>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })}
                {!Object.keys(muscleWeek).length && (
                  <div className="col-span-full text-[11px] text-gray-500">
                    No logged sets yet.
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {!hidden?.phaseTotals && (
            <motion.div
              key="phaseTotals"
              className="space-y-3"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="text-title">
                Phase Totals{" "}
                <span className="text-body-sm text-slate-400 ml-1 align-middle">
                  (Weighted Sets)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(muscleTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([m, v]) => {
                    const max = Math.max(1, ...Object.values(muscleTotals));
                    const pct = (v / max) * 100;
                    return (
                      <motion.div
                        key={m}
                        className="bg-white/5 rounded-lg px-2 py-2 space-y-1"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.25 }}
                      >
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span className="capitalize">{m}</span>
                          <span className="tabular-nums">{v.toFixed(1)}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden">
                          <motion.div
                            className="h-full bg-indigo-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 150,
                              damping: 26,
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                {!Object.keys(muscleTotals).length && (
                  <div className="col-span-full text-[11px] text-gray-500">
                    No logged sets yet.
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {!hidden?.weeklyMuscleBar && (
            <motion.div
              key="weeklyBar"
              className="space-y-3"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <WeeklyMuscleBar />
            </motion.div>
          )}
          {!hidden?.sessionVolumeTrend && (
            <motion.div
              key="sessionVolTrend"
              className="space-y-3"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <GlassCard>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="font-medium text-sm">
                    Session Tonnage Trend{" "}
                    <span className="text-xs text-slate-400 ml-1">
                      (per selected day across weeks)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <label className="flex items-center gap-1">
                      Day
                      <select
                        className="bg-slate-700 rounded px-1 py-0.5"
                        value={selectedDay}
                        onChange={(e) => {
                          setSelectedDay(Number(e.target.value));
                        }}
                      >
                        {dayLabels.map((lbl, idx) => (
                          <option key={idx} value={idx}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      Highlight
                      <select
                        className="bg-slate-700 rounded px-1 py-0.5"
                        value={highlightWeek ?? ""}
                        onChange={(e) =>
                          setHighlightWeek(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">None</option>
                        {Object.keys(dayVolumes).map((w) => (
                          <option key={w} value={w}>
                            W{w}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() =>
                        setHighlightWeek(
                          Object.keys(dayVolumes)
                            .map(Number)
                            .sort((a, b) => a - b)
                            .pop() || null
                        )
                      }
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                    >
                      Last
                    </button>
                  </div>
                </div>
                {(() => {
                  const weeks = Object.keys(dayVolumes)
                    .map(Number)
                    .sort((a, b) => a - b);
                  const rows = weeks.map((w) => ({
                    week: w,
                    vol: dayVolumes[w]?.[selectedDay] || 0,
                  }));
                  const vols = rows.map((r) => r.vol).filter((v) => v > 0);
                  const avg = vols.length
                    ? vols.reduce((a, b) => a + b, 0) / vols.length
                    : 0;
                  const best = vols.length ? Math.max(...vols) : 0;
                  const last = rows.length ? rows[rows.length - 1].vol : 0;
                  const prev = rows.length > 1 ? rows[rows.length - 2].vol : 0;
                  const delta = prev ? ((last - prev) / prev) * 100 : 0;
                  let slope = 0;
                  if (rows.length > 1) {
                    const n = rows.length;
                    const sx = rows.reduce((a, r) => a + r.week, 0);
                    const sy = rows.reduce((a, r) => a + r.vol, 0);
                    const sxx = rows.reduce((a, r) => a + r.week * r.week, 0);
                    const sxy = rows.reduce((a, r) => a + r.week * r.vol, 0);
                    const denom = n * sxx - sx * sx || 1;
                    slope = (n * sxy - sx * sy) / denom;
                  }
                  const avgLine = avg; // constant reference line
                  const Chart = RC?.BarChart;
                  const Bar = RC?.Bar;
                  const XAxis = RC?.XAxis;
                  const YAxis = RC?.YAxis;
                  const Tooltip = RC?.Tooltip;
                  const ResponsiveContainer = RC?.ResponsiveContainer;
                  const ReferenceLine = RC?.ReferenceLine;
                  const CartesianGrid = RC?.CartesianGrid;
                  return (
                    <div>
                      <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 mb-2">
                        <div>
                          Avg{" "}
                          <span className="text-slate-200 font-medium tabular-nums">
                            {avg.toFixed(0)}
                          </span>
                        </div>
                        <div>
                          Best{" "}
                          <span className="text-slate-200 font-medium tabular-nums">
                            {best.toFixed(0)}
                          </span>
                        </div>
                        <div>
                          Last{" "}
                          <span className="text-slate-200 font-medium tabular-nums">
                            {last.toFixed(0)}
                          </span>
                        </div>
                        <div>
                          ΔPrev{" "}
                          <span
                            className={`font-medium tabular-nums ${
                              delta > 0
                                ? "text-emerald-400"
                                : delta < 0
                                ? "text-red-400"
                                : "text-slate-300"
                            }`}
                          >
                            {prev
                              ? (delta > 0 ? "+" : "") + delta.toFixed(1) + "%"
                              : "–"}
                          </span>
                        </div>
                        <div>
                          Slope{" "}
                          <span
                            className={`font-medium tabular-nums ${
                              slope > 0
                                ? "text-emerald-400"
                                : slope < 0
                                ? "text-red-400"
                                : "text-slate-300"
                            }`}
                          >
                            {slope.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="h-56">
                        {RC && rows.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <Chart
                              data={rows}
                              margin={{ left: 4, right: 4, top: 10, bottom: 4 }}
                              barSize={32}
                            >
                              <CartesianGrid
                                stroke="rgba(255,255,255,0.08)"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="week"
                                tick={{ fill: "#94a3b8", fontSize: 10 }}
                                tickFormatter={(v: number) => "W" + v}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fill: "#94a3b8", fontSize: 10 }}
                                width={40}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) =>
                                  v >= 1000
                                    ? (v / 1000).toFixed(1) + "k"
                                    : v.toFixed(0)
                                }
                              />
                              <Tooltip
                                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                                content={({ active, payload, label }: any) => {
                                  if (!active || !payload?.length) return null;
                                  const r = payload[0].payload as any;
                                  const prevIdx =
                                    rows.findIndex((x) => x.week === r.week) -
                                    1;
                                  const prevVol =
                                    prevIdx >= 0 ? rows[prevIdx].vol : 0;
                                  const dPct = prevVol
                                    ? ((r.vol - prevVol) / prevVol) * 100
                                    : 0;
                                  return (
                                    <div className="text-[11px] bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-md px-2 py-1 space-y-0.5">
                                      <div className="font-medium text-slate-200">
                                        Week {r.week}
                                      </div>
                                      <div className="tabular-nums">
                                        Tonnage:{" "}
                                        <span className="text-slate-100 font-semibold">
                                          {r.vol.toFixed(0)}
                                        </span>
                                      </div>
                                      <div className="tabular-nums">
                                        ΔPrev:{" "}
                                        <span
                                          className={
                                            dPct > 0
                                              ? "text-emerald-400"
                                              : dPct < 0
                                              ? "text-red-400"
                                              : "text-slate-300"
                                          }
                                        >
                                          {prevVol
                                            ? (dPct > 0 ? "+" : "") +
                                              dPct.toFixed(1) +
                                              "%"
                                            : "–"}
                                        </span>
                                      </div>
                                      <div className="tabular-nums">
                                        vs Avg:{" "}
                                        <span
                                          className={
                                            r.vol >= avg
                                              ? "text-emerald-400"
                                              : "text-amber-400"
                                          }
                                        >
                                          {avg
                                            ? (
                                                ((r.vol - avg) / avg) *
                                                100
                                              ).toFixed(1) + "%"
                                            : "–"}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              <ReferenceLine
                                y={avgLine}
                                stroke="#10b981"
                                strokeDasharray="3 3"
                                ifOverflow="extendDomain"
                              />
                              <Bar
                                dataKey="vol"
                                radius={[4, 4, 0, 0]}
                                fill="#6366f1"
                              >
                                {rows.map((entry, i) => {
                                  const hl = highlightWeek === entry.week;
                                  return (
                                    <RC.Cell
                                      key={entry.week}
                                      fill={
                                        hl
                                          ? "url(#gradHighlight)"
                                          : entry.vol === best
                                          ? "#10b981"
                                          : "#6366f1"
                                      }
                                    />
                                  );
                                })}
                              </Bar>
                              <defs>
                                <linearGradient
                                  id="gradHighlight"
                                  x1="0"
                                  x2="0"
                                  y1="0"
                                  y2="1"
                                >
                                  <stop offset="0%" stopColor="#059669" />
                                  <stop offset="100%" stopColor="#065f46" />
                                </linearGradient>
                              </defs>
                            </Chart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-[11px] text-gray-500">
                            {rows.length ? "Loading chart..." : "No data."}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </GlassCard>
            </motion.div>
          )}
          {!hidden?.compliance && (
            <motion.div
              key="compliance"
              className="bg-card rounded-2xl p-5 shadow-soft space-y-4"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="text-title">Phase Weekly Compliance</div>
              <div className="text-body-sm text-gray-400">
                Color shows adherence vs target (green &gt;=100%, amber 70-99%,
                red &lt;70%).
              </div>
              <div className="space-y-2">
                {Object.keys(targets)
                  .filter((m) => targets[m] > 0)
                  .sort()
                  .map((m) => {
                    const rows = Object.entries(perWeek).sort(
                      (a, b) => Number(a[0]) - Number(b[0])
                    );
                    return (
                      <div key={m} className="space-y-1">
                        <div className="text-label text-gray-500 flex justify-between">
                          <span>{m}</span>
                          <span className="tabular-nums">{targets[m]}</span>
                        </div>
                        <div className="flex gap-1">
                          {rows.map(([wk, rec]) => {
                            const v = rec[m] || 0;
                            const tgt = targets[m];
                            const ratio = tgt ? v / tgt : 1;
                            const color =
                              ratio >= 1
                                ? "bg-emerald-600"
                                : ratio >= 0.7
                                ? "bg-amber-500"
                                : "bg-red-600";
                            return (
                              <div key={wk} className="flex-1">
                                <div className="h-8 rounded-md relative overflow-hidden bg-slate-700/40">
                                  <motion.div
                                    className={`${color} absolute bottom-0 left-0 w-full`}
                                    initial={{ height: 0 }}
                                    animate={{
                                      height: `${Math.min(100, ratio * 100)}%`,
                                    }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 150,
                                      damping: 26,
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white/80 font-medium">
                                    {v.toFixed(1)}
                                  </div>
                                </div>
                                <div className="text-center text-[8px] mt-0.5 text-gray-500">
                                  W{wk}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {modalMuscleKey && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={closeMuscleDetail}
          />
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <div className="relative z-10 w-full max-w-2xl">
              <div className="relative flex max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-[0_45px_120px_-60px_rgba(59,130,246,0.8)]">
                <button
                  type="button"
                  onClick={closeMuscleDetail}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-100 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  aria-label="Close muscle breakdown"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                  >
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <div className="p-5 sm:p-6 text-slate-100 flex flex-col gap-5 min-h-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                        <img
                          src={getMuscleIconPath(modalIconKey || "other")}
                          alt={modalGroupLabel || modalIconKey || "muscle"}
                          className="h-7 w-7"
                          loading="lazy"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm uppercase tracking-widest text-white/40">
                          Focus
                        </div>
                        <h2 className="text-2xl font-semibold capitalize">
                          {modalGroupLabel || modalIconKey}
                        </h2>
                        <p className="text-[11px] text-slate-300">
                          {modalHasDetail
                            ? modalSessionCount > 0
                              ? `${modalSessionCount} ${
                                  modalSessionCount === 1
                                    ? "session"
                                    : "sessions"
                                } logged in week ${week}`
                              : `No sessions logged in week ${week}`
                            : modalTotalSets > 0
                            ? `${modalTotalSets} sets logged in week ${week}`
                            : `No sets logged in week ${week}`}
                        </p>
                        {activeMuscleMembers && (
                          <p className="text-[11px] text-slate-400">
                            Includes{" "}
                            {activeMuscleMembers
                              .map((member) => humanizeMuscleName(member))
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="hidden text-right text-xs text-slate-400 sm:block">
                      Click outside or press Esc to close
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    <div className="rounded-2xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-white/40">
                        Total Sets
                      </div>
                      <div className="text-lg font-semibold tabular-nums text-white">
                        {modalTotalSets}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-white/40">
                        Total Volume
                      </div>
                      <div className="text-lg font-semibold tabular-nums text-white">
                        {(modalTotalTonnage * tonnageUnitMultiplier).toFixed(1)}
                        <span className="text-[11px] uppercase text-white/60 ml-1">
                          {tonnageUnit}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-white/40">
                        Avg Sets / Session
                      </div>
                      <div className="text-lg font-semibold tabular-nums text-white">
                        {modalSessionCount
                          ? (modalTotalSets / modalSessionCount).toFixed(1)
                          : "0.0"}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    {modalHasDetail ? (
                      <div className="space-y-4 h-full overflow-y-auto pr-1 sm:pr-2">
                        {modalSessions.map((session) => (
                          <div
                            key={session.sessionId}
                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 space-y-2"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-300">
                              <span>{session.label}</span>
                              <span className="tabular-nums text-white/70">
                                {session.totalSets} sets ·{" "}
                                {(
                                  session.totalTonnage * tonnageUnitMultiplier
                                ).toFixed(1)}{" "}
                                {tonnageUnit}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {session.exercises.map((exercise) => (
                                <div
                                  key={exercise.exerciseId}
                                  className="flex items-center justify-between text-[11px] text-slate-200/90"
                                >
                                  <span className="truncate max-w-[60%]">
                                    {exercise.name}
                                  </span>
                                  <span className="tabular-nums text-slate-300">
                                    {exercise.sets} sets ·{" "}
                                    {(
                                      exercise.tonnage * tonnageUnitMultiplier
                                    ).toFixed(1)}{" "}
                                    {tonnageUnit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full overflow-y-auto">
                        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center text-[12px] text-slate-300">
                          No detailed session data available for this muscle in
                          the selected week.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
