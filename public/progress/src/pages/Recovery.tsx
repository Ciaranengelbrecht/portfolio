import { useEffect, useState, useCallback } from "react";
import { getRecovery, MuscleRecoveryState } from "../lib/recovery";
import { MUSCLE_ICON_PATHS } from "../lib/muscles";

interface ViewState {
  loading: boolean;
  error?: string;
  updatedAt?: number;
  muscles: MuscleRecoveryState[];
}

const ORDER: (keyof typeof MUSCLE_ICON_PATHS)[] = [
  "chest",
  "back",
  "shoulders",
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

function formatETA(ms?: number) {
  if (!ms) return "";
  const now = Date.now();
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
  if (pct >= 99) return "Full session ready";
  if (pct >= 90) return "Normal volume OK";
  if (pct >= 75) return "Light work only";
  if (pct >= 50) return "Technique / isolation";
  return "Prioritise rest";
}

export default function RecoveryPage() {
  const [view, setView] = useState<ViewState>({ loading: true, muscles: [] });
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
      </header>
      {view.error && <div className="text-sm text-red-400">{view.error}</div>}
      <div className="mx-auto grid w-full max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {ORDER.map((m) => {
          const rec = view.muscles.find((x) => x.muscle === m);
          const pct = rec ? rec.percent : 100;
          const status = rec ? rec.status : "Ready";
          const eta = rec?.etaFull;
          const meta = STATUS_META[status];
          return (
            <div
              key={m}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-950/70 to-slate-900/60 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.35)] transition duration-200 hover:border-emerald-400/40 hover:shadow-[0_18px_40px_rgba(16,185,129,0.25)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <img
                      src={MUSCLE_ICON_PATHS[m]}
                      alt=""
                      className="h-7 w-7 object-contain opacity-85"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold capitalize text-slate-50">
                      {m}
                    </h2>
                    <p className="text-xs text-slate-400">{meta.caption}</p>
                  </div>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${meta.badge}`}
                >
                  {status}
                </span>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold text-slate-50 tabular-nums">
                    {Math.round(pct)}
                  </span>
                  <span className="text-sm text-slate-400">% recovered</span>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    ETA
                  </p>
                  <p className="text-sm font-semibold text-slate-200 tabular-nums">
                    {formatETA(eta) || "—"}
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-200">
                {recommendation(pct)}
              </p>
              <div
                className={`relative h-2 overflow-hidden rounded-full ${meta.track}`}
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
