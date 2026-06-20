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
  APP_INTRO_PAGE_IDS,
  getPendingAppIntroPages,
  shouldRunAppIntro,
  withAppIntroCompleted,
  withAppIntroPageCompleted,
  withAppIntroPageSkipped,
  withAppIntroSkipped,
  type AppIntroPageId,
} from "../lib/appIntro";
import type { Settings } from "../lib/types";

export type TourPrepareTarget =
  | "sessions-top"
  | "sessions-details"
  | "sessions-first-exercise"
  | "analytics-overview"
  | "analytics-sessions"
  | "analytics-muscles"
  | "analytics-exercises"
  | "settings-general"
  | "settings-profile"
  | "settings-appearance"
  | "settings-progress"
  | "settings-library"
  | "settings-safety";

export interface GuidedAppIntroStep {
  id: string;
  title: string;
  body: string;
  targetIds: string[];
  route?: string;
  prepare?: TourPrepareTarget;
  optional?: boolean;
}

export interface GuidedAppIntroPage {
  pageId: AppIntroPageId;
  label: string;
  route: string;
  steps: GuidedAppIntroStep[];
}

type RuntimeStep = GuidedAppIntroStep & {
  pageId: AppIntroPageId;
  pageLabel: string;
  pageStepIndex: number;
  pageStepTotal: number;
};

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

type CardSize = {
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

const waitMs = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const rectsClose = (a: TargetRect | null, b: TargetRect | null) => {
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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

export function getGuidedIntroCardStyle(
  rect: TargetRect | null,
  measuredSize?: CardSize | null
): CSSProperties {
  const width = Math.min(380, window.innerWidth - 24);
  const height = measuredSize?.height || 232;
  const margin = 12;
  const gap = 16;

  if (!rect) {
    return {
      width,
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const centered = rect.left + rect.width / 2 - width / 2;
  const centeredTop = rect.top + rect.height / 2 - height / 2;
  const left = clamp(centered, margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  const sideTop = clamp(centeredTop, margin, maxTop);
  const spaceBelow = window.innerHeight - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = window.innerWidth - (rect.left + rect.width);
  const spaceLeft = rect.left;

  if (spaceBelow >= height + gap + margin) {
    return { width, left, top: rect.top + rect.height + gap };
  }

  if (spaceAbove >= height + gap + margin) {
    return { width, left, top: rect.top - height - gap };
  }

  if (window.innerWidth >= 720 && spaceRight >= width + gap + margin) {
    return {
      width,
      left: rect.left + rect.width + gap,
      top: sideTop,
    };
  }

  if (window.innerWidth >= 720 && spaceLeft >= width + gap + margin) {
    return {
      width,
      left: rect.left - width - gap,
      top: sideTop,
    };
  }

  const top = spaceBelow >= spaceAbove ? margin : maxTop;

  return {
    width,
    left,
    top: clamp(top, margin, maxTop),
  };
}

const pageRoute: Record<AppIntroPageId, string> = {
  sessions: "/sessions",
  dashboard: "/",
  analytics: "/analytics",
  recovery: "/recovery",
  measurements: "/measurements",
  program: "/settings/program",
  templates: "/templates",
  settings: "/settings",
};

export function buildDefaultAppIntroPages(): GuidedAppIntroPage[] {
  return [
    {
      pageId: "sessions",
      label: "Training",
      route: pageRoute.sessions,
      steps: [
        {
          id: "sessions-nav",
          title: "Training comes first",
          body: "This is the main workout screen. Most day-to-day logging happens here.",
          targetIds: [
            "app-nav-sessions",
            "mobile-nav-sessions",
            "drawer-nav-sessions",
          ],
          route: pageRoute.sessions,
        },
        {
          id: "day",
          title: "Choose the training day",
          body: "Switch days here. Each day loads its own exercises and logged sets for the selected week.",
          targetIds: ["sessions-day-selector"],
          route: pageRoute.sessions,
          prepare: "sessions-top",
        },
        {
          id: "details",
          title: "Session details",
          body: "Open Details to change week or phase, update the date, switch training mode, import or save workouts, swap days, and erase logged data.",
          targetIds: [
            "sessions-details-toggle",
            "sessions-week-phase-controls",
            "sessions-training-mode",
          ],
          route: pageRoute.sessions,
          prepare: "sessions-details",
        },
        {
          id: "muscle-strip",
          title: "Muscle and exercise strip",
          body: "Use this sticky strip to filter by muscle or jump straight to an exercise in a long workout.",
          targetIds: ["sessions-muscle-strip"],
          route: pageRoute.sessions,
          optional: true,
        },
        {
          id: "exercise-card",
          title: "Exercise cards",
          body: "Tap a card surface to collapse or expand it. The header shows progress and quick actions.",
          targetIds: ["sessions-first-exercise-card"],
          route: pageRoute.sessions,
          prepare: "sessions-first-exercise",
          optional: true,
        },
        {
          id: "exercise-name",
          title: "Exercise history",
          body: "Tap the exercise name to review recent history for that movement without leaving the session.",
          targetIds: ["sessions-first-exercise-name"],
          route: pageRoute.sessions,
          prepare: "sessions-first-exercise",
          optional: true,
        },
        {
          id: "exercise-actions",
          title: "Swap, remove, and reorder",
          body: "Swap changes a movement, remove deletes it from this session, and arrows reorder on mobile.",
          targetIds: ["sessions-first-exercise-actions"],
          route: pageRoute.sessions,
          prepare: "sessions-first-exercise",
          optional: true,
        },
        {
          id: "set-inputs",
          title: "Log sets",
          body: "Enter weight and reps, or use the plus/minus buttons for quick changes during a workout.",
          targetIds: ["sessions-first-set-inputs"],
          route: pageRoute.sessions,
          prepare: "sessions-first-exercise",
          optional: true,
        },
        {
          id: "set-actions",
          title: "Set controls",
          body: "Add sets, start rest timers, reorder sets, delete mistakes, and duplicate the last set when useful.",
          targetIds: ["sessions-first-set-actions"],
          route: pageRoute.sessions,
          prepare: "sessions-first-exercise",
          optional: true,
        },
        {
          id: "summary",
          title: "Session summary",
          body: "The summary shows completed sets, total volume, muscle work, and what still needs attention.",
          targetIds: ["sessions-summary"],
          route: pageRoute.sessions,
          optional: true,
        },
        {
          id: "add-exercise",
          title: "Add exercises",
          body: "Use Add exercise to search the library or create a custom movement for this session.",
          targetIds: ["sessions-add-exercise-card"],
          route: pageRoute.sessions,
        },
      ],
    },
    {
      pageId: "dashboard",
      label: "Dashboard",
      route: pageRoute.dashboard,
      steps: [
        {
          id: "dashboard-home",
          title: "Home dashboard",
          body: "Dashboard gives you the fastest scan of lifetime work, current-week focus, and key progress panels.",
          targetIds: ["dashboard-overview"],
        },
        {
          id: "dashboard-lifetime",
          title: "Lifetime ledger",
          body: "This card summarizes all logged training so your total work stays visible.",
          targetIds: ["dashboard-lifetime-ledger"],
          optional: true,
        },
        {
          id: "dashboard-current",
          title: "Current focus",
          body: "Use this card to see the phase and week you are currently building around.",
          targetIds: ["dashboard-current-focus"],
          optional: true,
        },
        {
          id: "dashboard-toggles",
          title: "Choose visible panels",
          body: "These chips show or hide dashboard sections so the page stays focused on what you care about.",
          targetIds: ["dashboard-section-toggles"],
          optional: true,
        },
        {
          id: "dashboard-panels",
          title: "Progress panels",
          body: "Training, body, volume, compliance, and muscle panels turn your logs into weekly feedback.",
          targetIds: [
            "dashboard-training-chart",
            "dashboard-week-volume",
            "dashboard-compliance",
          ],
          optional: true,
        },
      ],
    },
    {
      pageId: "analytics",
      label: "Insights",
      route: pageRoute.analytics,
      steps: [
        {
          id: "analytics-header",
          title: "Analytics studio",
          body: "Insights is the deeper analysis page for training momentum, session quality, muscles, and exercises.",
          targetIds: ["analytics-header"],
        },
        {
          id: "analytics-tabs",
          title: "Switch analysis mode",
          body: "Use these modes to move between overview, sessions, muscles, and exercise-specific trends.",
          targetIds: ["analytics-mode-tabs"],
        },
        {
          id: "analytics-overview",
          title: "Overview mode",
          body: "Overview summarizes the main trends when you want a quick read.",
          targetIds: ["analytics-overview-section"],
          prepare: "analytics-overview",
          optional: true,
        },
        {
          id: "analytics-sessions",
          title: "Session quality",
          body: "Sessions mode compares workouts, volume, duration, and muscle balance over time.",
          targetIds: ["analytics-sessions-section"],
          prepare: "analytics-sessions",
          optional: true,
        },
        {
          id: "analytics-muscles",
          title: "Muscle balance",
          body: "Muscles mode shows how your work is distributed so gaps are easier to catch.",
          targetIds: ["analytics-muscles-section"],
          prepare: "analytics-muscles",
          optional: true,
        },
        {
          id: "analytics-exercises",
          title: "Exercise trends",
          body: "Exercises mode lets you focus on one movement and inspect its performance timeline.",
          targetIds: ["analytics-exercises-section"],
          prepare: "analytics-exercises",
          optional: true,
        },
        {
          id: "analytics-measurements",
          title: "Body data shortcut",
          body: "This shortcut jumps to Measurements when you want to pair body trends with training trends.",
          targetIds: ["analytics-measurements-shortcut"],
          optional: true,
        },
      ],
    },
    {
      pageId: "recovery",
      label: "Recovery",
      route: pageRoute.recovery,
      steps: [
        {
          id: "recovery-header",
          title: "Recovery overview",
          body: "Recovery estimates which muscles are ready, near ready, or should be managed carefully.",
          targetIds: ["recovery-header"],
        },
        {
          id: "recovery-legend",
          title: "Status legend",
          body: "The legend explains the readiness states used across every muscle card.",
          targetIds: ["recovery-status-legend"],
          optional: true,
        },
        {
          id: "recovery-refresh",
          title: "Refresh readiness",
          body: "Refresh recalculates readiness from your latest logged training data.",
          targetIds: ["recovery-refresh"],
          optional: true,
        },
        {
          id: "recovery-cards",
          title: "Muscle cards",
          body: "Each card shows readiness, estimated time to full recovery, and a practical training recommendation.",
          targetIds: ["recovery-muscle-grid", "recovery-muscle-card"],
          optional: true,
        },
      ],
    },
    {
      pageId: "measurements",
      label: "Measurements",
      route: pageRoute.measurements,
      steps: [
        {
          id: "measurements-header",
          title: "Measurements",
          body: "Measurements keeps body data separate from workout performance so trends are easier to compare.",
          targetIds: ["measurements-header"],
        },
        {
          id: "measurements-note",
          title: "Training tool note",
          body: "Body composition estimates are useful training context, not medical advice.",
          targetIds: ["measurements-health-note"],
          optional: true,
        },
        {
          id: "measurements-quick",
          title: "Quick weigh-in",
          body: "Use quick weigh-in for fast daily bodyweight and waist updates.",
          targetIds: ["measurements-quick-weigh-in"],
          optional: true,
        },
        {
          id: "measurements-entry",
          title: "Capture measurements",
          body: "Use the full entry form when you want to log detailed body measurements.",
          targetIds: ["measurements-entry-card"],
          optional: true,
        },
        {
          id: "measurements-history",
          title: "History and charts",
          body: "History and charts help you compare body metrics over time.",
          targetIds: ["measurements-entries-card", "measurements-trends-card"],
          optional: true,
        },
      ],
    },
    {
      pageId: "program",
      label: "Program",
      route: pageRoute.program,
      steps: [
        {
          id: "program-header",
          title: "Program settings",
          body: "Program controls your split, phase length, deload setup, and template mapping.",
          targetIds: ["program-header"],
        },
        {
          id: "program-summary",
          title: "Program summary",
          body: "These stats show the current structure before you make edits.",
          targetIds: ["program-summary"],
          optional: true,
        },
        {
          id: "program-guided",
          title: "Guided setup",
          body: "Run guided setup when you want to regenerate your plan quickly.",
          targetIds: ["program-guided-setup"],
          optional: true,
        },
        {
          id: "program-basics",
          title: "Basics",
          body: "Basics covers the program name, week count, week length, and deload behavior.",
          targetIds: ["program-basics"],
          optional: true,
        },
        {
          id: "program-split",
          title: "Weekly split",
          body: "Weekly Split maps each day to its training focus and optional template.",
          targetIds: ["program-weekly-split"],
          optional: true,
        },
        {
          id: "program-allocator",
          title: "Volume allocator",
          body: "The allocator helps compare planned volume with your weekly muscle targets.",
          targetIds: ["program-allocator"],
          optional: true,
        },
        {
          id: "program-actions",
          title: "Save and apply",
          body: "Save program changes here, then optionally apply templates to future empty sessions.",
          targetIds: ["program-actions"],
          optional: true,
        },
      ],
    },
    {
      pageId: "templates",
      label: "Templates",
      route: pageRoute.templates,
      steps: [
        {
          id: "templates-header",
          title: "Templates",
          body: "Templates are reusable workout plans that can be imported into sessions.",
          targetIds: ["templates-header"],
        },
        {
          id: "templates-create",
          title: "Create templates",
          body: "Name a new template here, then add exercises and planned set targets.",
          targetIds: ["templates-create-card"],
          optional: true,
        },
        {
          id: "templates-card",
          title: "Template cards",
          body: "Each card can be collapsed, renamed, duplicated, hidden, or deleted.",
          targetIds: ["templates-first-card"],
          optional: true,
        },
        {
          id: "templates-exercises",
          title: "Template exercises",
          body: "Inside a template, reorder exercises and tune planned sets or rep targets.",
          targetIds: ["templates-first-exercises"],
          optional: true,
        },
        {
          id: "templates-library",
          title: "Exercise library",
          body: "The library section lets you clean up exercise metadata and optional flags.",
          targetIds: ["templates-exercise-library"],
          optional: true,
        },
      ],
    },
    {
      pageId: "settings",
      label: "Settings",
      route: pageRoute.settings,
      steps: [
        {
          id: "settings-header",
          title: "Settings",
          body: "Settings is the control center for preferences, account controls, app intros, and data safety.",
          targetIds: ["settings-header"],
          prepare: "settings-general",
        },
        {
          id: "settings-tabs",
          title: "Settings tabs",
          body: "Use these tabs to jump between general, profile, appearance, progress, library, and safety controls.",
          targetIds: ["settings-tab-strip"],
          prepare: "settings-general",
        },
        {
          id: "settings-save",
          title: "Save and undo",
          body: "Settings autosave, but these controls let you force a save or undo the last saved change.",
          targetIds: ["settings-save-controls"],
          prepare: "settings-general",
          optional: true,
        },
        {
          id: "settings-intros",
          title: "Replay guided intros",
          body: "Replay all intros or just one page whenever you want a refresher.",
          targetIds: ["settings-guided-intros"],
          prepare: "settings-general",
          optional: true,
        },
        {
          id: "settings-profile",
          title: "Profile and account",
          body: "Profile includes sync identity, password, sign-out, and account security controls.",
          targetIds: ["settings-profile-panel"],
          prepare: "settings-profile",
          optional: true,
        },
        {
          id: "settings-appearance",
          title: "Appearance",
          body: "Appearance controls theme presets, density, motion, and visual preferences.",
          targetIds: ["settings-appearance-panel"],
          prepare: "settings-appearance",
          optional: true,
        },
        {
          id: "settings-safety",
          title: "Data and safety",
          body: "Data & Safety includes export/import, reset protection, and account deletion controls.",
          targetIds: ["settings-safety-panel"],
          prepare: "settings-safety",
          optional: true,
        },
      ],
    },
  ];
}

function dispatchPrepare(target?: TourPrepareTarget) {
  if (!target) return;
  const prefix = target.split("-")[0];
  window.dispatchEvent(
    new CustomEvent(`app-intro:${prefix}-prepare`, { detail: { target } })
  );
}

function flattenPages(
  pages: GuidedAppIntroPage[],
  pendingPages: AppIntroPageId[]
): RuntimeStep[] {
  const pending = new Set(pendingPages);
  return pages
    .filter((page) => pending.has(page.pageId))
    .flatMap((page) =>
      page.steps.map((step, index) => ({
        ...step,
        route: step.route || page.route,
        pageId: page.pageId,
        pageLabel: page.label,
        pageStepIndex: index,
        pageStepTotal: page.steps.length,
      }))
    );
}

export default function GuidedAppIntro({
  steps,
  pages,
  settingsApi = defaultSettingsApi,
}: {
  steps?: GuidedAppIntroStep[];
  pages?: GuidedAppIntroPage[];
  settingsApi?: SettingsApi;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const tourPages = useMemo<GuidedAppIntroPage[]>(
    () =>
      steps
        ? [
            {
              pageId: "sessions",
              label: "Training",
              route: "/sessions",
              steps,
            },
          ]
        : pages || buildDefaultAppIntroPages(),
    [pages, steps]
  );
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [runtimeSteps, setRuntimeSteps] = useState<RuntimeStep[]>([]);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [cardSize, setCardSize] = useState<CardSize | null>(null);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const runtimeStepsRef = useRef<RuntimeStep[]>([]);
  const resolverIdRef = useRef(0);
  const locationPathRef = useRef(location.pathname);
  const didInitialLoadRef = useRef(false);
  const loadingIntroRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const step = runtimeSteps[index];
  const total = runtimeSteps.length;

  useEffect(() => {
    runtimeStepsRef.current = runtimeSteps;
  }, [runtimeSteps]);

  useEffect(() => {
    locationPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    reducedMotionRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true ||
      document.documentElement.getAttribute("data-reduced-motion") === "true";
  }, []);

  const loadIntro = useCallback(async () => {
    if (activeRef.current || loadingIntroRef.current) return;
    loadingIntroRef.current = true;
    try {
      const settings = await settingsApi.getSettings();
      if (activeRef.current) return;
      const shouldRun = shouldRunAppIntro(settings);
      const pendingPages = getPendingAppIntroPages(settings);
      const nextSteps = flattenPages(tourPages, pendingPages);
      runtimeStepsRef.current = nextSteps;
      setRuntimeSteps(nextSteps);
      activeRef.current = shouldRun && nextSteps.length > 0;
      setActive(activeRef.current);
      if (activeRef.current) setIndex(0);
    } catch (err) {
      console.warn("[app-intro] failed to read settings", err);
    } finally {
      loadingIntroRef.current = false;
    }
  }, [settingsApi, tourPages]);

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    void loadIntro();
  }, [loadIntro]);

  useEffect(() => {
    if (!didInitialLoadRef.current || activeRef.current) return;
    void loadIntro();
  }, [loadIntro, location.pathname]);

  useEffect(() => {
    const handler = () => {
      if (activeRef.current) return;
      void loadIntro();
    };
    window.addEventListener("app-intro:replay", handler);
    return () => window.removeEventListener("app-intro:replay", handler);
  }, [loadIntro]);

  const finishAll = useCallback(
    async (mode: "complete" | "skip") => {
      resolverIdRef.current += 1;
      activeRef.current = false;
      setActive(false);
      setBusy(false);
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

  const waitForRoute = useCallback(async (route: string, resolverId: number) => {
    const deadline = Date.now() + 1400;
    while (Date.now() < deadline) {
      if (!activeRef.current || resolverIdRef.current !== resolverId) {
        return false;
      }
      if (locationPathRef.current === route) return true;
      await waitFrame();
    }
    return locationPathRef.current === route;
  }, []);

  const waitForPreparedLayout = useCallback(async (resolverId: number) => {
    await waitFrame();
    if (!activeRef.current || resolverIdRef.current !== resolverId) return false;
    await waitFrame();
    if (!activeRef.current || resolverIdRef.current !== resolverId) return false;
    if (!reducedMotionRef.current) {
      await waitMs(160);
      if (!activeRef.current || resolverIdRef.current !== resolverId) {
        return false;
      }
      await waitFrame();
    }
    return activeRef.current && resolverIdRef.current === resolverId;
  }, []);

  const waitForStableTarget = useCallback(
    async (
      targetIds: string[],
      resolverId: number,
      timeoutMs = 1200
    ): Promise<{ target: HTMLElement; rect: TargetRect } | null> => {
      const deadline = Date.now() + timeoutMs;
      let previousRect: TargetRect | null = null;
      let stableFrames = 0;

      while (Date.now() < deadline) {
        if (!activeRef.current || resolverIdRef.current !== resolverId) {
          return null;
        }

        const nextTarget = findTourTarget(targetIds);
        const nextRect = getTargetRect(nextTarget);

        if (nextTarget && nextRect) {
          stableFrames = rectsClose(previousRect, nextRect)
            ? stableFrames + 1
            : 0;
          previousRect = nextRect;
          if (stableFrames >= 2) {
            return { target: nextTarget, rect: nextRect };
          }
        } else {
          previousRect = null;
          stableFrames = 0;
        }

        await waitFrame();
      }

      const fallbackTarget = findTourTarget(targetIds);
      const fallbackRect = getTargetRect(fallbackTarget);
      return fallbackTarget && fallbackRect
        ? { target: fallbackTarget, rect: fallbackRect }
        : null;
    },
    []
  );

  const resolveTarget = useCallback(
    async (candidate: RuntimeStep, resolverId: number) => {
      const firstReady = await waitForStableTarget(
        candidate.targetIds,
        resolverId,
        candidate.optional ? 550 : 1300
      );
      if (!firstReady) return null;

      firstReady.target.scrollIntoView?.({
        block: "center",
        inline: "center",
        behavior: "auto",
      });
      await waitFrame();

      return (
        (await waitForStableTarget(candidate.targetIds, resolverId, 900)) ||
        firstReady
      );
    },
    [waitForStableTarget]
  );

  const resolveStep = useCallback(
    async (requestedIndex: number, direction: 1 | -1 = 1) => {
      if (!activeRef.current) return;
      const currentSteps = runtimeStepsRef.current;
      if (!currentSteps.length) {
        await finishAll("complete");
        return;
      }
      if (requestedIndex < 0) {
        setIndex(0);
        return;
      }
      if (requestedIndex >= currentSteps.length) {
        await finishAll("complete");
        return;
      }

      const resolverId = resolverIdRef.current + 1;
      resolverIdRef.current = resolverId;
      setBusy(true);
      let nextIndex = requestedIndex;
      while (nextIndex >= 0 && nextIndex < currentSteps.length) {
        const candidate = currentSteps[nextIndex];
        if (candidate.route && locationPathRef.current !== candidate.route) {
          navigate(candidate.route);
          const routed = await waitForRoute(candidate.route, resolverId);
          if (!routed) {
            if (resolverIdRef.current === resolverId) setBusy(false);
            return;
          }
        }
        dispatchPrepare(candidate.prepare);
        const prepared = await waitForPreparedLayout(resolverId);
        if (!prepared) return;

        const readyTarget = await resolveTarget(candidate, resolverId);
        if (!activeRef.current || resolverIdRef.current !== resolverId) return;
        if (readyTarget) {
          setIndex(nextIndex);
          setTarget(readyTarget.target);
          setRect(readyTarget.rect);
          setBusy(false);
          return;
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

      if (resolverIdRef.current === resolverId) {
        setBusy(false);
        await finishAll("complete");
      }
    },
    [
      finishAll,
      navigate,
      resolveTarget,
      waitForPreparedLayout,
      waitForRoute,
    ]
  );

  const completeCurrentPageAndAdvance = useCallback(async () => {
    if (!step || busy) return;
    const pageId = step.pageId;
    await settingsApi.setSettings((current) =>
      withAppIntroPageCompleted(current, pageId)
    );
    const nextIndex = index + 1;
    const nextStep = runtimeStepsRef.current[nextIndex];
    if (!nextStep) {
      resolverIdRef.current += 1;
      activeRef.current = false;
      setActive(false);
      setBusy(false);
      setRect(null);
      setTarget(null);
      return;
    }
    void resolveStep(nextIndex, 1);
  }, [busy, index, resolveStep, settingsApi, step]);

  const skipCurrentPage = useCallback(async () => {
    if (!step || busy) return;
    const pageId = step.pageId;
    await settingsApi.setSettings((current) =>
      withAppIntroPageSkipped(current, pageId)
    );
    const nextIndex = runtimeStepsRef.current.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index && candidate.pageId !== pageId
    );
    if (nextIndex < 0) {
      resolverIdRef.current += 1;
      activeRef.current = false;
      setActive(false);
      setBusy(false);
      setRect(null);
      setTarget(null);
      return;
    }
    void resolveStep(nextIndex, 1);
  }, [busy, index, resolveStep, settingsApi, step]);

  useEffect(() => {
    if (!active) return;
    activeRef.current = true;
    void resolveStep(index);
  }, [active]);

  useEffect(() => {
    if (!active || !step) return;
    let frame = 0;
    const updateRect = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setRect((current) => {
          const next = getTargetRect(target);
          return rectsClose(current, next) ? current : next;
        });
      });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void finishAll("skip");
      }
    };
    const resizeObserver =
      target && "ResizeObserver" in window
        ? new ResizeObserver(updateRect)
        : null;
    const mutationObserver =
      "MutationObserver" in window
        ? new MutationObserver(updateRect)
        : null;
    if (target) resizeObserver?.observe(target);
    mutationObserver?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("keydown", onKey);
    updateRect();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, finishAll, step, target]);

  useEffect(() => {
    if (!active || !cardRef.current) return;
    const measure = () => {
      const box = cardRef.current?.getBoundingClientRect();
      if (!box) return;
      setCardSize((current) => {
        const next = { width: box.width, height: box.height };
        return current &&
          Math.abs(current.width - next.width) < 1 &&
          Math.abs(current.height - next.height) < 1
          ? current
          : next;
      });
    };
    const observer =
      "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    observer?.observe(cardRef.current);
    measure();
    return () => observer?.disconnect();
  }, [active, step?.id]);

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

  const cardStyle = getGuidedIntroCardStyle(rect, cardSize);
  const nextStep = runtimeSteps[index + 1];
  const isLast = index >= total - 1;
  const isLastInPage = !nextStep || nextStep.pageId !== step.pageId;
  const currentPageNumber =
    APP_INTRO_PAGE_IDS.findIndex((pageId) => pageId === step.pageId) + 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[2400] pointer-events-auto"
      aria-live="polite"
      data-guided-app-intro
      data-guided-step-id={step.id}
    >
      <div
        className="fixed rounded-2xl border border-emerald-300/70 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.76),0_0_0_1px_rgba(255,255,255,0.35),0_18px_55px_rgba(16,185,129,0.28)] pointer-events-none"
        style={highlightStyle}
        data-guided-intro-highlight
      />
      <div
        ref={cardRef}
        className="fixed pointer-events-auto max-h-[calc(100vh-24px)] overflow-auto rounded-2xl border border-white/12 bg-slate-950/95 p-3.5 text-white shadow-[0_24px_70px_-28px_rgba(16,185,129,0.75)] backdrop-blur-xl sm:p-4"
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guided-intro-title"
        data-guided-intro-card
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/75 sm:tracking-[0.26em]">
              {step.pageLabel} {step.pageStepIndex + 1} / {step.pageStepTotal}
              <span className="text-white/35">
                {" "}
                - Page {currentPageNumber} / {APP_INTRO_PAGE_IDS.length}
              </span>
            </div>
            <h2
              id="guided-intro-title"
              className="mt-2 text-base font-semibold leading-tight text-white sm:text-lg"
            >
              {step.title}
            </h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            <button
              type="button"
              className="text-[11px] font-medium text-white/45 transition hover:text-white/80 disabled:opacity-30"
              disabled={busy}
              onClick={() => void skipCurrentPage()}
            >
              Skip page
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-white/35 transition hover:text-white/80"
              onClick={() => void finishAll("skip")}
            >
              Skip all
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {step.body}
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300"
            style={{ width: `${((index + 1) / Math.max(1, total)) * 100}%` }}
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
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="hidden rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:bg-white/10 disabled:opacity-35 min-[380px]:inline-flex"
              disabled={busy}
              onClick={() => void skipCurrentPage()}
            >
              Skip page
            </button>
            <button
              type="button"
              className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-60"
              disabled={busy}
              onClick={() =>
                isLast || isLastInPage
                  ? void completeCurrentPageAndAdvance()
                  : void resolveStep(index + 1, 1)
              }
            >
              {isLast ? "Done" : isLastInPage ? "Next page" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
