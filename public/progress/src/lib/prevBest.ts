import { Session, SetEntry } from "./types";

export interface PrevBestLookup {
  [exerciseId: string]: { week: number; set: SetEntry };
}

const getSessionPhase = (session: Session) => {
  const direct = Number(session.phaseNumber ?? session.phase ?? 1);
  if (Number.isFinite(direct)) return direct;
  const [phasePart] = (session.id || "").split("-");
  const fallback = Number(phasePart);
  return Number.isFinite(fallback) ? fallback : 1;
};

const getSessionWeek = (session: Session) => {
  const direct = Number(session.weekNumber);
  if (Number.isFinite(direct)) return direct;
  const [, weekPart] = (session.id || "").split("-");
  const fallback = Number(weekPart);
  return Number.isFinite(fallback) ? fallback : 1;
};

const getSessionDay = (session: Session) => {
  const direct = Number(session.scheduleOverride?.effectiveDayId);
  if (Number.isFinite(direct)) return direct;
  const parts = (session.id || "").split("-");
  const dayPart = parts.length >= 3 ? parts[2] : parts[1];
  const fallback = Number(dayPart);
  return Number.isFinite(fallback) ? fallback : 0;
};

const isBeforeTarget = (
  session: Session,
  targetPhase: number,
  targetWeek: number,
  targetDay?: number
) => {
  const phase = getSessionPhase(session);
  if (phase !== targetPhase) return phase < targetPhase;

  const week = getSessionWeek(session);
  if (week !== targetWeek) return week < targetWeek;

  if (targetDay == null) return false;
  return getSessionDay(session) < targetDay;
};

const byRecency = (a: Session, b: Session) => {
  const phaseDiff = getSessionPhase(b) - getSessionPhase(a);
  if (phaseDiff !== 0) return phaseDiff;
  const weekDiff = getSessionWeek(b) - getSessionWeek(a);
  if (weekDiff !== 0) return weekDiff;
  const dayDiff = getSessionDay(b) - getSessionDay(a);
  if (dayDiff !== 0) return dayDiff;
  const dateDiff = (Date.parse(b.dateISO) || 0) - (Date.parse(a.dateISO) || 0);
  if (dateDiff !== 0) return dateDiff;
  return (
    (Date.parse(b.updatedAt || "") || 0) -
    (Date.parse(a.updatedAt || "") || 0)
  );
};

const bestSet = (sets: SetEntry[]) =>
  [...sets]
    .filter((set) => (set.weightKg || 0) > 0 || (set.reps || 0) > 0)
    .sort((a, b) => {
      const weightDiff = (b.weightKg ?? 0) - (a.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return (b.reps ?? 0) - (a.reps ?? 0);
    })[0];

// Build previous bests from sessions before the active phase/week/day location.
// For each exercise, use the newest previous session that contains it, then pick
// the best set from that session by weight first, then reps.
export function buildPrevBestMap(
  sessions: Session[],
  targetWeek: number,
  phase: number,
  dayId?: number
): PrevBestLookup {
  const map: PrevBestLookup = {};

  const previousSessions = sessions
    .filter((session) => isBeforeTarget(session, phase, targetWeek, dayId))
    .sort(byRecency);

  for (const session of previousSessions) {
    for (const entry of session.entries || []) {
      if (map[entry.exerciseId]) continue;
      const best = bestSet(entry.sets || []);
      if (best) {
        map[entry.exerciseId] = {
          week: getSessionWeek(session),
          set: best,
        };
      }
    }
  }

  return map;
}

export function getPrevBest(map: PrevBestLookup, exerciseId: string) {
  return map[exerciseId];
}
