import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import { loadRecharts } from "../../lib/loadRecharts";
import { getAllCached } from "../../lib/dataCache";
import { useAggregates } from "../../lib/useAggregates";
import { getSettings } from "../../lib/helpers";
import { countValidSets } from "../../lib/volume";
import { Exercise, Measurement, Session, Settings } from "../../lib/types";
import { format, parseISO } from "date-fns";

const SECONDARY_FACTOR = 0.5;
const KG_TO_LB = 2.2046226218;

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const durationFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  return COMPACT_FORMATTER.format(value)
    .replace(/\.0([A-Za-z])/, "$1")
    .replace(/\.0$/, "");
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1000) return formatCompact(value);
  return Math.round(value).toLocaleString();
}

function formatHours(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0h";
  if (value >= 10) return `${durationFormatter.format(value)}h`;
  if (value >= 1) return `${value.toFixed(1)}h`;
  const minutes = Math.round(value * 60);
  return `${minutes}m`;
}

function computeSessionDurationMs(session: Session): number {
  const cap = 1000 * 60 * 60 * 12;
  const clamp = (ms: number) => Math.max(0, Math.min(ms, cap));
  const log = session.workLog;
  if (log && Object.keys(log).length) {
    const entries = Object.values(log)
      .filter(Boolean)
      .map((item: any) => ({
        first: new Date(item.first || 0).getTime(),
        last: new Date(item.last || 0).getTime(),
      }))
      .filter(
        (item) =>
          !Number.isNaN(item.first) &&
          !Number.isNaN(item.last) &&
          item.last >= item.first
      )
      .sort((a, b) => b.last - a.last);
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

type WeeklyAggregate = {
  key: string;
  label: string;
  weekNumber: number;
  phaseNumber: number | null;
  sessions: number;
  sets: number;
  volumeKg: number;
  durationHours: number;
  avgVolumePerSessionKg: number;
};

type SessionSummary = {
  id: string;
  dateISO: string;
  weekNumber: number;
  phaseNumber: number | null;
  sets: number;
  volumeKg: number;
  durationHours: number;
  topWeightKg: number;
  topExerciseName?: string;
  muscleBreakdown: { muscle: string; sets: number; share: number }[];
};

type MuscleSummary = {
  muscle: string;
  sets: number;
  tonnageKg: number;
  sessions: number;
  share: number;
  timeline: { key: string; label: string; sets: number; tonnageKg: number }[];
};

type ExerciseTimelineEntry = {
  sessionId: string;
  dateISO: string;
  weekNumber: number;
  phaseNumber: number | null;
  sets: number;
  volumeKg: number;
  topWeightKg: number;
  avgWeightKg: number;
  totalReps: number;
  setDetails: { weightKg: number; reps: number; rpe: number | null }[];
};

type ExerciseAnalytics = {
  exercise: Exercise;
  totals: { volumeKg: number; sets: number; sessions: number };
  maxTopWeightKg: number;
  timeline: ExerciseTimelineEntry[];
};

type AnalyticsBundle = {
  totals: {
    workouts: number;
    sets: number;
    volumeKg: number;
    durationHours: number;
  };
  weekly: WeeklyAggregate[];
  sessions: SessionSummary[];
  muscles: MuscleSummary[];
  exerciseMap: Record<string, ExerciseAnalytics>;
};

function safePhase(session: Session): number | null {
  return session.phaseNumber ?? session.phase ?? null;
}

function safeWeek(session: Session): number {
  return session.weekNumber ?? 0;
}

function makeWeekKey(session: Session): string {
  const phase = safePhase(session) ?? 0;
  const week = safeWeek(session) || 0;
  return `P${phase}-W${week}`;
}

function makeWeekLabel(session: Session): string {
  const phase = safePhase(session);
  const week = safeWeek(session) || 0;
  return phase ? `Phase ${phase} • Week ${week}` : `Week ${week}`;
}

function safeParseDate(value?: string): Date {
  if (value) {
    try {
      const parsed = parseISO(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    } catch {
      /* ignore */
    }
  }
  return new Date();
}

function buildAnalytics(
  sessions: Session[],
  exercises: Exercise[]
): AnalyticsBundle {
  if (!sessions.length) {
    return {
      totals: { workouts: 0, sets: 0, volumeKg: 0, durationHours: 0 },
      weekly: [],
      sessions: [],
      muscles: [],
      exerciseMap: {},
    };
  }

  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const weeklyMap = new Map<string, WeeklyAggregate & { order: number }>();
  const sessionSummaries: SessionSummary[] = [];
  const muscleMap = new Map<
    string,
    {
      sets: number;
      tonnageKg: number;
      sessions: Set<string>;
      weekBuckets: Map<string, { sets: number; tonnageKg: number }>;
    }
  >();
  const exerciseMap = new Map<string, ExerciseAnalytics>();

  let totalWorkouts = 0;
  let totalSets = 0;
  let totalVolumeKg = 0;
  let totalDurationHours = 0;

  for (const session of sessions) {
    if (!session || session.deletedAt) continue;
    const sessionDate = safeParseDate(session.dateISO || session.localDate);
    const sessionDateMs = sessionDate.getTime();
    let sessionSets = 0;
    let sessionVolumeKg = 0;
    const sessionDurationHours =
      computeSessionDurationMs(session) / (1000 * 60 * 60);
    let sessionTopWeightKg = 0;
    let sessionTopExerciseName: string | undefined;
    let sessionTopExerciseVolume = -Infinity;
    const sessionMuscle = new Map<
      string,
      { sets: number; tonnageKg: number }
    >();

    for (const entry of session.entries || []) {
      const ex = exMap.get(entry.exerciseId);
      if (!ex) continue;
      const validSets = countValidSets(entry.sets || []);
      if (!validSets) continue;

      let entryVolumeKg = 0;
      let entryTopWeightKg = 0;
      let totalReps = 0;
      const setDetails: {
        weightKg: number;
        reps: number;
        rpe: number | null;
      }[] = [];

      for (const set of entry.sets || []) {
        const reps = Math.max(0, set?.reps ?? 0);
        const weight = Math.max(0, set?.weightKg ?? 0);
        if (reps === 0 && weight === 0) continue;
        entryVolumeKg += weight * reps;
        totalReps += reps;
        if (weight > entryTopWeightKg) entryTopWeightKg = weight;
        setDetails.push({ weightKg: weight, reps, rpe: set?.rpe ?? null });
      }

      const realizedSets = setDetails.length;
      if (!realizedSets) continue;

      sessionSets += realizedSets;
      sessionVolumeKg += entryVolumeKg;
      if (entryTopWeightKg > sessionTopWeightKg) {
        sessionTopWeightKg = entryTopWeightKg;
      }
      if (entryVolumeKg >= sessionTopExerciseVolume) {
        sessionTopExerciseVolume = entryVolumeKg;
        sessionTopExerciseName = ex.name;
      }

      const muscles = [
        ex.muscleGroup || "other",
        ...(ex.secondaryMuscles || []),
      ];
      const multipliers = [
        1,
        ...(ex.secondaryMuscles || []).map(() => SECONDARY_FACTOR),
      ];
      const weekKey = makeWeekKey(session);

      muscles.forEach((muscle, idx) => {
        if (!muscle) return;
        const setMultiplier = multipliers[idx];
        const tonnageMultiplier = setMultiplier;
        const overall = muscleMap.get(muscle) ?? {
          sets: 0,
          tonnageKg: 0,
          sessions: new Set<string>(),
          weekBuckets: new Map<string, { sets: number; tonnageKg: number }>(),
        };
        overall.sets += realizedSets * setMultiplier;
        overall.tonnageKg += entryVolumeKg * tonnageMultiplier;
        overall.sessions.add(session.id);
        const bucket = overall.weekBuckets.get(weekKey) ?? {
          sets: 0,
          tonnageKg: 0,
        };
        bucket.sets += realizedSets * setMultiplier;
        bucket.tonnageKg += entryVolumeKg * tonnageMultiplier;
        overall.weekBuckets.set(weekKey, bucket);
        muscleMap.set(muscle, overall);

        const perSession = sessionMuscle.get(muscle) ?? {
          sets: 0,
          tonnageKg: 0,
        };
        perSession.sets += realizedSets * setMultiplier;
        perSession.tonnageKg += entryVolumeKg * tonnageMultiplier;
        sessionMuscle.set(muscle, perSession);
      });

      const analytics =
        exerciseMap.get(ex.id) ??
        ({
          exercise: ex,
          totals: { volumeKg: 0, sets: 0, sessions: 0 },
          maxTopWeightKg: 0,
          timeline: [] as ExerciseTimelineEntry[],
        } satisfies ExerciseAnalytics);
      analytics.totals.volumeKg += entryVolumeKg;
      analytics.totals.sets += realizedSets;
      analytics.totals.sessions += 1;
      analytics.maxTopWeightKg = Math.max(
        analytics.maxTopWeightKg,
        entryTopWeightKg
      );
      analytics.timeline.push({
        sessionId: session.id,
        dateISO: session.dateISO,
        weekNumber: session.weekNumber,
        phaseNumber: safePhase(session),
        sets: realizedSets,
        volumeKg: entryVolumeKg,
        topWeightKg: entryTopWeightKg,
        avgWeightKg: totalReps ? entryVolumeKg / totalReps : 0,
        totalReps,
        setDetails,
      });
      exerciseMap.set(ex.id, analytics);
    }

    if (!sessionSets) continue;

    totalWorkouts += 1;
    totalSets += sessionSets;
    totalVolumeKg += sessionVolumeKg;
    totalDurationHours += sessionDurationHours;

    const weekKey = makeWeekKey(session);
    const weekLabel = makeWeekLabel(session);
    const weekEntry =
      weeklyMap.get(weekKey) ??
      ({
        key: weekKey,
        label: weekLabel,
        weekNumber: safeWeek(session),
        phaseNumber: safePhase(session),
        sessions: 0,
        sets: 0,
        volumeKg: 0,
        durationHours: 0,
        avgVolumePerSessionKg: 0,
        order: sessionDateMs,
      } satisfies WeeklyAggregate & { order: number });
    weekEntry.sessions += 1;
    weekEntry.sets += sessionSets;
    weekEntry.volumeKg += sessionVolumeKg;
    weekEntry.durationHours += sessionDurationHours;
    weekEntry.order = Math.min(weekEntry.order, sessionDateMs);
    weeklyMap.set(weekKey, weekEntry);

    const breakdown = Array.from(sessionMuscle.entries())
      .sort((a, b) => b[1].sets - a[1].sets)
      .map(([muscle, info]) => ({
        muscle,
        sets: info.sets,
        share: sessionSets ? info.sets / sessionSets : 0,
      }))
      .slice(0, 4);

    sessionSummaries.push({
      id: session.id,
      dateISO: session.dateISO,
      weekNumber: safeWeek(session),
      phaseNumber: safePhase(session),
      sets: sessionSets,
      volumeKg: sessionVolumeKg,
      durationHours: sessionDurationHours,
      topWeightKg: sessionTopWeightKg,
      topExerciseName: sessionTopExerciseName,
      muscleBreakdown: breakdown,
    });
  }

  const weekly = Array.from(weeklyMap.values())
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      weekNumber: entry.weekNumber,
      phaseNumber: entry.phaseNumber,
      sessions: entry.sessions,
      sets: entry.sets,
      volumeKg: entry.volumeKg,
      durationHours: entry.durationHours,
      avgVolumePerSessionKg: entry.sessions
        ? entry.volumeKg / entry.sessions
        : 0,
    }));

  const sessionSorted = sessionSummaries.sort(
    (a, b) => parseISO(b.dateISO).getTime() - parseISO(a.dateISO).getTime()
  );

  const weekOrderMap = new Map<string, number>();
  const weekLabelMap = new Map<string, string>();
  weekly.forEach((entry, index) => {
    weekOrderMap.set(entry.key, index);
    weekLabelMap.set(entry.key, entry.label);
  });

  const totalMuscleSets = Array.from(muscleMap.values()).reduce(
    (sum, info) => sum + info.sets,
    0
  );

  const muscles: MuscleSummary[] = Array.from(muscleMap.entries())
    .map(([muscle, info]) => {
      const timeline = Array.from(info.weekBuckets.entries())
        .map(([key, bucket]) => ({
          key,
          label: weekLabelMap.get(key) || key,
          sets: bucket.sets,
          tonnageKg: bucket.tonnageKg,
        }))
        .sort(
          (a, b) =>
            (weekOrderMap.get(a.key) ?? 0) - (weekOrderMap.get(b.key) ?? 0)
        );
      return {
        muscle,
        sets: info.sets,
        tonnageKg: info.tonnageKg,
        sessions: info.sessions.size,
        share: totalMuscleSets ? info.sets / totalMuscleSets : 0,
        timeline,
      };
    })
    .sort((a, b) => b.sets - a.sets);

  const exerciseAnalytics: Record<string, ExerciseAnalytics> = {};
  exerciseMap.forEach((value, key) => {
    value.timeline.sort(
      (a, b) => parseISO(a.dateISO).getTime() - parseISO(b.dateISO).getTime()
    );
    exerciseAnalytics[key] = value;
  });

  return {
    totals: {
      workouts: totalWorkouts,
      sets: totalSets,
      volumeKg: totalVolumeKg,
      durationHours: totalDurationHours,
    },
    weekly,
    sessions: sessionSorted,
    muscles,
    exerciseMap: exerciseAnalytics,
  };
}

type ModeKey = "overview" | "sessions" | "muscles" | "exercises";

const MODES: { key: ModeKey; label: string; icon: string }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: "M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9-9-4-9-9Zm9-6.5a1 1 0 0 0-1 1v4.09l-3.27 1.87a1 1 0 1 0 1 1.73l3.77-2.16A1 1 0 0 0 13 10V6.5a1 1 0 0 0-1-1Z",
  },
  {
    key: "sessions",
    label: "Sessions",
    icon: "M5 4h14v4H5V4Zm0 6h14v4H5v-4Zm0 6h14v4H5v-4Z",
  },
  {
    key: "muscles",
    label: "Muscles",
    icon: "M12 2 4 6v12l8 4 8-4V6l-8-4Zm0 2.3 5.5 3V8L12 11 6.5 8v-.7L12 4.3ZM6.5 10.2 11 13v6.2l-4.5-2.4v-6.6Zm6.5 8V13l4.5-2.8v6.6L13 18.2Z",
  },
  {
    key: "exercises",
    label: "Exercises",
    icon: "M4 4h16v4H4V4Zm0 6h10v4H4v-4Zm0 6h16v4H4v-4Z",
  },
];

export default function Analytics() {
  const [mode, setMode] = useState<ModeKey>("overview");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [RC, setRC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const navigate = useNavigate();

  const aggregates = useAggregates();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sessionsRaw, exercisesRaw, measurementsRaw, settingsRaw] =
          await Promise.all([
            getAllCached("sessions"),
            getAllCached("exercises"),
            getAllCached("measurements"),
            getSettings(),
          ]);
        if (cancelled) return;
        setSessions((sessionsRaw as Session[]) || []);
        const sortedExercises = ((exercisesRaw as Exercise[]) || []).sort(
          (a, b) => a.name.localeCompare(b.name)
        );
        setExercises(sortedExercises);
        setMeasurements((measurementsRaw as Measurement[]) || []);
        setSettingsState(settingsRaw || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    loadRecharts().then((mod) => {
      if (!cancelled) setRC(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const usesLb = (settings?.unit ?? "kg") === "lb";
  const weightMultiplier = usesLb ? KG_TO_LB : 1;
  const weightUnit = usesLb ? "lb" : "kg";
  const tonnageUnit = weightUnit;

  const analytics = useMemo(
    () => buildAnalytics(sessions, exercises),
    [sessions, exercises]
  );

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const restoreSearchFocus = useRef(false);

  const filteredExercises = useMemo(() => {
    const term = exerciseQuery.trim().toLowerCase();
    if (!term) return exercises;
    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(term)
    );
  }, [exerciseQuery, exercises]);

  const exerciseOptions = useMemo(() => {
    if (!selectedExerciseId) return filteredExercises;
    if (
      filteredExercises.some((exercise) => exercise.id === selectedExerciseId)
    ) {
      return filteredExercises;
    }
    const selected = exercises.find(
      (exercise) => exercise.id === selectedExerciseId
    );
    if (!selected) return filteredExercises;
    return [
      selected,
      ...filteredExercises.filter((exercise) => exercise.id !== selected.id),
    ];
  }, [filteredExercises, exercises, selectedExerciseId]);

  useEffect(() => {
    if (selectedExerciseId || !exerciseOptions.length) return;
    setSelectedExerciseId(exerciseOptions[0].id);
  }, [exerciseOptions, selectedExerciseId]);

  useEffect(() => {
    if (!restoreSearchFocus.current) return;
    const input = searchInputRef.current;
    restoreSearchFocus.current = false;
    if (!input || document.activeElement === input) return;
    input.focus({ preventScroll: true });
    const length = input.value.length;
    try {
      input.setSelectionRange(length, length);
    } catch {
      /* noop */
    }
  }, [exerciseQuery, exerciseOptions, selectedExerciseId]);

  useEffect(() => {
    if (!selectedExerciseId) {
      const firstWithHistory = Object.entries(analytics.exerciseMap).find(
        ([, value]) => value.timeline.length > 0
      );
      if (firstWithHistory) {
        setSelectedExerciseId(firstWithHistory[0]);
      } else if (exercises.length) {
        setSelectedExerciseId(exercises[0].id);
      }
    }
  }, [analytics.exerciseMap, exercises, selectedExerciseId]);

  useEffect(() => {
    if (!selectedMuscle && analytics.muscles.length) {
      setSelectedMuscle(analytics.muscles[0].muscle);
    }
  }, [analytics.muscles, selectedMuscle]);

  const weightSeries = useMemo(() => {
    return measurements
      .filter((m) => Number.isFinite(m.weightKg))
      .sort(
        (a, b) => parseISO(a.dateISO).getTime() - parseISO(b.dateISO).getTime()
      )
      .map((m) => ({
        date: format(parseISO(m.dateISO), "MMM d"),
        value: (m.weightKg || 0) * weightMultiplier,
      }));
  }, [measurements, weightMultiplier]);

  const weeklySeries = useMemo(
    () =>
      analytics.weekly.map((week) => ({
        key: week.key,
        label: week.label,
        volume: week.volumeKg * weightMultiplier,
        sessions: week.sessions,
        sets: week.sets,
        avg: week.avgVolumePerSessionKg * weightMultiplier,
      })),
    [analytics.weekly, weightMultiplier]
  );

  const prSeries = useMemo(() => {
    if (!aggregates.data) return weeklySeries.map((w) => ({ ...w, prs: 0 }));
    return weeklySeries.map((week) => ({
      ...week,
      prs: aggregates.data?.weeklyPRCounts[week.key] ?? 0,
    }));
  }, [aggregates.data, weeklySeries]);

  const exerciseAnalytics = selectedExerciseId
    ? analytics.exerciseMap[selectedExerciseId]
    : undefined;
  const exerciseTimeline = exerciseAnalytics?.timeline ?? [];

  const selectedMuscleData = selectedMuscle
    ? analytics.muscles.find((m) => m.muscle === selectedMuscle)
    : undefined;

  const chartSkeleton = (
    <div className="h-60 rounded-3xl bg-slate-800/40 animate-pulse flex items-center justify-center text-xs text-slate-400">
      Loading chart…
    </div>
  );

  const formatWeightValue = (kg: number) => {
    const value = kg * weightMultiplier;
    if (!Number.isFinite(value) || value <= 0) return `0 ${weightUnit}`;
    if (value >= 200) return `${Math.round(value)} ${weightUnit}`;
    if (value >= 20) return `${value.toFixed(1)} ${weightUnit}`;
    return `${value.toFixed(2)} ${weightUnit}`;
  };

  const formatVolumeValue = (kg: number) =>
    `${formatCompact(kg * weightMultiplier)} ${tonnageUnit}`;

  const OverviewSection = () => (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4 sm:grid-cols-2">
        {[
          {
            label: "Workouts",
            value: formatCount(analytics.totals.workouts),
            caption: "Logged",
          },
          {
            label: "Sets",
            value: formatCount(analytics.totals.sets),
            caption: "Tracked",
          },
          {
            label: "Volume",
            value: formatVolumeValue(analytics.totals.volumeKg),
            caption: "Lifetime",
          },
          {
            label: "Active Time",
            value: formatHours(analytics.totals.durationHours),
            caption: "Recorded",
          },
        ].map((metric) => (
          <GlassCard key={metric.label}>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">
                {metric.caption}
              </p>
              <div className="text-3xl font-semibold tracking-tight text-white">
                {metric.value}
              </div>
              <p className="text-sm text-white/60">{metric.label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Weekly Trends
              </p>
              <h3 className="text-lg font-semibold text-white">
                Volume &amp; Sessions
              </h3>
            </div>
            <span className="text-xs text-white/50">{tonnageUnit}</span>
          </div>
          <div className="h-64">
            {!RC && chartSkeleton}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.ComposedChart
                  data={weeklySeries}
                  margin={{ left: 8, right: 16, top: 10, bottom: 0 }}
                >
                  <RC.CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.2)"
                  />
                  <RC.XAxis
                    dataKey="label"
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    tickFormatter={(label: string) =>
                      label.replace("Phase", "P").replace("Week", "W")
                    }
                  />
                  <RC.YAxis
                    yAxisId="left"
                    stroke="rgba(94,234,212,0.7)"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => formatCompact(value)}
                  />
                  <RC.YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="rgba(139,92,246,0.6)"
                    tick={{ fontSize: 12 }}
                  />
                  <RC.Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "sessions" || name === "sets") {
                        return [formatCount(value as number), name];
                      }
                      return [
                        `${formatCompact(value as number)} ${tonnageUnit}`,
                        name,
                      ];
                    }}
                  />
                  <RC.Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="volume"
                    stroke="rgba(45,212,191,0.9)"
                    fill="rgba(20,184,166,0.25)"
                    strokeWidth={2.2}
                    name={`Volume (${tonnageUnit})`}
                  />
                  <RC.Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sessions"
                    stroke="rgba(139,92,246,0.85)"
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                    name="Sessions"
                  />
                  <RC.Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sets"
                    stroke="rgba(96,165,250,0.85)"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    dot={false}
                    name="Sets"
                  />
                </RC.ComposedChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Bodyweight
              </p>
              <h3 className="text-lg font-semibold text-white">
                Trend (last {weightSeries.length} entries)
              </h3>
            </div>
            <span className="text-xs text-white/50">{weightUnit}</span>
          </div>
          <div className="h-64">
            {!RC && chartSkeleton}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.AreaChart
                  data={weightSeries}
                  margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                >
                  <RC.Defs>
                    <linearGradient id="bwGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="rgba(59,130,246,0.7)"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor="rgba(59,130,246,0.1)"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </RC.Defs>
                  <RC.CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />
                  <RC.XAxis
                    dataKey="date"
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                  />
                  <RC.YAxis
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => value.toFixed(1)}
                  />
                  <RC.Tooltip
                    formatter={(value: number) =>
                      `${value.toFixed(1)} ${weightUnit}`
                    }
                  />
                  <RC.Area
                    type="monotone"
                    dataKey="value"
                    stroke="rgba(59,130,246,0.9)"
                    fill="url(#bwGradient)"
                    strokeWidth={2.2}
                  />
                </RC.AreaChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
              Personal Records
            </p>
            <h3 className="text-lg font-semibold text-white">
              Weekly highlights
            </h3>
          </div>
        </div>
        <div className="h-56">
          {!RC && chartSkeleton}
          {RC && (
            <RC.ResponsiveContainer>
              <RC.BarChart
                data={prSeries}
                margin={{ left: 8, right: 8, top: 10, bottom: 0 }}
              >
                <RC.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.15)"
                />
                <RC.XAxis
                  dataKey="label"
                  stroke="rgba(226,232,240,0.65)"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  tickFormatter={(label: string) =>
                    label.replace("Phase", "P").replace("Week", "W")
                  }
                />
                <RC.YAxis
                  stroke="rgba(226,232,240,0.65)"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <RC.Tooltip />
                <RC.Bar
                  dataKey="prs"
                  fill="rgba(16,185,129,0.8)"
                  radius={[6, 6, 0, 0]}
                />
              </RC.BarChart>
            </RC.ResponsiveContainer>
          )}
        </div>
      </GlassCard>
    </div>
  );

  const SessionsSection = () => (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Session Timeline
              </p>
              <h3 className="text-lg font-semibold text-white">
                Volume by Session
              </h3>
            </div>
            <span className="text-xs text-white/50">{tonnageUnit}</span>
          </div>
          <div className="h-72">
            {!RC && chartSkeleton}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.AreaChart
                  data={analytics.sessions
                    .slice()
                    .reverse()
                    .map((session) => ({
                      date: format(parseISO(session.dateISO), "MMM d"),
                      volume: session.volumeKg * weightMultiplier,
                      sets: session.sets,
                      topWeight: session.topWeightKg * weightMultiplier,
                    }))}
                  margin={{ left: 8, right: 16, top: 10, bottom: 0 }}
                >
                  <RC.CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />
                  <RC.XAxis
                    dataKey="date"
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                  />
                  <RC.YAxis
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => formatCompact(value)}
                  />
                  <RC.Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "sets")
                        return [formatCount(value as number), "Sets"];
                      if (name === "topWeight")
                        return [
                          `${(value as number).toFixed(1)} ${weightUnit}`,
                          "Top weight",
                        ];
                      return [
                        `${formatCompact(value as number)} ${tonnageUnit}`,
                        "Volume",
                      ];
                    }}
                  />
                  <RC.Area
                    type="monotone"
                    dataKey="volume"
                    stroke="rgba(239,68,68,0.85)"
                    fill="rgba(239,68,68,0.18)"
                    strokeWidth={2.4}
                  />
                  <RC.Line
                    type="monotone"
                    dataKey="topWeight"
                    stroke="rgba(59,130,246,0.85)"
                    strokeWidth={2.2}
                    dot={{ r: 2 }}
                  />
                </RC.AreaChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Snapshot
              </p>
              <h3 className="text-lg font-semibold text-white">
                Latest sessions
              </h3>
            </div>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
            {analytics.sessions.slice(0, 8).map((session) => (
              <div
                key={session.id}
                className="rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3"
              >
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span className="font-medium">
                    {format(parseISO(session.dateISO), "EEE • MMM d")}
                  </span>
                  <span className="text-xs text-white/50">
                    {session.phaseNumber
                      ? `P${session.phaseNumber} • W${session.weekNumber}`
                      : `Week ${session.weekNumber}`}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70">
                  <div>
                    <p className="uppercase tracking-[0.3em] text-white/40">
                      Volume
                    </p>
                    <p className="text-base font-semibold text-white">
                      {formatVolumeValue(session.volumeKg)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.3em] text-white/40">
                      Top weight
                    </p>
                    <p className="text-base font-semibold text-white">
                      {formatWeightValue(session.topWeightKg)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.3em] text-white/40">
                      Sets
                    </p>
                    <p className="text-base font-semibold text-white">
                      {formatCount(session.sets)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.3em] text-white/40">
                      Active time
                    </p>
                    <p className="text-base font-semibold text-white">
                      {formatHours(session.durationHours)}
                    </p>
                  </div>
                </div>
                {session.topExerciseName && (
                  <p className="mt-2 text-xs text-white/60">
                    Focus:{" "}
                    <span className="text-white/80">
                      {session.topExerciseName}
                    </span>
                  </p>
                )}
                {session.muscleBreakdown.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
                    {session.muscleBreakdown.map((item) => (
                      <span
                        key={item.muscle}
                        className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5"
                      >
                        <span className="capitalize">{item.muscle}</span>
                        <span className="text-white/40">
                          {(item.share * 100).toFixed(0)}%
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!analytics.sessions.length && (
              <p className="text-sm text-white/50">
                Log a workout to unlock session analytics.
              </p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );

  const MusclesSection = () => (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
              Muscle Focus
            </p>
            <h3 className="text-lg font-semibold text-white">
              Top recruitment (weighted sets)
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            {analytics.muscles.slice(0, 12).map((muscle) => (
              <button
                key={muscle.muscle}
                onClick={() => setSelectedMuscle(muscle.muscle)}
                className={`rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
                  selectedMuscle === muscle.muscle
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                    : "bg-white/5 text-white/70 border border-white/10 hover:border-white/20"
                }`}
              >
                <span className="block capitalize">{muscle.muscle}</span>
                <span className="block text-[11px] text-white/50">
                  {formatCount(Math.round(muscle.sets))} sets
                </span>
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Distribution
              </p>
              <h3 className="text-lg font-semibold text-white">
                Sets by muscle group
              </h3>
            </div>
            <span className="text-xs text-white/50">share</span>
          </div>
          <div className="h-72">
            {!RC && chartSkeleton}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.BarChart
                  data={analytics.muscles.slice(0, 10).map((muscle) => ({
                    muscle: muscle.muscle,
                    sets: muscle.sets,
                    share: (muscle.share * 100).toFixed(1),
                  }))}
                  layout="vertical"
                  margin={{ left: 16, right: 16, top: 10, bottom: 0 }}
                >
                  <RC.CartesianGrid
                    horizontal={false}
                    stroke="rgba(148,163,184,0.12)"
                  />
                  <RC.XAxis type="number" hide domain={[0, "dataMax"]} />
                  <RC.YAxis
                    type="category"
                    dataKey="muscle"
                    tickFormatter={(value: string) => value.replace(/_/g, " ")}
                    stroke="rgba(226,232,240,0.7)"
                    tick={{ fontSize: 12 }}
                  />
                  <RC.Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "sets")
                        return [formatCount(value as number), "Sets"];
                      return [`${value}%`, "Share"];
                    }}
                  />
                  <RC.Bar
                    dataKey="sets"
                    fill="rgba(34,197,94,0.8)"
                    radius={[0, 6, 6, 0]}
                  />
                </RC.BarChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Focus timeline
              </p>
              <h3 className="text-lg font-semibold text-white">
                {selectedMuscleData
                  ? selectedMuscleData.muscle
                  : "Select a muscle"}
              </h3>
            </div>
            {selectedMuscleData && (
              <span className="text-xs text-white/50">
                {formatCount(Math.round(selectedMuscleData.sets))} sets •{" "}
                {formatVolumeValue(selectedMuscleData.tonnageKg)}
              </span>
            )}
          </div>
          <div className="h-72">
            {!RC && chartSkeleton}
            {RC && selectedMuscleData && selectedMuscleData.timeline.length ? (
              <RC.ResponsiveContainer>
                <RC.AreaChart
                  data={selectedMuscleData.timeline}
                  margin={{ left: 8, right: 16, top: 10, bottom: 0 }}
                >
                  <RC.CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />
                  <RC.XAxis
                    dataKey="label"
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                  />
                  <RC.YAxis
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => formatCount(value)}
                  />
                  <RC.Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "sets")
                        return [formatCount(value as number), "Sets"];
                      return [formatVolumeValue(value as number), "Volume"];
                    }}
                  />
                  <RC.Area
                    type="monotone"
                    dataKey="sets"
                    stroke="rgba(236,72,153,0.85)"
                    fill="rgba(236,72,153,0.25)"
                    strokeWidth={2.4}
                  />
                  <RC.Line
                    type="monotone"
                    dataKey="tonnageKg"
                    stroke="rgba(244,114,182,0.9)"
                    strokeWidth={2.2}
                    dot={{ r: 2 }}
                    name="Volume"
                  />
                </RC.AreaChart>
              </RC.ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/50">
                {selectedMuscle
                  ? "No data for this muscle yet."
                  : "Select a muscle to explore its timeline."}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );

  const ExercisesSection = () => (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Exercise analytics
              </p>
              <h3 className="text-lg font-semibold text-white">
                Choose an exercise to deep dive
              </h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative w-full sm:w-52">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 1 0 3.473 9.8l3.113 3.114a.75.75 0 1 0 1.06-1.06l-3.113-3.115A5.5 5.5 0 0 0 9 3.5Zm-4 5.5a4 4 0 1 1 7.999.002A4 4 0 0 1 5 9Z"
                    clipRule="evenodd"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  value={exerciseQuery}
                  onChange={(event) => {
                    restoreSearchFocus.current = true;
                    setExerciseQuery(event.target.value);
                  }}
                  onFocus={() => {
                    restoreSearchFocus.current = false;
                  }}
                  onBlur={() => {
                    restoreSearchFocus.current = false;
                  }}
                  placeholder="Search exercises"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 py-2 pl-9 pr-9 text-sm text-white/80 placeholder:text-white/40 focus:outline-none focus-visible:ring focus-visible:ring-emerald-400/60"
                  type="search"
                  spellCheck={false}
                />
                {exerciseQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      restoreSearchFocus.current = true;
                      setExerciseQuery("");
                    }}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition hover:text-white/80"
                    aria-label="Clear exercise search"
                  >
                    ×
                  </button>
                )}
              </div>
              <select
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white/80 focus:outline-none focus-visible:ring focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:text-white/30"
                value={exerciseOptions.length ? selectedExerciseId : ""}
                onChange={(event) => setSelectedExerciseId(event.target.value)}
                disabled={!exerciseOptions.length}
              >
                {exerciseOptions.length ? (
                  exerciseOptions.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No exercises found
                  </option>
                )}
              </select>
            </div>
          </div>
          {exerciseQuery && !filteredExercises.length && (
            <p className="text-xs text-rose-200/70">
              No exercises match “{exerciseQuery}”. Try a different term.
            </p>
          )}
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Performance curve
              </p>
              <h3 className="text-lg font-semibold text-white">
                {exerciseAnalytics?.exercise.name || "Select an exercise"}
              </h3>
            </div>
            {exerciseAnalytics && (
              <span className="text-xs text-white/50">
                Best: {formatWeightValue(exerciseAnalytics.maxTopWeightKg)}
              </span>
            )}
          </div>
          <div className="h-72">
            {!RC && chartSkeleton}
            {RC && exerciseTimeline.length ? (
              <RC.ResponsiveContainer>
                <RC.ComposedChart
                  data={exerciseTimeline.map((entry) => ({
                    date: format(parseISO(entry.dateISO), "MMM d"),
                    volume: entry.volumeKg * weightMultiplier,
                    topWeight: entry.topWeightKg * weightMultiplier,
                    avgWeight: entry.avgWeightKg * weightMultiplier,
                    sets: entry.sets,
                  }))}
                  margin={{ left: 8, right: 16, top: 10, bottom: 0 }}
                >
                  <RC.CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />
                  <RC.XAxis
                    dataKey="date"
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                  />
                  <RC.YAxis
                    yAxisId="left"
                    stroke="rgba(226,232,240,0.65)"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => formatCompact(value)}
                  />
                  <RC.YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="rgba(59,130,246,0.7)"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => value.toFixed(0)}
                  />
                  <RC.Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "sets")
                        return [formatCount(value as number), "Sets"];
                      if (name === "topWeight" || name === "avgWeight")
                        return [
                          `${(value as number).toFixed(1)} ${weightUnit}`,
                          name === "topWeight" ? "Top" : "Avg",
                        ];
                      return [
                        `${formatCompact(value as number)} ${tonnageUnit}`,
                        "Volume",
                      ];
                    }}
                  />
                  <RC.Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="volume"
                    stroke="rgba(248,113,113,0.9)"
                    fill="rgba(248,113,113,0.2)"
                    strokeWidth={2.4}
                    name={`Volume (${tonnageUnit})`}
                  />
                  <RC.Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="topWeight"
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth={2.4}
                    dot={{ r: 2 }}
                    name={`Top (${weightUnit})`}
                  />
                  <RC.Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgWeight"
                    stroke="rgba(96,165,250,0.8)"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    dot={false}
                    name={`Avg (${weightUnit})`}
                  />
                </RC.ComposedChart>
              </RC.ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/50">
                Select an exercise with logged sets to view progress.
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                Session log
              </p>
              <h3 className="text-lg font-semibold text-white">
                Most recent workouts
              </h3>
            </div>
            {exerciseAnalytics && (
              <span className="text-xs text-white/50">
                {formatCount(exerciseAnalytics.totals.sessions)} sessions
                tracked
              </span>
            )}
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
            {exerciseTimeline
              .slice()
              .sort(
                (a, b) =>
                  parseISO(b.dateISO).getTime() - parseISO(a.dateISO).getTime()
              )
              .slice(0, 6)
              .map((entry) => (
                <div
                  key={entry.sessionId + entry.dateISO}
                  className="rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3"
                >
                  <div className="flex items-center justify-between text-sm text-white/80">
                    <span className="font-medium">
                      {format(parseISO(entry.dateISO), "EEE • MMM d")}
                    </span>
                    <span className="text-xs text-white/50">
                      {entry.phaseNumber
                        ? `P${entry.phaseNumber} • W${entry.weekNumber}`
                        : `Week ${entry.weekNumber}`}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70">
                    <div>
                      <p className="uppercase tracking-[0.3em] text-white/40">
                        Volume
                      </p>
                      <p className="text-base font-semibold text-white">
                        {formatVolumeValue(entry.volumeKg)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.3em] text-white/40">
                        Top weight
                      </p>
                      <p className="text-base font-semibold text-white">
                        {formatWeightValue(entry.topWeightKg)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {entry.setDetails.map((set, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs text-white/60"
                      >
                        <span className="text-white/40">Set {idx + 1}</span>
                        <span className="tabular-nums text-white/80">
                          {formatCount(set.reps)} reps @{" "}
                          {formatWeightValue(set.weightKg)}
                          {set.rpe != null && (
                            <span className="text-white/40">
                              {" "}
                              • RPE {set.rpe}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {!exerciseTimeline.length && (
              <p className="text-sm text-white/50">
                No logged sets yet for this exercise.
              </p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-24">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-white/50">
              Insights
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Analytics Studio
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Explore weekly momentum, session quality, muscle balance, and
              exercise-specific trends with interactive visuals.
            </p>
          </div>
        </div>
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 p-1 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.55)]">
          {MODES.map((item) => (
            <button
              key={item.key}
              onClick={() => setMode(item.key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                mode === item.key
                  ? "bg-emerald-500/20 text-emerald-200 shadow-inner shadow-emerald-500/30"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <svg
                aria-hidden
                className={`h-4 w-4 ${
                  mode === item.key ? "fill-emerald-300" : "fill-white/50"
                }`}
                viewBox="0 0 24 24"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate("/measurements")}
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              aria-hidden
              className="h-4 w-4 fill-white/50"
              viewBox="0 0 24 24"
            >
              <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14v-2H5V5h14V3H5Zm6 4c-1.1 0-2 .9-2 2v2h2v-2h2v2h2V9c0-1.1-.9-2-2-2h-2Zm-4 6h12v2H7v-2Zm0 4h8v2H7v-2Z" />
            </svg>
            Measurements
          </button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, idx) => (
            <div
              key={idx}
              className="h-60 rounded-3xl bg-slate-900/40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {mode === "overview" && <OverviewSection />}
          {mode === "sessions" && <SessionsSection />}
          {mode === "muscles" && <MusclesSection />}
          {mode === "exercises" && <ExercisesSection />}
        </>
      )}
    </div>
  );
}
