import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type MouseEvent,
} from "react";
import { db } from "../lib/db";
import { getAllCached, invalidate } from "../lib/dataCache";
import { waitForSession } from "../lib/supabase";
import { requestRealtime } from "../lib/supabaseSync";
import {
  Exercise,
  Session,
  SessionEntry,
  SetEntry,
  Template,
  Settings,
} from "../lib/types";
import { buildSuggestions } from "../lib/progression";
import { useProgram } from "../state/program";
import { computeDeloadWeeks, programSummary } from "../lib/program";
import { buildPrevBestMap, getPrevBest } from "../lib/prevBest";
import { nanoid } from "nanoid";
import {
  getDeloadPrescription,
  getDeloadPrescriptionsBulk,
  getLastWorkingSets,
} from "../lib/helpers";
import { parseOptionalNumber, formatOptionalNumber } from "../lib/parse";
import { getSettings, setSettings } from "../lib/helpers";
import { motion, AnimatePresence } from "framer-motion";
import {
  unlockAudio,
  playRestBeep,
  playBeepStyle,
  setBeepVolumeScalar,
} from "../lib/audio";
import { fadeSlideUp, maybeDisable } from "../lib/motion";
import { computeSessionPacing } from "../lib/pacing";
import ImportTemplateDialog from "../features/sessions/ImportTemplateDialog";
import SaveTemplateDialog from "../features/sessions/SaveTemplateDialog";
import { rollingPRs } from "../lib/helpers";
import { setLastAction, undo as undoLast } from "../lib/undo";
import PhaseStepper from "../components/PhaseStepper";
import SessionBreadcrumb from "../components/SessionBreadcrumb";
import JumpToLatest from "../components/JumpToLatest";
import FloatingRestTimer from "../components/FloatingRestTimer";
// Using global snack queue instead of legacy Snackbar
import { useSnack } from "../state/snackbar";
import { getMuscleIconPath } from "../lib/muscles";
import { useExerciseMap, computeMuscleCounts } from "../lib/sessionHooks";
import OptionSheet, { OptionSheetOption } from "../components/OptionSheet";

const KG_TO_LB = 2.2046226218;

function TopMuscleAndContents({
  session,
  exMap,
  exNameCache,
}: {
  session: Session;
  exMap: Map<string, Exercise>;
  exNameCache: Record<string, string>;
}) {
  // Optimized: Use extracted computeMuscleCounts with proper memoization
  const muscleCounts = useMemo(() => {
    const counts = computeMuscleCounts(session, exMap);
    const order = [
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
    return Object.entries(counts)
      .filter(([, c]) => c > 0)
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [session.id, session.entries.length, exMap]); // Only recompute when session ID or entry count changes

  if (session.entries.length === 0) return null;
  return (
    <div className="sticky top-0 z-20 -mt-1 mb-1 pt-1 space-y-1">
      {muscleCounts.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none px-1 py-1 rounded-xl bg-slate-900/70 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50 border border-white/5">
          {muscleCounts.map(([k, c]) => {
            const src = getMuscleIconPath(k);
            return (
              <div
                key={k}
                className="badge-muscle icon-glow"
                aria-label={`${k} working sets ${c}`}
              >
                {src ? (
                  <img src={src} alt={k} className="w-6 h-6 object-contain" />
                ) : (
                  <span className="w-6 h-6" />
                )}
                <span className="tabular-nums leading-none">{c}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto scrollbar-none px-1 py-1 rounded-xl bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-slate-900/40 border border-white/5">
        {session.entries.map((en, i) => {
          const ex = exMap.get(en.exerciseId);
          const name = ex?.name || exNameCache[en.exerciseId] || `Ex ${i + 1}`;
          const short = name.length > 18 ? name.slice(0, 16) + "…" : name;
          return (
            <button
              key={en.id}
              onClick={() => {
                const el = document.getElementById(`exercise-${en.id}`);
                if (el)
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="text-[10px] leading-none px-2 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-600/70 active:scale-95 transition text-slate-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DeloadInfo = Awaited<ReturnType<typeof getDeloadPrescription>>;

type SessionAnalytics = {
  plannedSets: number;
  completedSets: number;
  completionPct: number;
  totalVolume: number;
  prSignals: number;
  totalExercises: number;
  completedExercises: number;
  muscleLoad: Array<{
    muscle: string;
    workingSets: number;
    totalSets: number;
    tonnage: number;
  }>;
  incompleteExercises: Array<{
    entryId: string;
    name: string;
    missingSets: number;
    totalSets: number;
    muscle: string;
    order: number;
    workingSets: number;
  }>;
};

type WipeScope = "day" | "week" | "phase";

type WipeCounts = {
  weekSessions: number;
  weekEntries: number;
  weekSets: number;
  phaseSessions: number;
  phaseEntries: number;
  phaseSets: number;
};

const pluralize = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

const getSessionPhaseNumber = (session: Session): number | null => {
  const { phaseNumber, phase } = session;
  const direct =
    phaseNumber != null
      ? Number(phaseNumber)
      : phase != null
      ? Number(phase)
      : null;
  if (direct != null && Number.isFinite(direct)) return direct;
  const [phasePart] = (session.id || "").split("-");
  const fallback = Number(phasePart);
  return Number.isFinite(fallback) ? fallback : null;
};

const getSessionWeekNumber = (session: Session): number | null => {
  const direct = Number(session.weekNumber);
  if (Number.isFinite(direct)) return direct;
  const [, weekPart] = (session.id || "").split("-");
  const fallback = Number(weekPart);
  return Number.isFinite(fallback) ? fallback : null;
};

const getSessionDayIndex = (session: Session): number | null => {
  const [, , dayPart] = (session.id || "").split("-");
  const fallback = Number(dayPart);
  return Number.isFinite(fallback) ? fallback : null;
};

const MAX_CACHE_ENTRIES = 24;
const SESSION_TTL_IDLE_MS = 45_000;
const SESSION_TTL_EDITING_MS = 12_000;

const computeSessionCacheTtl = (editingFieldCount: number) =>
  editingFieldCount > 0 ? SESSION_TTL_EDITING_MS : SESSION_TTL_IDLE_MS;

const trimCache = (cache: Map<string, any>) => {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const iterator = cache.keys().next();
  if (!iterator.done) cache.delete(iterator.value);
};

const sessionSignature = (sessions: Session[]) =>
  sessions
    .map((s) =>
      [
        s.id,
        s.updatedAt || "",
        s.entries?.length ?? 0,
        s.loggedEndAt || "",
      ].join(":")
    )
    .join("|");

const exerciseSignature = (exercises: Exercise[]) =>
  exercises
    .map((e) => [e.id, (e as any)?.updatedAt || "", e.name || ""].join(":"))
    .join("|");

const stableHash = (value: any): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableHash).join(",")}]`;
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${key}:${stableHash(value[key])}`);
  return `{${entries.join(",")}}`;
};

type ExerciseHistoryRow = {
  exerciseId: string;
  sessionId: string;
  entryId: string;
  dateISO: string | null | undefined;
  localDate?: string | null;
  weekNumber?: number | null;
  phaseNumber?: number | null;
  dayName?: string | null;
  sets: SetEntry[];
  workingSets: number;
  totalSets: number;
  tonnageKg: number;
  bestSet: { weightKg: number; reps: number; rpe?: number | null } | null;
};

const DAYS = [
  "Upper A",
  "Lower A",
  "Upper B",
  "Lower B",
  "Upper C",
  "Lower C",
  "Rest",
];

const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  traps: "Traps",
  lats: "Lats",
  delts: "Delts",
  upper_back: "Upper Back",
  lower_back: "Lower Back",
  abs: "Abs",
  cardio: "Cardio",
  conditioning: "Conditioning",
  mobility: "Mobility",
  other: "Other",
};

const formatMuscleLabel = (muscle?: string | null) => {
  if (!muscle) return "General";
  return (
    MUSCLE_LABELS[muscle] ||
    muscle.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

const coerceNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const fallback = Number((value as number | null | undefined) ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
};

const setHasActualWork = (set?: SetEntry | null) => {
  if (!set) return false;
  const weight = coerceNumber(set.weightKg);
  const reps = coerceNumber(set.reps);
  return weight > 0 || reps > 0;
};

const setHasRecordedWork = (set?: SetEntry | null) => {
  if (!setHasActualWork(set)) return false;
  const completionMs = set?.completedAt ? Date.parse(set.completedAt) : NaN;
  return Number.isFinite(completionMs) && completionMs > 0;
};

const toTimestamp = (value?: string | number | null): number => {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    let parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) return parsed;
    const compact = trimmed.replace(/[^0-9]/g, "");
    if (compact.length === 8) {
      const iso = `${compact.slice(0, 4)}-${compact.slice(
        4,
        6
      )}-${compact.slice(6, 8)}T12:00:00Z`;
      parsed = Date.parse(iso);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

const sessionRealActivityMs = (session?: Session | null) => {
  if (!session || session.deletedAt) return 0;
  let maxMs = 0;
  let hasWork = false;
  const consider = (value?: string | number | null) => {
    const ms = toTimestamp(value);
    if (ms > maxMs) maxMs = ms;
  };
  if (Array.isArray(session.entries)) {
    for (const entry of session.entries) {
      if (!Array.isArray(entry.sets)) continue;
      for (const set of entry.sets) {
        if (!setHasActualWork(set)) continue;
        hasWork = true;
        if (setHasRecordedWork(set)) {
          consider(set?.completedAt);
        }
        const maybeUpdated = (set as any)?.updatedAt;
        if (maybeUpdated) consider(maybeUpdated);
      }
    }
  }
  if (session.workLog) {
    for (const log of Object.values(session.workLog)) {
      const count = log?.count ?? 0;
      if (count >= 2 || (log?.activeMs ?? 0) > 0) {
        hasWork = true;
        consider(log?.last);
        consider(log?.first);
      }
    }
  }
  if (hasWork) {
    consider(session.loggedEndAt);
    consider(session.loggedStartAt);
    consider(session.updatedAt);
    consider(session.createdAt);
    consider(session.dateISO);
    if (session.localDate) {
      consider(`${session.localDate}T12:00:00Z`);
    }
  }
  return maxMs > 0 ? maxMs : 0;
};

const sessionHasRealWork = (session?: Session | null) => {
  if (!session || session.deletedAt) return false;
  if (!Array.isArray(session.entries) || session.entries.length === 0)
    return false;
  if (!session.entries.some((entry) => entry.sets?.some(setHasActualWork))) {
    return false;
  }
  return sessionRealActivityMs(session) > 0;
};
export default function Sessions() {
  const { program } = useProgram();
  const [week, setWeek] = useState<any>(1);
  const [phase, setPhase] = useState<number>(1);
  // When user selects a new phase (e.g., Phase 2) without any logged sets yet,
  // keep the UI on that phase without auto-reverting until a valid set is saved.
  const [allowEmptyPhase, setAllowEmptyPhase] = useState<boolean>(false);
  const phaseCommitPendingRef = useRef<number | null>(null);
  const [day, setDay] = useState(0);
  // Gate initial session load until we resolve navigation prefs (prevents brief Week 1 render)
  const [initialRouteReady, setInitialRouteReady] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  // Lightweight cache of exerciseId -> name to avoid name flicker when lists refresh
  const [exNameCache, setExNameCache] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<
    Map<string, { weightKg?: number; reps?: number }>
  >(new Map());
  const [session, setSession] = useState<Session | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [addFilter, setAddFilter] = useState<string>("all");
  const [dragEntryIdx, setDragEntryIdx] = useState<number | null>(null);
  const { push } = useSnack();
  const [showImport, setShowImport] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [historyContext, setHistoryContext] = useState<{
    exerciseId: string;
    name: string;
    entries: ExerciseHistoryRow[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyLoadTokenRef = useRef(0);
  const editingFieldsRef = useRef<Set<string>>(new Set()); // Track focused weight/reps inputs to adapt cache TTL
  const currentSessionsTtl = useCallback(
    () => computeSessionCacheTtl(editingFieldsRef.current.size),
    []
  );
  const persistSession = useCallback(async (value: Session) => {
    await db.put("sessions", value);
    invalidate("sessions");
  }, []);
  // Switch Exercise modal state
  const [switchTarget, setSwitchTarget] = useState<{ entryId: string } | null>(
    null
  );
  const [switchQuery, setSwitchQuery] = useState("");
  const [switchScope, setSwitchScope] = useState<"group" | "all">("group");
  useEffect(() => {
    if (!switchTarget) {
      setSwitchScope("group");
      setSwitchQuery("");
      return;
    }
    setSwitchScope("group");
    setSwitchQuery("");
  }, [switchTarget?.entryId]);
  const [prevBestMap, setPrevBestMap] = useState<{
    [id: string]: { week: number; set: SetEntry };
  } | null>(null);
  const [prevBestLoading, setPrevBestLoading] = useState<boolean>(true);
  const prevBestCacheRef = useRef(
    new Map<
      string,
      {
        signature: string;
        map: {
          [id: string]: { week: number; set: SetEntry };
        } | null;
      }
    >()
  );
  const getPrevBestCached = useCallback(
    (
      sessionsList: Session[],
      phaseNum: number,
      weekNum: number,
      dayId: number,
      templateId: string | null | undefined
    ) => {
      const key = `${phaseNum}|${weekNum}|${dayId}|${templateId || "none"}`;
      const signature = sessionSignature(sessionsList);
      const cached = prevBestCacheRef.current.get(key);
      if (cached && cached.signature === signature) {
        return cached.map;
      }
      const computed = buildPrevBestMap(sessionsList, weekNum, phaseNum, dayId);
      prevBestCacheRef.current.set(key, {
        signature,
        map: computed,
      });
      trimCache(prevBestCacheRef.current);
      return computed;
    },
    []
  );
  // Previous week per-exercise set data (same day) for quick reference
  const [prevWeekSets, setPrevWeekSets] = useState<
    Record<string, { weightKg: number | null; reps: number | null }[]>
  >({});
  const [prevWeekSourceWeek, setPrevWeekSourceWeek] = useState<number | null>(
    null
  );
  const [prevWeekLoading, setPrevWeekLoading] = useState<boolean>(false);
  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const [deloadPrescriptions, setDeloadPrescriptions] = useState<
    Record<string, DeloadInfo>
  >({});
  const deloadCacheRef = useRef(
    new Map<
      string,
      {
        signature: string;
        map: Record<string, DeloadInfo>;
      }
    >()
  );
  const getDeloadCached = useCallback(
    (
      cacheKey: string,
      signature: string,
      producer: () => Promise<Record<string, DeloadInfo>>
    ) => {
      const cached = deloadCacheRef.current.get(cacheKey);
      if (cached && cached.signature === signature) {
        return { hit: true as const, map: cached.map };
      }
      return producer().then((map) => {
        deloadCacheRef.current.set(cacheKey, { signature, map });
        trimCache(deloadCacheRef.current);
        return { hit: false as const, map };
      });
    },
    []
  );
  const [deloadLoading, setDeloadLoading] = useState(false);
  const [deloadError, setDeloadError] = useState(false);
  const [autoNavDone, setAutoNavDone] = useState(false);
  const lastRealSessionAppliedRef = useRef(false);
  // Track the latest session location for jump-to-latest feature
  const [latestLocation, setLatestLocation] = useState<{
    phase: number;
    week: number;
    day: number;
  } | null>(null);
  // Per-exercise rest timers keyed by entry.id (single timer per exercise)
  const [restTimers, setRestTimers] = useState<
    Record<
      string,
      {
        start: number;
        elapsed: number;
        running: boolean;
        finished?: boolean;
        alerted?: boolean;
      }
    >
  >({});
  const REST_TIMER_MAX = 300000; // 5 minutes auto-reset (was 3min)
  const [readinessPct, setReadinessPct] = useState(0);
  // Manual date editing UI state
  const [editingDate, setEditingDate] = useState(false);
  const [dateEditValue, setDateEditValue] = useState("");
  // Stamp animation state
  const [stampAnimating, setStampAnimating] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [wipeSheetOpen, setWipeSheetOpen] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);
  const [wipeCounts, setWipeCounts] = useState<WipeCounts | null>(null);
  const [wipeScope, setWipeScope] = useState<WipeScope>("day");
  const [wipeConfirmValue, setWipeConfirmValue] = useState("");
  const [wipeError, setWipeError] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLElement | null>(null);
  // Ephemeral weight input strings (to allow user to type trailing '.')
  const weightInputEditing = useRef<Record<string, string>>({});
  // Ephemeral reps input strings (avoid lag & flicker when clearing digits)
  const repsInputEditing = useRef<Record<string, string>>({});
  // Collapsed exercise card state (entry.id -> collapsed?)
  const [collapsedEntries, setCollapsedEntries] = useState<
    Record<string, boolean>
  >({});
  const [collapsedInitialized, setCollapsedInitialized] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const focusPrevCollapsedRef = useRef<Record<string, boolean> | null>(null);
  const toggleEntryCollapsed = (id: string) =>
    setCollapsedEntries((prev) => ({ ...prev, [id]: !prev[id] }));
  // Cache of day labels to avoid flicker before program loads
  const [labelsCache, setLabelsCache] = useState<string[] | null>(null);
  const parsedDay = typeof day === "number" ? day : Number(day);
  const dayIndexNumber =
    Number.isFinite(parsedDay) && parsedDay >= 0 ? Math.floor(parsedDay) : 0;
  const parsedWeek = Number(week);
  const weekNumber =
    Number.isFinite(parsedWeek) && parsedWeek > 0 ? Math.floor(parsedWeek) : 1;
  const parsedPhase = Number(phase);
  const phaseNumber =
    Number.isFinite(parsedPhase) && parsedPhase > 0
      ? Math.floor(parsedPhase)
      : 1;
  const rawDayLabel =
    labelsCache?.[dayIndexNumber] ??
    DAYS[dayIndexNumber] ??
    `Day ${dayIndexNumber + 1}`;
  const dayTitle = /^day\s*\d+/i.test(rawDayLabel)
    ? rawDayLabel
    : `Day ${dayIndexNumber + 1} – ${rawDayLabel}`;
  const weekLabel = `Week ${weekNumber}`;
  const phaseLabel = `Phase ${phaseNumber}`;
  // Track if we have already auto-picked a latest session to avoid settings lastLocation race overriding it
  const pickedLatestRef = useRef(false);
  const skipAutoNavRef = useRef(false);
  useEffect(() => {
    if (!wipeSheetOpen) return;
    let cancelled = false;
    setWipeCounts(null);
    (async () => {
      try {
        const all = await db.getAll<Session>("sessions");
        const unique = new Map<string, Session>();
        for (const item of all) {
          if (item?.id) unique.set(item.id, item);
        }
        if (session?.id) {
          unique.set(session.id, session);
        }
        const counts: WipeCounts = {
          weekSessions: 0,
          weekEntries: 0,
          weekSets: 0,
          phaseSessions: 0,
          phaseEntries: 0,
          phaseSets: 0,
        };
        const programId = session?.programId ?? null;
        const targetPhase = session
          ? getSessionPhaseNumber(session) ?? phaseNumber
          : phaseNumber;
        const targetWeek = session
          ? getSessionWeekNumber(session) ?? weekNumber
          : weekNumber;
        for (const candidate of unique.values()) {
          if (candidate?.deletedAt) continue;
          if (
            programId &&
            candidate.programId &&
            candidate.programId !== programId
          ) {
            continue;
          }
          const candidatePhase = getSessionPhaseNumber(candidate);
          if (candidatePhase == null || targetPhase == null) {
            continue;
          }
          if (candidatePhase !== targetPhase) {
            continue;
          }
          const entryCount = candidate.entries?.length ?? 0;
          const setCount = candidate.entries?.reduce(
            (sum, entry) => sum + (entry.sets?.length ?? 0),
            0
          );
          counts.phaseSessions += 1;
          counts.phaseEntries += entryCount;
          counts.phaseSets += setCount;
          const candidateWeek = getSessionWeekNumber(candidate);
          if (
            candidateWeek != null &&
            targetWeek != null &&
            candidateWeek === targetWeek
          ) {
            counts.weekSessions += 1;
            counts.weekEntries += entryCount;
            counts.weekSets += setCount;
          }
        }
        if (!cancelled) {
          setWipeCounts(counts);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Sessions] Failed to compute wipe impact", err);
          setWipeCounts(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wipeSheetOpen, phaseNumber, weekNumber, session?.programId, session?.id]);
  // Persist collapsed state per-session (mobile UX enhancement)
  useEffect(() => {
    setCollapsedInitialized(false);
  }, [session?.id, currentSessionsTtl]);
  useEffect(() => {
    if (!session?.id) return;
    if (collapsedInitialized) return;
    let initial: Record<string, boolean> | null = null;
    try {
      const raw = sessionStorage.getItem(`collapsedEntries:${session.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          initial = parsed;
        }
      }
    } catch {}
    if (!initial) {
      initial = {};
    }
    if (Array.isArray(session?.entries)) {
      for (const entry of session.entries) {
        if (initial[entry.id] === undefined) {
          initial[entry.id] = true;
        }
      }
    }
    setCollapsedEntries(initial);
    setCollapsedInitialized(true);
  }, [session?.id, session?.entries?.length, collapsedInitialized]);
  useEffect(() => {
    if (!session?.entries?.length) return;
    setCollapsedEntries((prev) => {
      if (!prev || typeof prev !== "object") {
        const next: Record<string, boolean> = {};
        for (const entry of session.entries) {
          next[entry.id] = true;
        }
        return next;
      }
      let changed = false;
      const next = { ...prev };
      for (const entry of session.entries) {
        if (next[entry.id] === undefined) {
          next[entry.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [session?.entries?.length]);
  useEffect(() => {
    if (!wipeSheetOpen) {
      setWipeConfirmValue("");
      setWipeError(null);
      return;
    }
    setWipeConfirmValue("");
    setWipeError(null);
  }, [wipeSheetOpen, wipeScope]);
  useEffect(() => {
    if (!session?.id) return;
    if (focusMode) return;
    try {
      sessionStorage.setItem(
        `collapsedEntries:${session.id}`,
        JSON.stringify(collapsedEntries)
      );
    } catch {}
  }, [collapsedEntries, session?.id, focusMode]);
  const collapseAll = () => {
    if (!session) return;
    if (focusMode) {
      setFocusMode(false);
      setFocusedEntryId(null);
      focusPrevCollapsedRef.current = null;
    }
    const next: Record<string, boolean> = {};
    for (const e of session.entries) {
      next[e.id] = true;
    }
    setCollapsedEntries(next);
  };
  const expandAll = () => {
    if (!session) return;
    if (focusMode) {
      setFocusMode(false);
      setFocusedEntryId(null);
      focusPrevCollapsedRef.current = null;
    }
    const next: Record<string, boolean> = {};
    for (const e of session.entries) {
      next[e.id] = false;
    }
    setCollapsedEntries(next);
  };
  const anyCollapsed = useMemo(
    () => Object.values(collapsedEntries).some((v) => v),
    [collapsedEntries]
  );
  const allCollapsed = useMemo(
    () =>
      session?.entries.length
        ? session.entries.every((e) => collapsedEntries[e.id])
        : false,
    [collapsedEntries, session?.entries.length]
  );
  const exitFocus = useCallback(() => {
    setFocusMode(false);
    setFocusedEntryId(null);
    setCollapsedEntries((prev) => {
      const restore = focusPrevCollapsedRef.current;
      if (restore) {
        const next: Record<string, boolean> = {};
        for (const key of Object.keys(restore)) {
          next[key] = restore[key];
        }
        if (session?.entries) {
          for (const entry of session.entries) {
            if (next[entry.id] === undefined) next[entry.id] = false;
          }
        }
        return next;
      }
      if (session?.entries) {
        const next: Record<string, boolean> = {};
        for (const entry of session.entries) {
          next[entry.id] = false;
        }
        return next;
      }
      return prev;
    });
    focusPrevCollapsedRef.current = null;
  }, [session]);

  const scrollToExercise = useCallback(
    (entryId: string) => {
      if (typeof window === "undefined") return;
      const target = document.getElementById(`exercise-${entryId}`);
      if (!target) return;
      let headerOffset = 0;
      try {
        const raw = getComputedStyle(document.documentElement)
          .getPropertyValue("--app-header-h")
          .trim();
        const numeric = parseFloat(raw);
        if (!Number.isNaN(numeric)) headerOffset = numeric;
      } catch {}
      const controlHeight = toolbarRef.current?.offsetHeight ?? 0;
      const extraOffset = headerOffset + controlHeight + 16;
      const rect = target.getBoundingClientRect();
      const destination = rect.top + window.scrollY - extraOffset;
      window.scrollTo({ top: Math.max(0, destination), behavior: "smooth" });
    },
    [currentSessionsTtl]
  );

  const activateFocus = useCallback(
    (entryId: string) => {
      if (!session) return;
      if (focusMode && entryId === focusedEntryId) {
        exitFocus();
        return;
      }
      if (!focusMode) {
        focusPrevCollapsedRef.current = { ...collapsedEntries };
      }
      setFocusMode(true);
      setFocusedEntryId(entryId);
      const next: Record<string, boolean> = {};
      for (const entry of session.entries) {
        next[entry.id] = entry.id !== entryId;
      }
      setCollapsedEntries(next);
      requestAnimationFrame(() => scrollToExercise(entryId));
    },
    [
      session,
      focusMode,
      focusedEntryId,
      collapsedEntries,
      exitFocus,
      scrollToExercise,
    ]
  );

  useEffect(() => {
    if (!focusMode) return;
    if (!session) {
      exitFocus();
      return;
    }
    if (
      focusedEntryId &&
      !session.entries.some((e) => e.id === focusedEntryId)
    ) {
      exitFocus();
    }
  }, [focusMode, session, focusedEntryId, exitFocus]);

  const exMap = useExerciseMap(exercises);

  const analytics = useMemo<SessionAnalytics | null>(() => {
    if (!session || session.entries.length === 0) return null;
    const planMap = new Map<
      string,
      { plannedSets: number; repRange?: string }
    >();
    if (session.templateId) {
      const tpl = templates.find((t) => t.id === session.templateId);
      if (tpl?.plan?.length) {
        for (const p of tpl.plan) {
          planMap.set(p.exerciseId, {
            plannedSets: p.plannedSets,
            repRange: p.repRange,
          });
        }
      }
    }
    let plannedSets = 0;
    let completedSets = 0;
    let completedAgainstPlan = 0;
    let totalVolume = 0;
    let prSignals = 0;
    let completedExercises = 0;
    const incompleteExercises: SessionAnalytics["incompleteExercises"] = [];
    const muscleBuckets = new Map<
      string,
      { workingSets: number; totalSets: number; tonnage: number }
    >();
    let entryOrder = 0;

    for (const entry of session.entries) {
      const ex = exMap.get(entry.exerciseId);
      const name = ex?.name || exNameCache[entry.exerciseId] || "Untitled";
      const muscle = ex?.muscleGroup || "other";
      const planned =
        planMap.get(entry.exerciseId)?.plannedSets ?? entry.sets.length;
      const working = entry.sets.filter(
        (s) => (s.reps || 0) > 0 || (s.weightKg || 0) > 0
      ).length;
      const missing = Math.max(0, planned - working);
      const tonnageEntry = entry.sets.reduce(
        (acc, s) => acc + (s.weightKg || 0) * (s.reps || 0),
        0
      );
      if (working > 0) completedExercises++;
      plannedSets += planned;
      completedSets += working;
      completedAgainstPlan += Math.min(working, planned);
      totalVolume += tonnageEntry;

      for (const set of entry.sets) {
        const ton = (set.weightKg || 0) * (set.reps || 0);
        if (ton > 0 && ton >= (ex?.defaults?.sets || 3) * 50) {
          prSignals++;
        }
      }

      const bucket = muscleBuckets.get(muscle) || {
        workingSets: 0,
        totalSets: 0,
        tonnage: 0,
      };
      bucket.workingSets += working;
      bucket.totalSets += planned;
      bucket.tonnage += tonnageEntry;
      muscleBuckets.set(muscle, bucket);

      if (missing > 0) {
        incompleteExercises.push({
          entryId: entry.id,
          name,
          missingSets: missing,
          totalSets: planned,
          muscle,
          order: entryOrder,
          workingSets: working,
        });
      }
      entryOrder += 1;
    }

    const muscleLoad = Array.from(muscleBuckets.entries())
      .map(([muscle, data]) => ({
        muscle,
        workingSets: data.workingSets,
        totalSets: data.totalSets,
        tonnage: data.tonnage,
      }))
      .sort((a, b) => b.workingSets - a.workingSets || b.tonnage - a.tonnage);

    const completionPct = plannedSets
      ? Math.round((completedAgainstPlan / plannedSets) * 100)
      : completedSets > 0
      ? 100
      : 0;

    return {
      plannedSets,
      completedSets,
      completionPct: Math.max(0, Math.min(100, completionPct)),
      totalVolume,
      prSignals,
      totalExercises: session.entries.length,
      completedExercises,
      muscleLoad,
      incompleteExercises,
    };
  }, [session, templates, exMap, exNameCache]);
  // Enable verbose session selection debugging by setting localStorage.debugSessions = '1'
  const debugSessions = useRef<boolean>(false);
  useEffect(() => {
    try {
      debugSessions.current = localStorage.getItem("debugSessions") === "1";
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Add timeout to getSettings() to prevent hanging forever
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("getSettings timeout")), 5000)
        );
        const s = await Promise.race([getSettings(), timeoutPromise]);

        // Only apply stored lastLocation if we haven't already picked the most recent session
        // Also, if navigation explicitly set lastLocation (via sessionStorage flag), prefer it and skip auto-pick
        let hadIntent = false;
        try {
          hadIntent = sessionStorage.getItem("lastLocationIntent") === "1";
          sessionStorage.removeItem("lastLocationIntent");
        } catch {}
        let last = s.dashboardPrefs?.lastLocation;
        if (last) {
          let candidate: Session | null = null;
          try {
            if (last.sessionId) {
              candidate =
                (await db.get<Session>("sessions", last.sessionId)) || null;
            }
            if (!candidate) {
              const fallbackId = `${last.phaseNumber}-${last.weekNumber}-${last.dayId}`;
              candidate =
                (await db.get<Session>("sessions", fallbackId)) || null;
            }
          } catch {}
          if (!sessionHasRealWork(candidate)) {
            last = undefined;
          }
        }
        if (!pickedLatestRef.current || hadIntent) {
          setPhase(s.currentPhase || 1);
          if (last) {
            if (debugSessions.current) {
              try {
                console.log(
                  "[Sessions debug] applying lastLocation from settings",
                  last
                );
              } catch {}
            }
            setWeek(last.weekNumber as any);
            setDay(last.dayId);
            skipAutoNavRef.current = true;
          }
          if (debugSessions.current && !last) {
            try {
              console.log(
                "[Sessions debug] no lastLocation in settings; using defaults"
              );
            } catch {}
          }
          if (hadIntent) pickedLatestRef.current = true; // lock to explicit choice
        }
      } catch (err) {
        console.error("[Sessions] Failed to load initial settings:", err);
        // Continue with defaults - don't block component initialization
      } finally {
        // CRITICAL: Always set initialRouteReady, even if getSettings fails
        // Otherwise the component will be permanently frozen
        setInitialRouteReady(true);
      }
    })();
  }, []);
  // Load exercise name cache on mount and persist updates
  useEffect(() => {
    try {
      const raw = localStorage.getItem("exerciseNamesCache");
      if (raw) setExNameCache(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    if (!session) return;
    if (!exercises.length) return;
    const map = new Map(exercises.map((e) => [e.id, e.name] as const));
    const delta: Record<string, string> = {};
    for (const en of session.entries) {
      const nm = map.get(en.exerciseId);
      if (nm && exNameCache[en.exerciseId] !== nm) delta[en.exerciseId] = nm;
    }
    if (Object.keys(delta).length) {
      const next = { ...exNameCache, ...delta };
      setExNameCache(next);
      try {
        localStorage.setItem("exerciseNamesCache", JSON.stringify(next));
      } catch {}
    }
  }, [exercises, session?.id, session?.entries?.length]);

  const exReady = useMemo(() => {
    if (!session) return false;
    if (!exercises.length && session.entries.length > 0) return false;
    return session.entries.every((en) => exMap.has(en.exerciseId));
  }, [session?.id, session?.entries?.length, exercises.length, exMap]); // exercises.length instead of exercises array

  // (auto-recover block relocated below initialLoading declaration)

  // Load cached labels on mount to avoid day-name flip
  useEffect(() => {
    try {
      const raw = localStorage.getItem("weeklyLabelsCache");
      if (raw) setLabelsCache(JSON.parse(raw));
    } catch {}
  }, []);
  // When program is available, cache its labels for next load
  useEffect(() => {
    try {
      if (program?.weeklySplit && Array.isArray(program.weeklySplit)) {
        const labels = program.weeklySplit.map(
          (d: any) => d?.customLabel || d?.type || "Day"
        );
        setLabelsCache(labels);
        localStorage.setItem("weeklyLabelsCache", JSON.stringify(labels));
      }
    } catch {}
  }, [program?.id, (program as any)?.weeklySplit?.length]);

  // Recompute progression suggestions when the active session (day identity) changes
  useEffect(() => {
    (async () => {
      if (!settingsState?.progress?.autoProgression) {
        setSuggestions(new Map());
        return;
      }
      if (!session) return;
      try {
        const [allExercises, allSessions] = await Promise.all([
          getAllCached<Exercise>("exercises", { swr: true }),
          getAllCached<Session>("sessions", {
            swr: true,
            ttlMs: currentSessionsTtl(),
          }),
        ]);
        const exerciseIds = session.entries.map((e) => e.exerciseId);
        const filteredExercises = allExercises.filter((e) =>
          exerciseIds.includes(e.id)
        );
        const deloadSet = program
          ? computeDeloadWeeks(program)
          : new Set<number>();
        const next = buildSuggestions(filteredExercises, allSessions, {
          matchTemplateId: session.templateId,
          matchDayName: session.templateId ? undefined : session.dayName,
          onlyExerciseIds: exerciseIds,
          adaptive: true,
          currentSession: session,
          deloadWeeks: deloadSet,
        });
        setSuggestions(next);
      } catch {}
    })();
  }, [
    session?.id,
    session?.templateId,
    session?.dayName,
    session?.weekNumber,
    session?.phaseNumber,
    settingsState?.progress?.autoProgression,
    program?.id,
    program?.mesoWeeks,
    program?.deload,
    currentSessionsTtl,
  ]);

  // One-time audio unlock: resume WebAudio on first user gesture to allow beeps
  useEffect(() => {
    let done = false;
    const tryUnlock = async () => {
      if (done) return;
      const ok = await unlockAudio();
      if (ok) {
        done = true;
        window.removeEventListener("pointerdown", tryUnlock);
        window.removeEventListener("keydown", tryUnlock as any);
        window.removeEventListener("touchstart", tryUnlock);
      }
    };
    window.addEventListener("pointerdown", tryUnlock, { passive: true });
    window.addEventListener("touchstart", tryUnlock, { passive: true });
    window.addEventListener("keydown", tryUnlock as any);
    return () => {
      window.removeEventListener("pointerdown", tryUnlock);
      window.removeEventListener("touchstart", tryUnlock);
      window.removeEventListener("keydown", tryUnlock as any);
    };
  }, []);

  // After initial mount, choose the most recently ACTIVE session with data.
  // Priority order:
  // 1. Latest calendar date (localDate or dateISO day) that has any non-zero set
  // 2. Within same date, latest activity timestamp (loggedEndAt > loggedStartAt > updatedAt > createdAt > dateISO)
  // 3. Tie-breaker: higher weekNumber then higher day index (parsed from id)
  // Also retroactively backfill missing loggedStart/End stamps.
  useEffect(() => {
    (async () => {
      if (lastRealSessionAppliedRef.current) return;
      // If user explicitly navigated with a chosen week/day, don't auto-pick latest
      try {
        if (sessionStorage.getItem("lastLocationIntent") === "1") {
          pickedLatestRef.current = true;
          return;
        }
      } catch {}
      try {
        const all = await db.getAll<Session>("sessions");
        let mutated = false;
        for (const s of all) {
          if (sessionHasRealWork(s) && !s.loggedEndAt) {
            (s as any).loggedEndAt = s.updatedAt || s.createdAt || s.dateISO;
            mutated = true;
          }
          if (sessionHasRealWork(s) && !s.loggedStartAt) {
            (s as any).loggedStartAt =
              s.loggedEndAt || s.updatedAt || s.createdAt || s.dateISO;
            mutated = true;
          }
        }
        if (mutated) {
          for (const s of all) {
            if (s.loggedEndAt && s.loggedStartAt) {
              try {
                await persistSession(s);
              } catch {}
            }
          }
        }
        const dayVal = (s: Session) => {
          const d = (s.localDate || s.dateISO?.slice(0, 10) || "").replace(
            /-/g,
            ""
          );
          return /^\d{8}$/.test(d) ? Number(d) : 0;
        };
        const withData = all.filter(sessionHasRealWork);
        if (!withData.length) {
          lastRealSessionAppliedRef.current = true;
          return;
        }
        withData.sort((a, b) => {
          const realA = sessionRealActivityMs(a);
          const realB = sessionRealActivityMs(b);
          if (realA !== realB) return realB - realA;
          const dv = dayVal(b) - dayVal(a);
          if (dv !== 0) return dv;
          if ((b.weekNumber || 0) !== (a.weekNumber || 0))
            return (b.weekNumber || 0) - (a.weekNumber || 0);
          const ad = Number(a.id.split("-")[2] || 0);
          const bd = Number(b.id.split("-")[2] || 0);
          return bd - ad;
        });
        const chosen = withData[0];
        if (debugSessions.current) {
          // Sanity: ensure no candidate has strictly newer calendar day than chosen
          const newer = withData.find((s) => dayVal(s) > dayVal(chosen));
          if (newer) {
            console.warn(
              "[Sessions debug] Found newer calendar session not chosen",
              { chosen: chosen.id, newer: newer.id }
            );
          }
        }
        if (debugSessions.current) {
          try {
            console.groupCollapsed("[Sessions debug] selection");
            console.log("Candidates (top 12):");
            withData.slice(0, 12).forEach((s) =>
              console.log(s.id, {
                localDate: s.localDate,
                dateISO: s.dateISO?.slice(0, 10),
                dayVal: dayVal(s),
                loggedStartAt: s.loggedStartAt,
                loggedEndAt: s.loggedEndAt,
                updatedAt: s.updatedAt,
                createdAt: s.createdAt,
                realActivityMs: sessionRealActivityMs(s),
              })
            );
            console.log("Chosen:", chosen.id);
            console.groupEnd();
          } catch {}
        }
        const parts = chosen.id.split("-");
        if (parts.length === 3) {
          const p = Number(parts[0]);
          const w = Number(parts[1]);
          const d = Number(parts[2]);
          if (!isNaN(p) && !isNaN(w) && !isNaN(d)) {
            setPhase(p);
            setWeek(w as any);
            setDay(d);
          }
        }
        lastRealSessionAppliedRef.current = true;
        pickedLatestRef.current = true;
        // Persist immediately so settings don't point to an older session later
        try {
          const settings = await getSettings();
          await setSettings({
            ...settings,
            dashboardPrefs: {
              ...(settings.dashboardPrefs || {}),
              lastLocation: {
                phaseNumber:
                  Number(parts[0]) || chosen.phaseNumber || chosen.phase || 1,
                weekNumber: Number(parts[1]) || chosen.weekNumber,
                dayId: Number(parts[2]) || 0,
                sessionId: chosen.id,
              },
            },
          });
        } catch {}
      } catch (e) {
        console.warn("Failed picking last active session", e);
      }
    })();
  }, []);

  // Auto navigation logic: stay on the most recent week within current phase that has ANY real data (weight or reps > 0).
  // Do not auto-advance to next phase until user manually creates data in week 1 of the next phase.
  useEffect(() => {
    (async () => {
      if (autoNavDone || !initialRouteReady) return;
      if (skipAutoNavRef.current) {
        setAutoNavDone(true);
        return;
      }
      const all = await db.getAll<Session>("sessions");
      if (!all.length) {
        setAutoNavDone(true);
        return;
      }
      const byPhase = all.filter(
        (s) => (s.phaseNumber || s.phase || 1) === phase
      );
      type WeekActivityInfo = {
        week: number;
        activity: number;
        calendar: number;
        updated: number;
      };
      const weekActivity = new Map<number, WeekActivityInfo>();
      const registerWeek = (sess: Session) => {
        const wk = sess.weekNumber;
        if (typeof wk !== "number" || Number.isNaN(wk)) return;
        const activity = sessionRealActivityMs(sess);
        const calendar =
          toTimestamp(sess.loggedEndAt) ||
          toTimestamp(sess.dateISO) ||
          (sess.localDate ? toTimestamp(`${sess.localDate}T12:00:00Z`) : 0) ||
          toTimestamp(sess.loggedStartAt) ||
          toTimestamp(sess.updatedAt) ||
          toTimestamp(sess.createdAt);
        const updated = toTimestamp(sess.updatedAt) || calendar;
        const next: WeekActivityInfo = {
          week: wk,
          activity,
          calendar,
          updated,
        };
        const prev = weekActivity.get(wk);
        if (
          !prev ||
          activity > prev.activity ||
          (activity === prev.activity && calendar > prev.calendar) ||
          (activity === prev.activity &&
            calendar === prev.calendar &&
            updated > prev.updated)
        ) {
          weekActivity.set(wk, next);
        }
      };
      for (const s of byPhase) {
        if (!sessionHasRealWork(s) || typeof s.weekNumber !== "number")
          continue;
        registerWeek(s);
      }
      if (!weekActivity.size) {
        setAutoNavDone(true);
        return;
      }
      const currentInfo = weekActivity.get(week) || null;
      let best: WeekActivityInfo | null = currentInfo;
      for (const info of weekActivity.values()) {
        if (!best) {
          best = info;
          continue;
        }
        if (info.activity > best.activity) {
          best = info;
          continue;
        }
        if (info.activity === best.activity && info.calendar > best.calendar) {
          best = info;
          continue;
        }
        if (
          info.activity === best.activity &&
          info.calendar === best.calendar &&
          info.week > best.week
        ) {
          best = info;
        }
      }
      const targetWeek = best ? best.week : week;
      if (targetWeek !== week) {
        setWeek(targetWeek as any);
      }
      // Record the latest location for jump-to-latest feature
      if (best) {
        setLatestLocation({ phase, week: best.week, day });
      }
      setAutoNavDone(true);
    })();
  }, [phase, autoNavDone, week, day, initialRouteReady]);

  // Guard against accidental phase increment: override phase if settings jumped forward without week1 data in next phase
  useEffect(() => {
    (async () => {
      // If user explicitly selected this phase for editing/preview, don't auto-revert
      // until they leave the page or log a valid set (which will commit the phase).
      if (allowEmptyPhase) return;
      const all = await db.getAll<Session>("sessions");
      const curPhaseSessions = all.filter(
        (s) => (s.phaseNumber || s.phase || 1) === phase
      );
      // If user is beyond phase 1 and there is zero real data in phase weeks, revert to previous phase with data
      if (phase > 1) {
        const haveReal = curPhaseSessions.some(sessionHasRealWork);
        if (!haveReal) {
          // find latest phase that has data
          const phasesWithData = new Set<number>();
          for (const s of all) {
            if (sessionHasRealWork(s))
              phasesWithData.add(s.phaseNumber || s.phase || 1);
          }
          if (phasesWithData.size) {
            const back = [...phasesWithData].sort((a, b) => b - a)[0];
            if (back !== phase) {
              setPhase(back);
              const settings = await getSettings();
              // currentPhase already reflects last phase with data; no need to force a write
              await setSettings({ ...settings });
            }
          }
        }
      }
    })();
  }, [phase, allowEmptyPhase]);

  // Phase readiness calculation
  useEffect(() => {
    (async () => {
      if (!program) {
        setReadinessPct(0);
        return;
      }
      const all = await db.getAll<Session>("sessions");
      const cur = all.filter((s) => (s.phaseNumber || s.phase || 1) === phase);
      const weeks = new Set<number>();
      for (const s of cur) {
        if (sessionHasRealWork(s)) weeks.add(s.weekNumber);
      }
      setReadinessPct(
        Math.min(100, Math.round((weeks.size / (program.mesoWeeks || 1)) * 100))
      );
    })();
  }, [phase, week, session?.id, program]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowAdd(true);
      }
      if (e.key === "Enter" && e.shiftKey) {
        const active = document.activeElement as HTMLElement | null;
        if (active?.tagName === "INPUT") {
          const inputs = [
            ...document.querySelectorAll('input[data-set-input="true"]'),
          ] as HTMLInputElement[];
          const idx = inputs.indexOf(active as HTMLInputElement);
          if (idx >= 0 && idx < inputs.length - 1) {
            inputs[idx + 1].focus();
            e.preventDefault();
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        const active = document.activeElement as HTMLElement | null;
        const entryId = active?.dataset.entryId;
        const setNumber = Number(active?.dataset.setNumber);
        if (entryId && setNumber) {
          const ent = session?.entries.find((en) => en.id === entryId);
          const src = ent?.sets.find((s) => s.setNumber === setNumber);
          if (ent && src) {
            const clone: SetEntry = { ...src, setNumber: ent.sets.length + 1 };
            updateEntryPatched({ ...ent, sets: [...ent.sets, clone] });
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session]);

  // Rest timer: periodic update & alert when target reached (per-exercise single timer)
  useEffect(() => {
    let frame: number;
    const tick = () => {
      setRestTimers((prev) => {
        const now = Date.now();
        const targetMs = (settingsState?.restTimerTargetSeconds || 90) * 1000;
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.finished) {
            // keep briefly for finish pulse then drop
            if (now - (v.start + v.elapsed) < 1200) {
              next[k] = v;
            }
            continue;
          }
          if (!v.running) {
            next[k] = v;
            continue;
          }
          // If start came from performance.now() (very small number) migrate to Date.now() baseline
          let start = v.start;
          if (start < 1e10) {
            // treat as perf timestamp, remap
            start = now - v.elapsed; // approximate
          }
          const elapsed = now - start;
          if (elapsed >= REST_TIMER_MAX) {
            next[k] = {
              ...v,
              start,
              elapsed: REST_TIMER_MAX,
              running: false,
              finished: true,
              alerted: true,
            };
            continue;
          }
          // trigger alert when crossing target threshold once
          if (elapsed >= targetMs && !v.alerted) {
            if (settingsState?.haptics !== false) {
              try {
                navigator.vibrate?.([16, 70, 18, 70, 18]);
              } catch {}
            }
            if (settingsState?.restTimerBeep !== false) {
              (async () => {
                try {
                  await unlockAudio();
                  const volPct = Math.max(
                    30,
                    Math.min(300, settingsState?.restTimerBeepVolume ?? 140)
                  );
                  setBeepVolumeScalar(volPct / 100);
                  const style =
                    (settingsState?.restTimerBeepStyle as any) ?? "gentle";
                  const count = Math.max(
                    1,
                    Math.min(5, settingsState?.restTimerBeepCount ?? 2)
                  );
                  playBeepStyle(style, count);
                } catch {}
              })();
            }
            next[k] = { ...v, start, elapsed, alerted: true };
          } else {
            next[k] = { ...v, start, elapsed };
          }
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    settingsState?.restTimerTargetSeconds,
    settingsState?.haptics,
    settingsState?.restTimerBeep,
    settingsState?.restTimerBeepStyle,
    settingsState?.restTimerBeepCount,
    settingsState?.restTimerBeepVolume,
  ]);
  // Restart (or start) rest timer in a single tap; always resets elapsed to 0 and runs
  const restartRestTimer = (entryId: string) => {
    setRestTimers((prev) => ({
      ...prev,
      [entryId]: {
        start: Date.now(),
        elapsed: 0,
        running: true,
        finished: false,
        alerted: false,
      },
    }));
    if (settingsState?.haptics !== false) {
      try {
        navigator.vibrate?.([8, 30, 14]);
      } catch {}
    }
  };
  // Stop & clear rest timer (remove entirely)
  const stopRestTimer = (entryId: string) => {
    setRestTimers((prev) => {
      const next = { ...prev };
      if (next[entryId]) delete next[entryId];
      return next;
    });
    if (settingsState?.haptics !== false) {
      try {
        navigator.vibrate?.(12);
      } catch {}
    }
  };
  const restTimerDisplay = (entryId: string) => {
    const t = restTimers[entryId];
    if (!t) return null;

    const ms = t.elapsed;
    const totalSecs = ms / 1000;
    const mm = Math.floor(totalSecs / 60);
    const ss = Math.floor(totalSecs) % 60;
    const cs = Math.floor((ms % 1000) / 10);
    const targetSecondsRaw = settingsState?.restTimerTargetSeconds ?? 90;
    const targetSeconds = targetSecondsRaw > 0 ? targetSecondsRaw : 1;
    const strong = settingsState?.restTimerStrongAlert !== false;
    const flash = settingsState?.restTimerScreenFlash === true;
    const reached = targetSecondsRaw <= 0 ? true : totalSecs >= targetSeconds;

    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const progressRatio =
      targetSecondsRaw <= 0 ? 1 : Math.min(totalSecs / targetSeconds, 1);
    const dashOffset = circumference * (1 - progressRatio);

    const basePulse =
      reached && !t.finished
        ? "animate-[timerPulseFast_900ms_ease-in-out_infinite]"
        : t.finished
        ? "animate-[timerFinishPop_900ms_ease-in-out_forwards]"
        : t.running
        ? "animate-[timerPulse_1800ms_ease-in-out_infinite]"
        : "";

    const shouldAnimateStroke = t.running && !reached && progressRatio > 0;

    if (reached && !t.alerted && flash) {
      try {
        document.body.classList.add("rest-screen-flash");
        setTimeout(
          () => document.body.classList.remove("rest-screen-flash"),
          520
        );
      } catch {}
    }

    return (
      <div className="relative inline-flex h-[56px] w-[56px] items-center justify-center">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 60 60"
        >
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-slate-700/35"
          />
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className={`${reached ? "text-rose-400" : "text-emerald-400"}`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              filter: reached
                ? "drop-shadow(0 0 6px rgba(244, 63, 94, 0.55))"
                : "drop-shadow(0 0 5px rgba(16, 185, 129, 0.45))",
              transition: shouldAnimateStroke
                ? "stroke-dashoffset 220ms linear, stroke 220ms linear, filter 220ms linear"
                : "none",
            }}
          />
        </svg>

        <span
          aria-live={reached ? "assertive" : "off"}
          aria-label={`Rest time ${mm} minutes ${ss} seconds ${cs} centiseconds${
            reached ? " – rest complete" : ""
          }`}
          className={`rest-timer relative flex h-[46px] w-[46px] flex-col items-center justify-center rounded-full bg-[rgba(15,23,42,0.92)] text-center font-mono leading-none shadow-lg backdrop-blur-sm sm:h-[48px] sm:w-[48px] ${
            reached ? "text-rose-300" : "text-emerald-300"
          } ${basePulse} ${reached && strong ? "rest-strong-alert" : ""}`}
        >
          {t.running ? (
            <>
              <span
                className={`rest-timer-value relative z-10 text-base font-bold tracking-tight ${
                  reached
                    ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-transform"
                    : "transition-transform"
                }`}
              >
                {mm}:{String(ss).padStart(2, "0")}
              </span>
              <div className="mt-0.5 text-[7px] leading-none text-slate-500 tabular-nums">
                .{String(cs).padStart(2, "0")}
              </div>
            </>
          ) : (
            <>
              <div className="mb-0.5 text-[8px] font-medium uppercase leading-none tracking-wider text-slate-400">
                Rest
              </div>
              <span
                className={`rest-timer-value relative z-10 text-sm font-bold tracking-tight ${
                  reached
                    ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-transform"
                    : "transition-transform"
                }`}
              >
                {mm}:{String(ss).padStart(2, "0")}
              </span>
              <div className="mt-0.5 text-[7px] leading-none text-slate-500 tabular-nums">
                .{String(cs).padStart(2, "0")}
              </div>
            </>
          )}
        </span>
      </div>
    );
  };
  const duplicateLastSet = (entry: SessionEntry) => {
    const last = [...entry.sets].pop();
    if (!last) return;
    const { completedAt: _completed, addedAt: _added, ...rest } = last;
    const clone: SetEntry = {
      ...rest,
      setNumber: entry.sets.length + 1,
      addedAt: new Date().toISOString(),
    };
    updateEntry({ ...entry, sets: [...entry.sets, clone] });
  };

  // Adjust week clamp if program changes
  useEffect(() => {
    if (program) {
      if (week > program.mesoWeeks) setWeek(1);
      if (day >= program.weekLengthDays) setDay(0);
    }
  }, [program]);

  useEffect(() => {
    (async () => {
      if (!initialRouteReady) return; // wait for lastLocation / intent resolution
      try {
        const id = `${phase}-${week}-${day}`;
        let s = await db.get<Session>("sessions", id);
        if (!s) {
          // fallback: try old id format (week-day) and migrate
          const oldId = `${week}-${day}`;
          const old = await db.get<Session>("sessions", oldId);
          if (old) {
            s = { ...old, id, phase };
            await db.delete("sessions", oldId);
            await persistSession(s);
          }
        }
        if (!s) {
          // Duplicate guard: ensure not creating second session for same phase-week-day within same UTC date
          const allToday = (await db.getAll<Session>("sessions")).filter(
            (x) =>
              x.dateISO?.slice(0, 10) === new Date().toISOString().slice(0, 10)
          );
          const existingSame = allToday.find((x) => x.id === id);
          if (existingSame) {
            s = existingSame; // another timezone path already created it
          }
        }
        if (!s) {
          const templateMeta = program ? program.weeklySplit[day] : undefined;
          const templateName = templateMeta
            ? templateMeta.customLabel || templateMeta.type || "Day"
            : DAYS[day];
          const now = new Date();
          const localDayStr = `${now.getFullYear()}-${String(
            now.getMonth() + 1
          ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const nowISO = new Date().toISOString();
          s = {
            id,
            dateISO: (() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              return d.toISOString();
            })(),
            localDate: localDayStr,
            weekNumber: week,
            phase,
            phaseNumber: phase,
            dayName: templateName,
            entries: [],
            templateId: templateMeta?.templateId,
            programId: program?.id,
            createdAt: nowISO,
            updatedAt: nowISO,
          } as Session;
          await persistSession(s);
          // If there is a templateId, auto-import it
          if (templateMeta?.templateId) {
            try {
              const t = await db.get("templates", templateMeta.templateId);
              if (t) {
                // Reuse import logic manually (append false since brand new)
                const exs = await db.getAll("exercises");
                const settings = await getSettings();
                const exMap = new Map(exs.map((e: any) => [e.id, e]));
                const rows = (exId: string) => {
                  const base =
                    settings.defaultSetRows ??
                    exMap.get(exId)?.defaults.sets ??
                    3;
                  return Math.min(6, Math.max(0, base));
                };
                const newEntries = (t.exerciseIds || []).map(
                  (exId: string) => ({
                    id: nanoid(),
                    exerciseId: exId,
                    sets: (() => {
                      const n = rows(exId);
                      return n === 0
                        ? []
                        : Array.from({ length: n }, (_, i) => ({
                            setNumber: i + 1,
                            weightKg: 0,
                            reps: 0,
                          }));
                    })(),
                  })
                );
                s = {
                  ...s,
                  entries: newEntries,
                  autoImportedTemplateId: templateMeta.templateId,
                };
                await persistSession(s);
              }
            } catch (e) {
              console.warn("[Sessions] auto-import template failed", e);
            }
          }
        }
        setSession(s);
        // Persist lastLocation only when the session contains real logged work to avoid landing on empty templates
        try {
          if (sessionHasRealWork(s)) {
            const settings = await getSettings();
            const prev = settings.dashboardPrefs?.lastLocation;
            const nextLoc = {
              phaseNumber: phase,
              weekNumber: week,
              dayId: day,
              sessionId: s.id,
            };
            const sameTarget =
              prev &&
              `${prev.phaseNumber}-${prev.weekNumber}-${prev.dayId}` ===
                `${nextLoc.phaseNumber}-${nextLoc.weekNumber}-${nextLoc.dayId}`;
            if (!prev || sameTarget) {
              await setSettings({
                ...settings,
                dashboardPrefs: {
                  ...(settings.dashboardPrefs || {}),
                  lastLocation: nextLoc,
                },
              });
            }
          }
        } catch (settingsErr) {
          console.warn("[Sessions] failed to save lastLocation", settingsErr);
        }
      } catch (err: any) {
        console.error("[Sessions] Critical error loading session:", err);
        // Don't let the error crash the component - create a minimal session
        const id = `${phase}-${week}-${day}`;
        const templateMeta = program ? program.weeklySplit[day] : undefined;
        const templateName = templateMeta
          ? templateMeta.customLabel || templateMeta.type || "Day"
          : DAYS[day];
        const now = new Date();
        const localDayStr = `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const nowISO = new Date().toISOString();
        const fallbackSession: Session = {
          id,
          dateISO: (() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
          })(),
          localDate: localDayStr,
          weekNumber: week,
          phase,
          phaseNumber: phase,
          dayName: templateName,
          entries: [],
          templateId: templateMeta?.templateId,
          programId: program?.id,
          createdAt: nowISO,
          updatedAt: nowISO,
        } as Session;
        setSession(fallbackSession);
        // Try to save it in the background
        setTimeout(async () => {
          try {
            await persistSession(fallbackSession);
          } catch (putErr) {
            console.warn("[Sessions] failed to save fallback session", putErr);
          }
        }, 1000);
      }
    })();
  }, [phase, week, day, initialRouteReady]);

  // Reset the transient allowEmptyPhase guard when leaving the page
  useEffect(() => {
    return () => {
      setAllowEmptyPhase(false);
      phaseCommitPendingRef.current = null;
    };
  }, []);

  // Wrap entry update to stamp loggedStartAt / loggedEndAt
  const stampActivity = async (sess: Session, updated: Session) => {
    const now = new Date().toISOString();
    let changed = false;
    const hadDataBefore = sessionHasRealWork(sess);
    const hasDataAfter = sessionHasRealWork(updated);
    if (hasDataAfter && !hadDataBefore && !updated.loggedStartAt) {
      (updated as any).loggedStartAt = now;
      changed = true;
    }
    if (hasDataAfter) {
      (updated as any).loggedEndAt = now;
      changed = true;
    }
    // Robust per-day work log tracking (local date key)
    try {
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const log = { ...(updated.workLog || {}) } as NonNullable<
        Session["workLog"]
      >;
      const prev = log[key];
      if (!prev) log[key] = { first: now, last: now, count: 1 };
      else log[key] = { ...prev, last: now, count: prev.count + 1 };
      (updated as any).workLog = log;
    } catch {}
    (updated as any).updatedAt = now;
    changed = true;
    if (changed) {
      await persistSession(updated);
    }
    (updated as any).updatedAt = new Date().toISOString();
    lastLocalEditRef.current = Date.now();
    setSession(updated);
  };

  // Monkey patch updateEntry references by defining function used below via closure
  function updateEntryPatched(entry: SessionEntry) {
    if (!session) return;
    // Determine set value changes to stamp completedAt on affected sets
    const prevEntry = session.entries.find((e) => e.id === entry.id);
    let stampedEntry = entry;
    if (prevEntry) {
      const sessionDate = session.dateISO.slice(0, 10); // lock day
      stampedEntry = {
        ...entry,
        sets: entry.sets.map((st, idx) => {
          const prev = prevEntry.sets[idx];
          const changed =
            prev &&
            ((prev.weightKg || 0) !== (st.weightKg || 0) ||
              (prev.reps || 0) !== (st.reps || 0));
          if (changed) {
            const now = new Date();
            // Force date to session calendar day to avoid late-edit day drift
            const [y, m, d] = sessionDate.split("-").map(Number);
            now.setFullYear(y, (m || 1) - 1, d || now.getDate());
            const iso = now.toISOString();
            return { ...st, completedAt: iso };
          }
          return st;
        }),
      };
    }
    const next: Session = {
      ...session,
      entries: session.entries.map((e) =>
        e.id === entry.id ? stampedEntry : e
      ),
    };
    stampActivity(session, next);
  }

  const [initialLoading, setInitialLoading] = useState(true);
  // --- AUTO-RECOVER DELETED EXERCISES (one-time per mount unless new deletions occur) ---
  const recoveryRunRef = useRef(false);
  const [recoveredCount, setRecoveredCount] = useState(0);
  const [recoveredIds, setRecoveredIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      if (initialLoading) return; // wait for initial lists
      // Only attempt again if we haven't already OR if exercise list shrank (possible new deletion)
      if (recoveryRunRef.current && exercises.length > 0) return;
      let allSessions: Session[] = [];
      try {
        allSessions = await db.getAll<Session>("sessions");
      } catch {
        return;
      }
      if (!allSessions.length) return;
      const referenced = new Set<string>();
      for (const s of allSessions) {
        if (!Array.isArray(s.entries)) continue;
        for (const en of s.entries) {
          if (en?.exerciseId) referenced.add(en.exerciseId);
        }
      }
      if (!referenced.size) {
        recoveryRunRef.current = true;
        return;
      }
      const existingIds = new Set(exercises.map((e) => e.id));
      const missing = [...referenced].filter((id) => !existingIds.has(id));
      if (!missing.length) {
        recoveryRunRef.current = true;
        return;
      }
      let created = 0;
      const createdIds: string[] = [];
      for (const id of missing) {
        try {
          // Skip if appeared meanwhile
          const already = await db.get<Exercise>("exercises", id);
          if (already) continue;
          const name = exNameCache[id] || `Recovered ${id.slice(0, 6)}`;
          const placeholder: Exercise = {
            id,
            name,
            muscleGroup: "other",
            defaults: { sets: 3, targetRepRange: "8-12" },
            isOptional: true,
          } as any;
          await db.put("exercises", placeholder);
          created++;
          createdIds.push(id);
        } catch {
          /* ignore single failure */
        }
      }
      if (created) {
        try {
          const refreshed = await db.getAll<Exercise>("exercises");
          setExercises(refreshed);
          setRecoveredCount(created);
          setRecoveredIds(
            (prev) => new Set([...Array.from(prev), ...createdIds])
          );
          try {
            window.dispatchEvent(
              new CustomEvent("sb-change", { detail: { table: "exercises" } })
            );
          } catch {}
          push({
            message: `Recovered ${created} exercise${created > 1 ? "s" : ""}`,
          });
        } catch {}
      }
      recoveryRunRef.current = true;
    })();
  }, [initialLoading, exercises.length, exNameCache, push]);
  // --- END AUTO-RECOVER ---
  useEffect(() => {
    (async () => {
      try {
        console.log("[Sessions] init: fetch lists (no auth wait)");
        const [t, e] = await Promise.all([
          getAllCached("templates"),
          getAllCached("exercises"),
        ]);
        console.log(
          "[Sessions] init: templates",
          t.length,
          "exercises",
          e.length
        );
        setTemplates(t);
        setExercises(e);
        // Preload sessions for prev best map (day-aware for better matching)
        setPrevBestLoading(true);
        const [allSessions, st] = await Promise.all([
          getAllCached<Session>("sessions", {
            ttlMs: currentSessionsTtl(),
          }),
          getSettings(),
        ]);
        const map = getPrevBestCached(
          allSessions,
          phase,
          week,
          day,
          session?.templateId
        );
        setPrevBestMap(map);
        setPrevBestLoading(false);
        setSettingsState(st as any);
        setInitialLoading(false);
        // Lazy subscribe to only needed tables
        requestRealtime("sessions");
        requestRealtime("exercises");
        requestRealtime("templates");
      } catch (err) {
        console.error("[Sessions] Critical error during initialization:", err);
        // Set minimal state to prevent total freeze
        setTemplates([]);
        setExercises([]);
        setPrevBestMap(null);
        setPrevBestLoading(false);
        setInitialLoading(false);
        // Still try to subscribe to realtime for when auth recovers
        try {
          requestRealtime("sessions");
          requestRealtime("exercises");
          requestRealtime("templates");
        } catch {}
      }
    })();
  }, []);

  // Refetch data when auth session changes (e.g., token refresh or resume)
  useEffect(() => {
    const onAuth = (evt: any) => {
      const nextSession = evt?.detail?.session;
      if (!nextSession) {
        return;
      }
      (async () => {
        console.log("[Sessions] sb-auth: refetch lists (no auth wait)");
        const [t, e] = await Promise.all([
          getAllCached("templates", { force: true }),
          getAllCached("exercises", { force: true }),
        ]);
        console.log(
          "[Sessions] sb-auth: templates",
          t.length,
          "exercises",
          e.length
        );
        setTemplates(t);
        setExercises(e);
        if (session) {
          const fresh = await db.get<Session>("sessions", session.id); // single fetch; not cached (ensure latest entry data)
          const remoteTs = fresh?.updatedAt ? Date.parse(fresh.updatedAt) : 0;
          console.log(
            "[Sessions] sb-auth: refreshed session entries",
            fresh?.entries?.length || 0,
            "remoteTs",
            remoteTs,
            "lastLocal",
            lastLocalEditRef.current
          );
          // Don’t clobber local optimistic edits or in-progress typing
          const isEditing =
            pendingRef.current ||
            (editingFieldsRef.current && editingFieldsRef.current.size > 0);
          if (
            fresh &&
            !isEditing &&
            remoteTs > (lastLocalEditRef.current || 0)
          ) {
            setSession(fresh);
          }
        }
      })();
    };
    window.addEventListener("sb-auth", onAuth);
    return () => window.removeEventListener("sb-auth", onAuth);
  }, [session?.id]);

  // Lightweight realtime auto-refresh: guarded to prevent clobbering in-progress typing
  useEffect(() => {
    const onChange = (e: any) => {
      const tbl = e?.detail?.table;
      if (tbl === "templates")
        getAllCached("templates", { force: true }).then(setTemplates);
      if (tbl === "exercises")
        getAllCached("exercises", { force: true }).then(setExercises);
      if (tbl === "sessions" && session) {
        if (
          pendingRef.current ||
          (editingFieldsRef.current && editingFieldsRef.current.size > 0)
        )
          return; // skip while user typing
        db.get<Session>("sessions", session.id).then((s) => {
          if (!s) return;
          const remoteTs = s.updatedAt ? Date.parse(s.updatedAt) : 0;
          if (remoteTs <= (lastLocalEditRef.current || 0)) return; // ignore stale/echo
          setSession(s);
          setPrevBestLoading(true);
          getAllCached<Session>("sessions", {
            force: true,
            ttlMs: currentSessionsTtl(),
          }).then((all) => {
            const map = getPrevBestCached(all, phase, week, day, s?.templateId);
            setPrevBestMap(map);
            setPrevBestLoading(false);
          });
          recomputePrevWeekSets(s);
        });
      }
    };
    window.addEventListener("sb-change", onChange as any);
    return () => window.removeEventListener("sb-change", onChange as any);
  }, [session?.id]);

  // Keep hints in sync when cache refreshes in background
  useEffect(() => {
    const onCache = (e: any) => {
      const store = e?.detail?.store;
      if (store === "sessions") {
        (async () => {
          try {
            setPrevBestLoading(true);
            const all = await db.getAll<Session>("sessions");
            const map = getPrevBestCached(
              all,
              phase,
              week,
              day,
              session?.templateId
            );
            setPrevBestMap(map);
            setPrevBestLoading(false);
          } catch {}
          await recomputePrevWeekSets(session);
        })();
      }
    };
    window.addEventListener("cache-refresh", onCache);
    return () => window.removeEventListener("cache-refresh", onCache);
  }, [
    session?.id,
    week,
    phase,
    day,
    program?.id,
    program?.mesoWeeks,
    program?.deload,
  ]);

  // Recompute prev best map whenever week, phase, or day changes
  useEffect(() => {
    (async () => {
      setPrevBestLoading(true);
      try {
        const allSessions = await db.getAll<Session>("sessions");
        const map = getPrevBestCached(
          allSessions,
          phase,
          week,
          day,
          session?.templateId
        );
        setPrevBestMap(map);
      } catch (err) {
        console.error("[Sessions] Error loading prev best map:", err);
        setPrevBestMap(null); // Fallback to empty map
      } finally {
        setPrevBestLoading(false);
      }
    })();
  }, [week, phase, day]);

  // Build previous week (or nearest past week) per-set lookup whenever active session context changes
  const recomputePrevWeekSets = async (sess: Session | null) => {
    setPrevWeekLoading(true);
    try {
      if (!sess) {
        setPrevWeekSets({});
        setPrevWeekSourceWeek(null);
        return;
      }
      const getPhaseNumber = (s: Session) => s.phaseNumber ?? s.phase ?? 1;
      const getWeekNumber = (s: Session) => s.weekNumber ?? 0;
      const identityMatches = (s: Session) => {
        if (sess.templateId && s.templateId)
          return s.templateId === sess.templateId;
        if (!sess.templateId && sess.dayName && s.dayName)
          return s.dayName === sess.dayName;
        return false;
      };
      const programMatches = (s: Session) => {
        if (!sess.programId || !s.programId) return true;
        return s.programId === sess.programId;
      };
      const deloadSet = program
        ? computeDeloadWeeks(program)
        : new Set<number>();
      const currentPhase = getPhaseNumber(sess);
      const currentWeek = getWeekNumber(sess);

      // Prefer fresh DB to avoid stale cache during rapid edits
      const all = await db.getAll<Session>("sessions");
      const candidates = (all as Session[])
        .filter((s) => s.id !== sess.id)
        .filter(identityMatches)
        .filter(programMatches)
        .filter((s) => {
          const phaseNum = getPhaseNumber(s);
          const weekNum = getWeekNumber(s);
          if (phaseNum > currentPhase) return false;
          if (phaseNum === currentPhase && weekNum >= currentWeek) return false;
          return true;
        })
        .sort((a, b) => {
          const phaseDiff = getPhaseNumber(b) - getPhaseNumber(a);
          if (phaseDiff !== 0) return phaseDiff;
          const weekDiff = getWeekNumber(b) - getWeekNumber(a);
          if (weekDiff !== 0) return weekDiff;
          const dateDiff =
            (Date.parse(b.dateISO) || 0) - (Date.parse(a.dateISO) || 0);
          if (dateDiff !== 0) return dateDiff;
          return (
            (Date.parse(b.updatedAt || "") || 0) -
            (Date.parse(a.updatedAt || "") || 0)
          );
        });

      const found = candidates.find((s) => !deloadSet.has(getWeekNumber(s)));

      if (!found) {
        setPrevWeekSets({});
        setPrevWeekSourceWeek(null);
        return;
      }
      const map: Record<
        string,
        { weightKg: number | null; reps: number | null }[]
      > = {};
      found.entries.forEach((en) => {
        map[en.exerciseId] = en.sets
          .slice()
          .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0))
          .map((st) => ({
            weightKg: st.weightKg == null ? null : st.weightKg,
            reps: st.reps == null ? null : st.reps,
          }));
      });
      setPrevWeekSets(map);
      setPrevWeekSourceWeek(found.weekNumber ?? null);
    } catch {
      setPrevWeekSets({});
      setPrevWeekSourceWeek(null);
    } finally {
      setPrevWeekLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await recomputePrevWeekSets(session);
    })();
  }, [
    session?.id,
    session?.weekNumber,
    session?.phaseNumber,
    session?.templateId,
    session?.dayName,
    session?.programId,
    program?.id,
    program?.mesoWeeks,
    program?.deload,
  ]);

  const confirmationTokens = useMemo(
    () => ({
      day: `${dayTitle} (${weekLabel}, ${phaseLabel})`,
      week: `${weekLabel} (${phaseLabel})`,
      phase: phaseLabel,
    }),
    [dayTitle, weekLabel, phaseLabel]
  );

  const wipeScopeLabels = useMemo(
    () => ({
      day: dayTitle,
      week: weekLabel,
      phase: phaseLabel,
    }),
    [dayTitle, weekLabel, phaseLabel]
  );

  const dayEntryCount = session?.entries?.length ?? 0;
  const daySetCount =
    session?.entries?.reduce(
      (sum, entry) => sum + (entry.sets?.length ?? 0),
      0
    ) ?? 0;

  const selectedStats = useMemo(() => {
    if (wipeScope === "day") {
      return {
        title: dayTitle,
        lines: [
          pluralize(dayEntryCount, "exercise"),
          pluralize(daySetCount, "set"),
        ],
      };
    }
    if (!wipeCounts) return null;
    if (wipeScope === "week") {
      return {
        title: weekLabel,
        lines: [
          pluralize(wipeCounts.weekSessions, "session"),
          pluralize(wipeCounts.weekEntries, "exercise"),
          pluralize(wipeCounts.weekSets, "set"),
        ],
      };
    }
    return {
      title: phaseLabel,
      lines: [
        pluralize(wipeCounts.phaseSessions, "session"),
        pluralize(wipeCounts.phaseEntries, "exercise"),
        pluralize(wipeCounts.phaseSets, "set"),
      ],
    };
  }, [
    wipeScope,
    wipeCounts,
    dayTitle,
    weekLabel,
    phaseLabel,
    dayEntryCount,
    daySetCount,
  ]);

  const confirmationPhrase = confirmationTokens[wipeScope];
  const confirmationMatches = wipeConfirmValue.trim() === confirmationPhrase;

  const wipeButtonLabels: Record<WipeScope, string> = {
    day: "Erase session",
    week: "Erase week",
    phase: "Erase phase",
  };

  const wipeOptions = useMemo<OptionSheetOption[]>(() => {
    const weekSummary = wipeCounts
      ? `${pluralize(wipeCounts.weekSessions, "session")} • ${pluralize(
          wipeCounts.weekEntries,
          "exercise"
        )} • ${pluralize(wipeCounts.weekSets, "set")}`
      : "Calculating…";
    const phaseSummary = wipeCounts
      ? `${pluralize(wipeCounts.phaseSessions, "session")} • ${pluralize(
          wipeCounts.phaseEntries,
          "exercise"
        )} • ${pluralize(wipeCounts.phaseSets, "set")}`
      : "Calculating…";
    return [
      {
        id: "day",
        label: "Erase this session",
        description: session
          ? `${pluralize(dayEntryCount, "exercise")} • ${pluralize(
              daySetCount,
              "set"
            )}`
          : "No session loaded",
        hint: dayTitle,
        selected: wipeScope === "day",
        trailing: wipeScope === "day" ? "Selected" : undefined,
        disabled: !session || wipeBusy,
        onSelect: () => {
          if (wipeBusy) return;
          setWipeScope("day");
        },
      },
      {
        id: "week",
        label: "Erase this week",
        description: weekSummary,
        hint: weekLabel,
        selected: wipeScope === "week",
        trailing: wipeScope === "week" ? "Selected" : undefined,
        disabled: wipeBusy || !wipeCounts,
        onSelect: () => {
          if (wipeBusy || !wipeCounts) return;
          setWipeScope("week");
        },
      },
      {
        id: "phase",
        label: "Erase this phase",
        description: phaseSummary,
        hint: phaseLabel,
        selected: wipeScope === "phase",
        trailing: wipeScope === "phase" ? "Selected" : undefined,
        disabled: wipeBusy || !wipeCounts,
        onSelect: () => {
          if (wipeBusy || !wipeCounts) return;
          setWipeScope("phase");
        },
      },
    ];
  }, [
    session,
    wipeCounts,
    wipeScope,
    wipeBusy,
    dayEntryCount,
    daySetCount,
    dayTitle,
    weekLabel,
    phaseLabel,
    setWipeScope,
  ]);

  const gatherWipeTargets = async (scope: WipeScope): Promise<Session[]> => {
    if (!session) return [];
    if (scope === "day") {
      if (latestSessionRef.current) return [latestSessionRef.current];
      return [session];
    }
    const all = await db.getAll<Session>("sessions");
    const programId = session.programId ?? null;
    const targetPhase = getSessionPhaseNumber(session) ?? phaseNumber ?? null;
    const targetWeek = getSessionWeekNumber(session) ?? weekNumber ?? null;
    return all.filter((candidate) => {
      const candidatePhase = getSessionPhaseNumber(candidate);
      if (candidatePhase == null || targetPhase == null) return false;
      if (candidatePhase !== targetPhase) return false;
      if (programId && candidate.programId && candidate.programId !== programId)
        return false;
      if (scope === "week") {
        const candidateWeek = getSessionWeekNumber(candidate);
        if (candidateWeek == null || targetWeek == null) return false;
        return candidateWeek === targetWeek;
      }
      return true;
    });
  };

  const executeWipe = async () => {
    if (!session) return;
    const expected = confirmationTokens[wipeScope];
    if (wipeConfirmValue.trim() !== expected) {
      setWipeError("Type the exact confirmation phrase to continue.");
      return;
    }
    if (wipeScope !== "day" && !wipeCounts) {
      setWipeError(
        "Still calculating how much will be erased. Try again in a moment."
      );
      return;
    }
    if (wipeBusy) return;
    setWipeBusy(true);
    setWipeError(null);
    try {
      if (pendingRef.current) {
        window.clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
      await flushSession();
      const targets = await gatherWipeTargets(wipeScope);
      if (!targets.length) {
        push({ message: "Nothing to erase." });
        setWipeSheetOpen(false);
        setWipeConfirmValue("");
        setWipeBusy(false);
        setWipeCounts(null);
        return;
      }
      const timestamp = new Date().toISOString();
      let totalExercises = 0;
      let totalSets = 0;
      const uniqueTargets = new Map<string, Session>();
      for (const target of targets) {
        uniqueTargets.set(target.id, target);
      }
      for (const [id, target] of uniqueTargets) {
        totalExercises += target.entries?.length ?? 0;
        totalSets += (target.entries || []).reduce(
          (sum, entry) => sum + (entry.sets?.length ?? 0),
          0
        );
        const cleared = clearSessionRecord(target, timestamp);
        await persistSession(cleared);
        uniqueTargets.set(id, cleared);
      }
      try {
        window.dispatchEvent(
          new CustomEvent("sb-change", { detail: { table: "sessions" } })
        );
      } catch {}
      await getAllCached<Session>("sessions", {
        force: true,
        ttlMs: currentSessionsTtl(),
      });
      const updatedCurrent = uniqueTargets.get(session.id);
      if (updatedCurrent) {
        setSession(updatedCurrent);
        await recomputePrevWeekSets(updatedCurrent);
      } else {
        await recomputePrevWeekSets(session);
      }
      setPrevBestLoading(true);
      const allSessions = await db.getAll<Session>("sessions");
      const templateForCache =
        updatedCurrent?.templateId ?? session?.templateId;
      const map = getPrevBestCached(
        allSessions,
        phase,
        week,
        day,
        templateForCache
      );
      setPrevBestMap(map);
      setPrevBestLoading(false);
      setWipeSheetOpen(false);
      setWipeConfirmValue("");
      setWipeCounts(null);
      try {
        (navigator as any).vibrate?.(18);
      } catch {}
      const sessionCount = uniqueTargets.size;
      push({
        message: `Erased ${pluralize(totalSets, "set")} across ${pluralize(
          totalExercises,
          "exercise"
        )} in ${pluralize(sessionCount, "session")}`,
      });
    } catch (err) {
      console.error("[Sessions] Failed to erase sessions", err);
      setWipeError("Unable to erase right now. Please try again.");
    } finally {
      setWipeBusy(false);
    }
  };

  const wipeHighlight = useMemo(() => {
    return (
      <form
        className="space-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80"
        onSubmit={(e) => {
          e.preventDefault();
          executeWipe();
        }}
      >
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
            Scope summary
          </p>
          {selectedStats ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                {selectedStats.title}
              </p>
              <ul className="space-y-0.5 text-xs text-white/65">
                {selectedStats.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-white/55">Gathering stats…</p>
          )}
        </div>
        <div className="space-y-2 text-xs text-white/70">
          <p>
            This will permanently remove logged sets for{" "}
            <span className="font-semibold text-white">
              {wipeScopeLabels[wipeScope]}
            </span>
            . Type{" "}
            <code className="rounded bg-slate-900/60 px-2 py-0.5 text-[11px] text-white/80">
              {confirmationPhrase}
            </code>{" "}
            to confirm.
          </p>
          <input
            className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            value={wipeConfirmValue}
            onChange={(e) => {
              setWipeConfirmValue(e.target.value);
              if (wipeError) setWipeError(null);
            }}
            placeholder={confirmationPhrase}
            disabled={wipeBusy}
            spellCheck={false}
            inputMode="text"
          />
          {wipeError ? (
            <p className="text-xs text-rose-300">{wipeError}</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={!confirmationMatches || wipeBusy}
          className={`w-full rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-rose-400/40 ${
            !confirmationMatches || wipeBusy
              ? "cursor-not-allowed border-white/10 bg-white/5 text-white/40"
              : "border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
          }`}
        >
          {wipeBusy ? "Erasing…" : wipeButtonLabels[wipeScope]}
        </button>
      </form>
    );
  }, [
    confirmationMatches,
    confirmationPhrase,
    executeWipe,
    selectedStats,
    wipeButtonLabels,
    wipeBusy,
    wipeConfirmValue,
    wipeError,
    wipeScope,
    wipeScopeLabels,
    setWipeConfirmValue,
    setWipeError,
  ]);

  const deloadWeeks = useMemo(
    () => (program ? computeDeloadWeeks(program) : new Set<number>()),
    [program]
  );
  const isDeloadWeek = deloadWeeks.has(week);
  const deloadExerciseKey = useMemo(() => {
    if (!session?.entries?.length) return "";
    return session.entries
      .map((entry) => entry.exerciseId)
      .sort()
      .join("|");
  }, [session?.entries]);

  // Backfill programId on existing loaded session if missing (one-time effect per session)
  useEffect(() => {
    (async () => {
      if (session && program && !session.programId) {
        const updated = { ...session, programId: program.id };
        await persistSession(updated);
        setSession(updated);
      }
    })();
  }, [session?.id, program?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadDeload = async () => {
      if (!isDeloadWeek || !session?.entries?.length) {
        if (!cancelled) {
          setDeloadPrescriptions({});
          setDeloadLoading(false);
          setDeloadError(false);
        }
        return;
      }
      try {
        setDeloadLoading(true);
        setDeloadError(false);
        const exerciseIds = Array.from(
          new Set(session.entries.map((entry) => entry.exerciseId))
        );
        const [sessionsData, exercisesData, settingsData] = await Promise.all([
          getAllCached<Session>("sessions", {
            swr: true,
            ttlMs: currentSessionsTtl(),
          }),
          exercises.length
            ? Promise.resolve(exercises)
            : getAllCached<Exercise>("exercises", { swr: true }),
          settingsState ? Promise.resolve(settingsState) : getSettings(),
        ]);
        const sortedIds = [...exerciseIds].sort();
        const cacheKey = `${
          session?.templateId || "none"
        }|${week}|${sortedIds.join(",")}`;
        const signature = [
          sessionSignature(sessionsData),
          exerciseSignature(exercisesData),
          stableHash({
            deloadWeeks: Array.from(deloadWeeks.values()).sort((a, b) => a - b),
            settings: settingsData,
          }),
        ].join("#");
        const { map } = await getDeloadCached(cacheKey, signature, () =>
          getDeloadPrescriptionsBulk(
            exerciseIds,
            week,
            { deloadWeeks },
            {
              sessions: sessionsData,
              exercises: exercisesData,
              settings: settingsData,
            }
          )
        );
        if (!cancelled) {
          setDeloadPrescriptions(map as Record<string, DeloadInfo>);
          setDeloadLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            "[Sessions] failed to compute deload prescriptions",
            err
          );
          setDeloadPrescriptions({});
          setDeloadLoading(false);
          setDeloadError(true);
        }
      }
    };
    loadDeload();
    return () => {
      cancelled = true;
    };
  }, [
    isDeloadWeek,
    deloadExerciseKey,
    session?.id,
    week,
    exercises,
    settingsState,
    deloadWeeks,
    currentSessionsTtl,
  ]);

  const addSet = (entry: SessionEntry) => {
    if (!session) return;
    const last = [...entry.sets]
      .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0))
      .slice(-1)[0];
    const next: SetEntry = {
      setNumber: entry.sets.length + 1,
      weightKg: last?.weightKg ?? null,
      reps: last?.reps ?? null,
      rpe: last?.rpe,
      addedAt: new Date().toISOString(),
    };
    const newEntry = { ...entry, sets: [...entry.sets, next] };
    // Inline the updateEntry logic to immediately stamp and set lastLocalEditRef before any remote pull
    const prevSession = session;
    const newEntries = session.entries.map((e) =>
      e.id === entry.id ? newEntry : e
    );
    let updated = { ...session, entries: newEntries } as Session;
    const hasWorkNow = sessionHasRealWork(updated);
    if (hasWorkNow) {
      const nowIso = new Date().toISOString();
      if (!updated.loggedStartAt) (updated as any).loggedStartAt = nowIso;
      (updated as any).loggedEndAt = nowIso;
    }
    (updated as any).updatedAt = new Date().toISOString();
    if (hasWorkNow) {
      // Update per-day work log only when we have recorded work
      try {
        const d = new Date();
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
        const log = { ...(updated.workLog || {}) } as NonNullable<
          Session["workLog"]
        >;
        const prev = log[key];
        if (!prev)
          log[key] = {
            first: updated.updatedAt!,
            last: updated.updatedAt!,
            count: 1,
          };
        else
          log[key] = {
            ...prev,
            last: updated.updatedAt!,
            count: prev.count + 1,
          };
        (updated as any).workLog = log;
      } catch {}
    }
    lastLocalEditRef.current = Date.now();
    setSession(updated);
    latestSessionRef.current = updated;
    scheduleFlush();
    // If this is the first valid set in the selected phase, commit currentPhase
    if (hasWorkNow && phaseCommitPendingRef.current === phase) {
      (async () => {
        try {
          const s = await getSettings();
          await setSettings({ ...s, currentPhase: phase });
        } catch {}
        setAllowEmptyPhase(false);
        phaseCommitPendingRef.current = null;
      })();
    }
    // Restart the rest timer for this exercise
    try {
      restartRestTimer(entry.id);
    } catch {}
  };

  const deleteSet = (entry: SessionEntry, idx: number) => {
    const removed = entry.sets[idx];
    const after = entry.sets
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    const prev = session;
    updateEntry({ ...entry, sets: after });
    push({
      message: "Set deleted",
      actionLabel: "Undo",
      onAction: async () => {
        if (prev) {
          await persistSession(prev);
          setSession(prev);
        }
      },
    });
  };

  const reorderSet = (entry: SessionEntry, from: number, to: number) => {
    const arr = [...entry.sets];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const renum = arr.map((s, i) => ({ ...s, setNumber: i + 1 }));
    updateEntry({ ...entry, sets: renum });
  };

  // Debounced write buffer for session updates to avoid lag while typing
  const pendingRef = useRef<number | null>(null);
  const latestSessionRef = useRef<Session | null>(null);
  const lastLocalEditRef = useRef<number>(0); // Timestamp of most recent local mutation
  useEffect(() => {
    latestSessionRef.current = session || null;
  }, [session]);
  const flushSession = async () => {
    const sToWrite = latestSessionRef.current;
    if (!sToWrite) return;
    await persistSession(sToWrite);
    try {
      window.dispatchEvent(
        new CustomEvent("sb-change", { detail: { table: "sessions" } })
      );
    } catch {}
    // Pull fresh if not actively editing to merge remote edits
    if (editingFieldsRef.current.size === 0) {
      const fresh = await db.get<Session>("sessions", sToWrite.id);
      if (fresh) {
        const remoteTs = fresh.updatedAt ? Date.parse(fresh.updatedAt) : 0;
        if (remoteTs > lastLocalEditRef.current) {
          setSession(fresh);
          setPrevBestLoading(true);
          const all = await getAllCached<Session>("sessions", {
            force: true,
            ttlMs: currentSessionsTtl(),
          });
          const templateForCache = fresh?.templateId ?? sToWrite?.templateId;
          const map = getPrevBestCached(
            all,
            phase,
            week,
            day,
            templateForCache
          );
          setPrevBestMap(map);
          setPrevBestLoading(false);
        }
      }
    }
    if (sessionHasRealWork(sToWrite)) {
      const s = await getSettings();
      await setSettings({
        ...s,
        dashboardPrefs: {
          ...(s.dashboardPrefs || {}),
          lastLocation: {
            phaseNumber: phase,
            weekNumber: week,
            dayId: day,
            sessionId: sToWrite.id,
          },
        },
      });
    }
  };
  const scheduleFlush = () => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current);
    pendingRef.current = window.setTimeout(() => {
      flushSession();
      pendingRef.current = null;
    }, 1000); // 1000ms debounce
  };
  // Flush pending session edits when page becomes hidden or before unload to preserve latest activity timestamps
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && pendingRef.current) {
        flushSession();
      }
    };
    const onBefore = () => {
      if (pendingRef.current) {
        flushSession();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBefore);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBefore);
    };
  }, []);

  const clearSessionRecord = (target: Session, timestamp: string): Session => {
    const sanitized: Session = {
      ...target,
      entries: [],
      updatedAt: timestamp,
      deletedAt: null,
    };
    delete (sanitized as any).loggedStartAt;
    delete (sanitized as any).loggedEndAt;
    delete (sanitized as any).workLog;
    return sanitized;
  };

  const updateEntry = (entry: SessionEntry) => {
    if (!session) return;
    const prevSession = session;
    const prevEntry = session.entries.find((e) => e.id === entry.id);
    const newEntries = session.entries.map((e) =>
      e.id === entry.id ? entry : e
    );
    let updated = { ...session, entries: newEntries } as Session;
    // If session previously had no working sets and now has at least one, re-stamp date to today
    const hadWorkBefore = sessionHasRealWork(prevSession);
    const hasWorkNow = sessionHasRealWork(updated);
    if (!hadWorkBefore && hasWorkNow) {
      const today = new Date();
      const localDayStr = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const prevLocal =
        prevSession.localDate || prevSession.dateISO.slice(0, 10);
      if (prevLocal !== localDayStr) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        updated = {
          ...updated,
          dateISO: startOfDay.toISOString(),
          localDate: localDayStr,
        };
      }
    }
    // Stamp activity (debounced write later)
    if (hasWorkNow) {
      const nowIso = new Date().toISOString();
      if (!updated.loggedStartAt) (updated as any).loggedStartAt = nowIso;
      (updated as any).loggedEndAt = nowIso;
    }
    (updated as any).updatedAt = new Date().toISOString();
    if (hasWorkNow) {
      // Update per-day work log
      try {
        const d = new Date();
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
        const log = { ...(updated.workLog || {}) } as NonNullable<
          Session["workLog"]
        >;
        const prev = log[key];
        if (!prev)
          log[key] = {
            first: updated.updatedAt!,
            last: updated.updatedAt!,
            count: 1,
          };
        else
          log[key] = {
            ...prev,
            last: updated.updatedAt!,
            count: prev.count + 1,
          };
        (updated as any).workLog = log;
      } catch {}
    }
    lastLocalEditRef.current = Date.now();
    setSession(updated);
    latestSessionRef.current = updated;
    scheduleFlush();
    // If first valid set is now present and user had selected this phase, commit it
    if (hasWorkNow && phaseCommitPendingRef.current === phase) {
      (async () => {
        try {
          const s = await getSettings();
          await setSettings({ ...s, currentPhase: phase });
        } catch {}
        setAllowEmptyPhase(false);
        phaseCommitPendingRef.current = null;
      })();
    }
  };

  const removeEntry = async (entryId: string) => {
    if (!session) return;
    const cfg = await getSettings();
    if (cfg.confirmDestructive) {
      const exName =
        exercises.find(
          (e) =>
            e.id === session.entries.find((x) => x.id === entryId)?.exerciseId
        )?.name || "exercise";
      if (!window.confirm(`Remove ${exName} from this session?`)) return;
    }
    const prev = session;
    const updated = {
      ...session,
      entries: session.entries.filter((e) => e.id !== entryId),
    };
    setSession(updated);
    await persistSession(updated);
    const undo = async () => {
      setSession(prev);
      await persistSession(prev);
    };
    setLastAction({ undo });
    push({ message: "Exercise removed", actionLabel: "Undo", onAction: undo });
  };

  const addExerciseToSession = async (ex: Exercise) => {
    if (!session) return;
    let sets: SetEntry[] = [];
    const lastSets = await getLastWorkingSets(ex.id, week, phase);
    if (isDeloadWeek) {
      const dl = await getDeloadPrescription(ex.id, week, { deloadWeeks });
      const avgReps = lastSets.length
        ? Math.round(
            lastSets.reduce((a, b) => a + (b.reps || 8), 0) / lastSets.length
          )
        : 8;
      sets = Array.from({ length: dl.targetSets }, (_, i) => ({
        setNumber: i + 1,
        weightKg: dl.targetWeight,
        reps: avgReps,
      }));
    } else {
      sets = lastSets.length
        ? lastSets
        : [{ setNumber: 1, weightKg: null, reps: null }];
    }
    const entry: SessionEntry = { id: nanoid(), exerciseId: ex.id, sets };
    const updated = { ...session, entries: [...session.entries, entry] };
    // If this addition brings in working data immediately, stamp
    const hasWorkNow = sessionHasRealWork(updated);
    if (hasWorkNow) {
      const nowIso = new Date().toISOString();
      if (!updated.loggedStartAt) (updated as any).loggedStartAt = nowIso;
      (updated as any).loggedEndAt = nowIso;
    }
    (updated as any).updatedAt = new Date().toISOString();
    // Update per-day work log
    try {
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const log = { ...(updated.workLog || {}) } as NonNullable<
        Session["workLog"]
      >;
      const prev = log[key];
      if (!prev)
        log[key] = {
          first: updated.updatedAt!,
          last: updated.updatedAt!,
          count: 1,
        };
      else
        log[key] = { ...prev, last: updated.updatedAt!, count: prev.count + 1 };
      (updated as any).workLog = log;
    } catch {}
    lastLocalEditRef.current = Date.now();
    setSession(updated);
    await persistSession(updated);
    try {
      window.dispatchEvent(
        new CustomEvent("sb-change", { detail: { table: "sessions" } })
      );
    } catch {}
    if (hasWorkNow) {
      const s = await getSettings();
      await setSettings({
        ...s,
        dashboardPrefs: {
          ...(s.dashboardPrefs || {}),
          lastLocation: {
            phaseNumber: phase,
            weekNumber: week,
            dayId: day,
            sessionId: updated.id,
          },
        },
      });
    }
  };

  const createCustomExercise = async (name: string) => {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!clean) {
      return;
    }
    const ex: Exercise = {
      id: nanoid(),
      name: clean,
      muscleGroup: "other",
      defaults: { sets: 3, targetRepRange: "8-12" },
    };
    await db.put("exercises", ex);
    setExercises([ex, ...exercises]);
    await addExerciseToSession(ex);
  };

  // Switch exercise in a session entry (keep set rows; clear values unless none were logged)
  const switchExercise = async (entry: SessionEntry, newEx: Exercise) => {
    if (!session) return;
    const hadLogged = entry.sets.some(
      (s) => (s.weightKg || 0) > 0 || (s.reps || 0) > 0
    );
    if (hadLogged) {
      const ok = window.confirm(
        "This exercise has logged sets. Switching will clear these set values. Continue?"
      );
      if (!ok) return;
    }
    const base = entry.sets.length || newEx.defaults?.sets || 3;
    const rows = Math.max(0, base);
    const newSets: SetEntry[] =
      rows === 0
        ? []
        : Array.from({ length: rows }, (_, i) => ({
            setNumber: i + 1,
            weightKg: null,
            reps: null,
            rpe: entry.sets[i]?.rpe,
          }));
    const newEntry: SessionEntry = {
      ...entry,
      exerciseId: newEx.id,
      targetRepRange:
        (newEx as any)?.defaults?.targetRepRange ?? entry.targetRepRange,
      sets: newSets,
    };
    // Persist via existing update flow (stamps time, debounces write)
    updateEntry(newEntry);
    setSwitchTarget(null);
    try {
      (navigator as any).vibrate?.(10);
    } catch {}
    push({ message: `Switched to ${newEx.name}` });
  };

  const sessionExerciseIds = useMemo(() => {
    if (!session) return new Set<string>();
    return new Set(session.entries.map((en) => en.exerciseId));
  }, [session?.id, session?.entries]);

  const recentExercises = useMemo(() => {
    if (!session) return [] as Exercise[];
    const seen = new Set<string>();
    const list: Exercise[] = [];
    for (let i = session.entries.length - 1; i >= 0; i--) {
      const entry = session.entries[i];
      if (seen.has(entry.exerciseId)) continue;
      const ex = exMap.get(entry.exerciseId);
      if (ex) {
        list.push(ex);
        seen.add(entry.exerciseId);
      }
      if (list.length === 6) break;
    }
    return list;
  }, [session?.entries, exMap]);

  const muscleFilters = useMemo(() => {
    const groups = new Set<string>();
    for (const ex of exercises) {
      if (ex.muscleGroup) groups.add(ex.muscleGroup);
    }
    const sorted = Array.from(groups).sort((a, b) =>
      formatMuscleLabel(a).localeCompare(formatMuscleLabel(b))
    );
    return ["all", ...sorted];
  }, [exercises]);

  const addExerciseOptions = useMemo<OptionSheetOption[]>(() => {
    const q = query.trim().toLowerCase();
    const list = exercises
      .filter((ex) => addFilter === "all" || ex.muscleGroup === addFilter)
      .filter((ex) => (q ? ex.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 200);
    return list.map((ex) => {
      const secondary =
        ex.secondaryMuscles && ex.secondaryMuscles.length
          ? `Secondary: ${ex.secondaryMuscles
              .map((m) => formatMuscleLabel(m))
              .join(", ")}`
          : undefined;
      const isInSession = sessionExerciseIds.has(ex.id);
      return {
        id: ex.id,
        label: ex.name,
        description: formatMuscleLabel(ex.muscleGroup),
        hint: secondary,
        selected: isInSession,
        trailing: isInSession ? "In session" : undefined,
        onSelect: () => {
          addExerciseToSession(ex);
          setShowAdd(false);
          setQuery("");
          setAddFilter("all");
        },
      } satisfies OptionSheetOption;
    });
  }, [exercises, addFilter, query, sessionExerciseIds, addExerciseToSession]);

  const addSheetHighlight = (muscleFilters.length > 1 ||
    recentExercises.length > 0) && (
    <div className="flex flex-col gap-2 pt-1 text-xs text-white/70">
      {muscleFilters.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/35">
            Filter
          </span>
          {muscleFilters.map((key) => {
            const label =
              key === "all" ? "All muscles" : formatMuscleLabel(key);
            const active = addFilter === key;
            return (
              <button
                key={key}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
                }`}
                onClick={() => setAddFilter(key)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {recentExercises.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/35">
            Recent
          </span>
          {recentExercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:border-emerald-400/60 hover:bg-emerald-400/15 hover:text-white"
              onClick={() => {
                addExerciseToSession(ex);
                setShowAdd(false);
                setQuery("");
                setAddFilter("all");
              }}
            >
              {ex.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const switchModalContext = useMemo(() => {
    if (!switchTarget || !session) return null;
    const entry = session.entries.find((e) => e.id === switchTarget.entryId);
    if (!entry) return null;
    const currentEx = exMap.get(entry.exerciseId);
    const group = currentEx?.muscleGroup || null;
    const q = switchQuery.trim().toLowerCase();
    const pool = exercises.filter((ex) => ex.id !== currentEx?.id);
    const scoped =
      switchScope === "group" && group
        ? pool.filter((ex) => ex.muscleGroup === group)
        : pool;
    const list = scoped
      .filter((ex) => (q ? ex.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 160);
    const options = list.map((ex) => {
      const secondary =
        ex.secondaryMuscles && ex.secondaryMuscles.length
          ? `Secondary: ${ex.secondaryMuscles
              .map((m) => formatMuscleLabel(m))
              .join(", ")}`
          : undefined;
      return {
        id: ex.id,
        label: ex.name,
        description: formatMuscleLabel(ex.muscleGroup),
        hint: secondary,
        onSelect: () => switchExercise(entry, ex),
      } satisfies OptionSheetOption;
    });
    return {
      entry,
      currentEx,
      group,
      options,
      scopedCount: scoped.length,
      totalCount: pool.length,
    };
  }, [
    switchTarget?.entryId,
    session?.entries,
    exMap,
    exercises,
    switchQuery,
    switchScope,
    switchExercise,
  ]);

  const switchSheetHighlight = switchModalContext && (
    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-white/70">
      <span className="text-[10px] uppercase tracking-[0.28em] text-white/35">
        Scope
      </span>
      <button
        type="button"
        className={`rounded-full border px-3 py-1 text-xs transition ${
          switchScope === "group"
            ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
        }`}
        onClick={() => setSwitchScope("group")}
      >
        Same muscle
      </button>
      <button
        type="button"
        className={`rounded-full border px-3 py-1 text-xs transition ${
          switchScope === "all"
            ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
        }`}
        onClick={() => setSwitchScope("all")}
      >
        Show all
      </button>
      {switchModalContext.group ? (
        <span className="ml-auto text-[11px] text-white/50">
          Targeting {formatMuscleLabel(switchModalContext.group)}
        </span>
      ) : null}
    </div>
  );

  const weightUnit = settingsState?.unit === "lb" ? "lb" : "kg";

  const formatWeightDisplay = useCallback(
    (kg?: number | null) => {
      if (!Number.isFinite(kg ?? null) || kg == null || kg <= 0) return "BW";
      const value = weightUnit === "lb" ? kg * KG_TO_LB : kg;
      if (value >= 200) return `${Math.round(value)}${weightUnit}`;
      if (value >= 20) return `${value.toFixed(1)}${weightUnit}`;
      return `${value.toFixed(2)}${weightUnit}`;
    },
    [weightUnit]
  );

  const formatVolumeDisplay = useCallback(
    (kg: number) => {
      if (!Number.isFinite(kg) || kg <= 0) return null;
      const value = weightUnit === "lb" ? kg * KG_TO_LB : kg;
      if (value >= 10000) return `${(value / 1000).toFixed(1)}k${weightUnit}`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k${weightUnit}`;
      return `${Math.round(value)}${weightUnit}`;
    },
    [weightUnit]
  );

  const formatHistoryDate = useCallback((row: ExerciseHistoryRow) => {
    const iso =
      row.dateISO || (row.localDate ? `${row.localDate}T00:00:00` : null);
    if (!iso) return "Undated session";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Undated session";
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }, []);

  const historyOptions = useMemo<OptionSheetOption[]>(() => {
    if (!historyContext?.entries?.length) return [];
    return historyContext.entries.map((item, index) => {
      const metaParts: string[] = [];
      if (item.phaseNumber) metaParts.push(`Phase ${item.phaseNumber}`);
      if (item.weekNumber) metaParts.push(`Week ${item.weekNumber}`);
      if (item.dayName) metaParts.push(item.dayName);
      const meta = metaParts.join(" • ");
      const workingSets = item.sets.filter(
        (set) => (set.reps || 0) > 0 || (set.weightKg || 0) > 0
      );
      const setDetail = (workingSets.length ? workingSets : item.sets).map(
        (set, setIdx) => {
          const weight =
            (set.weightKg || 0) > 0
              ? formatWeightDisplay(set.weightKg || 0)
              : "BW";
          const reps = set.reps != null ? set.reps : "—";
          return (
            <div
              key={`${item.sessionId}-${item.entryId}-set-${setIdx}`}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2"
            >
              <span className="text-[10px] uppercase tracking-[0.28em] text-white/45">
                Set {setIdx + 1}
              </span>
              <span className="text-sm font-semibold text-white">{weight}</span>
              <span className="text-sm text-white/80">× {reps}</span>
              {set.rpe != null ? (
                <span className="text-xs text-white/60">RPE {set.rpe}</span>
              ) : null}
            </div>
          );
        }
      );
      const detail = setDetail.length ? (
        <div className="space-y-1">{setDetail}</div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          No sets logged in this session.
        </div>
      );
      return {
        id: `${item.sessionId}-${item.entryId}-${index}`,
        label: formatHistoryDate(item),
        description: meta || undefined,
        detail,
        selected: index === 0,
        onSelect: () => {},
      } satisfies OptionSheetOption;
    });
  }, [historyContext?.entries, formatWeightDisplay, formatHistoryDate]);

  const historyHighlight = useMemo(() => {
    if (!historyContext || historyLoading || historyError) return null;
    if (!historyContext.entries.length) return null;
    const totalVolume = historyContext.entries.reduce(
      (sum, item) => sum + item.tonnageKg,
      0
    );
    const totalSets = historyContext.entries.reduce(
      (sum, item) => sum + item.workingSets,
      0
    );
    let peakSet: ExerciseHistoryRow["bestSet"] = null;
    for (const item of historyContext.entries) {
      if (!item.bestSet) continue;
      if (!peakSet || (item.bestSet.weightKg || 0) > (peakSet?.weightKg || 0)) {
        peakSet = item.bestSet;
      }
    }
    const volumeLabel = formatVolumeDisplay(totalVolume);
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
              Exercise
            </p>
            <p className="text-sm font-semibold text-white">
              {historyContext.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
              Sessions
            </p>
            <p className="text-lg font-semibold text-white">
              {historyContext.entries.length}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
              Sets logged
            </p>
            <p className="mt-1 text-sm font-medium text-white">{totalSets}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
              Volume
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {volumeLabel ?? "—"}
            </p>
          </div>
          {peakSet ? (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
                Heaviest set
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {formatWeightDisplay(peakSet.weightKg)}×{peakSet.reps}
                {peakSet.rpe != null ? ` · RPE ${peakSet.rpe}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }, [
    historyContext,
    historyLoading,
    historyError,
    formatVolumeDisplay,
    formatWeightDisplay,
  ]);

  const historyEmptyMessage = historyLoading
    ? "Loading history…"
    : historyError ?? "No logged sessions yet for this exercise.";

  const openExerciseHistory = useCallback(
    (exerciseId: string, fallbackName: string) => {
      const exerciseName =
        exMap.get(exerciseId)?.name || exNameCache[exerciseId] || fallbackName;
      const loadToken = ++historyLoadTokenRef.current;
      setHistorySheetOpen(true);
      setHistoryLoading(true);
      setHistoryError(null);
      setHistoryContext({ exerciseId, name: exerciseName, entries: [] });
      (async () => {
        try {
          const allSessions = await getAllCached<Session>("sessions", {
            swr: true,
            ttlMs: currentSessionsTtl(),
          });
          const rows: ExerciseHistoryRow[] = [];
          for (const s of allSessions) {
            if (!Array.isArray(s.entries)) continue;
            const match = s.entries.find((en) => en.exerciseId === exerciseId);
            if (!match) continue;
            const sets = Array.isArray(match.sets) ? match.sets : [];
            const workingSets = sets.filter(
              (set) => (set.reps || 0) > 0 || (set.weightKg || 0) > 0
            ).length;
            if (workingSets === 0) continue;
            const tonnageKg = sets.reduce(
              (sum, set) => sum + (set.weightKg || 0) * (set.reps || 0),
              0
            );
            let best: ExerciseHistoryRow["bestSet"] = null;
            for (const set of sets) {
              const weight = set.weightKg || 0;
              const reps = set.reps || 0;
              if (weight <= 0 || reps <= 0) continue;
              if (!best || weight > (best.weightKg || 0)) {
                best = { weightKg: weight, reps, rpe: set.rpe ?? null };
              }
            }
            rows.push({
              exerciseId,
              sessionId: s.id,
              entryId: match.id,
              dateISO: s.dateISO,
              localDate: s.localDate ?? null,
              weekNumber:
                s.weekNumber ??
                (s as any).weekNumber ??
                (s as any).loggedWeek ??
                null,
              phaseNumber:
                s.phaseNumber ??
                (s as any).phaseNumber ??
                (s as any).phase ??
                null,
              dayName: s.dayName ?? (s as any).dayName ?? null,
              sets,
              workingSets,
              totalSets: sets.length,
              tonnageKg,
              bestSet: best,
            });
          }
          const parseDate = (item: ExerciseHistoryRow) => {
            if (item.dateISO) {
              const value = Date.parse(item.dateISO);
              if (!Number.isNaN(value)) return value;
            }
            if (item.localDate) {
              const value = Date.parse(`${item.localDate}T00:00:00`);
              if (!Number.isNaN(value)) return value;
            }
            return 0;
          };
          rows.sort((a, b) => parseDate(b) - parseDate(a));
          if (historyLoadTokenRef.current !== loadToken) return;
          setHistoryContext({ exerciseId, name: exerciseName, entries: rows });
        } catch (err) {
          if (historyLoadTokenRef.current !== loadToken) return;
          console.error("[Sessions] Failed to load exercise history", err);
          setHistoryError("Unable to load history right now.");
        } finally {
          if (historyLoadTokenRef.current === loadToken) {
            setHistoryLoading(false);
          }
        }
      })();
    },
    [exMap, exNameCache, currentSessionsTtl]
  );

  const closeExerciseHistory = useCallback(() => {
    setHistorySheetOpen(false);
  }, []);

  const reorderEntry = async (from: number, to: number) => {
    if (
      !session ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= session.entries.length ||
      to >= session.entries.length
    )
      return;
    const arr = [...session.entries];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const updated = { ...session, entries: arr };
    setSession(updated);
    await persistSession(updated);
  };

  // Manually stamp the session with today's local date (overrides previous date)
  const stampToday = async () => {
    if (!session) return;
    const today = new Date();
    const localDayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    if (session.localDate === localDayStr) {
      push({ message: "Already stamped for today" });
      return;
    }
    const prev = session;
    const updated: Session = {
      ...session,
      dateISO: startOfDay.toISOString(),
      localDate: localDayStr,
    };
    setSession(updated);
    await persistSession(updated);
    try {
      window.dispatchEvent(
        new CustomEvent("sb-change", { detail: { table: "sessions" } })
      );
    } catch {}
    try {
      navigator.vibrate?.(15);
    } catch {}
    push({
      message: `Session dated ${displayDate(localDayStr)}`,
      actionLabel: "Undo",
      onAction: async () => {
        await persistSession(prev);
        setSession(prev);
      },
    });
  };

  // Save manually selected date (subtle edit control)
  const saveManualDate = async () => {
    if (!session) return;
    if (!/\d{4}-\d{2}-\d{2}/.test(dateEditValue)) {
      push({ message: "Invalid date" });
      return;
    }
    if (session.localDate === dateEditValue) {
      setEditingDate(false);
      return;
    }
    const prev = session;
    const d = new Date(dateEditValue + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    const updated: Session = {
      ...session,
      dateISO: d.toISOString(),
      localDate: dateEditValue,
    };
    setSession(updated);
    await persistSession(updated);
    try {
      window.dispatchEvent(
        new CustomEvent("sb-change", { detail: { table: "sessions" } })
      );
    } catch {}
    setEditingDate(false);
    push({
      message: `Date set to ${dateEditValue}`,
      actionLabel: "Undo",
      onAction: async () => {
        await persistSession(prev);
        setSession(prev);
        try {
          window.dispatchEvent(
            new CustomEvent("sb-change", { detail: { table: "sessions" } })
          );
        } catch {}
      },
    });
  };

  // Display helper: convert yyyy-mm-dd to dd/mm/yyyy for UI
  const displayDate = (isoLike?: string) => {
    if (!isoLike) return "";
    if (/\d{4}-\d{2}-\d{2}/.test(isoLike)) {
      const [y, m, d] = isoLike.split("-");
      return `${d}/${m}/${y}`;
    }
    return isoLike;
  };

  const openEraseSheet = () => {
    if (!session || wipeBusy) return;
    setWipeScope("day");
    setWipeConfirmValue("");
    setWipeError(null);
    setWipeSheetOpen(true);
  };

  const sessionDuration = (() => {
    // Prefer robust day-scoped duration if available
    const log = session?.workLog;
    if (log && Object.keys(log).length) {
      // Choose dominant day (highest count); tie-break by longest active span
      const entries = Object.entries(log);
      entries.sort((a, b) => {
        const ca = a[1]?.count || 0,
          cb = b[1]?.count || 0;
        if (cb !== ca) return cb - ca;
        const la =
          new Date(a[1]?.last || 0).getTime() -
          new Date(a[1]?.first || 0).getTime();
        const lb =
          new Date(b[1]?.last || 0).getTime() -
          new Date(b[1]?.first || 0).getTime();
        return lb - la;
      });
      const dom = entries[0]?.[1];
      if (dom?.first && dom?.last) {
        const start = new Date(dom.first).getTime();
        const end = new Date(dom.last).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          const ms = Math.max(0, Math.min(end - start, 1000 * 60 * 6 * 6 * 2)); // safety cap ~12h
          const mins = Math.floor(ms / 60000);
          const hrs = Math.floor(mins / 60);
          const remMins = mins % 60;
          return hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
        }
      }
    }
    // Fallback to legacy loggedStartAt/EndAt
    if (!session?.loggedStartAt || !session.loggedEndAt) return null;
    const start = new Date(session.loggedStartAt).getTime();
    const end = new Date(session.loggedEndAt).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;
    const ms = end - start;
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
  })();

  // Pacing metrics derived from completedAt stamps
  const pacing = useMemo(
    () => (session ? computeSessionPacing(session) : null),
    [session?.id, session?.entries.length]
  );
  const canOpenWipe = Boolean(session) && !wipeBusy;
  const eraseButtonTitle = session
    ? "Erase logged data for this session, week, or phase"
    : "Load a session to erase data";
  const hasMomentumPanel =
    !initialLoading && session != null && analytics != null;
  const formatMs = (ms: number) => {
    if (!ms) return "–";
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    if (m >= 1) return `${m}m ${s.toString().padStart(2, "0")}s`;
    return `${s}s`;
  };
  const [showPacingDetails, setShowPacingDetails] = useState(false);
  const [expandedNames, setExpandedNames] = useState<Record<string, boolean>>(
    {}
  );
  const toggleName = (id: string) =>
    setExpandedNames((p) => ({ ...p, [id]: !p[id] }));

  // Map entry IDs to exercise names for FloatingRestTimer
  const entryIdToExerciseName = useMemo(() => {
    const map: Record<string, string> = {};
    if (session?.entries) {
      for (const entry of session.entries) {
        const ex = exMap.get(entry.exerciseId);
        map[entry.id] = ex?.name || exNameCache[entry.exerciseId] || "Exercise";
      }
    }
    return map;
  }, [session?.entries, exMap, exNameCache]);

  return (
    <div className="space-y-4">
      {/* Floating Rest Timer */}
      <FloatingRestTimer
        restTimers={restTimers}
        targetSeconds={settingsState?.restTimerTargetSeconds ?? 90}
        exerciseNames={entryIdToExerciseName}
        onStop={stopRestTimer}
        onRestart={restartRestTimer}
      />
      {/* Top scroll anchor at very start to allow absolute top jump */}
      <div
        id="sessions-top-anchor"
        aria-hidden="true"
        style={{ position: "relative", height: 0 }}
      />
      {/* Removed mobile floating Add Exercise button (user preference) */}
      <section className="px-4" aria-label="Session controls" ref={toolbarRef}>
        <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.82)] px-4 py-4 shadow-[0_20px_48px_rgba(15,23,42,0.55)] backdrop-blur sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-slate-50">
                Sessions
              </h2>
              <SessionBreadcrumb
                phase={phase}
                week={Number(week) || 1}
                day={day}
                dayLabel={
                  program
                    ? program.weeklySplit[day]?.customLabel ||
                      program.weeklySplit[day]?.type
                    : undefined
                }
                className="mt-1"
              />
            </div>
            {sessionDuration && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-medium text-indigo-200"
                title="Active logging duration (first to last non-zero set)"
              >
                ⏱ {sessionDuration}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="flex min-w-[200px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.32em] text-slate-300/60">
                Workout day
              </span>
              <DaySelector
                labels={
                  program
                    ? program.weeklySplit.map(
                        (d: any) => d.customLabel || d.type
                      )
                    : labelsCache || DAYS
                }
                value={day}
                onChange={(v) => {
                  setDay(v);
                  setAutoNavDone(true);
                  setAllowEmptyPhase(true);
                }}
              />
            </div>
            <div className="flex min-w-[220px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.32em] text-slate-300/60">
                Week & phase
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <WeekSelector
                  value={Number(week) || 1}
                  totalWeeks={
                    program && Number.isFinite(program.mesoWeeks)
                      ? Math.max(1, Number(program.mesoWeeks) || 1)
                      : 9
                  }
                  deloadWeeks={deloadWeeks}
                  onChange={(selectedWeek) => {
                    setWeek(selectedWeek as any);
                    setAutoNavDone(true);
                    setAllowEmptyPhase(true);
                  }}
                />
                <PhaseStepper
                  variant="compact"
                  value={phase}
                  onChange={async (p) => {
                    setPhase(p);
                    setAllowEmptyPhase(true);
                    phaseCommitPendingRef.current = p;
                    const s = await getSettings();
                    await setSettings({
                      ...s,
                      dashboardPrefs: {
                        ...(s.dashboardPrefs || {}),
                        lastLocation: {
                          ...(s.dashboardPrefs?.lastLocation || {
                            weekNumber: 1,
                            dayId: 0,
                          }),
                          phaseNumber: p,
                        },
                      },
                    });
                  }}
                />
              </div>
            </div>
            {session && (
              <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.32em] text-slate-300/60">
                  Session date & quick actions
                </span>
                <div
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-900/75 px-3 py-2 text-[11px] text-slate-100"
                  title="Current assigned date (edit or stamp)"
                >
                  {editingDate ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="date"
                        className="rounded border border-white/10 bg-slate-800/90 px-2 py-1 text-[11px] text-slate-200"
                        value={dateEditValue}
                        onChange={(e) => setDateEditValue(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded bg-emerald-500/80 px-2 py-1 text-[10px] font-medium text-emerald-900 transition hover:bg-emerald-400"
                        onClick={saveManualDate}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded bg-slate-700/80 px-2 py-1 text-[10px] text-slate-200 transition hover:bg-slate-600"
                        onClick={() => setEditingDate(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span
                      className="font-mono tracking-tight"
                      title={session.localDate || session.dateISO.slice(0, 10)}
                    >
                      {displayDate(
                        session.localDate || session.dateISO.slice(0, 10)
                      )}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    {!editingDate && (
                      <button
                        type="button"
                        className={`rounded bg-slate-700 px-2 py-1 text-[10px] transition hover:bg-slate-600 ${
                          stampAnimating ? "animate-stamp" : ""
                        }`}
                        onClick={() => {
                          setStampAnimating(true);
                          setTimeout(() => setStampAnimating(false), 360);
                          stampToday();
                        }}
                        aria-label="Stamp with today's date"
                      >
                        Stamp
                      </button>
                    )}
                    {!editingDate && (
                      <button
                        type="button"
                        aria-label="Edit date"
                        className="rounded bg-slate-700 px-2 py-1 text-[10px] transition hover:bg-slate-600"
                        onClick={() => {
                          setDateEditValue(
                            session.localDate || session.dateISO.slice(0, 10)
                          );
                          setEditingDate(true);
                        }}
                      >
                        ✎
                      </button>
                    )}
                    {session && !!session.entries.length && (
                      <button
                        type="button"
                        className="rounded bg-slate-700 px-2 py-1 text-[10px] transition hover:bg-slate-600"
                        aria-label={
                          allCollapsed
                            ? "Expand all exercises"
                            : "Collapse all exercises"
                        }
                        title={
                          allCollapsed
                            ? "Expand all exercises"
                            : "Collapse all exercises"
                        }
                        onClick={() => {
                          if (allCollapsed) expandAll();
                          else collapseAll();
                          try {
                            navigator.vibrate?.(8);
                          } catch {}
                        }}
                      >
                        {allCollapsed ? "Expand" : "Collapse"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded bg-slate-800/70 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70 transition hover:bg-slate-700/70"
                      onClick={() => setEditingDate((v) => !v)}
                    >
                      {editingDate ? "Done" : "Edit"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-slate-800/70 px-3 py-1.5 font-medium text-slate-100 shadow-sm transition hover:bg-slate-700/80"
              onClick={() => setToolsOpen((open) => !open)}
              aria-expanded={toolsOpen}
              aria-controls="session-tools-panel"
              type="button"
            >
              <span>{toolsOpen ? "Hide tools" : "Show tools"}</span>
              <span
                className={`text-base leading-none transition-transform duration-150 ${
                  toolsOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
          </div>
          <AnimatePresence initial={false}>
            {toolsOpen && (
              <motion.div
                key="session-tools"
                id="session-tools-panel"
                className="flex flex-wrap items-center gap-2 text-[11px] text-slate-200"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.32, 0.72, 0.33, 1] }}
              >
                {session && (
                  <>
                    <button
                      type="button"
                      data-testid="erase-session-tools"
                      className="tool-btn !border-rose-400/60 !bg-rose-500/15 !px-3 !py-1.5 !font-semibold !text-rose-100 !shadow-[0_0_10px_rgba(244,63,94,0.28)] hover:!bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canOpenWipe}
                      onClick={openEraseSheet}
                      title={eraseButtonTitle}
                    >
                      Erase Data
                    </button>
                    <button
                      type="button"
                      className="tool-btn !px-3 !py-1.5"
                      onClick={() => {
                        setStampAnimating(true);
                        setTimeout(() => setStampAnimating(false), 360);
                        stampToday();
                      }}
                      title="Stamp with today's date"
                    >
                      Stamp
                    </button>
                    <button
                      type="button"
                      className="tool-btn !px-3 !py-1.5"
                      onClick={() => setShowImport(true)}
                      title="Import from template"
                    >
                      Import
                    </button>
                    <button
                      type="button"
                      className="tool-btn !px-3 !py-1.5"
                      disabled={!session.entries.length}
                      onClick={() => setShowSaveTemplate(true)}
                      title={
                        session.entries.length
                          ? "Save this session as template"
                          : "No exercises to save"
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="tool-btn !px-3 !py-1.5"
                      onClick={() => collapseAll()}
                      title="Collapse all exercises"
                    >
                      Collapse All
                    </button>
                    <button
                      type="button"
                      className="tool-btn !px-3 !py-1.5"
                      onClick={() => expandAll()}
                      title="Expand all exercises"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      className="tool-btn !px-3 !py-1.5"
                      onClick={async () => {
                        const prevId = `${phase}-${Math.max(
                          1,
                          (week as number) - 1
                        )}-${day}`;
                        let prev = await db.get<Session>("sessions", prevId);
                        if (!prev && week === 1 && phase > 1) {
                          prev = await db.get<Session>(
                            "sessions",
                            `${phase - 1}-9-${day}`
                          );
                        }
                        if (prev) {
                          const copy: Session = {
                            ...session,
                            entries: prev.entries.map((e) => ({
                              ...e,
                              id: nanoid(),
                              sets: e.sets.map((s, i) => ({
                                ...s,
                                setNumber: i + 1,
                              })),
                            })),
                          };
                          setSession(copy);
                          await persistSession(copy);
                        }
                      }}
                      title="Copy previous session"
                    >
                      Copy Last
                    </button>
                  </>
                )}
                <button
                  className="tool-btn !px-3 !py-1.5"
                  onClick={async () => {
                    // Move UI to next phase without committing until data is logged
                    const s = await getSettings();
                    const next = (s.currentPhase || 1) + 1;
                    setPhase(next as number);
                    setWeek(1 as any);
                    setDay(0);
                    setAllowEmptyPhase(true);
                    phaseCommitPendingRef.current = next;
                    await setSettings({
                      ...s,
                      dashboardPrefs: {
                        ...(s.dashboardPrefs || {}),
                        lastLocation: {
                          ...(s.dashboardPrefs?.lastLocation || {}),
                          phaseNumber: next,
                          weekNumber: 1 as any,
                          dayId: 0,
                        },
                      },
                    });
                  }}
                  title="Next phase"
                >
                  Next →
                </button>
                {phase > 1 && (
                  <button
                    className="tool-btn !px-3 !py-1.5"
                    onClick={async () => {
                      if (
                        !window.confirm(`Go to phase ${phase - 1} (view only)?`)
                      )
                        return;
                      const s = await getSettings();
                      const prev = Math.max(1, (phase as number) - 1);
                      // View previous phase, do not change committed currentPhase
                      setPhase(prev as number);
                      setWeek(1 as any);
                      setDay(0);
                      setAllowEmptyPhase(true);
                      phaseCommitPendingRef.current = prev;
                      await setSettings({
                        ...s,
                        dashboardPrefs: {
                          ...(s.dashboardPrefs || {}),
                          lastLocation: {
                            ...(s.dashboardPrefs?.lastLocation || {}),
                            phaseNumber: prev,
                            weekNumber: 1 as any,
                            dayId: 0,
                          },
                        },
                      });
                    }}
                    title="Previous phase"
                  >
                    ← Prev
                  </button>
                )}
                {sessionDuration && (
                  <span className="ml-auto rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-indigo-200">
                    ⏱ {sessionDuration}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {focusMode && (
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100 shadow-[0_6px_18px_-12px_rgba(16,185,129,0.6)]">
              <span className="uppercase tracking-[0.24em] text-emerald-200/80">
                Focus mode
              </span>
              <button
                className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-50 transition-colors hover:bg-emerald-400/30"
                onClick={() => exitFocus()}
              >
                Exit
              </button>
            </div>
          )}
        </div>
      </section>
      {/* Session analytics & pacing */}
      {!initialLoading && session && analytics && (
        <SessionMomentumPanel
          analytics={analytics}
          onFocusRequest={activateFocus}
          focusedEntryId={focusedEntryId}
        />
      )}
      {session && pacing && pacing.overall.count > 0 && (
        <div className="mx-4 mt-3 bg-[rgba(30,41,59,0.65)] rounded-xl p-3 space-y-2 border border-white/5">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="font-semibold tracking-wide">Pacing</span>
            <button
              className="text-[10px] underline text-slate-400"
              onClick={() => setShowPacingDetails((s) => !s)}
            >
              {showPacingDetails ? "Hide Details" : "Show Details"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
            <div>
              Sets:{" "}
              <span className="text-slate-200 font-medium">
                {pacing.overall.count}
              </span>
            </div>
            <div>
              Avg Rest:{" "}
              <span className="text-slate-200 font-medium">
                {formatMs(pacing.overall.averageMs)}
              </span>
            </div>
            <div>
              Median:{" "}
              <span className="text-slate-200 font-medium">
                {formatMs(pacing.overall.medianMs)}
              </span>
            </div>
            <div>
              Longest:{" "}
              <span className="text-slate-200 font-medium">
                {formatMs(pacing.overall.longestMs)}
              </span>
            </div>
            {sessionDuration && (
              <div>
                Session Span:{" "}
                <span className="text-slate-200 font-medium">
                  {sessionDuration}
                </span>
              </div>
            )}
          </div>
          {showPacingDetails && (
            <div className="space-y-1 max-h-64 overflow-auto pr-1">
              {pacing.exercises
                .filter((e) => e.count > 0)
                .map((e) => {
                  const ex = exMap.get(e.exerciseId);
                  const name =
                    ex?.name || exNameCache[e.exerciseId] || e.exerciseId;
                  return (
                    <div
                      key={e.exerciseId}
                      className="flex items-center justify-between gap-2 text-[10px] bg-slate-800/50 rounded-lg px-2 py-1"
                    >
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => toggleName(e.exerciseId)}
                          className="text-left w-full truncate hover:whitespace-normal hover:line-clamp-none focus:outline-none"
                        >
                          <span
                            className={`capitalize ${
                              expandedNames[e.exerciseId]
                                ? "whitespace-normal break-words"
                                : ""
                            }`}
                          >
                            {name}
                          </span>
                        </button>
                      </div>
                      <div className="flex gap-3 text-[9px] tabular-nums text-slate-300">
                        <span>n{e.count}</span>
                        <span>avg {formatMs(e.averageMs)}</span>
                        <span>med {formatMs(e.medianMs)}</span>
                        <span>max {formatMs(e.longestMs)}</span>
                      </div>
                    </div>
                  );
                })}
              {!pacing.exercises.some((e) => e.count > 0) && (
                <div className="text-[10px] text-slate-500">
                  No rest intervals yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Non-sticky actions; keep compact on mobile and avoid wrapping controls off-screen */}
      <div
        className={`flex flex-wrap items-center gap-2 ${
          hasMomentumPanel ? "mt-0" : "-mt-6"
        } sm:mt-0`}
      >
        <div className="hidden sm:flex items-center gap-2">
          <button
            className="btn-primary-enhanced btn-enhanced px-4 py-2.5 rounded-xl font-medium text-white"
            onClick={() => setShowImport(true)}
          >
            Import from Template
          </button>
          <button
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded-xl disabled:opacity-40 font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95"
            disabled={!session || !session.entries.length}
            onClick={() => setShowSaveTemplate(true)}
            title="Save current session as a reusable template"
          >
            Save as Template
          </button>
          <button
            className="bg-emerald-700 px-3 py-2 rounded-xl"
            title="Start next 9-week phase"
            onClick={async () => {
              const all = await db.getAll<Session>("sessions");
              const curPhaseSessions = all.filter(
                (s) => (s.phaseNumber || s.phase || 1) === phase
              );
              const hasReal = curPhaseSessions.some(sessionHasRealWork);
              if (!hasReal) {
                if (
                  !window.confirm(
                    "No real training data logged in this phase. Advance anyway?"
                  )
                )
                  return;
              } else {
                if (
                  !window.confirm(
                    "Advance to next phase? This will reset week to 1."
                  )
                )
                  return;
              }
              const s = await getSettings();
              const next = (s.currentPhase || 1) + 1;
              await setSettings({ ...s, currentPhase: next });
              setPhase(next as number);
              setWeek(1 as any);
              setDay(0);
            }}
          >
            Next phase →
          </button>
          {phase > 1 && (
            <button
              className="bg-slate-700 px-3 py-2 rounded-xl"
              title="Revert to previous phase"
              onClick={async () => {
                if (!window.confirm("Revert to phase " + (phase - 1) + "?"))
                  return;
                const s = await getSettings();
                const prev = Math.max(1, (s.currentPhase || 1) - 1);
                await setSettings({ ...s, currentPhase: prev });
                setPhase(prev);
                setWeek(1 as any);
                setDay(0);
              }}
            >
              ← Prev phase
            </button>
          )}
          <button
            className="bg-slate-700 px-3 py-2 rounded-xl"
            onClick={async () => {
              if (!session) return;
              const prevId = `${phase}-${Math.max(
                1,
                (week as number) - 1
              )}-${day}`;
              let prev = await db.get<Session>("sessions", prevId);
              if (!prev && week === 1 && phase > 1) {
                prev = await db.get<Session>(
                  "sessions",
                  `${phase - 1}-9-${day}`
                );
              }
              if (prev) {
                const copy: Session = {
                  ...session,
                  entries: prev.entries.map((e) => ({
                    ...e,
                    id: nanoid(),
                    sets: e.sets.map((s, i) => ({ ...s, setNumber: i + 1 })),
                  })),
                };
                setSession(copy);
                await persistSession(copy);
              }
            }}
          >
            Copy last session
          </button>
          {/* Apply-to-future moved to Program Settings */}
        </div>
        {/* Mobile inline compact tools removed from normal flow; see fixed overlay above */}
      </div>
      {/* Legacy floating more panel removed in favor of inline collapsible */}
      {isDeloadWeek && (
        <div
          className="text-xs text-amber-300 fade-in inline-flex items-center gap-1"
          data-shape="deload"
          aria-label="Deload week adjustments are active"
        >
          Deload adjustments active
        </div>
      )}

      <div
        className={`space-y-3 sm:mt-0 ${
          hasMomentumPanel ? "mt-0" : "-mt-[72px]"
        }`}
      >
        {initialLoading && (
          <div className="space-y-3" aria-label="Loading session">
            <div className="h-5 w-40 rounded skeleton" />
            <div className="rounded-2xl p-4 glow-card">
              <div className="h-4 w-3/5 rounded skeleton mb-3" />
              <div className="space-y-2">
                <div className="h-8 rounded skeleton" />
                <div className="h-8 rounded skeleton" />
                <div className="h-8 rounded skeleton" />
              </div>
            </div>
            <div className="rounded-2xl p-4 glow-card">
              <div className="h-4 w-2/5 rounded skeleton mb-3" />
              <div className="space-y-2">
                <div className="h-8 rounded skeleton" />
                <div className="h-8 rounded skeleton" />
              </div>
            </div>
          </div>
        )}
        {/* Top sticky: live muscle counts + contents navigator */}
        {!initialLoading && session && session.entries.length > 0 && (
          <TopMuscleAndContents
            session={session}
            exMap={exMap}
            exNameCache={exNameCache}
          />
        )}
        {!initialLoading &&
          session &&
          session.entries.map((entry, entryIdx) => {
            const ex = exMap.get(entry.exerciseId) || undefined;
            // derive previous best + nudge
            const prev = prevBestMap
              ? getPrevBest(prevBestMap, entry.exerciseId)
              : undefined;
            const currentBest = (() => {
              const best = [...entry.sets].sort((a, b) => {
                if ((b.weightKg ?? 0) !== (a.weightKg ?? 0))
                  return (b.weightKg ?? 0) - (a.weightKg ?? 0);
                return (b.reps || 0) - (a.reps || 0);
              })[0];
              return best;
            })();
            const showPrevHints =
              settingsState?.progress?.showPrevHints ?? true;
            const showNudge = !!(
              showPrevHints &&
              prev &&
              currentBest &&
              currentBest.weightKg === prev.set.weightKg &&
              currentBest.reps === prev.set.reps
            );
            const isCollapsed = !!collapsedEntries[entry.id];
            const isFocusTarget = focusMode && entry.id === focusedEntryId;
            const dimmed = focusMode && entry.id !== focusedEntryId;
            // Planned guide from template if available, else exercise defaults
            const guide = (() => {
              let setsPlan: number | undefined;
              let repPlan: string | undefined;
              const tpl = session?.templateId
                ? templates.find((t) => t.id === session.templateId)
                : undefined;
              if (tpl && Array.isArray((tpl as any).plan)) {
                const p = (tpl as any).plan.find(
                  (x: any) => x.exerciseId === entry.exerciseId
                );
                if (p) {
                  setsPlan = p.plannedSets;
                  repPlan = p.repRange;
                }
              }
              if (setsPlan == null) setsPlan = ex?.defaults?.sets ?? undefined;
              if (!repPlan)
                repPlan =
                  (ex as any)?.defaults?.targetRepRange ?? entry.targetRepRange;
              if (setsPlan == null && !repPlan) return null;
              return { sets: setsPlan, reps: repPlan } as {
                sets?: number;
                reps?: string;
              } | null;
            })();
            // quick metrics for collapsed overview
            const setsLogged = entry.sets.filter(
              (s) => (s.reps || 0) > 0 || (s.weightKg || 0) > 0
            );
            const tonnage = setsLogged.reduce(
              (a, s) => a + (s.weightKg || 0) * (s.reps || 0),
              0
            );
            const bestSet = setsLogged
              .slice()
              .sort(
                (a, b) =>
                  (b.weightKg || 0) * (b.reps || 0) -
                  (a.weightKg || 0) * (a.reps || 0)
              )[0];
            const collapsedSummaryContent = (
              <>
                <span className="font-medium text-slate-100">
                  {entry.sets.length} sets
                </span>
                {tonnage > 0 && (
                  <span className="opacity-70 tabular-nums">
                    • {tonnage.toLocaleString()}
                  </span>
                )}
                {bestSet && (
                  <span className="opacity-70 tabular-nums">
                    • {bestSet.weightKg}×{bestSet.reps}
                  </span>
                )}
                {guide && (
                  <span
                    className="opacity-80"
                    title="Template guide (planned sets × rep range)"
                  >
                    • Guide {guide.sets ? `${guide.sets}×` : ""}
                    {guide.reps || ""}
                  </span>
                )}
              </>
            );
            const collapsedSummaryClass =
              "inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-200 ring-1 ring-white/[0.05] shadow-sm";
            const displayName =
              ex?.name || exNameCache[entry.exerciseId] || "Deleted exercise";
            const nameButtonClass = `inline-flex items-center gap-2 min-w-0 ${
              isCollapsed ? "whitespace-normal break-words" : ""
            }`;
            const nameTextClass = isCollapsed
              ? "whitespace-normal break-words pr-1"
              : "truncate max-w-[56vw] sm:max-w-none";
            const handleCardSurfaceClick = (
              event: MouseEvent<HTMLDivElement>
            ) => {
              if (event.defaultPrevented || event.button !== 0) return;
              const target = event.target as HTMLElement | null;
              if (!target) return;
              const selection = window.getSelection?.();
              if (selection && !selection.isCollapsed) return;
              if (
                target.closest(
                  'button, input, select, textarea, label, a, summary, details, [data-history-trigger="true"], [data-card-interactive="true"], [contenteditable="true"]'
                )
              ) {
                return;
              }
              toggleEntryCollapsed(entry.id);
            };
            return (
              <div
                key={entry.id}
                id={`exercise-${entry.id}`}
                className={`relative card-enhanced rounded-2xl px-3.5 py-3 sm:px-4 sm:py-4 fade-in reorder-anim group transition-opacity duration-200 ${
                  dimmed ? "opacity-30" : ""
                } ${
                  isFocusTarget
                    ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-950 shadow-[0_0_0_1px_rgba(var(--accent-rgb,59,130,246),0.45)]"
                    : ""
                }`}
                draggable
                onDragStart={(e) => {
                  setDragEntryIdx(entryIdx);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(entryIdx));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from =
                    dragEntryIdx ??
                    Number(e.dataTransfer.getData("text/plain"));
                  if (from != null) {
                    reorderEntry(from, entryIdx);
                    setDragEntryIdx(null);
                    try {
                      if ("vibrate" in navigator)
                        (navigator as any).vibrate?.(10);
                    } catch {}
                  }
                }}
                onTouchStart={(e) => {
                  // Long press (550ms) to start reorder; provides haptic feedback
                  const target = e.currentTarget;
                  let started = false;
                  const idx = entryIdx;
                  const timer = window.setTimeout(() => {
                    started = true;
                    setDragEntryIdx(idx);
                    target.classList.add("ring-app");
                    try {
                      if ("vibrate" in navigator)
                        (navigator as any).vibrate?.(18);
                    } catch {}
                    setTimeout(() => target.classList.remove("ring-app"), 900);
                  }, 550);
                  const cancel = () => {
                    clearTimeout(timer);
                    if (!started) target.classList.remove("ring-app");
                    target.removeEventListener("touchend", cancel);
                    target.removeEventListener("touchmove", cancel);
                    target.removeEventListener("touchcancel", cancel);
                  };
                  target.addEventListener("touchend", cancel, {
                    passive: true,
                  });
                  target.addEventListener("touchmove", cancel, {
                    passive: true,
                  });
                  target.addEventListener("touchcancel", cancel, {
                    passive: true,
                  });
                }}
                onClick={handleCardSurfaceClick}
              >
                {/* Glow layers */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
                  <div className="absolute inset-px rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_25%_20%,rgba(0,185,255,0.18),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(77,91,255,0.15),transparent_60%)]" />
                  <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-brand-500/15 via-electric-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="relative z-10" role="group">
                  <div
                    className={`flex justify-between gap-1.5 sm:gap-2 cursor-pointer select-none ${
                      isCollapsed ? "items-center" : "items-start"
                    }`}
                    aria-expanded={!isCollapsed}
                    aria-controls={`entry-${entry.id}-sets`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (
                          (e.target as HTMLElement | null)?.closest(
                            '[data-history-trigger="true"]'
                          )
                        )
                          return;
                        e.preventDefault();
                        toggleEntryCollapsed(entry.id);
                      }
                    }}
                  >
                    <div className="font-medium flex items-center gap-2 flex-nowrap min-w-0">
                      <span
                        className="hidden sm:inline-block cursor-grab select-none opacity-40 group-hover:opacity-100 drag-handle"
                        data-card-interactive="true"
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        ⋮⋮
                      </span>
                      <button
                        type="button"
                        className={`${nameButtonClass} -ml-1 px-1 py-0.5 rounded-md text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                          isCollapsed ? "" : "hover:bg-slate-800/40"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openExerciseHistory(entry.exerciseId, displayName);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            openExerciseHistory(entry.exerciseId, displayName);
                          }
                        }}
                        aria-label={`View history for ${displayName}`}
                        title={`View history for ${displayName}`}
                        data-history-trigger="true"
                      >
                        {ex && (
                          <img
                            src={getMuscleIconPath(ex.muscleGroup)}
                            alt={ex.muscleGroup || "other"}
                            className="w-4 h-4 opacity-80 flex-shrink-0 rounded-sm ring-1 ring-white/10 shadow-sm"
                            loading="lazy"
                          />
                        )}
                        <span className={nameTextClass}>{displayName}</span>
                        {!ex && (exNameCache[entry.exerciseId] || true) && (
                          <span
                            className="text-[9px] px-1 py-0.5 rounded bg-rose-700/40 text-rose-200 border border-rose-500/30"
                            title="This exercise reference was missing and will be auto‑recovered. You can rename it in the exercise library."
                          >
                            missing
                          </span>
                        )}
                        {ex && recoveredIds.has(ex.id) && (
                          <span
                            className="text-[9px] px-1 py-0.5 rounded bg-amber-700/40 text-amber-100 border border-amber-500/30"
                            title="Auto‑recovered placeholder exercise (original was deleted). Rename or edit details if needed."
                          >
                            recovered
                          </span>
                        )}
                      </button>
                      <span
                        className={`transition-transform text-[11px] opacity-70 ${
                          isCollapsed ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                      {ex?.isOptional && (
                        <span className="hidden sm:inline text-[10px] text-gray-400">
                          optional
                        </span>
                      )}
                      {isCollapsed && (
                        <span
                          className={`hidden sm:inline-flex ${collapsedSummaryClass}`}
                        >
                          {collapsedSummaryContent}
                        </span>
                      )}
                      {/* Mobile reorder buttons (shown inline only when expanded to save vertical space) */}
                      {!isCollapsed && (
                        <div className="flex sm:hidden items-center gap-1 ml-auto shrink-0">
                          <button
                            disabled={entryIdx === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() =>
                              reorderEntry(entryIdx, Math.max(0, entryIdx - 1))
                            }
                            aria-label="Move exercise up"
                          >
                            <span aria-hidden="true">↑</span>
                          </button>
                          <button
                            disabled={entryIdx === session.entries.length - 1}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() =>
                              reorderEntry(
                                entryIdx,
                                Math.min(
                                  session.entries.length - 1,
                                  entryIdx + 1
                                )
                              )
                            }
                            aria-label="Move exercise down"
                          >
                            <span aria-hidden="true">↓</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1 relative min-w-[100px]">
                      {isDeloadWeek && (
                        <div className="w-full flex justify-end mt-1">
                          <span data-shape="deload">
                            <AsyncChip
                              loading={deloadLoading}
                              errored={deloadError}
                              info={deloadPrescriptions[entry.exerciseId]}
                              unit={settingsState?.unit || "kg"}
                            />
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 justify-end w-full">
                        <button
                          aria-label="Switch exercise"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-slate-800/70 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwitchTarget({ entryId: entry.id });
                            setSwitchQuery("");
                          }}
                          title="Switch to a different exercise for this muscle group"
                        >
                          <span aria-hidden="true">⇄</span>
                          <span className="sr-only">Switch exercise</span>
                        </button>
                        <button
                          aria-label="Remove exercise"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/15 text-[12px] text-rose-100 transition-colors duration-150 hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          onClick={() => removeEntry(entry.id)}
                          title="Remove exercise"
                        >
                          <span aria-hidden="true">✕</span>
                          <span className="sr-only">Remove exercise</span>
                        </button>
                      </div>
                      {isCollapsed && (
                        <div className="flex sm:hidden items-center gap-1 w-full justify-end">
                          <button
                            disabled={entryIdx === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() =>
                              reorderEntry(entryIdx, Math.max(0, entryIdx - 1))
                            }
                            aria-label="Move exercise up"
                          >
                            <span aria-hidden="true">↑</span>
                          </button>
                          <button
                            disabled={entryIdx === session.entries.length - 1}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() =>
                              reorderEntry(
                                entryIdx,
                                Math.min(
                                  session.entries.length - 1,
                                  entryIdx + 1
                                )
                              )
                            }
                            aria-label="Move exercise down"
                          >
                            <span aria-hidden="true">↓</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Collapsed metrics pill keeps mobile footprint minimal */}
                  {isCollapsed && (
                    <span
                      className={`${collapsedSummaryClass} sm:hidden mt-0.5 w-full justify-between`}
                    >
                      {collapsedSummaryContent}
                    </span>
                  )}
                  {/* Close inner content wrapper opened earlier */}
                </div>
                {/* end relative z-10 */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && showPrevHints && (
                    <motion.div
                      className="mt-1 flex items-center gap-2 flex-wrap"
                      key="prevhints"
                      variants={maybeDisable(fadeSlideUp)}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      {prev ? (
                        <>
                          <span
                            className="prev-hint-pill"
                            aria-label={`Previous best set: ${prev.set.weightKg} kilograms for ${prev.set.reps} reps`}
                            title="Last logged best set"
                          >
                            <span className="opacity-70">Prev:</span>
                            <span>{prev.set.weightKg}</span>
                            <span>×</span>
                            <span>{prev.set.reps}</span>
                          </span>
                          {prev.set.weightKg != null &&
                            prev.set.reps != null &&
                            prev.set.weightKg > 0 &&
                            prev.set.reps > 0 && (
                              <span
                                className="prev-hint-pill opacity-80"
                                aria-label={`Suggested target: ${
                                  prev.set.weightKg
                                } kilograms for ${prev.set.reps + 1} reps`}
                                title="Suggested target (same weight, +1 rep)"
                                data-suggest="true"
                              >
                                <span className="opacity-60">Target:</span>
                                <span>{prev.set.weightKg}</span>
                                <span>×</span>
                                <span>{prev.set.reps + 1}</span>
                              </span>
                            )}
                          {showNudge && (
                            <span className="prev-hint-pill" data-nudge="true">
                              Try +1 rep or +2.5kg?
                            </span>
                          )}
                        </>
                      ) : prevBestLoading ? (
                        <span className="prev-hint-pill" aria-hidden="true">
                          ...
                        </span>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key="setsBlock"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: 0.28,
                        ease: [0.32, 0.72, 0.33, 1],
                      }}
                      style={{ overflow: "hidden" }}
                    >
                      {/* Sets - mobile friendly list */}
                      <div
                        id={`entry-${entry.id}-sets`}
                        className="mt-3 sm:hidden space-y-2"
                      >
                        {entry.sets.map((set, idx) => (
                          <div
                            key={idx}
                            className="group relative rounded-2xl bg-gradient-to-br from-slate-900/40 to-slate-900/60 px-3 py-3 border border-white/[0.03] shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-white/[0.06] hover:from-slate-900/50 hover:to-slate-900/70"
                          >
                            {/* Subtle gradient overlay on hover for feedback */}
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent rounded-2xl transition-all duration-300 pointer-events-none" />
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium flex items-center gap-2">
                                <span className="text-gray-300 flex items-center gap-1.5">
                                  Set {set.setNumber}
                                  {/* Success checkmark when set is complete */}
                                  {set.weightKg != null &&
                                    set.weightKg > 0 &&
                                    set.reps != null &&
                                    set.reps > 0 && (
                                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 success-checkmark">
                                        <svg
                                          className="w-2.5 h-2.5 text-emerald-400 success-glow"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth="3"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      </span>
                                    )}
                                  {(() => {
                                    const iso = set.addedAt || set.completedAt;
                                    if (!iso) return null;
                                    try {
                                      const d = new Date(iso);
                                      const hh = String(d.getHours()).padStart(
                                        2,
                                        "0"
                                      );
                                      const mm = String(
                                        d.getMinutes()
                                      ).padStart(2, "0");
                                      return (
                                        <span
                                          className="ml-1 text-[10px] text-slate-400/50 tabular-nums"
                                          title={`Added at ${d.toLocaleTimeString(
                                            [],
                                            {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            }
                                          )}`}
                                        >
                                          {hh}:{mm}
                                        </span>
                                      );
                                    } catch {
                                      return null;
                                    }
                                  })()}
                                </span>
                                {idx === 0 &&
                                  (set.weightKg || 0) === 0 &&
                                  (set.reps || 0) === 0 &&
                                  suggestions.get(entry.exerciseId) && (
                                    <span
                                      className="text-[10px] text-emerald-300 bg-emerald-600/20 px-1.5 py-0.5 rounded"
                                      title="Suggested progression (enter manually to apply)"
                                    >
                                      {(() => {
                                        const s = suggestions.get(
                                          entry.exerciseId
                                        )!;
                                        return `${s.weightKg ?? ""}${
                                          s.weightKg ? "kg" : ""
                                        }${s.reps ? ` x ${s.reps}` : ""}`;
                                      })()}
                                    </span>
                                  )}
                                <PRChip
                                  exerciseId={entry.exerciseId}
                                  score={(set.weightKg ?? 0) * (set.reps ?? 0)}
                                  week={week}
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    reorderSet(entry, idx, idx - 1)
                                  }
                                  aria-label="Move set up"
                                >
                                  <span aria-hidden="true">↑</span>
                                </button>
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={idx === entry.sets.length - 1}
                                  onClick={() =>
                                    reorderSet(entry, idx, idx + 1)
                                  }
                                  aria-label="Move set down"
                                >
                                  <span aria-hidden="true">↓</span>
                                </button>
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/35 bg-rose-500/15 text-[12px] text-rose-100 transition-colors duration-150 hover:bg-rose-500/25"
                                  onClick={() => deleteSet(entry, idx)}
                                  aria-label="Delete set"
                                >
                                  <span aria-hidden="true">✕</span>
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-900/40 rounded-xl px-2 py-2 relative">
                                <div className="text-[11px] text-gray-400 mb-1 flex items-center justify-between">
                                  <span>Weight</span>
                                  {/* Progressive overload indicator - aligned with label */}
                                  {(() => {
                                    const prev =
                                      prevWeekSets[entry.exerciseId]?.[idx];
                                    if (
                                      !prev ||
                                      prev.weightKg == null ||
                                      set.weightKg == null ||
                                      set.weightKg === 0
                                    )
                                      return null;
                                    const gained = set.weightKg - prev.weightKg;
                                    if (gained > 0) {
                                      return (
                                        <div
                                          className="flex items-center gap-0.5 bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 px-1 py-0.5 rounded text-[8px] font-bold shadow-sm"
                                          title="Progressive overload - weight increased!"
                                        >
                                          <svg
                                            className="w-2 h-2"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          +{gained}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className="flex items-start gap-1.5">
                                  <button
                                    className="btn-input-compact text-base leading-none"
                                    onClick={() =>
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                weightKg: Math.max(
                                                  0,
                                                  (s.weightKg || 0) - 2.5
                                                ),
                                              }
                                            : s
                                        ),
                                      })
                                    }
                                  >
                                    -
                                  </button>
                                  <div className="relative flex-1 pb-4 sm:pb-5">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      pattern="[0-9]*[.,]?[0-9]*"
                                      aria-label="Weight"
                                      className="input-number-enhanced h-9 w-full"
                                      data-set-input="true"
                                      data-entry-id={entry.id}
                                      data-set-number={set.setNumber}
                                      value={
                                        weightInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ] ?? formatOptionalNumber(set.weightKg)
                                      }
                                      placeholder=""
                                      onKeyDown={(e) => {
                                        if (e.key === "ArrowUp") {
                                          e.preventDefault();
                                          updateEntry({
                                            ...entry,
                                            sets: entry.sets.map((s, i) =>
                                              i === idx
                                                ? {
                                                    ...s,
                                                    weightKg:
                                                      (s.weightKg || 0) + 2.5,
                                                  }
                                                : s
                                            ),
                                          });
                                        } else if (e.key === "ArrowDown") {
                                          e.preventDefault();
                                          updateEntry({
                                            ...entry,
                                            sets: entry.sets.map((s, i) =>
                                              i === idx
                                                ? {
                                                    ...s,
                                                    weightKg: Math.max(
                                                      0,
                                                      (s.weightKg || 0) - 2.5
                                                    ),
                                                  }
                                                : s
                                            ),
                                          });
                                        }
                                      }}
                                      onChange={(e) => {
                                        let v = e.target.value;
                                        if (v.includes(","))
                                          v = v.replace(",", ".");
                                        if (!/^\d*(?:[.,]\d*)?$/.test(v))
                                          return;
                                        weightInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ] = v;
                                        if (v === "" || /[.,]$/.test(v)) return;
                                        const num = parseOptionalNumber(v);
                                        updateEntry({
                                          ...entry,
                                          sets: entry.sets.map((s, i) =>
                                            i === idx
                                              ? { ...s, weightKg: num }
                                              : s
                                          ),
                                        });
                                      }}
                                      onBlur={(e) => {
                                        let v = e.target.value;
                                        if (v.includes(","))
                                          v = v.replace(",", ".");
                                        const num = parseOptionalNumber(
                                          v.replace(/\.$/, "")
                                        );
                                        updateEntry({
                                          ...entry,
                                          sets: entry.sets.map((s, i) =>
                                            i === idx
                                              ? { ...s, weightKg: num }
                                              : s
                                          ),
                                        });
                                        delete weightInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ];
                                      }}
                                    />
                                    {(() => {
                                      const prev =
                                        prevWeekSets[entry.exerciseId]?.[idx];
                                      if (prev && prev.weightKg != null) {
                                        const wk = prevWeekSourceWeek;
                                        return (
                                          <div
                                            className="absolute -bottom-1 left-0 right-0 text-center text-[9px] text-emerald-400/60 tabular-nums pointer-events-none select-none font-medium"
                                            title={
                                              wk
                                                ? `Week ${wk} weight`
                                                : "Previous weight"
                                            }
                                          >
                                            <span className="bg-slate-900/70 px-1 py-0.5 rounded text-[8px]">
                                              prev: {prev.weightKg}kg
                                            </span>
                                          </div>
                                        );
                                      }
                                      if (prevWeekLoading) {
                                        return (
                                          <div className="absolute -bottom-1 left-0 right-0 text-center text-[8px] text-slate-500/40 pointer-events-none select-none">
                                            ...
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {!(
                                      (
                                        weightInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ] ?? ""
                                      ).length > 0
                                    ) &&
                                      set.weightKg == null &&
                                      suggestions.get(entry.exerciseId)
                                        ?.weightKg && (
                                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-emerald-500/40 font-medium">
                                          {
                                            suggestions.get(entry.exerciseId)
                                              ?.weightKg
                                          }
                                          kg
                                        </span>
                                      )}
                                  </div>
                                  <button
                                    className="btn-input-compact text-base leading-none"
                                    onClick={() =>
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                weightKg:
                                                  (s.weightKg || 0) + 2.5,
                                              }
                                            : s
                                        ),
                                      })
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="bg-slate-900/40 rounded-xl px-2 py-2 relative">
                                <div className="text-[11px] text-gray-400 mb-1 flex items-center justify-between">
                                  <span>Reps</span>
                                  {/* Progressive overload indicator - aligned with label */}
                                  {(() => {
                                    const prev =
                                      prevWeekSets[entry.exerciseId]?.[idx];
                                    if (
                                      !prev ||
                                      prev.reps == null ||
                                      set.reps == null ||
                                      set.reps === 0
                                    )
                                      return null;
                                    const gained = set.reps - prev.reps;
                                    if (gained > 0) {
                                      return (
                                        <div
                                          className="flex items-center gap-0.5 bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 px-1 py-0.5 rounded text-[8px] font-bold shadow-sm"
                                          title="Progressive overload - reps increased!"
                                        >
                                          <svg
                                            className="w-2 h-2"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          +{gained}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className="flex items-start gap-1.5">
                                  <button
                                    className="btn-input-compact text-base leading-none"
                                    onClick={() =>
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                reps: Math.max(
                                                  0,
                                                  (s.reps || 0) - 1
                                                ),
                                              }
                                            : s
                                        ),
                                      })
                                    }
                                  >
                                    -
                                  </button>
                                  <div className="relative flex-1 pb-4 sm:pb-5">
                                    <input
                                      inputMode="numeric"
                                      aria-label="Reps"
                                      className="input-number-enhanced h-9 w-full"
                                      data-set-input="true"
                                      data-entry-id={entry.id}
                                      data-set-number={set.setNumber}
                                      value={
                                        repsInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ] ??
                                        (set.reps == null
                                          ? ""
                                          : String(set.reps))
                                      }
                                      placeholder=""
                                      onFocus={() => {
                                        editingFieldsRef.current.add(
                                          `${entry.id}:${set.setNumber}:reps`
                                        );
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "ArrowUp") {
                                          e.preventDefault();
                                          updateEntry({
                                            ...entry,
                                            sets: entry.sets.map((s, i) =>
                                              i === idx
                                                ? {
                                                    ...s,
                                                    reps: (s.reps || 0) + 1,
                                                  }
                                                : s
                                            ),
                                          });
                                        } else if (e.key === "ArrowDown") {
                                          e.preventDefault();
                                          updateEntry({
                                            ...entry,
                                            sets: entry.sets.map((s, i) =>
                                              i === idx
                                                ? {
                                                    ...s,
                                                    reps: Math.max(
                                                      0,
                                                      (s.reps || 0) - 1
                                                    ),
                                                  }
                                                : s
                                            ),
                                          });
                                        } else if (e.key === "Enter") {
                                          const buf =
                                            repsInputEditing.current[
                                              `${entry.id}:${set.setNumber}`
                                            ];
                                          if (buf !== undefined) {
                                            const num =
                                              buf === "" ? null : Number(buf);
                                            updateEntry({
                                              ...entry,
                                              sets: entry.sets.map((s, i) =>
                                                i === idx
                                                  ? { ...s, reps: num }
                                                  : s
                                              ),
                                            });
                                            delete repsInputEditing.current[
                                              `${entry.id}:${set.setNumber}`
                                            ];
                                            editingFieldsRef.current.delete(
                                              `${entry.id}:${set.setNumber}:reps`
                                            );
                                          }
                                        }
                                      }}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (!/^\d*$/.test(v)) return;
                                        repsInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ] = v;
                                        if (v === "") return;
                                        updateEntry({
                                          ...entry,
                                          sets: entry.sets.map((s, i) =>
                                            i === idx
                                              ? { ...s, reps: Number(v) }
                                              : s
                                          ),
                                        });
                                      }}
                                      onBlur={(e) => {
                                        const v = e.target.value;
                                        const num = v === "" ? null : Number(v);
                                        updateEntry({
                                          ...entry,
                                          sets: entry.sets.map((s, i) =>
                                            i === idx ? { ...s, reps: num } : s
                                          ),
                                        });
                                        delete repsInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ];
                                        editingFieldsRef.current.delete(
                                          `${entry.id}:${set.setNumber}:reps`
                                        );
                                      }}
                                    />
                                    {(() => {
                                      const prev =
                                        prevWeekSets[entry.exerciseId]?.[idx];
                                      if (prev && prev.reps != null) {
                                        const wk = prevWeekSourceWeek;
                                        return (
                                          <div
                                            className="absolute -bottom-1 left-0 right-0 text-center text-[9px] text-emerald-400/60 tabular-nums pointer-events-none select-none font-medium"
                                            title={
                                              wk
                                                ? `Week ${wk} reps`
                                                : "Previous reps"
                                            }
                                          >
                                            <span className="bg-slate-900/70 px-1 py-0.5 rounded text-[8px]">
                                              prev: {prev.reps}r
                                            </span>
                                          </div>
                                        );
                                      }
                                      if (prevWeekLoading) {
                                        return (
                                          <div className="absolute -bottom-1 left-0 right-0 text-center text-[8px] text-slate-500/40 pointer-events-none select-none">
                                            ...
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {!(
                                      (
                                        repsInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ] ?? ""
                                      ).length > 0
                                    ) &&
                                      set.reps == null &&
                                      (suggestions.get(entry.exerciseId)
                                        ?.reps ||
                                        entry.targetRepRange) && (
                                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-emerald-400/35 font-medium">
                                          {suggestions.get(entry.exerciseId)
                                            ?.reps ?? entry.targetRepRange}
                                        </span>
                                      )}
                                  </div>
                                  <button
                                    className="btn-input-compact text-base leading-none"
                                    onClick={() =>
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? { ...s, reps: (s.reps || 0) + 1 }
                                            : s
                                        ),
                                      })
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Removed per-set rest controls */}
                            {set.completedAt && (
                              <div className="mt-1 text-[10px] text-right text-slate-400/40 tracking-tight">
                                {new Date(set.completedAt).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          className="w-full btn-touch-primary"
                          onClick={() => addSet(entry)}
                        >
                          Add Set
                        </button>
                        {/* Exercise-level rest control (mobile) */}
                        <div className="pt-2 pb-1 flex items-center justify-end gap-3 min-h-[56px]">
                          <button
                            className={`px-4 h-10 leading-none rounded-lg bg-slate-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/60 text-sm flex items-center ${
                              restTimers[entry.id]?.running
                                ? "bg-emerald-700 text-emerald-50 shadow-inner"
                                : ""
                            }`}
                            onClick={() => restartRestTimer(entry.id)}
                            aria-label={
                              restTimers[entry.id]
                                ? "Restart rest timer"
                                : "Start rest timer"
                            }
                          >
                            {restTimers[entry.id]
                              ? "Restart Rest"
                              : "Start Rest"}
                          </button>
                          <div className="flex items-center gap-1.5 ml-1 min-h-[56px]">
                            {restTimerDisplay(entry.id)}
                            {restTimers[entry.id] && (
                              <button
                                className="h-9 w-9 leading-none flex items-center justify-center rounded-lg border border-white/10 bg-slate-800/80 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                                aria-label="Stop rest timer"
                                onClick={() => stopRestTimer(entry.id)}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sets grid with drag-and-drop (desktop) */}
                      <div
                        className="mt-3 hidden sm:grid grid-cols-[auto,1fr,1fr,auto] gap-2 items-center"
                        role="list"
                        aria-label={`Sets for exercise ${entry.exerciseId}`}
                      >
                        <div className="text-sm text-gray-400">Set</div>
                        <div className="text-sm text-gray-400">Weight</div>
                        <div className="text-sm text-gray-400">Reps</div>
                        <div></div>
                        {entry.sets.map((set, idx) => (
                          <div
                            key={idx}
                            className="contents"
                            role="listitem"
                            aria-roledescription="Draggable set row"
                            aria-label={`Set ${set.setNumber} weight ${
                              set.weightKg || 0
                            } reps ${set.reps || 0}`}
                            draggable
                            onDragStart={(ev) => {
                              (entry as any)._dragSet = idx;
                              ev.dataTransfer.setData(
                                "text/plain",
                                String(idx)
                              );
                              ev.currentTarget.setAttribute(
                                "aria-grabbed",
                                "true"
                              );
                            }}
                            onDragEnd={(ev) =>
                              ev.currentTarget.removeAttribute("aria-grabbed")
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const from = (entry as any)._dragSet;
                              if (typeof from === "number") {
                                reorderSet(entry, from, idx);
                                (entry as any)._dragSet = undefined;
                              }
                            }}
                          >
                            <div className="px-2">{set.setNumber}</div>
                            <div className="flex items-start gap-1.5">
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[13px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70"
                                onClick={() =>
                                  updateEntry({
                                    ...entry,
                                    sets: entry.sets.map((s, i) =>
                                      i === idx
                                        ? {
                                            ...s,
                                            weightKg: Math.max(
                                              0,
                                              (s.weightKg || 0) - 2.5
                                            ),
                                          }
                                        : s
                                    ),
                                  })
                                }
                              >
                                -
                              </button>
                              <div className="relative w-24">
                                <input
                                  inputMode="decimal"
                                  pattern="[0-9]*[.,]?[0-9]*"
                                  aria-label="Weight"
                                  className="input-number-enhanced h-9 w-full"
                                  data-set-input="true"
                                  data-entry-id={entry.id}
                                  data-set-number={set.setNumber}
                                  value={
                                    weightInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ] ??
                                    (set.weightKg || set.weightKg === 0
                                      ? String(set.weightKg)
                                      : "")
                                  }
                                  placeholder={(() => {
                                    if ((set.weightKg || 0) > 0) return "0";
                                    const sug = suggestions.get(
                                      entry.exerciseId
                                    );
                                    return sug?.weightKg
                                      ? String(sug.weightKg)
                                      : "0.0";
                                  })()}
                                  onKeyDown={(e) => {
                                    if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                weightKg:
                                                  (s.weightKg || 0) + 2.5,
                                              }
                                            : s
                                        ),
                                      });
                                    } else if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                weightKg: Math.max(
                                                  0,
                                                  (s.weightKg || 0) - 2.5
                                                ),
                                              }
                                            : s
                                        ),
                                      });
                                    }
                                  }}
                                  onChange={(e) => {
                                    let v = e.target.value;
                                    if (v.includes(","))
                                      v = v.replace(",", ".");
                                    if (!/^\d*(?:[.,]\d*)?$/.test(v)) return;
                                    weightInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ] = v;
                                    if (v === "" || /[.,]$/.test(v)) return;
                                    const num = Number(v);
                                    if (!isNaN(num)) {
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? { ...s, weightKg: num }
                                            : s
                                        ),
                                      });
                                    }
                                  }}
                                  onBlur={(e) => {
                                    let v = e.target.value;
                                    if (v.includes(","))
                                      v = v.replace(",", ".");
                                    if (!/^\d*(?:[.,]\d*)?$/.test(v)) return;
                                    const num =
                                      v === ""
                                        ? 0
                                        : Number(v.replace(/\.$/, ""));
                                    updateEntry({
                                      ...entry,
                                      sets: entry.sets.map((s, i) =>
                                        i === idx
                                          ? {
                                              ...s,
                                              weightKg: isNaN(num) ? 0 : num,
                                            }
                                          : s
                                      ),
                                    });
                                    delete weightInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ];
                                  }}
                                />
                                {!(
                                  (
                                    weightInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ] ?? ""
                                  ).length > 0
                                ) &&
                                  set.weightKg == null &&
                                  suggestions.get(entry.exerciseId)
                                    ?.weightKg && (
                                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-emerald-500/40 font-medium">
                                      {
                                        suggestions.get(entry.exerciseId)
                                          ?.weightKg
                                      }
                                      kg
                                    </span>
                                  )}
                              </div>
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[13px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70"
                                onClick={() =>
                                  updateEntry({
                                    ...entry,
                                    sets: entry.sets.map((s, i) =>
                                      i === idx
                                        ? {
                                            ...s,
                                            weightKg: (s.weightKg || 0) + 2.5,
                                          }
                                        : s
                                    ),
                                  })
                                }
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[13px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70"
                                onClick={() =>
                                  updateEntry({
                                    ...entry,
                                    sets: entry.sets.map((s, i) =>
                                      i === idx
                                        ? {
                                            ...s,
                                            reps: Math.max(
                                              0,
                                              (s.reps || 0) - 1
                                            ),
                                          }
                                        : s
                                    ),
                                  })
                                }
                              >
                                -
                              </button>
                              <div className="relative w-20">
                                <input
                                  inputMode="numeric"
                                  aria-label="Reps"
                                  className="input-number-enhanced h-9 w-full"
                                  data-set-input="true"
                                  data-entry-id={entry.id}
                                  data-set-number={set.setNumber}
                                  value={
                                    repsInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ] ??
                                    (set.reps == null ? "" : String(set.reps))
                                  }
                                  placeholder={(() => {
                                    if ((set.reps || 0) > 0) return "0";
                                    const sug = suggestions.get(
                                      entry.exerciseId
                                    );
                                    return sug?.reps
                                      ? String(sug.reps)
                                      : entry.targetRepRange
                                      ? entry.targetRepRange
                                      : "0";
                                  })()}
                                  onKeyDown={(e) => {
                                    if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? { ...s, reps: (s.reps || 0) + 1 }
                                            : s
                                        ),
                                      });
                                    } else if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      updateEntry({
                                        ...entry,
                                        sets: entry.sets.map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                reps: Math.max(
                                                  0,
                                                  (s.reps || 0) - 1
                                                ),
                                              }
                                            : s
                                        ),
                                      });
                                    } else if (e.key === "Enter") {
                                      const buf =
                                        repsInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ];
                                      if (buf !== undefined) {
                                        const num =
                                          buf === "" ? null : Number(buf);
                                        updateEntry({
                                          ...entry,
                                          sets: entry.sets.map((s, i) =>
                                            i === idx ? { ...s, reps: num } : s
                                          ),
                                        });
                                        delete repsInputEditing.current[
                                          `${entry.id}:${set.setNumber}`
                                        ];
                                      }
                                    }
                                  }}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (!/^\d*$/.test(v)) return;
                                    repsInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ] = v;
                                    if (v === "") return;
                                    updateEntry({
                                      ...entry,
                                      sets: entry.sets.map((s, i) =>
                                        i === idx
                                          ? { ...s, reps: Number(v) }
                                          : s
                                      ),
                                    });
                                  }}
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    const num = v === "" ? null : Number(v);
                                    updateEntry({
                                      ...entry,
                                      sets: entry.sets.map((s, i) =>
                                        i === idx ? { ...s, reps: num } : s
                                      ),
                                    });
                                    delete repsInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ];
                                  }}
                                />
                                {!(
                                  (
                                    repsInputEditing.current[
                                      `${entry.id}:${set.setNumber}`
                                    ] ?? ""
                                  ).length > 0
                                ) &&
                                  set.reps == null &&
                                  (suggestions.get(entry.exerciseId)?.reps ||
                                    entry.targetRepRange) && (
                                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-emerald-400/35 font-medium">
                                      {suggestions.get(entry.exerciseId)
                                        ?.reps ?? entry.targetRepRange}
                                    </span>
                                  )}
                              </div>
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[13px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70"
                                onClick={() =>
                                  updateEntry({
                                    ...entry,
                                    sets: entry.sets.map((s, i) =>
                                      i === idx
                                        ? { ...s, reps: (s.reps || 0) + 1 }
                                        : s
                                    ),
                                  })
                                }
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <PRChip
                                exerciseId={entry.exerciseId}
                                score={(set.weightKg ?? 0) * (set.reps ?? 0)}
                                week={week}
                              />
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[11px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={idx === 0}
                                onClick={() => reorderSet(entry, idx, idx - 1)}
                                aria-label="Move set up"
                              >
                                <span aria-hidden="true">↑</span>
                              </button>
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-slate-800/70 text-[11px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={idx === entry.sets.length - 1}
                                onClick={() => reorderSet(entry, idx, idx + 1)}
                                aria-label="Move set down"
                              >
                                <span aria-hidden="true">↓</span>
                              </button>
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/15 text-[11px] text-rose-100 transition-colors duration-150 hover:bg-rose-500/25"
                                onClick={() => deleteSet(entry, idx)}
                                aria-label="Delete set"
                              >
                                <span aria-hidden="true">✕</span>
                              </button>
                              {/* Removed per-set rest controls in desktop grid */}
                              {idx === entry.sets.length - 1 && (
                                <button
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-600/20 text-[11px] text-emerald-200 transition-colors duration-150 hover:bg-emerald-600/30"
                                  onClick={() => duplicateLastSet(entry)}
                                  aria-label="Duplicate last set"
                                >
                                  <span aria-hidden="true">⧉</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="contents">
                          <div></div>
                          <div></div>
                          <div></div>
                          <div>
                            <button
                              className="text-[10px] bg-emerald-700 rounded px-2 py-0.5"
                              onClick={() => addSet(entry)}
                            >
                              Add Set
                            </button>
                          </div>
                        </div>
                        {/* Exercise-level rest control (desktop) */}
                        <div className="col-span-4 mt-2 flex items-center justify-end gap-3 text-[11px] min-h-[56px]">
                          <div className="flex items-center gap-1.5 min-h-[56px]">
                            {restTimerDisplay(entry.id)}
                            {restTimers[entry.id] && (
                              <button
                                className="h-9 w-9 leading-none flex items-center justify-center rounded-lg border border-white/10 bg-slate-800/80 text-[12px] text-slate-200 transition-colors duration-150 hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                                aria-label="Stop rest timer"
                                onClick={() => stopRestTimer(entry.id)}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
      </div>

      {/* Session summary footer */}
      {session && !!session.entries.length && (
        <SessionSummary
          session={session}
          exercises={exercises}
          analytics={analytics}
        />
      )}
      {/* Spacer for mobile summary bar & FAB */}
      <div className="h-40 sm:h-0" aria-hidden="true" />
      {/* Mobile sticky summary bar */}
      {session && !!session.entries.length && (
        <MobileSummaryFader visibleThreshold={0.5}>
          <MobileSessionMetrics
            session={session}
            exercises={exercises}
            analytics={analytics}
          />
        </MobileSummaryFader>
      )}

      <OptionSheet
        open={historySheetOpen}
        title={
          historyContext?.name
            ? `${historyContext.name} history`
            : "Exercise history"
        }
        description="Review recent sessions logged for this movement."
        onClose={closeExerciseHistory}
        options={historyOptions}
        highlight={historyHighlight ?? undefined}
        emptyState={
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
            {historyEmptyMessage}
          </div>
        }
        maxListHeight={520}
      />

      <div className="bg-card rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="text-base font-medium">Add exercise</div>
          <button
            className="btn-primary-enhanced btn-enhanced text-sm px-4 py-2.5 rounded-xl font-medium text-white"
            onClick={() => setShowAdd(true)}
          >
            Search
          </button>
        </div>
        {/* Removed full exercise chip list to avoid rendering hundreds; user opens Search to query */}
      </div>

      <OptionSheet
        open={showAdd}
        title="Add exercise"
        description="Search the library or build a custom movement for this session."
        onClose={() => {
          setShowAdd(false);
          setQuery("");
          setAddFilter("all");
        }}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search or type a new exercise name"
        searchLabel="Exercise"
        initialFocus="search"
        options={addExerciseOptions}
        highlight={addSheetHighlight || undefined}
        emptyState={
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
            {query.trim()
              ? `No exercises match "${query.trim()}". Use the button below to create it.`
              : "No exercises found. Try syncing or creating a custom exercise."}
          </div>
        }
        primaryAction={
          query.trim()
            ? {
                label: `Create "${query.trim()}"`,
                onClick: () => {
                  createCustomExercise(query.trim());
                  setShowAdd(false);
                  setQuery("");
                  setAddFilter("all");
                },
              }
            : undefined
        }
        maxListHeight={560}
      />

      <OptionSheet
        open={Boolean(switchTarget) && Boolean(switchModalContext)}
        title={
          switchModalContext?.currentEx
            ? `Switch ${switchModalContext.currentEx.name}`
            : "Switch exercise"
        }
        description={
          switchModalContext?.group
            ? `Browse alternatives for ${formatMuscleLabel(
                switchModalContext.group
              )}.`
            : "Pick a different movement to replace this entry."
        }
        onClose={() => setSwitchTarget(null)}
        searchValue={switchQuery}
        onSearchChange={setSwitchQuery}
        searchPlaceholder="Search exercises"
        searchLabel="Search"
        initialFocus="search"
        options={switchModalContext?.options ?? []}
        highlight={switchSheetHighlight || undefined}
        emptyState={
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
            <p>No alternatives found in this view.</p>
            {switchScope === "group" &&
            (switchModalContext?.totalCount || 0) > 0 ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white/80 transition hover:border-emerald-400/60 hover:bg-emerald-400/20 hover:text-white"
                onClick={() => setSwitchScope("all")}
              >
                Show all exercises
              </button>
            ) : null}
          </div>
        }
        footer={
          switchModalContext?.currentEx ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
              <span className="text-white/90">Currently:</span>{" "}
              <span className="font-medium text-white">
                {switchModalContext.currentEx.name}
              </span>
            </div>
          ) : undefined
        }
        maxListHeight={520}
      />

      <OptionSheet
        open={wipeSheetOpen}
        title="Erase logged training"
        description="Choose the scope to wipe and confirm the phrase to proceed."
        onClose={() => {
          if (wipeBusy) return;
          setWipeSheetOpen(false);
        }}
        options={wipeOptions}
        highlight={wipeHighlight}
        initialFocus="list"
      />

      <div>
        <button className="text-xs underline" onClick={() => undoLast()}>
          Undo last action
        </button>
      </div>

      {/* Snackbar removed; using global queue */}
      <ImportTemplateDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        session={session as any}
        weekNumber={week}
        onImported={(updated, count, name) => {
          setSession(updated);
          push({ message: `Imported ${count} exercises from "${name}"` });
        }}
      />
      <SaveTemplateDialog
        open={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        session={session}
        onSaved={(tpl) => {
          push({ message: `Saved template "${tpl.name}"` });
        }}
      />
      {/* Bottom scroll anchor */}
      <div
        id="sessions-bottom-anchor"
        aria-hidden="true"
        style={{ position: "relative", height: 0 }}
      />
      {/* Jump to Latest floating button */}
      <JumpToLatest
        onJump={() => {
          if (latestLocation) {
            setPhase(latestLocation.phase);
            setWeek(latestLocation.week as any);
            setDay(latestLocation.day);
          }
          // Scroll to top
          document.getElementById("sessions-top-anchor")?.scrollIntoView({
            behavior: "smooth",
          });
        }}
        isAtLatest={
          !latestLocation ||
          (phase === latestLocation.phase &&
            week === latestLocation.week &&
            day === latestLocation.day)
        }
        latestLabel={
          latestLocation
            ? `P${latestLocation.phase} W${latestLocation.week}`
            : undefined
        }
      />
    </div>
  );
}

// Adaptive Week Selector Component
function WeekSelector({
  value,
  totalWeeks,
  deloadWeeks,
  onChange,
}: {
  value: number;
  totalWeeks: number;
  deloadWeeks?: Iterable<number> | null;
  onChange: (week: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);

  const weekNumbers = useMemo(() => {
    const count = Math.max(1, Number.isFinite(totalWeeks) ? totalWeeks : 1);
    return Array.from({ length: count }, (_, idx) => idx + 1);
  }, [totalWeeks]);

  useEffect(() => {
    if (!weekNumbers.length) return;
    const first = weekNumbers[0];
    const last = weekNumbers[weekNumbers.length - 1];
    const clamped = Math.min(Math.max(value || first, first), last);
    if (clamped !== value) {
      onChange(clamped);
    }
  }, [weekNumbers, value, onChange]);

  useEffect(() => {
    if (!open) return;
    try {
      navigator.vibrate?.(12);
    } catch {}
  }, [open]);

  const deloadArray = useMemo(() => {
    if (!deloadWeeks) return [] as number[];
    return Array.from(deloadWeeks).filter((w) => Number.isFinite(w));
  }, [deloadWeeks]);

  const deloadSet = useMemo(() => new Set(deloadArray), [deloadArray]);

  const announceSelection = useCallback((label: string) => {
    if (liveRef.current) {
      liveRef.current.textContent = `Selected ${label}`;
    }
  }, []);

  const handleSelect = useCallback(
    (weekNumber: number) => {
      const label = deloadSet.has(weekNumber)
        ? `Week ${weekNumber} (Deload)`
        : `Week ${weekNumber}`;
      onChange(weekNumber);
      setOpen(false);
      announceSelection(label);
      try {
        (navigator as any).vibrate?.(10);
      } catch {}
    },
    [announceSelection, deloadSet, onChange]
  );

  const weekOptions = useMemo<OptionSheetOption[]>(() => {
    return weekNumbers.map((num) => {
      const isDeload = deloadSet.has(num);
      return {
        id: String(num),
        label: `Week ${num}`,
        description: isDeload ? "Deload week" : `Training week ${num}`,
        selected: num === value,
        trailing: isDeload ? "Deload" : undefined,
        onSelect: () => handleSelect(num),
      } satisfies OptionSheetOption;
    });
  }, [weekNumbers, deloadSet, value, handleSelect]);

  const selectedLabel = useMemo(() => {
    if (!weekNumbers.length) return "No weeks";
    const base = `Week ${value}`;
    return deloadSet.has(value) ? `${base} • Deload` : base;
  }, [weekNumbers.length, value, deloadSet]);

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const deloadSummary = useMemo(() => {
    if (!deloadArray.length) return null;
    const sorted = [...deloadArray].sort((a, b) => a - b);
    return `Deload: W${sorted.join(" · W")}`;
  }, [deloadArray]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex w-full sm:w-auto max-w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-white/90 transition hover:border-white/20 hover:bg-slate-700/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        title={selectedLabel}
      >
        <span className="truncate max-w-[70vw] sm:max-w-[180px]">
          {selectedLabel}
        </span>
        <span className="opacity-70 text-[10px]" aria-hidden="true">
          ▼
        </span>
      </button>
      <OptionSheet
        open={open}
        title="Choose training week"
        description="Switching weeks loads the matching session data."
        onClose={() => setOpen(false)}
        initialFocus="list"
        options={weekOptions}
        emptyState={
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
            No weeks available.
          </div>
        }
        footer={
          weekNumbers.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
              {weekNumbers.length} week{weekNumbers.length === 1 ? "" : "s"}
              {deloadSummary ? ` • ${deloadSummary}` : ""}
            </div>
          ) : undefined
        }
        maxListHeight={420}
      />
      <div ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
}

// Adaptive Workout Day Selector Component
function DaySelector({
  labels,
  value,
  onChange,
}: {
  labels: string[];
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!labels.length) return;
    if (value < 0) {
      onChange(0);
      return;
    }
    if (value >= labels.length) {
      onChange(labels.length - 1);
    }
  }, [labels.length, value, onChange]);

  useEffect(() => {
    try {
      sessionStorage.setItem("lastDayIdx", String(value));
    } catch {}
  }, [value]);

  useEffect(() => {
    if (!labels.length) return;
    try {
      const stored = sessionStorage.getItem("lastDayIdx");
      if (stored != null) {
        const idx = Number(stored);
        if (Number.isFinite(idx)) {
          const clamped = Math.max(0, Math.min(labels.length - 1, idx));
          if (clamped !== value) {
            onChange(clamped);
          }
        }
      }
    } catch {}
  }, [labels.length, onChange, value]);

  useEffect(() => {
    if (!open) return;
    try {
      navigator.vibrate?.(12);
    } catch {}
  }, [open]);

  const announceSelection = useCallback((label: string) => {
    if (liveRef.current) {
      liveRef.current.textContent = `Selected ${label}`;
    }
  }, []);

  const handleSelect = useCallback(
    (idx: number) => {
      const label = labels[idx] || `Day ${idx + 1}`;
      onChange(idx);
      setOpen(false);
      announceSelection(label);
      try {
        (navigator as any).vibrate?.(10);
      } catch {}
    },
    [labels, onChange, announceSelection]
  );

  const dayOptions = useMemo<OptionSheetOption[]>(() => {
    if (!labels.length) return [];
    return labels
      .map((label, idx) => {
        const title = label || `Day ${idx + 1}`;
        return {
          id: String(idx),
          label: title,
          description: `Day ${idx + 1}`,
          selected: idx === value,
          trailing: idx === value ? "Current" : undefined,
          onSelect: () => handleSelect(idx),
        } satisfies OptionSheetOption;
      })
      .filter(Boolean) as OptionSheetOption[];
  }, [labels, value, handleSelect]);

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const selectedLabel = labels[value] || `Day ${value + 1}`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex w-full sm:w-auto max-w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-white/90 transition hover:border-white/20 hover:bg-slate-700/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        title={selectedLabel}
      >
        <span className="truncate max-w-[70vw] sm:max-w-[180px]">
          {selectedLabel}
        </span>
        <span className="opacity-70 text-[10px]" aria-hidden="true">
          ▼
        </span>
      </button>
      <OptionSheet
        open={open}
        title="Choose workout day"
        description="Switching days updates the session you are editing."
        onClose={() => {
          setOpen(false);
        }}
        initialFocus="list"
        options={dayOptions}
        emptyState={
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
            No days available.
          </div>
        }
        footer={
          labels.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
              {labels.length} day{labels.length === 1 ? "" : "s"} in this phase
            </div>
          ) : undefined
        }
        maxListHeight={420}
      />
      <div ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
}

function SessionMomentumPanel({
  analytics,
  onFocusRequest,
  focusedEntryId,
}: {
  analytics: SessionAnalytics;
  onFocusRequest?: (entryId: string) => void;
  focusedEntryId?: string | null;
}) {
  const completion = Math.max(0, Math.min(100, analytics.completionPct));
  const activeMuscleCount = analytics.muscleLoad.filter(
    (m) => m.workingSets > 0
  ).length;
  const topMuscles = analytics.muscleLoad.slice(0, 4);
  const incompleteQueue = analytics.incompleteExercises.filter(
    (task) => task.workingSets === 0
  );
  const nextTask = incompleteQueue[0];
  const remainingTasks = incompleteQueue.length;
  const queueRemainder = Math.max(0, remainingTasks - 1);

  return (
    <div className="mx-4 mt-2 space-y-3 rounded-2xl border border-white/12 bg-[rgba(15,23,42,0.78)] px-4 py-4 shadow-[0_14px_30px_-24px_rgba(59,130,246,0.55)] backdrop-blur-sm sm:px-5 sm:py-4 fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400/80">
            Session momentum
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold text-white/90">
              {completion}%
            </span>
            <span className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
              Complete
            </span>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-300">
          <div className="font-medium text-white/90 leading-tight">
            {analytics.completedSets.toLocaleString()} /{" "}
            {analytics.plannedSets.toLocaleString()} sets
          </div>
          <div className="text-[10px] text-slate-400">
            {analytics.completedExercises}/{analytics.totalExercises} exercises
            logged
          </div>
        </div>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400/80 via-emerald-400/70 to-emerald-300/70"
          style={{ width: `${completion}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] text-slate-200">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 font-medium">
          <span className="text-slate-400 uppercase tracking-[0.24em]">
            Sets
          </span>
          <span className="text-white/90">
            {analytics.completedSets.toLocaleString()} /{" "}
            {analytics.plannedSets.toLocaleString()}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 font-medium">
          <span className="text-slate-400 uppercase tracking-[0.24em]">
            Volume
          </span>
          <span className="text-emerald-300">
            {analytics.totalVolume.toLocaleString()}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 font-medium">
          <span className="text-slate-400 uppercase tracking-[0.24em]">PR</span>
          <span className="text-white/90">{analytics.prSignals}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 font-medium">
          <span className="text-slate-400 uppercase tracking-[0.24em]">
            Muscles
          </span>
          <span className="text-white/90">{activeMuscleCount}</span>
        </span>
      </div>
      {topMuscles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-200">
          {topMuscles.map((m) => {
            const icon = getMuscleIconPath(m.muscle);
            return (
              <span
                key={m.muscle}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 tabular-nums"
                title={`${m.muscle} · ${m.workingSets}/${m.totalSets} sets`}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt={m.muscle}
                    className="h-5 w-5 rounded-sm border border-white/15 bg-black/20"
                  />
                ) : (
                  <span
                    className="h-5 w-5 rounded-sm border border-white/10 bg-slate-700/60"
                    aria-hidden="true"
                  />
                )}
                <span className="font-medium text-emerald-200">
                  {m.workingSets}/{m.totalSets}
                </span>
              </span>
            );
          })}
        </div>
      )}
      {nextTask && (
        <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.26em] text-slate-400">
            <span>Up next</span>
            <span className="text-slate-500 normal-case tracking-normal">
              {queueRemainder > 0
                ? `+${queueRemainder} more`
                : `${remainingTasks} item${remainingTasks === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-200">
            <div className="min-w-0">
              <div className="truncate font-medium text-white/90">
                {nextTask.name}
              </div>
              <div className="text-[10px] text-slate-400">
                {nextTask.missingSets} set
                {nextTask.missingSets === 1 ? "" : "s"} remaining ·{" "}
                <span className="capitalize">{nextTask.muscle}</span>
              </div>
            </div>
            {onFocusRequest && (
              <button
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                  focusedEntryId === nextTask.entryId
                    ? "bg-emerald-400 text-slate-950"
                    : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                }`}
                onClick={() => onFocusRequest(nextTask.entryId)}
              >
                {focusedEntryId === nextTask.entryId ? "Focused" : "Focus"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Lightweight summary component
function SessionSummary({
  session,
  exercises,
  analytics,
}: {
  session: Session;
  exercises: Exercise[];
  analytics?: SessionAnalytics | null;
}) {
  const exMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );
  const fallbackTotals = useMemo(() => {
    let sets = 0,
      volume = 0,
      prs = 0;
    for (const entry of session.entries) {
      for (const s of entry.sets) {
        sets++;
        const ton = (s.weightKg || 0) * (s.reps || 0);
        volume += ton;
        // naive PR heuristic: ton > 0 & reps*weight above simple threshold
        if (
          ton > 0 &&
          ton >= (exMap.get(entry.exerciseId)?.defaults.sets || 3) * 50
        )
          prs++;
      }
    }
    return { sets, volume, prs };
  }, [session, exMap]);
  const totals = analytics
    ? {
        sets: analytics.completedSets,
        volume: analytics.totalVolume,
        prs: analytics.prSignals,
      }
    : fallbackTotals;
  // Count sets & tonnage per PRIMARY muscle group (ignore secondaryMuscles). Tonnage sums raw weight*reps of all sets.
  const fallbackMuscleStats = useMemo(() => {
    const by: Record<string, { sets: number; tonnage: number }> = {};
    for (const entry of session.entries) {
      const ex = exMap.get(entry.exerciseId);
      if (!ex) continue;
      const g = ex.muscleGroup || "other";
      let bucket = by[g];
      if (!bucket) bucket = by[g] = { sets: 0, tonnage: 0 };
      for (const s of entry.sets) {
        bucket.sets += 1;
        bucket.tonnage += (s.weightKg || 0) * (s.reps || 0);
      }
    }
    const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
    return Object.entries(by)
      .filter(([, v]) => v.sets >= 1)
      .sort((a, b) => label(a[0]).localeCompare(label(b[0])));
  }, [session, exMap]);
  const muscleStats = analytics
    ? analytics.muscleLoad
        .filter((m) => m.workingSets > 0)
        .map(
          (m) =>
            [m.muscle, { sets: m.workingSets, tonnage: m.tonnage }] as const
        )
    : fallbackMuscleStats;
  const estTonnage = totals.volume;
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft mt-4 fade-in">
      <div className="flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-muted">Sets:</span> {totals.sets}
        </div>
        <div>
          <span className="text-muted">Volume:</span> {estTonnage}
        </div>
        <div>
          <span className="text-muted">PR Signals:</span> {totals.prs}
        </div>
        {/* Per-muscle set & tonnage summary */}
        {muscleStats.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-200">
            {muscleStats.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 tabular-nums"
                title={`${k} • ${v.sets} sets • ${v.tonnage} tonnage`}
              >
                <span className="font-medium text-white/80">
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
                <span className="text-slate-300/90">
                  {v.sets} sets · {v.tonnage}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AsyncChip({
  info,
  loading,
  errored,
  unit,
}: {
  info?: DeloadInfo;
  loading: boolean;
  errored?: boolean;
  unit: "kg" | "lb";
}) {
  const formatWeight = (kg: number) => {
    if (!Number.isFinite(kg) || kg <= 0) return null;
    const val = unit === "lb" ? Math.round(kg * 2.20462) : Math.round(kg);
    return `${val}${unit}`;
  };

  let text = "Deload --";
  if (loading) {
    text = "Deload …";
  } else if (errored) {
    text = "Deload --";
  } else if (info && !info.inactive) {
    const sets = Math.max(0, info.targetSets ?? 0);
    const targetWeightLabel = formatWeight(info.targetWeight ?? 0);
    if (targetWeightLabel) {
      const setsLabel = sets > 0 ? ` × ${sets}` : "";
      text = `Deload ${targetWeightLabel}${setsLabel}`;
    } else if (sets > 0) {
      text = `Deload × ${sets}`;
    } else {
      text = "Deload";
    }
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-slate-800 rounded-xl px-2 py-1 whitespace-nowrap">
      {text}
    </span>
  );
}

function PRChip({
  exerciseId,
  score,
  week,
}: {
  exerciseId: string;
  score: number;
  week: number;
}) {
  const [best, setBest] = useState(0);
  useEffect(() => {
    (async () => {
      const r = await rollingPRs(exerciseId);
      setBest(r.bestTonnageSet);
    })();
  }, [exerciseId, week]);
  if (score <= 0 || best <= 0 || score < best) return null;
  return (
    <span
      className="text-[8px] rounded px-1 py-0.5 inline-flex items-center gap-0.5 bg-yellow-500/90 text-black border border-yellow-400/50 font-bold"
      data-shape="pr"
      aria-label="Personal record set"
      title="Personal Record"
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-black"
        aria-hidden="true"
      ></span>
      PR
    </span>
  );
}

// Compact metrics bar for mobile (mirrors SessionSummary but denser)
function MobileSessionMetrics({
  session,
  exercises,
  analytics,
}: {
  session: Session;
  exercises: Exercise[];
  analytics?: SessionAnalytics | null;
}) {
  const exMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );
  const fallbackStats = useMemo(() => {
    let sets = 0,
      volume = 0,
      prs = 0;
    for (const entry of session.entries) {
      for (const s of entry.sets) {
        if ((s.reps || 0) > 0 || (s.weightKg || 0) > 0) {
          sets++;
          const ton = (s.weightKg || 0) * (s.reps || 0);
          volume += ton;
          if (
            ton > 0 &&
            ton >= (exMap.get(entry.exerciseId)?.defaults.sets || 3) * 50
          )
            prs++;
        }
      }
    }
    return { sets, volume, prs };
  }, [session, exMap]);
  const stats = analytics
    ? {
        sets: analytics.completedSets,
        volume: analytics.totalVolume,
        prs: analytics.prSignals,
      }
    : fallbackStats;
  // Mobile bar uses "working" sets semantics elsewhere; mirror that for muscle counts (only count sets with reps>0 or weight>0)
  const fallbackMuscleCounts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const entry of session.entries) {
      const ex = exMap.get(entry.exerciseId);
      if (!ex) continue;
      const g = ex.muscleGroup || "other";
      let count = 0;
      for (const s of entry.sets) {
        if ((s.reps || 0) > 0 || (s.weightKg || 0) > 0) count++;
      }
      if (count > 0) by[g] = (by[g] || 0) + count;
    }
    const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
    return Object.entries(by)
      .filter(([, n]) => n >= 1)
      .sort((a, b) => label(a[0]).localeCompare(label(b[0])));
  }, [session, exMap]);
  const muscleCounts = analytics
    ? analytics.muscleLoad
        .filter((m) => m.workingSets > 0)
        .map((m) => [m.muscle, m.workingSets] as const)
    : fallbackMuscleCounts;
  return (
    <div className="flex items-center gap-4 text-xs font-medium">
      <span className="flex flex-col items-center gap-0.5">
        <span className="metric-label">Sets</span>
        <span className="display-number-sm text-slate-100">{stats.sets}</span>
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <span className="metric-label">Vol</span>
        <span className="display-number-sm text-emerald-400">
          {stats.volume}
        </span>
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <span className="metric-label">PR</span>
        <span className="display-number-sm text-emerald-400">{stats.prs}</span>
      </span>
      {muscleCounts.length > 0 && (
        <div className="flex items-center gap-2">
          {muscleCounts.map(([k, n]) => (
            <span
              key={k}
              className="px-2 py-0.5 rounded bg-slate-800/80 border border-white/10 whitespace-nowrap"
            >
              {k.charAt(0).toUpperCase() + k.slice(1)} {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Add helper component near bottom before export (or after existing components)
function MobileSummaryFader({
  children,
  visibleThreshold = 0.5,
}: {
  children: React.ReactNode;
  visibleThreshold?: number;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight || 1;
      const ratio = window.scrollY / max;
      setVisible(ratio < visibleThreshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleThreshold]);
  return (
    <div
      className={`fixed sm:hidden bottom-0 left-0 right-0 z-30 px-4 py-3 flex items-center gap-4 overflow-x-auto transition-all duration-500 ease-out will-change-transform backdrop-blur border-t border-white/10 bg-slate-900/80 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-hidden={visible ? undefined : "true"}
    >
      {children}
    </div>
  );
}
