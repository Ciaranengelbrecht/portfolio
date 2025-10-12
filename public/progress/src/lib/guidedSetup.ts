import { nanoid } from "nanoid";
import {
  DayLabel,
  EquipmentAccessLevel,
  Exercise,
  GuidedSetupScheduleDay,
  GuidedSetupState,
  GuidedTemplateDraft,
  GuidedTemplateHighlight,
  MuscleGroup,
  TrainingExperienceLevel,
  TrainingGoalEmphasis,
  UserProgram,
} from "./types";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const DEFAULT_DAY_FOCUS: Partial<Record<DayLabel, MuscleGroup[]>> = {
  Upper: ["chest", "back", "shoulders", "triceps", "biceps"],
  Lower: ["quads", "hamstrings", "glutes", "calves"],
  Push: ["chest", "shoulders", "triceps"],
  Pull: ["back", "biceps", "forearms"],
  Legs: ["quads", "hamstrings", "glutes", "calves"],
  "Full Body": [
    "chest",
    "back",
    "shoulders",
    "triceps",
    "biceps",
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "core",
  ],
  Arms: ["biceps", "triceps", "forearms"],
};

type PriorityLane = "primary" | "secondary" | "maintenance";

const MUSCLE_PRIORITY_SHARES: Record<PriorityLane, number> = {
  primary: 0.6,
  secondary: 0.3,
  maintenance: 0.1,
};

const MUSCLE_PRIORITY_BASE_WEIGHT: Record<PriorityLane, number> = {
  primary: 3,
  secondary: 2,
  maintenance: 1,
};

const PRIORITY_ORDER: PriorityLane[] = ["primary", "secondary", "maintenance"];

const LOWER_BODY_MUSCLES = new Set<MuscleGroup>([
  "glutes",
  "hamstrings",
  "quads",
  "calves",
]);

const POPULAR_EXERCISE_KEYWORDS = [
  "squat",
  "deadlift",
  "bench",
  "press",
  "row",
  "pull-up",
  "chin-up",
  "hip thrust",
  "lunge",
  "leg press",
  "romanian",
  "rdl",
  "split squat",
  "dip",
];

const NICHE_EXERCISE_KEYWORDS = [
  "bosu",
  "trx",
  "balance",
  "stability ball",
  "combo",
  "plyo",
  "complex",
];

const TRAINING_PATTERNS: Record<number, DayLabel[]> = {
  3: ["Full Body", "Upper", "Lower"],
  4: ["Upper", "Lower", "Push", "Pull"],
  5: ["Upper", "Lower", "Push", "Pull", "Legs"],
  6: ["Push", "Pull", "Legs", "Upper", "Lower", "Arms"],
  7: ["Push", "Pull", "Legs", "Upper", "Lower", "Arms", "Full Body"],
};

const DEFAULT_REST_ORDER = [6, 2, 4, 0, 5, 1, 3];

const DAY_TYPE_OPTIONS: DayLabel[] = [
  "Lower",
  "Legs",
  "Upper",
  "Push",
  "Pull",
  "Full Body",
  "Arms",
];

const BASE_VOLUME: Record<MuscleGroup, number> = {
  chest: 12,
  back: 14,
  shoulders: 10,
  triceps: 8,
  biceps: 8,
  forearms: 4,
  legs: 0,
  hamstrings: 10,
  quads: 10,
  glutes: 10,
  calves: 6,
  core: 6,
  other: 0,
};

const ALL_MUSCLE_GROUPS = Object.keys(BASE_VOLUME) as MuscleGroup[];

const EXPERIENCE_MULTIPLIER: Record<TrainingExperienceLevel, number> = {
  beginner: 0.85,
  intermediate: 1,
  advanced: 1.15,
};

const GOAL_EMPHASIS_MULTIPLIER: Record<TrainingGoalEmphasis, number> = {
  hypertrophy: 1.05,
  balanced: 1,
  strength: 0.95,
};

const VOLUME_PREF_MULTIPLIER = {
  lower: 0.9,
  standard: 1,
  higher: 1.15,
};

const EQUIPMENT_TAG_PRIORITIES: Record<
  EquipmentAccessLevel,
  { preferred: string[]; allowed: string[]; avoid: string[] }
> = {
  "commercial-gym": {
    preferred: ["machine", "cable", "barbell", "dumbbell"],
    allowed: ["bodyweight", "band", "kettlebell"],
    avoid: [],
  },
  "home-gym": {
    preferred: ["barbell", "dumbbell", "bodyweight", "band", "kettlebell"],
    allowed: ["cable"],
    avoid: ["machine"],
  },
  minimal: {
    preferred: ["bodyweight", "band", "dumbbell"],
    allowed: ["kettlebell"],
    avoid: ["machine", "barbell", "cable"],
  },
};

function clampTrainingDays(days?: number): number {
  if (!days || Number.isNaN(days)) return 4;
  return Math.max(3, Math.min(7, Math.round(days)));
}

function uniqMuscles(list: MuscleGroup[]): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  const out: MuscleGroup[] = [];
  for (const m of list) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

function resolvePattern(days: number): DayLabel[] {
  if (TRAINING_PATTERNS[days]) return [...TRAINING_PATTERNS[days]];
  if (days < 3) return [...TRAINING_PATTERNS[3]];
  if (days > 7) return [...TRAINING_PATTERNS[7]];
  // fallback: for 5/6 default already handled; for other values blend
  return [...TRAINING_PATTERNS[5]];
}

function createVolumeRecord(initial = 0): Record<MuscleGroup, number> {
  const record = {} as Record<MuscleGroup, number>;
  ALL_MUSCLE_GROUPS.forEach((muscle) => {
    record[muscle] = initial;
  });
  return record;
}

function derivePriorityBuckets(
  state: GuidedSetupState
): Record<PriorityLane, MuscleGroup[]> {
  const primarySet = new Set(state.priorityMuscles?.primary || []);
  const secondarySet = new Set(
    (state.priorityMuscles?.secondary || []).filter(
      (muscle) => !primarySet.has(muscle)
    )
  );
  const maintenanceSet = new Set(
    (state.priorityMuscles?.maintenance || []).filter(
      (muscle) => !primarySet.has(muscle) && !secondarySet.has(muscle)
    )
  );

  return {
    primary: Array.from(primarySet),
    secondary: Array.from(secondarySet),
    maintenance: Array.from(maintenanceSet),
  };
}

function deriveMusclePriorityWeights(
  state: GuidedSetupState
): Map<MuscleGroup, number> {
  const buckets = derivePriorityBuckets(state);
  const map = new Map<MuscleGroup, number>();
  (Object.keys(buckets) as PriorityLane[]).forEach((lane) => {
    const weight = MUSCLE_PRIORITY_BASE_WEIGHT[lane];
    buckets[lane].forEach((muscle) => {
      map.set(muscle, weight);
    });
  });
  return map;
}

function computeWeeklySetBudget(
  state: GuidedSetupState,
  trainingDays: number
): number {
  const days = Math.max(1, trainingDays);
  const sets = Math.max(8, Math.min(24, state.setsPerSession || 12));
  return days * sets;
}

function buildPriorityVolumeTargets(
  state: GuidedSetupState,
  trainingDays: number
): Partial<Record<MuscleGroup, number>> | null {
  const buckets = derivePriorityBuckets(state);
  const activeBuckets = (
    Object.entries(buckets) as [PriorityLane, MuscleGroup[]][]
  ).filter(([, muscles]) => muscles.length > 0);
  if (!activeBuckets.length) return null;

  const totalSets = computeWeeklySetBudget(state, trainingDays);
  const totalShare = activeBuckets.reduce(
    (sum, [lane]) => sum + MUSCLE_PRIORITY_SHARES[lane],
    0
  );
  const volume: Partial<Record<MuscleGroup, number>> = {};

  activeBuckets.forEach(([lane, muscles]) => {
    const share = MUSCLE_PRIORITY_SHARES[lane] / (totalShare || 1);
    const bucketSets = totalSets * share;
    const perMuscle = muscles.length ? bucketSets / muscles.length : 0;
    muscles.forEach((muscle) => {
      volume[muscle] = Number(perMuscle.toFixed(1));
    });
  });

  const sum = Object.values(volume).reduce((acc, value) => acc + value, 0) || 1;
  const scale = totalSets / sum;
  Object.keys(volume).forEach((muscle) => {
    volume[muscle as MuscleGroup] = Number(
      ((volume[muscle as MuscleGroup] || 0) * scale).toFixed(1)
    );
  });

  return volume;
}

function buildPriorityLookup(
  state: GuidedSetupState
): Map<MuscleGroup, PriorityLane> {
  const buckets = derivePriorityBuckets(state);
  const lookup = new Map<MuscleGroup, PriorityLane>();
  (Object.keys(buckets) as PriorityLane[]).forEach((lane) => {
    buckets[lane].forEach((muscle) => lookup.set(muscle, lane));
  });
  return lookup;
}

function topMusclesByRemaining(
  remainingVolume: Map<MuscleGroup, number>,
  muscleWeights: Map<MuscleGroup, number>,
  limit: number
): MuscleGroup[] {
  const ranked = ALL_MUSCLE_GROUPS.map((muscle) => {
    const remaining = remainingVolume.get(muscle) ?? 0;
    const weight = muscleWeights.get(muscle) ?? 0;
    return { muscle, remaining, weight };
  })
    .filter((item) => item.remaining > 0 || item.weight > 0)
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return b.weight - a.weight;
    });
  return ranked.slice(0, Math.max(0, limit)).map((item) => item.muscle);
}

function pickDayType(
  remainingVolume: Map<MuscleGroup, number>,
  muscleWeights: Map<MuscleGroup, number>,
  usedCounts: Map<DayLabel, number>,
  lowerTarget: number,
  remainingSlots: number,
  lowerUsedSoFar: number
): DayLabel {
  if (
    lowerTarget > 0 &&
    lowerTarget - lowerUsedSoFar >= remainingSlots &&
    remainingSlots > 0
  ) {
    return "Lower";
  }
  const totals = ALL_MUSCLE_GROUPS.reduce(
    (acc, muscle) => {
      const remaining = remainingVolume.get(muscle) ?? 0;
      acc.total += remaining;
      if (LOWER_BODY_MUSCLES.has(muscle)) acc.lower += remaining;
      return acc;
    },
    { total: 0, lower: 0 }
  );
  const lowerShare = totals.total > 0 ? totals.lower / totals.total : 0;
  let best: { type: DayLabel; score: number } | null = null;
  for (const type of DAY_TYPE_OPTIONS) {
    const focus = DEFAULT_DAY_FOCUS[type] || [];
    if (!focus.length) continue;
    let score = 0;
    focus.forEach((muscle) => {
      const remaining = remainingVolume.get(muscle) ?? 0;
      const weight = muscleWeights.get(muscle) ?? 0.1;
      score += remaining * 2.2 + weight;
    });
    if (type === "Lower" || type === "Legs") {
      score *= 1 + lowerShare;
    } else if (type === "Upper" || type === "Push" || type === "Pull") {
      const upperShare =
        totals.total > 0 ? (totals.total - totals.lower) / totals.total : 0.5;
      score *= 1 + upperShare * 0.6;
    }
    const penalty = usedCounts.get(type) ?? 0;
    score -= penalty * 1.4;
    if (!best || score > best.score) best = { type, score };
  }
  if (lowerShare > 0.45 && lowerUsedSoFar === 0) {
    return "Lower";
  }
  if (best && best.score > 0.2) {
    return best.type;
  }
  const fallback = topMusclesByRemaining(remainingVolume, muscleWeights, 1)[0];
  if (fallback && LOWER_BODY_MUSCLES.has(fallback)) return "Lower";
  if (fallback) return "Upper";
  return "Full Body";
}

function selectFocusMuscles(
  type: DayLabel,
  remainingVolume: Map<MuscleGroup, number>,
  muscleWeights: Map<MuscleGroup, number>,
  priorityLookup: Map<MuscleGroup, PriorityLane>
): MuscleGroup[] {
  const base = Array.from(new Set(DEFAULT_DAY_FOCUS[type] || []));
  const scored = base.map((muscle) => ({
    muscle,
    remaining: remainingVolume.get(muscle) ?? 0,
    weight: muscleWeights.get(muscle) ?? 0,
    lane: priorityLookup.get(muscle),
  }));
  const positive = scored.filter((item) => item.remaining > 0.1);
  const source = positive.length ? positive : scored;
  const ordered = source
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      if ((a.lane || "") !== (b.lane || "")) {
        const laneRank = (lane?: PriorityLane) =>
          lane ? PRIORITY_ORDER.indexOf(lane) : PRIORITY_ORDER.length;
        return laneRank(a.lane) - laneRank(b.lane);
      }
      return b.weight - a.weight;
    })
    .map((item) => item.muscle)
    .filter(Boolean);
  const limited = ordered.slice(0, 4);
  if (limited.length) return limited;
  return topMusclesByRemaining(remainingVolume, muscleWeights, 3);
}

function consumeVolumeForDay(
  remainingVolume: Map<MuscleGroup, number>,
  muscles: MuscleGroup[],
  budget: number,
  muscleWeights: Map<MuscleGroup, number>
) {
  if (!muscles.length || budget <= 0) return;
  const entries = muscles.map((muscle) => {
    const remaining = remainingVolume.get(muscle) ?? 0;
    const weight = muscleWeights.get(muscle) ?? 0.1;
    const score = remaining > 0 ? remaining * 2 + weight : weight;
    return { muscle, remaining, weight: score > 0 ? score : 1 };
  });
  let totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!totalWeight) totalWeight = entries.length || 1;
  const allocations = entries.map((entry) => {
    const raw = (entry.weight / totalWeight) * budget;
    return Math.max(1, Math.round(raw));
  });
  let total = allocations.reduce((sum, value) => sum + value, 0);
  let idx = 0;
  while (total > budget && allocations.length) {
    const target = allocations[idx % allocations.length];
    if (target > 1) {
      allocations[idx % allocations.length] -= 1;
      total -= 1;
    }
    idx += 1;
    if (idx > allocations.length * 4) break;
  }
  idx = 0;
  while (total < budget && allocations.length) {
    allocations[idx % allocations.length] += 1;
    total += 1;
    idx += 1;
    if (idx > allocations.length * 4) break;
  }

  allocations.forEach((sets, i) => {
    const muscle = entries[i].muscle;
    const current = remainingVolume.get(muscle) ?? 0;
    const applied = Math.min(sets, Math.max(0, current));
    const next = Math.max(0, Number((current - applied).toFixed(1)));
    remainingVolume.set(muscle, next);
  });
}

function buildScheduleNote(
  focus: MuscleGroup[],
  priorityLookup: Map<MuscleGroup, PriorityLane>
): string | undefined {
  if (!focus.length) return undefined;
  const grouped: Record<PriorityLane, MuscleGroup[]> = {
    primary: [],
    secondary: [],
    maintenance: [],
  };
  focus.forEach((muscle) => {
    const lane = priorityLookup.get(muscle);
    if (lane) grouped[lane].push(muscle);
  });
  const notes: string[] = [];
  if (grouped.primary.length) {
    notes.push(`Primary focus: ${formatList(grouped.primary)}`);
  }
  if (grouped.secondary.length) {
    notes.push(`Secondary: ${formatList(grouped.secondary)}`);
  }
  if (!notes.length) {
    notes.push(`Emphasis: ${formatList(focus)}`);
  }
  return notes.join(" • ");
}

function buildPatternSchedule(
  state: GuidedSetupState,
  restSet: Set<number>
): GuidedSetupScheduleDay[] {
  const trainingDays = clampTrainingDays(state.daysPerWeek);
  const pattern = resolvePattern(trainingDays);
  const primary = new Set(state.priorityMuscles?.primary || []);
  const secondary = new Set(state.priorityMuscles?.secondary || []);
  let patternIdx = 0;
  const days: GuidedSetupScheduleDay[] = [];
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    if (restSet.has(dayIdx) || patternIdx >= pattern.length) {
      days.push({
        id: `rest-${dayIdx}`,
        label: `${DAY_NAMES[dayIdx]} – Recovery`,
        type: "Rest",
        focusMuscles: [],
        note: "Planned recovery day",
      });
      continue;
    }
    const type = pattern[patternIdx++];
    const baseFocus = DEFAULT_DAY_FOCUS[type] || [];
    const focus = uniqMuscles([
      ...baseFocus,
      ...Array.from(primary).filter((m) => baseFocus.includes(m)),
      ...Array.from(secondary).filter((m) => baseFocus.includes(m)),
    ]);
    const primaryHits = focus.filter((m) => primary.has(m));
    const secondaryHits = focus.filter((m) => secondary.has(m));
    const noteParts: string[] = [];
    if (primaryHits.length) {
      noteParts.push(`Primary focus: ${formatList(primaryHits)}`);
    }
    if (secondaryHits.length && secondaryHits.length !== primaryHits.length) {
      noteParts.push(`Secondary: ${formatList(secondaryHits)}`);
    }
    if (!noteParts.length) {
      noteParts.push(`Emphasis: ${formatList(focus)}`);
    }
    days.push({
      id: `day-${dayIdx}`,
      label: `${DAY_NAMES[dayIdx]} – ${type}`,
      type,
      focusMuscles: focus,
      note: noteParts.join(" • "),
    });
  }
  return days;
}

export function suggestWeeklySplit(
  state: GuidedSetupState
): GuidedSetupScheduleDay[] {
  const trainingDays = clampTrainingDays(state.daysPerWeek);
  const preferredRest = Array.isArray(state.preferredRestDays)
    ? state.preferredRestDays
        .map((d) => Math.max(0, Math.min(6, Math.floor(d))))
        .slice(0, 7)
    : [];
  const restSet = new Set<number>();
  const restNeeded = Math.max(0, 7 - trainingDays);
  for (const idx of preferredRest) {
    if (restSet.size >= restNeeded) break;
    restSet.add(idx);
  }
  if (restSet.size < restNeeded) {
    for (const idx of DEFAULT_REST_ORDER) {
      if (restSet.size >= restNeeded) break;
      if (!restSet.has(idx)) restSet.add(idx);
    }
  }

  const schedule: GuidedSetupScheduleDay[] = [];
  const muscleWeights = deriveMusclePriorityWeights(state);
  const priorityLookup = buildPriorityLookup(state);
  const volumeTargets = buildPriorityVolumeTargets(state, trainingDays) || {};
  const hasPriorities = Array.from(muscleWeights.values()).some(
    (value) => value > 0
  );
  if (!hasPriorities) {
    return buildPatternSchedule(state, new Set(restSet));
  }
  const remainingVolume = new Map<MuscleGroup, number>();
  Object.entries(volumeTargets).forEach(([muscle, value]) => {
    remainingVolume.set(muscle as MuscleGroup, value ?? 0);
  });
  const initialTotals = Array.from(remainingVolume.entries()).reduce(
    (acc, [muscle, value]) => {
      const amount = value ?? 0;
      acc.total += amount;
      if (LOWER_BODY_MUSCLES.has(muscle)) acc.lower += amount;
      return acc;
    },
    { total: 0, lower: 0 }
  );
  const initialLowerShare =
    initialTotals.total > 0 ? initialTotals.lower / initialTotals.total : 0;
  const targetLowerDays = Math.max(
    1,
    Math.round(initialLowerShare * trainingDays)
  );
  const usedCounts = new Map<DayLabel, number>();
  const setsPerSession = Math.max(8, Math.min(24, state.setsPerSession || 12));
  let scheduledTrainingDays = 0;

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    if (restSet.has(dayIdx)) {
      schedule.push({
        id: `rest-${dayIdx}`,
        label: `${DAY_NAMES[dayIdx]} – Recovery`,
        type: "Rest",
        focusMuscles: [],
        note: "Planned recovery day",
      });
      continue;
    }

    const lowerUsedSoFar =
      (usedCounts.get("Lower") || 0) + (usedCounts.get("Legs") || 0);
    const slotsLeft = Math.max(1, trainingDays - scheduledTrainingDays);
    const dayType = pickDayType(
      remainingVolume,
      muscleWeights,
      usedCounts,
      targetLowerDays,
      slotsLeft,
      lowerUsedSoFar
    );
    const focusMuscles = selectFocusMuscles(
      dayType,
      remainingVolume,
      muscleWeights,
      priorityLookup
    );
    if (focusMuscles.length) {
      consumeVolumeForDay(
        remainingVolume,
        focusMuscles,
        setsPerSession,
        muscleWeights
      );
    }
    usedCounts.set(dayType, (usedCounts.get(dayType) || 0) + 1);
    scheduledTrainingDays += 1;

    schedule.push({
      id: `day-${dayIdx}`,
      label: `${DAY_NAMES[dayIdx]} – ${dayType}`,
      type: dayType,
      focusMuscles,
      note: buildScheduleNote(focusMuscles, priorityLookup),
    });
  }

  return schedule;
}

function formatList(list: MuscleGroup[]): string {
  if (!list.length) return "—";
  if (list.length === 1) return list[0];
  const head = list.slice(0, -1).join(", ");
  return `${head} & ${list[list.length - 1]}`;
}

export function calculateVolumeTargets(
  state: GuidedSetupState,
  schedule?: GuidedSetupScheduleDay[]
): Record<MuscleGroup, number> {
  const trainingDays = schedule
    ? schedule.filter((day) => day.type !== "Rest").length
    : clampTrainingDays(state.daysPerWeek);
  const priorityVolume = buildPriorityVolumeTargets(state, trainingDays);
  if (priorityVolume) {
    const record = createVolumeRecord(0);
    Object.entries(priorityVolume).forEach(([muscle, value]) => {
      record[muscle as MuscleGroup] = Number((value ?? 0).toFixed(1));
    });
    return record;
  }

  const experience = state.experience || "intermediate";
  const goal = state.goalEmphasis || "balanced";
  const volumePref = state.volumePreference || "standard";
  const base = createVolumeRecord(0);
  const mult =
    EXPERIENCE_MULTIPLIER[experience] *
    GOAL_EMPHASIS_MULTIPLIER[goal] *
    VOLUME_PREF_MULTIPLIER[volumePref];
  ALL_MUSCLE_GROUPS.forEach((muscle) => {
    let value = BASE_VOLUME[muscle] * mult;
    base[muscle] = Number(value.toFixed(1));
  });
  return base;
}

export function generateProgram(
  state: GuidedSetupState,
  schedule: GuidedSetupScheduleDay[]
): UserProgram {
  const trainingDays = schedule.filter((d) => d.type !== "Rest");
  const weekLengthDays = Math.max(5, schedule.length);
  const now = new Date().toISOString();
  const experience = state.experience || "intermediate";
  const mesoWeeks =
    experience === "beginner" ? 8 : experience === "advanced" ? 12 : 9;
  const deload =
    experience === "advanced" || state.volumePreference === "higher"
      ? { mode: "interval" as const, everyNWeeks: 6 as const }
      : { mode: "last-week" as const };
  const primaryMuscles = state.priorityMuscles?.primary || [];
  const nameParts = [
    "Guided",
    `${trainingDays.length}-day`,
    trainingDays[0]?.type || "Program",
  ];
  const weeklySplit = schedule.map((day) => {
    if (day.type === "Rest") {
      return {
        type: "Rest" as DayLabel,
        customLabel: day.label || `${day.type}`,
      };
    }
    if (day.type === "Custom") {
      return {
        type: "Custom" as DayLabel,
        customLabel: day.label,
      };
    }
    const customLabel = day.label
      ? day.label
      : day.note
      ? `${day.type} – ${day.note.replace(/\s+•.*/, "")}`
      : undefined;
    return {
      type: day.type,
      customLabel,
    };
  });
  return {
    id: `prog_${nanoid(6)}`,
    name: nameParts.join(" "),
    weekLengthDays,
    weeklySplit,
    mesoWeeks,
    deload,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

interface TemplateBuildContext {
  state: GuidedSetupState;
  exercises: Exercise[];
  exerciseById: Map<string, Exercise>;
}

interface MuscleTarget {
  muscle: MuscleGroup;
  targetSets: number;
  weight: number;
}

export function buildTemplateDrafts(
  state: GuidedSetupState,
  schedule: GuidedSetupScheduleDay[],
  exercises: Exercise[],
  volumeTargets: Record<MuscleGroup, number>
): GuidedTemplateDraft[] {
  const activeExercises = exercises.filter((ex) => ex && ex.active !== false);
  const exerciseById = new Map(activeExercises.map((ex) => [ex.id, ex]));
  const ctx: TemplateBuildContext = {
    state,
    exercises: activeExercises,
    exerciseById,
  };
  const drafts: GuidedTemplateDraft[] = [];
  const used = new Set<string>();
  const setsPerSession = Math.max(8, Math.min(24, state.setsPerSession || 12));
  const goal = state.goalEmphasis || "balanced";
  const repRange =
    goal === "strength" ? "4-6" : goal === "hypertrophy" ? "8-12" : "6-10";
  const remainingVolume = new Map<MuscleGroup, number>();
  Object.entries(volumeTargets).forEach(([muscle, value]) => {
    remainingVolume.set(muscle as MuscleGroup, value ?? 0);
  });
  const priorityWeights = deriveMusclePriorityWeights(state);

  for (
    let scheduleIndex = 0;
    scheduleIndex < schedule.length;
    scheduleIndex++
  ) {
    const day = schedule[scheduleIndex];
    if (day.type === "Rest") continue;
    const focus = day.focusMuscles.length
      ? day.focusMuscles
      : DEFAULT_DAY_FOCUS[day.type] || [];
    if (!focus.length) continue;

    const muscleTargets = allocateMuscleTargets(
      state,
      focus,
      setsPerSession,
      remainingVolume,
      priorityWeights
    );
    if (!muscleTargets.length) continue;

    const planEntries: GuidedTemplateDraft["plan"] = [];
    const exerciseIds: string[] = [];
    const highlights: GuidedTemplateHighlight[] = [];

    for (const target of muscleTargets) {
      if (!target.targetSets || target.targetSets <= 0) continue;
      const desiredExercises = determineExerciseCount(
        target.targetSets,
        target.muscle
      );
      if (desiredExercises <= 0) continue;
      const picks = pickExercises(
        ctx,
        day,
        target.muscle,
        used,
        desiredExercises
      );
      if (!picks.length) continue;

      const setsDistribution = distributeSets(target.targetSets, picks.length);
      picks.forEach((exercise, idx) => {
        used.add(exercise.id);
        exerciseIds.push(exercise.id);
        planEntries.push({
          exerciseId: exercise.id,
          plannedSets:
            setsDistribution[idx] ??
            Math.max(2, Math.round(target.targetSets / picks.length)),
          repRange,
        });
        highlights.push({
          exerciseId: exercise.id,
          role: idx === 0 ? "anchor" : "support",
        });
      });
    }

    if (!planEntries.length) continue;

    planEntries.sort((a, b) => b.plannedSets - a.plannedSets);
    const uniqueExerciseIds = Array.from(new Set(exerciseIds));
    const note = buildTemplateNote(ctx, day, muscleTargets, planEntries);

    drafts.push({
      id: `tpl_${nanoid(6)}`,
      name: day.label.replace(/ – .*/, ""),
      exerciseIds: uniqueExerciseIds,
      focusMuscles: focus,
      scheduleDayId: day.id,
      scheduleIndex,
      plan: planEntries,
      note,
      highlights,
    });
  }
  return drafts;
}

function determineExerciseCount(
  targetSets: number,
  muscle: MuscleGroup
): number {
  if (targetSets <= 0 || Number.isNaN(targetSets)) return 0;
  const maxByVolume = Math.max(1, Math.floor(targetSets / 2));
  const baseCap = targetSets >= 10 ? 3 : targetSets >= 6 ? 2 : 1;
  const muscleCap = ["core", "calves", "forearms"].includes(muscle)
    ? Math.min(baseCap, 1)
    : baseCap;
  return Math.max(1, Math.min(maxByVolume, muscleCap));
}

function distributeSets(totalSets: number, exerciseCount: number): number[] {
  if (exerciseCount <= 0) return [];
  if (exerciseCount === 1) return [Math.max(2, Math.round(totalSets))];
  const minPerExercise = 2;
  const base = Math.max(minPerExercise, Math.floor(totalSets / exerciseCount));
  const allocation = new Array(exerciseCount).fill(base);
  let allocated = allocation.reduce((sum, value) => sum + value, 0);

  let idx = 0;
  while (allocated < totalSets) {
    allocation[idx % exerciseCount] += 1;
    allocated += 1;
    idx += 1;
    if (idx > exerciseCount * 4) break;
  }

  idx = 0;
  while (allocated > totalSets) {
    const targetIdx =
      (exerciseCount - 1 - (idx % exerciseCount) + exerciseCount) %
      exerciseCount;
    if (allocation[targetIdx] > minPerExercise) {
      allocation[targetIdx] -= 1;
      allocated -= 1;
    }
    idx += 1;
    if (idx > exerciseCount * 6) break;
  }

  return allocation;
}

function allocateMuscleTargets(
  state: GuidedSetupState,
  focus: MuscleGroup[],
  setsPerSession: number,
  remainingVolume: Map<MuscleGroup, number>,
  priorityWeights: Map<MuscleGroup, number>
): MuscleTarget[] {
  if (!focus.length) return [];
  const uniqueFocus = uniqMuscles(focus);
  const entries = uniqueFocus
    .map((muscle) => {
      const remaining = remainingVolume.get(muscle) ?? 0;
      const priority = priorityWeights.get(muscle) ?? 0.3;
      const weight = remaining > 0 ? remaining * 1.6 + priority : priority;
      return { muscle, remaining, weight: weight > 0 ? weight : 0.2 };
    })
    .filter((entry) => entry.weight > 0);
  if (!entries.length) return [];

  let totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    totalWeight = entries.length;
  }

  const allocations = entries.map((entry) => {
    const raw = (entry.weight / totalWeight) * setsPerSession;
    return Math.max(1, Math.round(raw));
  });

  let total = allocations.reduce((sum, value) => sum + value, 0);
  let idx = allocations.length - 1;
  while (total > setsPerSession && allocations.length) {
    if (allocations[idx] > 1) {
      allocations[idx] -= 1;
      total -= 1;
    }
    idx = (idx - 1 + allocations.length) % allocations.length;
    if (idx < 0) idx = allocations.length - 1;
  }
  idx = 0;
  while (total < setsPerSession && allocations.length) {
    allocations[idx % allocations.length] += 1;
    total += 1;
    idx += 1;
    if (idx > allocations.length * 4) break;
  }

  const targets: MuscleTarget[] = allocations.map((targetSets, i) => {
    const muscle = entries[i].muscle;
    const available = remainingVolume.get(muscle) ?? 0;
    const applied = Math.min(targetSets, Math.max(0, Math.round(available)));
    const next = Math.max(0, Number((available - applied).toFixed(1)));
    remainingVolume.set(muscle, next);
    return {
      muscle,
      targetSets: targetSets,
      weight: entries[i].weight,
    };
  });

  return targets.sort(
    (a, b) => b.targetSets - a.targetSets || b.weight - a.weight
  );
}

function pickExercises(
  ctx: TemplateBuildContext,
  day: GuidedSetupScheduleDay,
  muscle: MuscleGroup,
  used: Set<string>,
  limit: number
): Exercise[] {
  if (limit <= 0) return [];
  const { exercises } = ctx;
  const candidates = exercises.filter(
    (ex) =>
      ex.muscleGroup === muscle || (ex.secondaryMuscles || []).includes(muscle)
  );
  const primaryPool = candidates.filter(
    (ex) => ex.muscleGroup === muscle && !used.has(ex.id)
  );
  const secondaryPool = candidates.filter(
    (ex) =>
      ex.muscleGroup !== muscle &&
      (ex.secondaryMuscles || []).includes(muscle) &&
      !used.has(ex.id)
  );

  const selection: Exercise[] = [];
  const taken = new Set<string>();

  const takeFromPool = (pool: Exercise[], fallback = false) => {
    if (!pool.length || selection.length >= limit) return;
    const scored = pool
      .map((exercise) => ({
        exercise,
        score: scoreExercise(ctx, day, muscle, exercise, fallback),
      }))
      .sort((a, b) => b.score - a.score);
    for (const { exercise } of scored) {
      if (selection.length >= limit) break;
      if (taken.has(exercise.id)) continue;
      selection.push(exercise);
      taken.add(exercise.id);
    }
  };

  takeFromPool(primaryPool, false);
  if (selection.length < limit) {
    takeFromPool(secondaryPool, false);
  }

  if (selection.length < limit) {
    const remaining = candidates.filter(
      (ex) => !used.has(ex.id) && !taken.has(ex.id)
    );
    takeFromPool(remaining, true);
  }

  if (selection.length < limit) {
    const reused = candidates.filter((ex) => !taken.has(ex.id));
    takeFromPool(reused, true);
  }

  return selection.slice(0, limit);
}

function buildTemplateNote(
  ctx: TemplateBuildContext,
  day: GuidedSetupScheduleDay,
  targets: MuscleTarget[],
  plan: GuidedTemplateDraft["plan"]
): string | undefined {
  if (!plan.length) return undefined;
  const anchorExercise = ctx.exerciseById.get(plan[0].exerciseId);
  const focusList = targets
    .slice(0, Math.min(3, targets.length))
    .map((item) => item.muscle);
  const focusSummary = focusList.length ? formatList(focusList) : undefined;
  const goal = ctx.state.goalEmphasis || "balanced";
  const goalDescriptor =
    goal === "strength"
      ? "heavy compounds"
      : goal === "hypertrophy"
      ? "higher-volume accessories"
      : "a balanced mix";
  const dayName = day.label.split(" – ")[0];
  if (anchorExercise && focusSummary) {
    return `${dayName} opens with ${anchorExercise.name} before layering ${goalDescriptor} across ${focusSummary}.`;
  }
  if (anchorExercise) {
    return `${dayName} leads with ${anchorExercise.name} for ${goalDescriptor}.`;
  }
  if (focusSummary) {
    return `${dayName} emphasises ${goalDescriptor} across ${focusSummary}.`;
  }
  return undefined;
}

interface NormalisedTags {
  all: Set<string>;
  simple: Set<string>;
}

function normaliseTags(exercise: Exercise): NormalisedTags {
  const all = new Set<string>(
    (exercise.tags || []).map((tag) => tag.toLowerCase())
  );
  const simple = new Set<string>(
    Array.from(all).filter((tag) => !tag.includes(":"))
  );
  return { all, simple };
}

function scoreExercise(
  ctx: TemplateBuildContext,
  day: GuidedSetupScheduleDay,
  muscle: MuscleGroup,
  exercise: Exercise,
  isFallback: boolean
): number {
  const { state } = ctx;
  const tags = normaliseTags(exercise);
  const name = exercise.name.toLowerCase();
  const hasSimple = (value: string) => tags.simple.has(value);
  const hasAny = (values: string[]) =>
    values.some((value) => tags.simple.has(value));

  let score = 0;

  if (exercise.muscleGroup === muscle) score += 8;
  else if ((exercise.secondaryMuscles || []).includes(muscle)) score += 4;
  else score += 1;

  if (tags.all.has(`mg:${muscle}`)) score += 0.5;

  score += equipmentCompatibilityScore(state.equipment, tags.simple, name);
  score += goalAlignmentScore(state.goalEmphasis, tags.simple);
  score += experienceAlignmentScore(state.experience, tags.simple, name);
  score += dayTypeAlignmentScore(day.type, tags.simple);

  if (hasSimple("compound")) score += 1;
  if (hasSimple("unilateral")) score += 0.2;
  if (hasAny(["curl", "raise", "extension", "fly"])) score += 0.2;

  const mainstream = POPULAR_EXERCISE_KEYWORDS.some((keyword) =>
    name.includes(keyword)
  );
  if (mainstream) score += 1.1;

  const niche = NICHE_EXERCISE_KEYWORDS.some((keyword) =>
    name.includes(keyword)
  );
  const setsBudget = Math.max(8, Math.min(24, ctx.state.setsPerSession || 12));
  if (
    niche &&
    ctx.state.equipment !== "minimal" &&
    setsBudget <= 16 &&
    !mainstream
  ) {
    score -= 1.4;
  }

  if (isFallback) score -= 1.2;

  return score;
}

function equipmentCompatibilityScore(
  equipment: EquipmentAccessLevel | undefined,
  tags: Set<string>,
  name: string
): number {
  const eq = equipment || "commercial-gym";
  const prefs = EQUIPMENT_TAG_PRIORITIES[eq];
  if (!prefs) return 0;
  let score = 0;
  if (prefs.preferred.some((tag) => tags.has(tag))) score += 2.5;
  if (prefs.allowed.some((tag) => tags.has(tag))) score += 1;
  if (prefs.avoid.some((tag) => tags.has(tag)))
    score -= eq === "minimal" ? 4 : 2;

  if (!tags.size) {
    if (eq !== "commercial-gym" && /machine/.test(name))
      score -= eq === "minimal" ? 4 : 1.5;
    if (eq === "minimal" && /barbell|smith/.test(name)) score -= 2.5;
    if (eq !== "commercial-gym" && /cable/.test(name)) score -= 1.5;
  }

  return score;
}

function goalAlignmentScore(
  goal: TrainingGoalEmphasis | undefined,
  tags: Set<string>
): number {
  const value = goal || "balanced";
  let score = 0;
  if (value === "strength") {
    if (tags.has("compound")) score += 2.5;
    if (["press", "squat", "hinge", "pull"].some((tag) => tags.has(tag)))
      score += 1;
    if (tags.has("isolation")) score -= 1.4;
  } else if (value === "hypertrophy") {
    if (tags.has("isolation")) score += 1.6;
    if (["fly", "raise", "curl", "extension"].some((tag) => tags.has(tag)))
      score += 0.8;
    if (tags.has("compound")) score += 0.7;
  } else {
    if (tags.has("compound")) score += 1.1;
    if (tags.has("isolation")) score += 0.9;
  }
  return score;
}

function experienceAlignmentScore(
  experience: TrainingExperienceLevel | undefined,
  tags: Set<string>,
  name: string
): number {
  const level = experience || "intermediate";
  let score = 0;
  if (level === "beginner") {
    if (["machine", "bodyweight", "dumbbell"].some((tag) => tags.has(tag)))
      score += 0.8;
    if (tags.has("power") || /clean|snatch|jerk|complex/.test(name)) score -= 2;
  } else if (level === "advanced") {
    if (tags.has("barbell")) score += 0.8;
    if (tags.has("power")) score += 0.6;
  }
  return score;
}

function dayTypeAlignmentScore(day: DayLabel, tags: Set<string>): number {
  switch (day) {
    case "Push":
      return ["press", "fly"].some((tag) => tags.has(tag)) ? 0.8 : 0;
    case "Pull":
      return tags.has("pull") ? 0.8 : 0;
    case "Upper":
      return ["press", "pull"].some((tag) => tags.has(tag)) ? 0.6 : 0;
    case "Lower":
    case "Legs":
      return ["squat", "hinge"].some((tag) => tags.has(tag)) ? 0.8 : 0;
    case "Arms":
      return ["curl", "extension"].some((tag) => tags.has(tag)) ? 0.9 : 0;
    case "Full Body":
      return tags.has("compound") ? 0.6 : 0;
    default:
      return 0;
  }
}

export interface GuidedSetupPlanResult {
  schedule: GuidedSetupScheduleDay[];
  program: UserProgram;
  templates: GuidedTemplateDraft[];
  volumeTargets: Record<MuscleGroup, number>;
}

export function buildGuidedSetupPlan(
  state: GuidedSetupState,
  exercises: Exercise[]
): GuidedSetupPlanResult {
  const schedule = suggestWeeklySplit(state);
  const volumeTargets = calculateVolumeTargets(state, schedule);
  const program = generateProgram(state, schedule);
  const templates = buildTemplateDrafts(
    state,
    schedule,
    exercises,
    volumeTargets
  );
  return { schedule, program, templates, volumeTargets };
}
