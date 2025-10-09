import { useEffect, useState } from "react";
import { clampPhase } from "../lib/sessionOps";
import { getSettings, setSettings } from "../lib/helpers";
import { clsx } from "clsx";

type PhaseStepperVariant = "default" | "compact";

interface PhaseStepperProps {
  value?: number;
  onChange?: (n: number) => void;
  variant?: PhaseStepperVariant;
}

export default function PhaseStepper({
  value,
  onChange,
  variant = "default",
}: PhaseStepperProps) {
  const [n, setN] = useState<number>(value ?? 1);
  const [hint, setHint] = useState<string>("");

  useEffect(() => {
    if (typeof value === "number") setN(value);
  }, [value]);

  const commit = async (v: number) => {
    const prevPhase = value ?? n;
    const c = clampPhase(v);
    if (c > prevPhase) {
      if (
        !window.confirm(
          "Move to phase " +
            c +
            "? You should only advance after completing current phase."
        )
      )
        return;
    } else if (c < prevPhase) {
      if (
        !window.confirm(
          "Revert to phase " +
            c +
            "? Progress indicators will recalc based on earlier data."
        )
      )
        return;
    }
    setN(c);
    setHint(c !== v ? "Min phase is 1" : "");
    onChange?.(c);
    const s = await getSettings();
    await setSettings({
      ...s,
      currentPhase: c,
      dashboardPrefs: {
        ...(s.dashboardPrefs || {}),
        lastLocation: {
          ...(s.dashboardPrefs?.lastLocation || { weekNumber: 1, dayId: 0 }),
          phaseNumber: c,
        },
      },
    });
  };

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-1 text-[11px] text-white/70">
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/60 px-2 py-1 shadow-[0_6px_20px_-18px_rgba(59,130,246,0.8)]">
          <button
            type="button"
            aria-label="Previous phase"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-sm text-white/80 transition hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60 active:scale-95"
            onClick={() => commit(n - 1)}
          >
            −
          </button>
          <div className="flex items-center gap-1 px-1 text-[10px] uppercase tracking-[0.32em] text-white/40">
            Phase
          </div>
          <input
            className="h-6 w-12 rounded-md border border-white/10 bg-slate-900/70 px-2 text-center text-sm font-semibold text-white/90 transition focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
            inputMode="numeric"
            value={n}
            aria-label="Current phase"
            onChange={(e) => {
              const v = e.target.value;
              if (!/^\d*$/.test(v)) return;
              setN(Number(v || "1"));
            }}
            onBlur={() => commit(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(n);
              if (e.key === "ArrowUp") commit(n + 1);
              if (e.key === "ArrowDown") commit(n - 1);
            }}
          />
          <button
            type="button"
            aria-label="Next phase"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/30 hover:text-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60 active:scale-95"
            onClick={() => commit(n + 1)}
          >
            +
          </button>
        </div>
        {hint && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-amber-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            {hint}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-slate-950/65 px-2 py-2 shadow-[0_10px_30px_-24px_rgba(59,130,246,0.75)]">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous phase"
          className={clsx(
            "group relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-900/70 text-base font-semibold text-white/90 transition-all duration-150",
            "hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-[rgba(99,102,241,0.75)] focus-visible:outline-offset-2 active:scale-95"
          )}
          onClick={() => commit(n - 1)}
        >
          <span className="relative z-10">−</span>
          <span className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 bg-[radial-gradient(circle_at_center,rgba(148,163,255,0.28),transparent_70%)]" />
        </button>
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <input
            className="h-9 w-16 rounded-lg border border-white/10 bg-slate-900/70 px-3 text-center text-sm font-semibold tracking-wide text-white/90 transition focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
            inputMode="numeric"
            value={n}
            aria-label="Current phase"
            onChange={(e) => {
              const v = e.target.value;
              if (!/^\d*$/.test(v)) return;
              setN(Number(v || "1"));
            }}
            onBlur={() => commit(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(n);
              if (e.key === "ArrowUp") commit(n + 1);
              if (e.key === "ArrowDown") commit(n - 1);
            }}
          />
        </div>
        <button
          type="button"
          aria-label="Next phase"
          className={clsx(
            "group relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-sky-500 via-[var(--accent)] to-indigo-500 text-base font-semibold text-slate-950 transition-all duration-150",
            "hover:brightness-105 focus-visible:outline focus-visible:outline-[rgba(59,130,246,0.55)] focus-visible:outline-offset-2 active:scale-95"
          )}
          onClick={() => commit(n + 1)}
        >
          <span className="relative z-10">+</span>
          <span className="absolute inset-0 opacity-0 transition-opacity duration-150 group-active:opacity-100 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.26),transparent_70%)]" />
        </button>
      </div>
      {hint && (
        <div className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          {hint}
        </div>
      )}
    </div>
  );
}
