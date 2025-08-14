export type UUID = string;

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "triceps"
  | "biceps"
  | "legs"
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
}

export interface SetEntry {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
}
export interface SessionEntry {
  id: UUID;
  exerciseId: UUID;
  sets: SetEntry[];
  notes?: string;
}
export interface Session {
  id: UUID;
  dateISO: string;
  weekNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  // v3+: use phaseNumber; keep legacy phase for BC
  phaseNumber?: number;
  phase?: number;
  templateId?: UUID;
  dayName?: string;
  entries: SessionEntry[];
  deletedAt?: string | null;
}

export interface Measurement {
  id: UUID;
  dateISO: string;
  weightKg?: number;
  neck?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  thigh?: number;
  calf?: number;
  upperArm?: number;
  forearm?: number;
  deletedAt?: string | null;
}

import type { ThemeKey } from "../theme/themes";

export interface Settings {
  unit: "kg" | "lb";
  // Legacy theme flag kept for backward-compat UI; do not remove without migration of Settings UI
  theme?: "dark" | "light";
  // New theming system (v5+)
  themeV2?: { key: ThemeKey; customAccent?: string; prefersSystem?: boolean };
  deloadDefaults: { loadPct: number; setPct: number };
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
  };
  progress?: {
    weeklyTargetDays?: number; // default 6, min 3, max 6
    gamification?: boolean; // default true
    showDeloadHints?: boolean; // default true
  showPrevHints?: boolean; // default true (previous week hint pill)
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
}

export interface Template {
  id: UUID;
  name: string;
  exerciseIds: UUID[];
  hidden?: boolean;
}

export type DBVersion = 5;

// User profile (server source of truth for theme persistence across devices)
export interface UserProfile {
  id: string; // auth user id
  themeV2?: { key: ThemeKey; customAccent?: string; prefersSystem?: boolean }; // stored in DB column 'themev2'
  created_at?: string;
}
