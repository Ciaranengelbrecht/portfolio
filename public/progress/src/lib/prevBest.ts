import { Session, SetEntry } from "./types";

export interface PrevBestLookup {
  [exerciseId: string]: { week: number; set: SetEntry };
}

// Build a map of best sets per exercise up to (but excluding) a target week within same phase
export function buildPrevBestMap(
  sessions: Session[],
  targetWeek: number,
  phase: number
): PrevBestLookup {
  const map: PrevBestLookup = {};
  const relevant = sessions.filter(
    (s) => (s.phaseNumber || s.phase) === phase && s.weekNumber < targetWeek
  );
  // Sort sessions descending by week to allow early fill
  relevant.sort((a, b) => b.weekNumber - a.weekNumber);
  for (const sess of relevant) {
    for (const entry of sess.entries) {
      if (map[entry.exerciseId]) continue; // already have more recent
      // Determine best set in this session (highest weight, tie reps)
      const best = [...entry.sets].sort((a, b) => {
        if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
        return (b.reps || 0) - (a.reps || 0);
      })[0];
      if (best) map[entry.exerciseId] = { week: sess.weekNumber, set: best };
    }
  }
  return map;
}

export function getPrevBest(map: PrevBestLookup, exerciseId: string) {
  return map[exerciseId];
}
