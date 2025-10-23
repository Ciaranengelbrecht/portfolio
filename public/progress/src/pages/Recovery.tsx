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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {ORDER.map((m) => {
          const rec = view.muscles.find((x) => x.muscle === m);
          const pct = rec ? rec.percent : 100;
          const status = rec ? rec.status : "Ready";
          const eta = rec?.etaFull;
          const meta = STATUS_META[status];
          return (
            <div
              key={m}
              className="rounded-lg border border-white/10 bg-slate-900/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-sm transition hover:border-emerald-400/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5">
                  <img
                    src={MUSCLE_ICON_PATHS[m]}
                    alt=""
                    className="h-6 w-6 object-contain opacity-80"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold capitalize text-slate-100">
                      {m}
                    </h2>
                    <span
                      className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {meta.caption}
                  </div>
                </div>
                <div className="w-10 text-right text-xs font-semibold text-slate-200 tabular-nums">
                  {Math.round(pct)}%
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className={`flex-1 h-2.5 rounded-full ${meta.track}`}>
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${meta.bar}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate pr-2">{recommendation(pct)}</span>
                <span className="font-medium text-slate-200 tabular-nums">
                  {formatETA(eta) || "—"}
                </span>
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
