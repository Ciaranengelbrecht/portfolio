export type UUID = string

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'triceps' | 'biceps'
  | 'legs' | 'glutes' | 'calves' | 'core' | 'other'

export interface ExerciseDefaults {
  sets: number
  targetRepRange: string
  deloadLoadPct?: number // 0-1
  deloadSetPct?: number // 0-1
}

export interface Exercise {
  id: UUID
  name: string
  muscleGroup: MuscleGroup
  defaults: ExerciseDefaults
  active?: boolean
  isOptional?: boolean
}

export interface SetEntry { setNumber: number; weightKg: number; reps: number; rpe?: number }
export interface SessionEntry { id: UUID; exerciseId: UUID; sets: SetEntry[]; notes?: string }
export interface Session {
  id: UUID
  dateISO: string
  weekNumber: 1|2|3|4|5|6|7|8|9
  // v3+: use phaseNumber; keep legacy phase for BC
  phaseNumber?: number
  phase?: number
  templateId?: UUID
  dayName?: string
  entries: SessionEntry[]
  deletedAt?: string | null
}

export interface Measurement {
  id: UUID
  dateISO: string
  weightKg?: number
  neck?: number
  chest?: number
  waist?: number
  hips?: number
  thigh?: number
  calf?: number
  upperArm?: number
  forearm?: number
  deletedAt?: string | null
}

export interface Settings {
  unit: 'kg'|'lb'
  theme?: 'dark'|'light'
  deloadDefaults: { loadPct: number; setPct: number }
  backupEmail?: string
  dashboardPrefs?: {
    exerciseId?: string
    measurementKey?: keyof Measurement
    range?: '4w'|'8w'|'12w'|'all'
    lastLocation?: { phaseNumber: number; weekNumber: number; dayId: number; sessionId?: string }
    openToLast?: boolean
    startPage?: 'last'|'dashboard'|'sessions'|'measurements'
  }
  currentPhase?: number
  accentColor?: string
  cardStyle?: 'glass'|'solid'|'minimal'
  autoAdvanceSession?: boolean
  defaultSetRows?: number
  measurementUnits?: 'metric'|'imperial'
  privacyUnlockMode?: 'everyLaunch'|'remember24h'
  unlockedUntil?: string
}

export interface Template {
  id: UUID
  name: string
  exerciseIds: UUID[]
  hidden?: boolean
}

export type DBVersion = 3
