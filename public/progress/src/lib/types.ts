export type UUID = string;

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "triceps"
  | "biceps"
  | "forearms"
  | "legs"
  | "hamstrings"
  | "quads"
  | "glutes"
  | "calves"
  | "core"
  | "other";

export interface ExerciseDefaults {
  sets: number;
  targetRepRange: string;
  deloadLoadPct?: number; // 0-1
  deloadSetPct?: number; // 0-1
}

export interface Exercise {
  id: UUID;
  name: string;
  muscleGroup: MuscleGroup;
  defaults: ExerciseDefaults;
  active?: boolean;
  isOptional?: boolean;
  /** Additional secondary muscle groups contributing indirect volume */
  secondaryMuscles?: MuscleGroup[]; // e.g. lat pulldown: ['biceps']
  /** Free-form tags for filtering (equipment, pattern, modality, plane, etc.) */
  tags?: string[];
}

export interface SetEntry {
  setNumber: number;
  /** Optional to allow true null/blank state distinct from 0 */
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number;
  /** Timestamp when this set was last completed/edited (ISO). Locked to session calendar date for late edits. */
  completedAt?: string;
  /** Timestamp when the set row was created (ISO). */
  addedAt?: string;
}
export interface SessionEntry {
  id: UUID;
  exerciseId: UUID;
  sets: SetEntry[];
  notes?: string;
  /** Optional planned rep range like "8-12" imported from template */
  targetRepRange?: string;
}
export interface Session {
  id: UUID;
  dateISO: string;
  /** Local calendar date (YYYY-MM-DD) captured at creation/logging time for timezone-correct charts */
  localDate?: string;
  // v6+: allow dynamic mesocycle length; previously union 1-9
  weekNumber: number;
  // v3+: use phaseNumber; keep legacy phase for BC
  phaseNumber?: number;
  phase?: number;
  templateId?: UUID;
  dayName?: string;
  programId?: string; // identifies which program config was active when created
  autoImportedTemplateId?: string; // if auto-imported at creation, record template id for provenance badge
  entries: SessionEntry[];
  deletedAt?: string | null;
  /** Timestamp when user first entered any non-zero weight or reps in this session */
  loggedStartAt?: string;
  /** Timestamp of most recent change to any set (non-zero edit) */
  loggedEndAt?: string;
  /** Creation + update timestamps (added via migration v6) */
  createdAt?: string;
  updatedAt?: string;
  /** Per-day activity log used to compute robust session duration (ignoring long gaps/accidental late edits) */
  workLog?: Record<
    string,
    { first: string; last: string; count: number; activeMs?: number }
  >; // key = YYYY-MM-DD (local)
}

export interface Measurement {
  id: UUID;
  dateISO: string;
  weightKg?: number;
  // Circumference/tape metrics
  neck?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  thigh?: number;
  calf?: number;
  upperArm?: number;
  forearm?: number;
  // Body composition (Evolt 360 import)
  bodyFatPct?: number; // percent
  fatMassKg?: number; // kg
  leanMassKg?: number; // kg (LBM)
  skeletalMuscleMassKg?: number; // kg (SMM)
  visceralFatRating?: number; // often a unitless score
  bmrKcal?: number; // kcal/day
  // Additional composition metrics
  subcutaneousFatMassKg?: number;
  visceralFatMassKg?: number;
  visceralFatAreaCm2?: number;
  totalBodyWaterKg?: number;
  proteinKg?: number;
  mineralKg?: number;
  waistToHipRatio?: number;
  // Segmental lean mass (kg) — optional granularity if available
  trunkLeanKg?: number;
  leftArmLeanKg?: number;
  rightArmLeanKg?: number;
  leftLegLeanKg?: number;
  rightLegLeanKg?: number;
  // Segmental fat mass (kg)
  trunkFatKg?: number;
  leftArmFatKg?: number;
  rightArmFatKg?: number;
  leftLegFatKg?: number;
  rightLegFatKg?: number;
  deletedAt?: string | null;
}

import type { ThemeKey } from "../theme/themes";

export interface Settings {
  unit: "kg" | "lb";
  // Legacy theme flag kept for backward-compat UI; do not remove without migration of Settings UI
  theme?: "dark" | "light";
  // New theming system (v5+)
  themeV2?: {
    key: ThemeKey;
    customAccent?: string;
    prefersSystem?: boolean;
    accentIntensity?: number;
    glowStrength?: number;
    customVars?: Record<string, string>;
  };
  deloadDefaults: { loadPct: number; setPct: number };
  /** User preference to reduce motion regardless of system setting */
  reducedMotion?: boolean;
  backupEmail?: string;
  dashboardPrefs?: {
    exerciseId?: string;
    measurementKey?: keyof Measurement;
    range?: "4w" | "8w" | "12w" | "all";
    lastLocation?: {
      phaseNumber: number;
      weekNumber: number;
      dayId: number;
      sessionId?: string;
    };
    openToLast?: boolean;
    startPage?: "last" | "dashboard" | "sessions" | "measurements";
    /** Per-dashboard-section visibility flags (true = hidden) */
    hidden?: {
      trainingChart?: boolean;
      bodyChart?: boolean;
      weekVolume?: boolean;
      phaseTotals?: boolean;
      compliance?: boolean;
      weeklyMuscleBar?: boolean; // new aggregated weekly muscle bar chart
      sessionVolumeTrend?: boolean; // per-day across weeks tonnage trend panel
    };
  };
  progress?: {
    weeklyTargetDays?: number; // default 6, min 3, max 6
    gamification?: boolean; // default true
    showDeloadHints?: boolean; // default true
    showPrevHints?: boolean; // default true (previous week hint pill)
    autoProgression?: boolean; // suggest next session weights/reps (AI guidance)
  };
  /** Per-muscle weekly target (weighted sets) */
  volumeTargets?: Record<string, number>;
  /** Subtle animated ECG background settings */
  ecg?: {
    enabled?: boolean;
    intensity?: "low" | "med" | "high";
    shape?: "classic" | "smooth" | "spikes" | "minimal";
    speedMs?: number;
    color?: string;
    trailMs?: number;
    spikes?: number;
  };
  ui?: {
    compactMode?: boolean; // reduced paddings / font-size
    instantThemeTransition?: boolean; // disable animated theme swap
    smoothingDefault?: boolean; // measurement chart smoothing persisted
    themeMode?: "system" | "dark" | "light"; // high-level mode override
  };
  currentPhase?: number;
  accentColor?: string;
  cardStyle?: "glass" | "solid" | "minimal";
  autoAdvanceSession?: boolean;
  defaultSetRows?: number;
  measurementUnits?: "metric" | "imperial";
  privacyUnlockMode?: "everyLaunch" | "remember24h";
  confirmDestructive?: boolean;
  unlockedUntil?: string;
  cloudSync?: {
    provider: "gist";
    enabled?: boolean;
    token?: string; // GitHub Personal Access Token with 'gist' scope
    gistId?: string; // target gist id; created automatically if missing
    etag?: string; // last seen ETag for conditional pulls
    lastPulledAt?: string; // ISO timestamp of last successful pull
    lastPushedAt?: string; // ISO timestamp of last successful push
    lastError?: string;
  };
  /** Enable subtle vibration feedback (mobile). Default true on first run */
  haptics?: boolean;
  /** Target rest duration in seconds for alert (timer flashes when reached) */
  restTimerTargetSeconds?: number;
  /** Emphasize rest timer on target reached with strong pulse */
  restTimerStrongAlert?: boolean;
  /** Also flash screen background briefly when rest ends */
  restTimerScreenFlash?: boolean;
  /** Play a short beep when rest target is reached */
  restTimerBeep?: boolean;
  /** Beep sound style */
  restTimerBeepStyle?: "gentle" | "chime" | "digital" | "alarm" | "click";
  /** Number of beeps to play (1-5) */
  restTimerBeepCount?: number;
  /** Beep volume as a percentage (50-300). 100 = default. Multiplies base volume. */
  restTimerBeepVolume?: number;
}

export interface Template {
  id: UUID;
  name: string;
  exerciseIds: UUID[];
  hidden?: boolean;
  /** Optional per-exercise plan data (progressive overload guidance) */
  plan?: {
    exerciseId: string;
    plannedSets: number;
    repRange: string; // e.g. "6-8", "8-10", "10-12"
    progression?: {
      scheme: "linear";
      incrementKg?: number; // default 2.5
      addRepsFirst?: boolean; // default true
    };
  }[];
}

export type DBVersion = 7;

// User profile (server source of truth for theme persistence across devices)
export interface UserProfile {
  id: string; // auth user id
  themeV2?: {
    key: ThemeKey;
    customAccent?: string;
    prefersSystem?: boolean;
    accentIntensity?: number;
    glowStrength?: number;
    customVars?: Record<string, string>;
  }; // stored in DB column 'themev2'
  created_at?: string;
  program?: UserProgram;
  program_history?: ArchivedProgram[]; // array of archived programs
}

// Program customization types
export type DayLabel =
  | "Upper"
  | "Lower"
  | "Push"
  | "Pull"
  | "Legs"
  | "Full Body"
  | "Arms"
  | "Rest"
  | "Custom";

export type WeeklySplitDay = {
  type: DayLabel;
  customLabel?: string; // if type === 'Custom'
  templateId?: string; // exercise template mapping
};

export type DeloadConfig =
  | { mode: "none" }
  | { mode: "last-week" }
  | { mode: "interval"; everyNWeeks: number };

export interface UserProgram {
  id: string;
  name: string;
  weekLengthDays: number; // default 7 (allow 5-7)
  weeklySplit: WeeklySplitDay[]; // length = weekLengthDays
  mesoWeeks: number; // e.g., 9 (weeks in mesocycle)
  deload: DeloadConfig; // default last-week
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ArchivedProgram {
  id: string; // same as program.id
  name: string;
  summary?: string;
  archivedAt: string;
  program: UserProgram;
  phaseSpan?: { from: number; to: number };
  stats?: { sessions: number; totalSets: number; totalVolume: number }; // lightweight volume snapshot
}
