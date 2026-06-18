import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { getSettings, setSettings } from "../lib/helpers";
import {
  shouldRunAppIntro,
  withAppIntroCompleted,
  withAppIntroSkipped,
} from "../lib/appIntro";
import type { Settings } from "../lib/types";

export type TourPrepareTarget =
  | "sessions-top"
  | "sessions-details"
  | "sessions-tools"
  | "sessions-first-exercise";

export interface GuidedAppIntroStep {
  id: string;
  title: string;
  body: string;
  targetIds: string[];
  route?: string;
  prepare?: TourPrepareTarget;
  optional?: boolean;
}

type SettingsApi = {
  getSettings: () => Promise<Settings>;
  setSettings: (
    next: Settings | ((current: Settings) => Settings | Promise<Settings>)
  ) => Promise<void>;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const defaultSettingsApi: SettingsApi = {
  getSettings,
  setSettings,
};

const waitFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

export function findTourTarget(targetIds: string[]): HTMLElement | null {
  for (const id of targetIds) {
    const targets = document.querySelectorAll<HTMLElement>(
      `[data-tour-id="${id}"]`
    );
    for (const target of Array.from(targets)) {
      const style = window.getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      const hasLayout =
        rect.width > 0 ||
        rect.height > 0 ||
        target.getClientRects().length > 0 ||
        navigator.userAgent.toLowerCase().includes("jsdom");
      if (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        hasLayout
      ) {
        return target;
      }
    }
  }
  return null;
}

function getTargetRect(target: HTMLElement | null): TargetRect | null {
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const pad = 8;
  return {
    top: Math.max(8, rect.top - pad),
    left: Math.max(8, rect.left - pad),
    width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
    height: Math.min(window.innerHeight - 16, rect.height + pad * 2),
  };
}

function getCardStyle(rect: TargetRect | null): CSSProperties {
  const width = Math.min(360, window.innerWidth - 24);
  if (!rect) {
    return {
      width,
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const gap = 14;
  const cardHeight = 236;
  const canPlaceBelow = rect.top + rect.height + gap + cardHeight < window.innerHeight;
  const top = canPlaceBelow
    ? rect.top + rect.height + gap
    : Math.max(12, rect.top - cardHeight - gap);
  const centered = rect.left + rect.width / 2 - width / 2;
  const left = Math.min(Math.max(12, centered), window.innerWidth - width - 12);

  return { width, left, top };
}

export function buildDefaultAppIntroSteps(): GuidedAppIntroStep[] {
  return [
    {
      id: "home",
      title: "Home dashboard",
      body: "Your quick overview: recent training, progress signals, and the next place to jump back in.",
      targetIds: ["app-nav-dashboard", "mobile-nav-home", "drawer-nav-dashboard"],
      optional: true,
    },
    {
      id: "insights",
      title: "Insights",
      body: "Use Insights for trends, pacing, and training patterns once you have logged a few workouts.",
      targetIds: ["app-nav-analytics", "mobile-nav-analytics", "drawer-nav-analytics"],
      optional: true,
    },
    {
      id: "sessions-nav",
      title: "Training",
      body: "This is the main workout screen. Most day-to-day logging happens here.",
      targetIds: ["app-nav-sessions", "mobile-nav-sessions", "drawer-nav-sessions"],
      route: "/sessions",
    },
    {
      id: "recovery",
      title: "Recovery",
      body: "Recovery helps you keep fatigue, rest, and readiness visible beside your training.",
      targetIds: ["app-nav-recovery", "mobile-nav-recovery", "drawer-nav-recovery"],
      optional: true,
    },
    {
      id: "measurements",
      title: "Measurements",
      body: "Track body weight, photos, and body-composition changes separately from workout performance.",
      targetIds: ["app-nav-measurements", "mobile-nav-measurements", "drawer-nav-measurements"],
      optional: true,
    },
    {
      id: "program",
      title: "Program",
      body: "Program is where your split, phases, training days, and guided setup live.",
      targetIds: ["app-nav-program", "mobile-nav-program", "drawer-nav-program"],
      optional: true,
    },
    {
      id: "templates",
      title: "Templates",
      body: "Templates save repeatable workouts so you can reuse sessions instead of rebuilding them.",
      targetIds: ["app-nav-templates", "mobile-nav-templates", "drawer-nav-templates"],
      optional: true,
    },
    {
      id: "settings",
      title: "Settings",
      body: "Settings handles preferences, account controls, export/import, and replaying this intro.",
      targetIds: ["app-nav-settings", "mobile-nav-settings", "drawer-nav-settings"],
      optional: true,
    },
    {
      id: "day",
      title: "Choose the training day",
      body: "Switch days here. Each day loads its own exercises and logged sets for the selected week.",
      targetIds: ["sessions-day-selector"],
      route: "/sessions",
      prepare: "sessions-top",
    },
    {
      id: "details",
      title: "Week, phase, and date",
      body: "Open Details to change week or phase, stamp today's date, or edit the session date.",
      targetIds: ["sessions-details-toggle", "sessions-week-phase-controls"],
      route: "/sessions",
      prepare: "sessions-details",
    },
    {
      id: "tools",
      title: "Session tools",
      body: "Tools holds training mode, erase, stamp, collapse/expand, copy last, and phase navigation.",
      targetIds: ["sessions-tools-toggle", "sessions-tools-panel"],
      route: "/sessions",
      prepare: "sessions-tools",
    },
    {
      id: "muscle-strip",
      title: "Muscle and exercise strip",
      body: "Use this sticky strip to filter by muscle or jump straight to an exercise in a long workout.",
      targetIds: ["sessions-muscle-strip"],
      route: "/sessions",
      optional: true,
    },
    {
      id: "exercise-card",
      title: "Exercise cards",
      body: "Tap a card surface to collapse or expand it. The header shows progress and quick actions.",
      targetIds: ["sessions-first-exercise-card"],
      route: "/sessions",
      prepare: "sessions-first-exercise",
      optional: true,
    },
    {
      id: "exercise-name",
      title: "Exercise history",
      body: "Tap the exercise name to review recent history for that movement without leaving the session.",
      targetIds: ["sessions-first-exercise-name"],
      route: "/sessions",
      prepare: "sessions-first-exercise",
      optional: true,
    },
    {
      id: "exercise-actions",
      title: "Swap, remove, and reorder",
      body: "Swap changes a movement, remove deletes it from this session, and arrows reorder on mobile.",
      targetIds: ["sessions-first-exercise-actions"],
      route: "/sessions",
      prepare: "sessions-first-exercise",
      optional: true,
    },
    {
      id: "set-inputs",
      title: "Log sets",
      body: "Enter weight and reps, or use the plus/minus buttons for quick changes during a workout.",
      targetIds: ["sessions-first-set-inputs"],
      route: "/sessions",
      prepare: "sessions-first-exercise",
      optional: true,
    },
    {
      id: "set-actions",
      title: "Set controls",
      body: "Add sets, start rest timers, reorder sets, delete mistakes, and duplicate the last set when useful.",
      targetIds: ["sessions-first-set-actions"],
      route: "/sessions",
      prepare: "sessions-first-exercise",
      optional: true,
    },
    {
      id: "summary",
      title: "Session summary",
      body: "The summary shows completed sets, total volume, muscle work, and what still needs attention.",
      targetIds: ["sessions-summary"],
      route: "/sessions",
      optional: true,
    },
    {
      id: "add-exercise",
      title: "Add exercises",
      body: "Use Add exercise to search the library or create a custom movement for this session.",
      targetIds: ["sessions-add-exercise-card"],
      route: "/sessions",
    },
    {
      id: "jump-latest",
      title: "Jump back to latest",
      body: "When you browse older sessions, Jump to Latest brings you back to the newest workout quickly.",
      targetIds: ["sessions-jump-latest"],
      route: "/sessions",
      optional: true,
    },
  ];
}

function dispatchPrepare(target?: TourPrepareTarget) {
  if (!target) return;
  window.dispatchEvent(
    new CustomEvent("app-intro:sessions-prepare", { detail: { target } })
  );
}

export default function GuidedAppIntro({
  steps,
  settingsApi = defaultSettingsApi,
}: {
  steps?: GuidedAppIntroStep[];
  settingsApi?: SettingsApi;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const tourSteps = useMemo(() => steps || buildDefaultAppIntroSteps(), [steps]);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const step = tourSteps[index];
  const total = tourSteps.length;

  useEffect(() => {
    reducedMotionRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true ||
      document.documentElement.getAttribute("data-reduced-motion") === "true";
  }, []);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const shouldRun = shouldRunAppIntro(settings);
        activeRef.current = shouldRun;
        setActive(shouldRun);
        if (shouldRun) setIndex(0);
      })
      .catch((err) => {
        console.warn("[app-intro] failed to read settings", err);
      });
    return () => {
      cancelled = true;
    };
  }, [settingsApi, location.pathname]);

  const finish = useCallback(
    async (mode: "complete" | "skip") => {
      activeRef.current = false;
      setActive(false);
      setRect(null);
      setTarget(null);
      await settingsApi.setSettings((current) =>
        mode === "complete"
          ? withAppIntroCompleted(current)
          : withAppIntroSkipped(current)
      );
    },
    [settingsApi]
  );

  const resolveStep = useCallback(
    async (requestedIndex: number, direction: 1 | -1 = 1) => {
      if (!activeRef.current) return;
      if (requestedIndex < 0) {
        setIndex(0);
        return;
      }
      if (requestedIndex >= tourSteps.length) {
        await finish("complete");
        return;
      }

      setBusy(true);
      let nextIndex = requestedIndex;
      while (nextIndex >= 0 && nextIndex < tourSteps.length) {
        const candidate = tourSteps[nextIndex];
        if (candidate.route && location.pathname !== candidate.route) {
          navigate(candidate.route);
          await waitFrame();
        }
        dispatchPrepare(candidate.prepare);
        await waitFrame();
        if (!reducedMotionRef.current) await waitFrame();
        const nextTarget = findTourTarget(candidate.targetIds);
        if (nextTarget) {
          nextTarget.scrollIntoView?.({
            block: "center",
            inline: "center",
            behavior: reducedMotionRef.current ? "auto" : "smooth",
          });
          await waitFrame();
          const nextRect = getTargetRect(nextTarget);
          if (nextRect) {
            setIndex(nextIndex);
            setTarget(nextTarget);
            setRect(nextRect);
            setBusy(false);
            return;
          }
        }
        if (!candidate.optional) {
          setIndex(nextIndex);
          setTarget(null);
          setRect(null);
          setBusy(false);
          return;
        }
        nextIndex += direction;
      }

      setBusy(false);
      await finish("complete");
    },
    [finish, location.pathname, navigate, tourSteps]
  );

  useEffect(() => {
    if (!active) return;
    activeRef.current = true;
    void resolveStep(index);
  }, [active]);

  useEffect(() => {
    if (!active || !step) return;
    const updateRect = () => {
      setRect(getTargetRect(target));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void finish("skip");
      }
    };
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, finish, step, target]);

  if (!active || !step) return null;

  const highlightStyle: CSSProperties = rect
    ? {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        transition: reducedMotionRef.current
          ? "none"
          : "top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease",
      }
    : { display: "none" };

  const cardStyle = getCardStyle(rect);
  const isLast = index >= total - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[2400] pointer-events-none"
      aria-live="polite"
      data-guided-app-intro
    >
      <div
        className="fixed rounded-2xl border border-emerald-300/70 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.76),0_0_0_1px_rgba(255,255,255,0.35),0_18px_55px_rgba(16,185,129,0.28)] pointer-events-none"
        style={highlightStyle}
      />
      <div
        className="fixed pointer-events-auto rounded-2xl border border-white/12 bg-slate-950/95 p-4 text-white shadow-[0_24px_70px_-28px_rgba(16,185,129,0.75)] backdrop-blur-xl"
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guided-intro-title"
      >
        <button
          type="button"
          className="absolute right-3 top-2 text-[11px] font-medium text-white/45 transition hover:text-white/80"
          onClick={() => void finish("skip")}
        >
          Skip all
        </button>
        <div className="pr-14">
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-emerald-300/75">
            Intro {Math.min(index + 1, total)} / {total}
          </div>
          <h2
            id="guided-intro-title"
            className="mt-2 text-lg font-semibold leading-tight text-white"
          >
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {step.body}
          </p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:bg-white/10 disabled:opacity-35"
            disabled={index === 0 || busy}
            onClick={() => void resolveStep(index - 1, -1)}
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:bg-white/10"
              onClick={() => void finish("skip")}
            >
              Later
            </button>
            <button
              type="button"
              className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-60"
              disabled={busy}
              onClick={() =>
                isLast
                  ? void finish("complete")
                  : void resolveStep(index + 1, 1)
              }
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
