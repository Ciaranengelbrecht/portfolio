import { getPrevBest, type PrevBestLookup } from "./prevBest";
import type { SessionEntry, SetEntry } from "./types";

export type SetPrefill = Pick<SetEntry, "weightKg" | "reps" | "rpe">;

export function getNextSetPrefill(
  entry: SessionEntry,
  prevBestMap?: PrevBestLookup | null
): SetPrefill {
  const last = [...(entry.sets || [])]
    .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0))
    .slice(-1)[0];

  if (last) {
    return {
      weightKg: last.weightKg ?? null,
      reps: last.reps ?? null,
      rpe: last.rpe,
    };
  }

  const prevBest = prevBestMap
    ? getPrevBest(prevBestMap, entry.exerciseId)
    : null;
  return {
    weightKg: prevBest?.set.weightKg ?? null,
    reps: prevBest?.set.reps ?? null,
    rpe: prevBest?.set.rpe,
  };
}
