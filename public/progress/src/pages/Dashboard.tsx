import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { volumeByMuscleGroup } from "../lib/helpers";
import { getMuscleIconPath } from "../lib/muscles";
import { loadRecharts } from "../lib/loadRecharts";
import { getAllCached } from "../lib/dataCache";
import {
  Measurement,
  Session,
  Settings,
  Exercise,
  UserProgram,
} from "../lib/types";
import { getProfileProgram } from "../lib/profile";
import UnifiedTooltip from "../components/UnifiedTooltip";
// Recharts is lazy loaded; see RC state
import DashboardDeloadTable from "./DashboardDeloadTable";
import ProgressBars from "../components/ProgressBars";

// Lightweight animated number hook respecting reduced motion
function useAnimatedNumber(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (
      document.documentElement.getAttribute("data-reduced-motion") === "true"
    ) {
      setDisplay(value);
      return;
    }
    let start: number | undefined;
    const from = display;
    const diff = value - from;
    if (diff === 0) return;
    const d = Math.max(200, duration);
    function step(ts: number) {
      if (start == null) start = ts;
      const t = (ts - start) / d;
      const eased = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
      setDisplay(from + diff * eased);
      if (t < 1) requestAnimationFrame(step);
      else setDisplay(value);
    }
    const r = requestAnimationFrame(step);
    return () => cancelAnimationFrame(r);
  }, [value]);
  return Math.round(display * 100) / 100;
}

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function computeSessionDurationMs(session: Session): number | null {
  const log = session.workLog;
  if (log && Object.keys(log).length) {
    const entries = Object.entries(log).sort((a, b) => {
      const countA = a[1]?.count || 0;
      const countB = b[1]?.count || 0;
      if (countB !== countA) return countB - countA;
      const spanA =
        new Date(a[1]?.last || 0).getTime() -
        new Date(a[1]?.first || 0).getTime();
      const spanB =
        new Date(b[1]?.last || 0).getTime() -
        new Date(b[1]?.first || 0).getTime();
      return spanB - spanA;
    });
    const top = entries[0]?.[1];
    if (top?.first && top?.last) {
      const start = new Date(top.first).getTime();
      const end = new Date(top.last).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        const ms = Math.max(0, Math.min(end - start, 1000 * 60 * 60 * 12));
        return ms;
      }
    }
  }
  if (session.loggedStartAt && session.loggedEndAt) {
    const start = new Date(session.loggedStartAt).getTime();
    const end = new Date(session.loggedEndAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return Math.max(0, Math.min(end - start, 1000 * 60 * 60 * 12));
    }
  }
  return null;
}

function formatHours(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0h";
  if (value >= 100) return `${Math.round(value)}h`;
  if (value >= 10) return `${value.toFixed(1)}h`;
  if (value >= 1) return `${value.toFixed(1)}h`;
  const minutes = Math.round(value * 60);
  return `${minutes}m`;
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const formatted = COMPACT_FORMATTER.format(value);
  return formatted.replace(/\.0([A-Za-z])/, "$1").replace(/\.0$/, "");
}

export default function Dashboard() {
  const [week, setWeek] = useState(1);
  const [volume, setVolume] = useState<
    Record<string, { tonnage: number; sets: number }>
  >({});
  const [weights, setWeights] = useState<{ date: string; weight: number }[]>(
    []
  );
  const [waist, setWaist] = useState<{ date: string; value: number }[]>([]);
  const [arm, setArm] = useState<{ date: string; value: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [targetDays, setTargetDays] = useState(6);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [weeklyRecap, setWeeklyRecap] = useState<{
    volume: number;
    prCount: number;
    bodyDelta?: number;
    adherence: number;
  } | null>(null);
  // Analytics
  const [volumeTrend, setVolumeTrend] = useState<any[]>([]); // per week aggregated sets per muscle
  const [intensityDist, setIntensityDist] = useState<
    { bucket: string; sets: number }[]
  >([]);
  const [plateaus, setPlateaus] = useState<
    { exercise: string; changePct: number }[]
  >([]);
  const [undertrained, setUndertrained] = useState<
    { muscle: string; avgSets: number }[]
  >([]);
  const [phaseFilter, setPhaseFilter] = useState<"recent" | "all" | number>(
    "recent"
  );
  const [availablePhases, setAvailablePhases] = useState<number[]>([]);
  const [activePhaseWindow, setActivePhaseWindow] = useState<number[]>([]);
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
  const [tonnageUnit, setTonnageUnit] = useState<"kg" | "lb">("kg");
  const [RC, setRC] = useState<any | null>(null);
  useEffect(() => {
    loadRecharts().then((m) => setRC(m));
  }, []);

  const phaseFilterOptions = useMemo(() => {
    const sorted = [...availablePhases].sort((a, b) => b - a);
    const opts: { value: string; label: string }[] = [];
    if (sorted.length > 2) {
      opts.push({ value: "all", label: "All phases" });
    }
    if (sorted.length > 1) {
      opts.push({ value: "recent", label: "Last 2 phases" });
    }
    sorted.forEach((phase) => {
      opts.push({ value: String(phase), label: `Phase ${phase}` });
    });
    if (!opts.length) {
      opts.push({ value: "recent", label: "Last 2 phases" });
    }
    return opts;
  }, [availablePhases]);

  const phaseFilterValue =
    typeof phaseFilter === "number" ? String(phaseFilter) : phaseFilter;

  const activePhaseLabel = useMemo(() => {
    if (phaseFilter === "all") return "Showing all phases";
    if (!activePhaseWindow.length) return "";
    const sorted = [...activePhaseWindow].sort((a, b) => a - b);
    if (sorted.length === 1) return `Showing phase ${sorted[0]}`;
    return `Showing phases ${sorted.join(", ")}`;
  }, [activePhaseWindow, phaseFilter]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!availablePhases.length) return;
    if (
      availablePhases.length === 1 &&
      (phaseFilter === "recent" || phaseFilter === "all")
    ) {
      setPhaseFilter(availablePhases[0]);
      return;
    }
    if (
      typeof phaseFilter === "number" &&
      !availablePhases.includes(phaseFilter)
    ) {
      setPhaseFilter(
        availablePhases.length > 1
          ? "recent"
          : availablePhases[availablePhases.length - 1]
      );
    }
  }, [availablePhases, phaseFilter]);

  const loadDashboard = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force ?? false;
      try {
        const [sessions, exercises, measurements, settingsList, programMaybe] =
          await Promise.all([
            getAllCached<Session>("sessions", { swr: true, force }),
            getAllCached<Exercise>("exercises", { swr: true, force }),
            getAllCached<Measurement>("measurements", { swr: true, force }),
            getAllCached<Settings>("settings", { swr: true, force }),
            getProfileProgram().catch(() => undefined),
          ]);

        if (!isMountedRef.current) return;

        const phaseOf = (s: Session) =>
          ((s.phaseNumber ?? s.phase ?? 1) as number) || 1;
        const phaseNumbers = Array.from(new Set(sessions.map(phaseOf)))
          .filter((p) => Number.isFinite(p))
          .sort((a, b) => a - b);
        setAvailablePhases(phaseNumbers);

        let effectivePhases: number[] = [];
        if (phaseFilter === "all") {
          effectivePhases = phaseNumbers;
        } else if (phaseFilter === "recent") {
          effectivePhases = phaseNumbers.slice(-2);
        } else if (
          typeof phaseFilter === "number" &&
          phaseNumbers.includes(phaseFilter)
        ) {
          effectivePhases = [phaseFilter];
        }
        if (!effectivePhases.length && phaseNumbers.length) {
          const fallback = phaseNumbers.slice(
            -Math.min(phaseNumbers.length, 2)
          );
          effectivePhases = fallback.length
            ? fallback
            : [phaseNumbers[phaseNumbers.length - 1]];
        }
        if (!phaseNumbers.length) {
          effectivePhases = [];
        }
        setActivePhaseWindow(
          phaseFilter === "all" ? phaseNumbers : effectivePhases
        );

        const sessionsForAnalytics =
          effectivePhases.length && phaseNumbers.length
            ? sessions.filter((s) => effectivePhases.includes(phaseOf(s)))
            : sessions;

        const volumeResult = await volumeByMuscleGroup(
          week,
          {
            sessions,
            exercises,
          },
          { phases: effectivePhases }
        );
        if (!isMountedRef.current) return;
        setVolume(volumeResult);

        const weightSeries = measurements
          .filter((x) => x.weightKg)
          .map((x) => ({ date: x.dateISO.slice(5), weight: x.weightKg! }));
        const waistSeries = measurements
          .filter((x) => x.waist)
          .map((x) => ({ date: x.dateISO.slice(5), value: x.waist! }));
        const armSeries = measurements
          .filter((x) => x.upperArm)
          .map((x) => ({ date: x.dateISO.slice(5), value: x.upperArm! }));

        setWeights(weightSeries);
        setWaist(waistSeries);
        setArm(armSeries);

        const today = new Date();
        const dayKey = (d: Date) => d.toISOString().slice(0, 10);
        const sessionDays = new Set<string>();
        sessions.forEach((s) => {
          if (
            s.entries.some((e) =>
              e.sets.some((st) => (st.reps || 0) > 0 || (st.weightKg || 0) > 0)
            )
          ) {
            sessionDays.add(s.dateISO.slice(0, 10));
          }
        });

        let curStreak = 0;
        const cursor = new Date(today);
        while (sessionDays.has(dayKey(cursor))) {
          curStreak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        setStreak(curStreak);

        const settingsApp =
          settingsList.find((item: any) => (item as any).id === "app") || null;
        const program = (programMaybe as UserProgram | undefined) || undefined;
        const nonRest = program
          ? program.weeklySplit.filter((d) => d.type !== "Rest").length
          : undefined;
        const userTargetDays =
          nonRest || settingsApp?.progress?.weeklyTargetDays || 6;
        setTargetDays(userTargetDays);

        const usesLb = (settingsApp?.unit ?? "kg") === "lb";
        setTonnageUnit(usesLb ? "lb" : "kg");
        const tonnageMultiplier = usesLb ? 2.2046226218 : 1;

        const trackedWeekPref =
          settingsApp?.dashboardPrefs?.lastLocation?.weekNumber ?? null;
        const trackedPhasePref =
          settingsApp?.dashboardPrefs?.lastLocation?.phaseNumber ?? null;
        const fallbackPhase =
          phaseNumbers.length > 0
            ? phaseNumbers[phaseNumbers.length - 1]
            : null;
        const trackedWeek = trackedWeekPref ?? week ?? null;
        const trackedPhase = trackedPhasePref ?? fallbackPhase;

        const lifetimeAgg = {
          workouts: 0,
          sets: 0,
          volume: 0,
          durationMs: 0,
        };
        const weeklyAgg = {
          workouts: 0,
          sets: 0,
          volume: 0,
          durationMs: 0,
        };

        let totalSets = 0;
        let prCount = 0;
        const byEx: Record<string, number> = {};

        for (const session of sessions) {
          if (session.deletedAt) continue;
          let sessionSets = 0;
          let sessionVolume = 0;
          let hasValidWork = false;

          for (const entry of session.entries) {
            for (const st of entry.sets) {
              const reps = Math.max(0, st.reps || 0);
              const weight = Math.max(0, st.weightKg || 0);
              const hasEffort = reps > 0 || weight > 0;
              if (!hasEffort) continue;

              totalSets += 1;
              hasValidWork = true;
              sessionSets += 1;

              if (reps > 0 && weight > 0) {
                const score = weight * reps;
                sessionVolume += score;
                if (score > (byEx[entry.exerciseId] || 0)) {
                  byEx[entry.exerciseId] = score;
                  prCount += 1;
                }
              }
            }
          }

          if (!hasValidWork) continue;

          const durationMs = computeSessionDurationMs(session) || 0;

          lifetimeAgg.workouts += 1;
          lifetimeAgg.sets += sessionSets;
          lifetimeAgg.volume += sessionVolume;
          lifetimeAgg.durationMs += durationMs;

          if (
            trackedWeek != null &&
            session.weekNumber === trackedWeek &&
            (trackedPhase == null ||
              (session.phaseNumber ?? session.phase ?? trackedPhase) ===
                trackedPhase)
          ) {
            weeklyAgg.workouts += 1;
            weeklyAgg.sets += sessionSets;
            weeklyAgg.volume += sessionVolume;
            weeklyAgg.durationMs += durationMs;
          }
        }

        setLifetimeStats({
          workouts: lifetimeAgg.workouts,
          sets: lifetimeAgg.sets,
          hours: lifetimeAgg.durationMs / (1000 * 60 * 60),
          tonnage: lifetimeAgg.volume * tonnageMultiplier,
        });

        setWeeklyStats({
          workouts: weeklyAgg.workouts,
          sets: weeklyAgg.sets,
          hours: weeklyAgg.durationMs / (1000 * 60 * 60),
          tonnage: weeklyAgg.volume * tonnageMultiplier,
          weekNumber: trackedWeek,
          phaseNumber: trackedPhase,
        });

        const earnedXp = totalSets * 5 + prCount * 20;
        setXp(earnedXp);
        setLevel(Math.max(1, Math.floor(Math.sqrt(earnedXp) / 3) + 1));

        const achievementsNext: string[] = [];
        if (curStreak >= 7) achievementsNext.push("7 Day Streak");
        if (curStreak >= 21) achievementsNext.push("21 Day Streak");
        if (prCount >= 10) achievementsNext.push("10 PRs");
        if (totalSets >= 400) achievementsNext.push("Volume Grinder");
        setAchievements(achievementsNext);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 6);
        let weekVolume = 0;
        sessions
          .filter((s) => new Date(s.dateISO) >= weekAgo)
          .forEach((s) => {
            s.entries.forEach((e) =>
              e.sets.forEach((st) => {
                weekVolume += (st.weightKg || 0) * (st.reps || 0);
              })
            );
          });
        const weekPR = prCount;

        const windowLen = program ? program.weeklySplit.length : 7;
        const loggedInWindow = Array.from({ length: windowLen }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return sessionDays.has(dayKey(d));
        }).filter(Boolean).length;
        const adherence = (loggedInWindow / (userTargetDays || 6)) * 100;

        const bwLast7 = measurements
          .filter((x) => new Date(x.dateISO) >= weekAgo)
          .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        let bodyDelta: number | undefined = undefined;
        if (bwLast7.length >= 2) {
          bodyDelta =
            (bwLast7[bwLast7.length - 1].weightKg || 0) -
            (bwLast7[0].weightKg || 0);
        }

        setWeeklyRecap({
          volume: weekVolume,
          prCount: weekPR,
          bodyDelta,
          adherence,
        });

        setVolumeTrend([]);
        setIntensityDist([]);
        setPlateaus([]);
        setUndertrained([]);

        try {
          const worker = new Worker(
            new URL("../workers/analyticsWorker.ts", import.meta.url),
            { type: "module" }
          );
          worker.onmessage = (evt) => {
            const {
              volumeTrend,
              intensityDist,
              plateaus,
              undertrained,
              error,
            } = evt.data || {};
            if (error) {
              console.warn("[AnalyticsWorker] error", error);
              worker.terminate();
              return;
            }
            if (!isMountedRef.current) {
              worker.terminate();
              return;
            }
            if (volumeTrend) setVolumeTrend(volumeTrend);
            if (intensityDist) setIntensityDist(intensityDist);
            if (plateaus) setPlateaus(plateaus);
            if (undertrained) setUndertrained(undertrained);
            worker.terminate();
          };
          worker.postMessage({ sessions: sessionsForAnalytics, exercises });
        } catch (err) {
          console.warn("[Dashboard] worker fallback", err);
        }
      } catch (err) {
        console.warn("[Dashboard] failed to load dashboard data", err);
      }
    },
    [week, phaseFilter]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onChange = (evt: any) => {
      const tbl = evt?.detail?.table as string | undefined;
      if (
        tbl &&
        ["sessions", "exercises", "measurements", "settings"].includes(tbl)
      ) {
        loadDashboard({ force: true });
      }
    };
    const onAuth = () => loadDashboard({ force: true });
    window.addEventListener("sb-change", onChange);
    window.addEventListener("sb-auth", onAuth as any);
    return () => {
      window.removeEventListener("sb-change", onChange);
      window.removeEventListener("sb-auth", onAuth as any);
    };
  }, [loadDashboard]);

  const volData = useMemo(
    () =>
      Object.entries(volume).map(([k, v]) => ({
        group: k,
        tonnage: v.tonnage,
        sets: v.sets,
      })),
    [volume]
  );

  // Build min/max metadata for line series
  const weightMinMax = useMemo(() => {
    if (!weights.length) return undefined;
    const vals = weights.map((w) => w.weight);
    return { weight: { min: Math.min(...vals), max: Math.max(...vals) } };
  }, [weights]);
  const waistMinMax = useMemo(() => {
    if (!waist.length) return undefined;
    const vals = waist.map((w) => w.value);
    return { value: { min: Math.min(...vals), max: Math.max(...vals) } };
  }, [waist]);
  const armMinMax = useMemo(() => {
    if (!arm.length) return undefined;
    const vals = arm.map((w) => w.value);
    return { value: { min: Math.min(...vals), max: Math.max(...vals) } };
  }, [arm]);
  const volumeTrendMinMax = useMemo(() => {
    if (!volumeTrend.length) return undefined;
    const out: Record<string, { min: number; max: number }> = {};
    volumeTrend.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k === "week") return;
        const v = row[k];
        if (typeof v !== "number" || isNaN(v)) return;
        if (!out[k]) out[k] = { min: v, max: v };
        else {
          if (v < out[k].min) out[k].min = v;
          if (v > out[k].max) out[k].max = v;
        }
      });
    });
    return out;
  }, [volumeTrend]);
  const prevPoint = (
    series: string,
    label: any,
    rows: any[],
    keyField: string
  ) => {
    const idx = rows.findIndex((r) => r[keyField] === label);
    if (idx > 0) {
      const prev = rows[idx - 1];
      return prev?.[series];
    }
    return undefined;
  };

  const animXp = useAnimatedNumber(xp);
  const animWeekVol = useAnimatedNumber(weeklyRecap?.volume || 0);
  const animPR = useAnimatedNumber(weeklyRecap?.prCount || 0);
  const animAdh = useAnimatedNumber(weeklyRecap?.adherence || 0);
  const formatCount = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value >= 1000) return formatCompact(value);
    return Math.round(value).toLocaleString();
  };

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

  return (
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
      <ProgressBars />
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <select
          className="bg-card rounded-xl px-3 py-2"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
        >
          {Array.from({ length: 9 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2 flex items-center justify-between">
            Streak & XP{" "}
            <span className="text-xs text-gray-400">Lvl {level}</span>
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Current streak</span>
              <span className="font-medium">{streak}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Target / week</span>
              <span>{targetDays}d</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                XP
              </div>
              <div className="h-3 bg-slate-700/50 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (xp % 1000) / 10)}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-500 mt-1 tabular-nums">
                {animXp.toFixed(0)} XP
              </div>
            </div>
            {achievements.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                  Achievements
                </div>
                <div className="flex flex-wrap gap-1">
                  {achievements.map((a) => (
                    <span key={a} className="badge" data-variant="info">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Weekly Recap</h3>
          {weeklyRecap ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  Volume
                </div>
                <div className="font-semibold tabular-nums">
                  {Math.round(animWeekVol)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  PRs
                </div>
                <div className="font-semibold tabular-nums">
                  {Math.round(animPR)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  BW Δ
                </div>
                <div className="font-semibold tabular-nums">
                  {weeklyRecap.bodyDelta?.toFixed(1) ?? "—"} kg
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  Adherence
                </div>
                <div className="font-semibold tabular-nums">
                  {Math.round(animAdh)}%
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              Need more data for recap.
            </div>
          )}
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Weekly Volume by Muscle Group</h3>
          <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
            {volData.map((v) => (
              <span
                key={v.group}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5"
              >
                <img
                  src={getMuscleIconPath(v.group)}
                  alt={v.group}
                  className="w-4 h-4 opacity-80"
                  loading="lazy"
                />
                <span className="capitalize">{v.group}</span>
                <span className="tabular-nums text-xs opacity-70">
                  {v.sets} sets
                </span>
              </span>
            ))}
          </div>
          <div className="h-56">
            {!RC && (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading…
              </div>
            )}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.BarChart data={volData}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="group" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip
                    content={({ active, payload, label }: any) => (
                      <UnifiedTooltip
                        active={active}
                        payload={payload}
                        label={label}
                        context={{
                          seriesMinMax: weightMinMax,
                          previousPointLookup: (s, l) =>
                            prevPoint(s, l, weights, "date"),
                        }}
                      />
                    )}
                  />
                  <RC.Bar dataKey="tonnage" fill="#3b82f6" name="Tonnage" />
                  <RC.Bar dataKey="sets" fill="#f59e0b" name="Sets" />
                </RC.BarChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Bodyweight (kg)</h3>
          <div className="h-56">
            {!RC && (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading…
              </div>
            )}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={weights}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="date" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip
                    content={({ active, payload, label }: any) => (
                      <UnifiedTooltip
                        active={active}
                        payload={payload}
                        label={label}
                        context={{
                          seriesMinMax: waistMinMax,
                          previousPointLookup: (s, l) =>
                            prevPoint(s, l, waist, "date"),
                        }}
                      />
                    )}
                  />
                  <RC.Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#3b82f6"
                    dot={false}
                  />
                  {/* PR marker (max weight) */}
                  {weights.length > 1 &&
                    (() => {
                      const max = Math.max(...weights.map((w) => w.weight));
                      const idx = weights.findIndex((w) => w.weight === max);
                      if (idx >= 0) {
                        const pt = weights[idx];
                        return (
                          <RC.Scatter
                            data={[pt]}
                            shape={(props: any) => (
                              <rect
                                x={props.cx - 3}
                                y={props.cy - 3}
                                width={6}
                                height={6}
                                className="pr-marker"
                              />
                            )}
                          />
                        );
                      }
                      return null;
                    })()}
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Waist (cm)</h3>
          <div className="h-56">
            {!RC && (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading…
              </div>
            )}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={waist}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="date" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip
                    content={({ active, payload, label }: any) => (
                      <UnifiedTooltip
                        active={active}
                        payload={payload}
                        label={label}
                        context={{
                          seriesMinMax: armMinMax,
                          previousPointLookup: (s, l) =>
                            prevPoint(s, l, arm, "date"),
                        }}
                      />
                    )}
                  />
                  <RC.Line
                    type="monotone"
                    dataKey="value"
                    stroke="#ef4444"
                    dot={false}
                  />
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Upper Arm (cm)</h3>
          <div className="h-56">
            {!RC && (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading…
              </div>
            )}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={arm}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="date" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip
                    content={({ active, payload, label }: any) => (
                      <UnifiedTooltip
                        active={active}
                        payload={payload}
                        label={label}
                        context={{
                          seriesMinMax: volumeTrendMinMax,
                          previousPointLookup: (s, l) =>
                            prevPoint(s, l, volumeTrend, "week"),
                        }}
                      />
                    )}
                  />
                  <RC.Line
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    dot={false}
                  />
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <DashboardDeloadTable />

      {/* Analytics & Insights */}
      <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft xl:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <h3 className="font-medium flex items-center gap-2">
              <span>Muscle Volume Trend</span>
              <span className="text-[10px] text-gray-500">
                Sets / completed
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {activePhaseLabel && (
                <span className="text-[11px] text-gray-400 hidden sm:inline">
                  {activePhaseLabel}
                </span>
              )}
              {phaseFilterOptions.length > 1 && (
                <select
                  aria-label="Select phase window"
                  className="bg-slate-800/80 border border-white/10 rounded-xl px-2 py-1 text-xs text-slate-200"
                  value={phaseFilterValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPhaseFilter(
                      next === "recent"
                        ? "recent"
                        : next === "all"
                        ? "all"
                        : Number(next)
                    );
                  }}
                >
                  {phaseFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {activePhaseLabel && (
            <div className="text-[10px] text-gray-500 sm:hidden mb-2">
              {activePhaseLabel}
            </div>
          )}
          <div className="h-64">
            {!RC && (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading…
              </div>
            )}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.LineChart data={volumeTrend}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="week" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip
                    content={({ active, payload, label }: any) => (
                      <UnifiedTooltip
                        active={active}
                        payload={payload}
                        label={label}
                      />
                    )}
                  />
                  <RC.Legend />
                  {[
                    "chest",
                    "back",
                    "legs",
                    "shoulders",
                    "arms",
                    "core",
                    "glutes",
                  ]
                    .filter((m) => volumeTrend.some((r) => r[m]))
                    .map((m, i) => {
                      const palette = [
                        "#f87171",
                        "#60a5fa",
                        "#34d399",
                        "#fbbf24",
                        "#c084fc",
                        "#f472b6",
                        "#a3e635",
                      ];
                      const icon = getMuscleIconPath(m);
                      return (
                        <RC.Line
                          key={m}
                          type="monotone"
                          dataKey={m}
                          name={m}
                          stroke={palette[i % palette.length]}
                          dot={false}
                          legendType="circle"
                        />
                      );
                    })}
                </RC.LineChart>
              </RC.ResponsiveContainer>
            )}
          </div>
          {!!undertrained.length && (
            <div className="mt-3 text-[11px] flex flex-wrap gap-2">
              {undertrained.map((u) => (
                <span key={u.muscle} className="badge" data-variant="danger">
                  {u.muscle}: {u.avgSets.toFixed(1)} avg
                </span>
              ))}
            </div>
          )}
          {!undertrained.length && (
            <div className="mt-3 text-[11px] text-gray-500">
              Balanced across selected phases.
            </div>
          )}
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Intensity Distribution</h3>
          <div className="h-64">
            {!RC && (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading…
              </div>
            )}
            {RC && (
              <RC.ResponsiveContainer>
                <RC.BarChart data={intensityDist}>
                  <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <RC.XAxis dataKey="bucket" stroke="#9ca3af" />
                  <RC.YAxis stroke="#9ca3af" />
                  <RC.Tooltip
                    content={({ active, payload, label }: any) => (
                      <UnifiedTooltip
                        active={active}
                        payload={payload}
                        label={label}
                      />
                    )}
                  />
                  <RC.Bar dataKey="sets" name="% Sets" fill="#6366f1" />
                </RC.BarChart>
              </RC.ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft xl:col-span-3">
          <h3 className="font-medium mb-2">Plateau Watch</h3>
          {!plateaus.length && (
            <div className="text-xs text-gray-500">
              No plateaus detected (need ≥4 weeks history).
            </div>
          )}
          {!!plateaus.length && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
              {plateaus.map((p) => (
                <div
                  key={p.exercise}
                  className="bg-white/5 rounded px-2 py-2 flex items-center justify-between"
                >
                  <span className="truncate max-w-[140px]" title={p.exercise}>
                    {p.exercise}
                  </span>
                  <span className="text-danger">{p.changePct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
