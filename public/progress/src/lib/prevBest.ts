import { Session, SetEntry } from "./types";

export interface PrevBestLookup {
  [exerciseId: string]: { week: number; set: SetEntry };
}

// Build a map of best sets per exercise up to (but excluding) a target week within same phase.
// If no previous in current phase, fallback to earlier phases. If dayId provided, prefer matching day.
export function buildPrevBestMap(
  sessions: Session[],
  targetWeek: number,
  phase: number,
  dayId?: number
): PrevBestLookup {
  const map: PrevBestLookup = {};
  const curPhase = (s: Session) => (s.phaseNumber || s.phase || 1) === phase;
  const prevPhases = (s: Session) => (s.phaseNumber || s.phase || 1) < phase;
  const hasWork = (st: SetEntry) => ((st.weightKg || 0) > 0) || ((st.reps || 0) > 0);

  const byRecency = (a: Session, b: Session) =>
    (b.phaseNumber || b.phase || 1) - (a.phaseNumber || a.phase || 1) ||
    b.weekNumber - a.weekNumber;

  const pickFrom = (pool: Session[]) => {
    // Sort by phase desc, week desc; prefer same day if dayId supplied
    const sorted = [...pool].sort(byRecency);
    for (const sess of sorted) {
      // If dayId specified, skip non-matching sessions first pass
      if (dayId != null) {
        const sessDay = Number(String(sess.id).split('-')[2] || 0);
        if (sessDay !== dayId) continue;
      }
      for (const entry of sess.entries) {
        if (map[entry.exerciseId]) continue; // already filled with a more recent
        const best = [...entry.sets]
          .filter(hasWork)
          .sort((a, b) => {
            const bw = b.weightKg ?? 0;
            const aw = a.weightKg ?? 0;
            if (bw !== aw) return bw - aw;
            return (b.reps ?? 0) - (a.reps ?? 0);
          })[0];
        if (best) map[entry.exerciseId] = { week: sess.weekNumber, set: best };
      }
    }
    // If dayId restricted pass found nothing for some exercises, do a second pass ignoring day filter
    if (dayId != null) {
      const second = [...pool].sort(byRecency);
      for (const sess of second) {
        for (const entry of sess.entries) {
          if (map[entry.exerciseId]) continue;
          const best = [...entry.sets]
            .filter(hasWork)
            .sort((a, b) => {
              const bw = b.weightKg ?? 0;
              const aw = a.weightKg ?? 0;
              if (bw !== aw) return bw - aw;
              return (b.reps ?? 0) - (a.reps ?? 0);
            })[0];
          if (best) map[entry.exerciseId] = { week: sess.weekNumber, set: best };
        }
      }
    }
  };

  // Current phase, weeks before target
  const curPool = sessions.filter((s) => curPhase(s) && s.weekNumber < targetWeek);
  pickFrom(curPool);
  // Fallback to previous phases if still missing
  if (Object.keys(map).length === 0) {
    const older = sessions.filter(prevPhases);
    pickFrom(older);
  }
  return map;
}

export function getPrevBest(map: PrevBestLookup, exerciseId: string) {
  return map[exerciseId];
}
