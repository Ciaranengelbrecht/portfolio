import { Session, SetEntry } from "./types";

export interface PrevBestLookup {
  [exerciseId: string]: { week: number; set: SetEntry };
}

export interface PrevBestOptions {
  activeSessionId?: string | null;
}

const getSessionWeek = (session: Session) => {
  const direct = Number(session.weekNumber);
  if (Number.isFinite(direct)) return direct;
  const [, weekPart] = (session.id || "").split("-");
  const fallback = Number(weekPart);
  return Number.isFinite(fallback) ? fallback : 1;
};

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sessionRecency = (session: Session) =>
  Math.max(
    toTimestamp(session.loggedEndAt),
    toTimestamp(session.dateISO),
    session.localDate ? toTimestamp(`${session.localDate}T00:00:00`) : 0,
    toTimestamp(session.updatedAt),
    toTimestamp(session.createdAt)
  );

const byRecency = (a: Session, b: Session) =>
  sessionRecency(b) - sessionRecency(a);

const bestSet = (sets: SetEntry[]) =>
  [...sets]
    .filter((set) => (set.weightKg || 0) > 0 || (set.reps || 0) > 0)
    .sort((a, b) => {
      const weightDiff = (b.weightKg ?? 0) - (a.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return (b.reps ?? 0) - (a.reps ?? 0);
    })[0];

// Build bests from the latest filled historical session for each exercise.
// Blank/skipped sessions are ignored, and the active session is excluded so the
// current workout cannot source its own just-added rows.
export function buildPrevBestMap(
  sessions: Session[],
  _targetWeek?: number,
  _phase?: number,
  _dayId?: number,
  options?: PrevBestOptions
): PrevBestLookup {
  const map: PrevBestLookup = {};
  const activeSessionId = options?.activeSessionId || null;

  const previousSessions = sessions
    .filter((session) => session.id && session.id !== activeSessionId)
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
