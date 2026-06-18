import type {
  Settings,
  UserProgram,
  WeekScheduleOverride,
  WeeklySplitDay,
} from "./types";

export function getWeekScheduleKey(
  programId: string | undefined,
  phaseNumber: number,
  weekNumber: number
) {
  return `${programId || "program"}:${Math.max(1, phaseNumber)}:${Math.max(
    1,
    weekNumber
  )}`;
}

export function getWeekScheduleOverrides(
  settings: Settings | null | undefined,
  program: Pick<UserProgram, "id"> | null | undefined,
  phaseNumber: number,
  weekNumber: number
): WeekScheduleOverride[] {
  const key = getWeekScheduleKey(program?.id, phaseNumber, weekNumber);
  const overrides = settings?.progress?.weekScheduleOverrides?.[key];
  return Array.isArray(overrides) ? overrides : [];
}

const cloneDay = (day: WeeklySplitDay): WeeklySplitDay => ({ ...day });

export function isTrainingDay(day?: WeeklySplitDay | null) {
  return !!day && day.type !== "Rest";
}

export function getPullForwardSourceDayId(
  split: WeeklySplitDay[],
  restDayId: number
) {
  if (!Number.isInteger(restDayId)) return null;
  if (restDayId < 0 || restDayId >= split.length) return null;
  if (isTrainingDay(split[restDayId])) return null;
  for (let index = restDayId + 1; index < split.length; index += 1) {
    if (isTrainingDay(split[index])) return index;
  }
  return null;
}

export function getPushBackRestTargetDayId(
  split: WeeklySplitDay[],
  workoutDayId: number
) {
  if (!Number.isInteger(workoutDayId)) return null;
  if (workoutDayId < 0 || workoutDayId >= split.length) return null;
  if (!isTrainingDay(split[workoutDayId])) return null;
  for (let index = workoutDayId + 1; index < split.length; index += 1) {
    if (!isTrainingDay(split[index])) return index;
  }
  return null;
}

export function getOverrideAffectedDayIds(
  baseSplit: WeeklySplitDay[],
  override: WeekScheduleOverride
): number[] {
  if (override.type === "day-swap") {
    const { fromDayId, toDayId } = override;
    if (
      !Number.isInteger(fromDayId) ||
      !Number.isInteger(toDayId) ||
      fromDayId < 0 ||
      toDayId < 0 ||
      fromDayId >= baseSplit.length ||
      toDayId >= baseSplit.length ||
      fromDayId === toDayId
    ) {
      return [];
    }
    return [fromDayId, toDayId];
  }

  const boundaryDayId =
    override.type === "pull-forward"
      ? getPullForwardSourceDayId(baseSplit, override.restDayId)
      : getPushBackRestTargetDayId(baseSplit, override.workoutDayId);
  if (boundaryDayId == null) return [];
  const startDayId =
    override.type === "pull-forward"
      ? override.restDayId
      : override.workoutDayId;
  const affected: number[] = [];
  for (let index = startDayId; index <= boundaryDayId; index += 1) {
    affected.push(index);
  }
  return affected;
}

export function applyWeekScheduleOverride(
  split: WeeklySplitDay[],
  override: WeekScheduleOverride
) {
  const next = split.map(cloneDay);
  if (override.type === "day-swap") {
    const affected = getOverrideAffectedDayIds(next, override);
    if (affected.length !== 2) return next;
    const [fromDayId, toDayId] = affected;
    const from = next[fromDayId];
    next[fromDayId] = next[toDayId];
    next[toDayId] = from;
    return next;
  }

  if (override.type === "pull-forward") {
    const sourceDayId = getPullForwardSourceDayId(next, override.restDayId);
    if (sourceDayId == null) return next;
    for (let index = override.restDayId; index < sourceDayId; index += 1) {
      next[index] = next[index + 1];
    }
    next[sourceDayId] = { type: "Rest" };
    return next;
  }

  const restDayId = getPushBackRestTargetDayId(next, override.workoutDayId);
  if (restDayId == null) return next;
  for (let index = restDayId; index > override.workoutDayId; index -= 1) {
    next[index] = next[index - 1];
  }
  next[override.workoutDayId] = { type: "Rest" };
  return next;
}

export function getEffectiveWeeklySplit(
  program: Pick<UserProgram, "id" | "weeklySplit"> | null | undefined,
  settings: Settings | null | undefined,
  phaseNumber: number,
  weekNumber: number
): WeeklySplitDay[] {
  const baseSplit = Array.isArray(program?.weeklySplit)
    ? program.weeklySplit.map(cloneDay)
    : [];
  if (!baseSplit.length) return [];

  return getWeekScheduleOverrides(settings, program, phaseNumber, weekNumber)
    .reduce(
      (split, override) => applyWeekScheduleOverride(split, override),
      baseSplit
    );
}

export function getBaseDayIdForEffectiveDay(
  baseSplit: WeeklySplitDay[],
  overrides: WeekScheduleOverride[],
  effectiveDayId: number
) {
  let mapping = baseSplit.map((_, index) => index);
  let split = baseSplit.map(cloneDay);

  for (const override of overrides) {
    if (override.type === "day-swap") {
      const affected = getOverrideAffectedDayIds(split, override);
      if (affected.length !== 2) continue;
      const [fromDayId, toDayId] = affected;
      const previous = mapping[fromDayId];
      mapping[fromDayId] = mapping[toDayId];
      mapping[toDayId] = previous;
      split = applyWeekScheduleOverride(split, override);
      continue;
    }

    if (override.type === "pull-forward") {
      const sourceDayId = getPullForwardSourceDayId(split, override.restDayId);
      if (sourceDayId == null) continue;
      for (let index = override.restDayId; index < sourceDayId; index += 1) {
        mapping[index] = mapping[index + 1];
      }
      mapping[sourceDayId] = sourceDayId;
      split = applyWeekScheduleOverride(split, override);
      continue;
    }

    const restDayId = getPushBackRestTargetDayId(split, override.workoutDayId);
    if (restDayId == null) continue;
    for (let index = restDayId; index > override.workoutDayId; index -= 1) {
      mapping[index] = mapping[index - 1];
    }
    mapping[override.workoutDayId] = override.workoutDayId;
    split = applyWeekScheduleOverride(split, override);
  }

  return mapping[effectiveDayId] ?? effectiveDayId;
}

export function getLatestOverrideForDay(
  baseSplit: WeeklySplitDay[],
  overrides: WeekScheduleOverride[],
  dayId: number
) {
  let match: WeekScheduleOverride | undefined;
  let split = baseSplit.map(cloneDay);
  for (const override of overrides) {
    const affected = getOverrideAffectedDayIds(split, override);
    if (affected.includes(dayId)) match = override;
    split = applyWeekScheduleOverride(split, override);
  }
  return match;
}
