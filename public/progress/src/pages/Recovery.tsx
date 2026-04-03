import { useEffect, useState, useCallback, useMemo } from "react";
import { getRecovery, MuscleRecoveryState } from "../lib/recovery";
import { MUSCLE_ICON_PATHS } from "../lib/muscles";
import { SkeletonMuscleCard } from "../components/Skeleton";

interface ViewState {
  loading: boolean;
  error?: string;
  updatedAt?: number;
  muscles: MuscleRecoveryState[];
}

const ORDER: MuscleRecoveryState["muscle"][] = [
  "chest",
  "lats",
  "traps",
  "delts",
  "reardelts",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "other",
];

function formatETA(ms?: number, nowMs?: number) {
  if (!ms) return "";
  const now = nowMs ?? Date.now();
  if (ms <= now) return "Ready";
  const diff = ms - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h <= 0) return `${m}m`;
  if (h < 10) return `${h}h ${m}m`;
  return `${h}h`;
}

const STATUS_META: Record<
  MuscleRecoveryState["status"],
  {
    badge: string;
    bar: string;
    track: string;
    caption: string;
  }
> = {
  Ready: {
    badge: "bg-emerald-300/80 text-emerald-950",
    bar: "from-emerald-400 to-emerald-500",
    track: "bg-emerald-400/15",
    caption: "Recovered",
  },
  Near: {
    badge: "bg-lime-300/80 text-lime-950",
    bar: "from-lime-300 to-amber-300",
    track: "bg-lime-400/15",
    caption: "Almost ready",
  },
  Caution: {
    badge: "bg-amber-400/80 text-amber-950",
    bar: "from-amber-400 to-orange-500",
    track: "bg-amber-500/15",
    caption: "Manage fatigue",
  },
  "Not Ready": {
    badge: "bg-rose-500/80 text-rose-50",
    bar: "from-rose-500 to-red-600",
    track: "bg-rose-600/15",
    caption: "High fatigue",
  },
};

function recommendation(pct: number) {
  if (pct >= 99) return "Full session ready - normal load is fine.";
  if (pct >= 90) return "Near ready - run normal work with controlled top sets.";
  if (pct >= 75) return "Use reduced volume or easier accessory work today.";
  if (pct >= 50) return "Technique and pump work only - skip heavy compounds.";
  return "Prioritise rest and sleep before hard loading.";
}

const STATUS_LEGEND: Array<{
  key: MuscleRecoveryState["status"];
  label: string;
}> = [
  { key: "Ready", label: "Recovered" },
  { key: "Near", label: "Almost ready" },
  { key: "Caution", label: "Manage fatigue" },
  { key: "Not Ready", label: "High fatigue" },
];

export default function RecoveryPage() {
  const [view, setView] = useState<ViewState>({ loading: true, muscles: [] });
  const musclesByName = useMemo(() => {
    const map = new Map<MuscleRecoveryState["muscle"], MuscleRecoveryState>();
    for (const muscle of view.muscles) {
      map.set(muscle.muscle, muscle);
    }
    return map;
  }, [view.muscles]);

  const load = useCallback(async (force?: boolean) => {
    try {
      const data = await getRecovery(force);
      setView({
        loading: false,
        muscles: data.muscles,
        updatedAt: data.updatedAt,
      });
    } catch (e: any) {
      setView((v) => ({
        ...v,
        loading: false,
        error: e?.message || "Failed to compute recovery",
      }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const etaNow = Date.now();

  // Periodic refresh (hourly) + visibility change to keep fresh
  useEffect(() => {
    const t = setInterval(() => load(true), 60 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  return (
    <div className="space-y-5 pb-20">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">
          Recovery
        </h1>
        {view.updatedAt && (
          <span className="text-xs text-slate-400">
            Updated{" "}
            {new Date(view.updatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        <button
          onClick={() => load(true)}
          className="ml-auto text-xs rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-medium text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          Refresh
        </button>
        <div className="w-full flex flex-wrap items-center gap-1.5 pt-1">
          {STATUS_LEGEND.map((item) => {
            const meta = STATUS_META[item.key];
            return (
              <span
                key={item.key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                title={`${item.key}: ${item.label}`}
              >
                <span>{item.key}</span>
                <span className="opacity-70">· {item.label}</span>
              </span>
            );
          })}
        </div>
      </header>
      {view.error && <div className="text-sm text-red-400">{view.error}</div>}
      {view.loading ? (
        <div className="mx-auto grid w-full max-w-6xl gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] xl:[grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          {ORDER.map((m) => (
            <SkeletonMuscleCard key={m} />
          ))}
        </div>
      ) : (
      <div className="mx-auto grid w-full max-w-6xl gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] xl:[grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        {ORDER.map((m) => {
          const rec = musclesByName.get(m);
          const pct = rec ? rec.percent : 100;
          const status = rec ? rec.status : "Ready";
          const eta = rec?.etaFull;
          const meta = STATUS_META[status];
          return (
            <div
              key={m}
              className="group flex h-full flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/75 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.28)] transition duration-200 hover:border-emerald-400/40 hover:shadow-[0_14px_28px_rgba(16,185,129,0.2)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10">
                    <img
                      src={MUSCLE_ICON_PATHS[m]}
                      alt=""
                      className="h-5 w-5 object-contain opacity-85"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold capitalize text-slate-50">
                      {m}
                    </h2>
                    <p className="text-[11px] text-slate-400">{meta.caption}</p>
                  </div>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}
                >
                  {status}
                </span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-slate-50 tabular-nums">
                    {Math.round(pct)}
                  </span>
                  <span className="text-xs text-slate-400">%</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    ETA
                  </p>
                  <p className="text-xs font-semibold text-slate-200 tabular-nums">
                    {formatETA(eta, etaNow) || "—"}
                  </p>
                </div>
              </div>
              <p className="truncate text-[11px] font-medium text-slate-200">
                {recommendation(pct)}
              </p>
              <div
                className={`relative h-1.5 overflow-hidden rounded-full ${meta.track}`}
              >
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${meta.bar}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      )}
      <footer className="pt-1 text-[10px] leading-relaxed text-slate-500">
        <p>
          <strong className="font-semibold text-slate-300">
            Smart Recovery Algorithm:
          </strong>{" "}
          Heuristic decay modelling based on volume, intensity, and muscle size.
          Timelines assume solid sleep and nutrition—use as guidance, not
          prescription.
        </p>
      </footer>
    </div>
  );
}
