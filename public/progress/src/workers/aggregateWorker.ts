// Aggregate worker: precomputes heavy aggregates once and returns a bundle
// Input: { sessions, exercises, measurements }
// Output: { weeklyVolume, exercisePRs, weeklyPRCounts, lastComputed, version }

interface SetEntry {
  weightKg: number;
  reps: number;
}
interface SessionEntry {
  exerciseId: string;
  sets: SetEntry[];
}
interface Session {
  dateISO: string;
  entries: SessionEntry[];
  weekNumber: number;
  phaseNumber?: number;
  phase?: number;
}
interface Exercise {
  id: string;
  muscleGroup?: string;
  secondaryMuscles?: string[];
}
interface Measurement {
  dateISO: string;
  weightKg?: number;
}

const VERSION = 2; // bump when aggregate schema changes

const SECONDARY_FACTOR = 0.5; // must match app logic

function countValidSets(sets: SetEntry[]): number {
  let c = 0;
  for (const s of sets || []) {
    const reps = (s?.reps ?? 0) as number;
    const weight = (s?.weightKg ?? 0) as number;
    if (reps > 0 || weight > 0) c++;
  }
  return c;
}

function sanitizeMuscleList(list?: string[]): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

self.onmessage = (e: MessageEvent) => {
  const { sessions, exercises } = e.data as {
    sessions: Session[];
    exercises: Exercise[];
    measurements: Measurement[];
  };
  try {
    const exMap = new Map(exercises.map((e) => [e.id, e]));
    // weeklyVolume: map weekKey -> muscle -> weighted sets (primary + 0.5*secondary)
    const weeklyVolume: Record<string, Record<string, number>> = {};
    const exercisePRs: Record<string, { bestScore: number; est1RM: number }> =
      {};
    const weeklyPRCounts: Record<string, number> = {};
    sessions.forEach((s) => {
      const wkKey = `P${s.phaseNumber || s.phase || 1}-W${s.weekNumber || 1}`;
      const wRec = weeklyVolume[wkKey] || (weeklyVolume[wkKey] = {});
      s.entries.forEach((en) => {
        const ex = exMap.get(en.exerciseId);
        let bestSetScore = 0;
        let completedSets = 0;
        en.sets.forEach((st) => {
          const reps = st.reps || 0;
          const weight = st.weightKg || 0;
          const score = weight * reps;
          if (reps > 0 || weight > 0) {
            completedSets++;
          }
          if (score > 0) {
            bestSetScore = Math.max(bestSetScore, score);
          }
        });
        if (completedSets === 0) return;
        const primary = ex?.muscleGroup || "other";
        wRec[primary] = (wRec[primary] || 0) + completedSets;
        const secondaries = sanitizeMuscleList(ex?.secondaryMuscles);
        if (secondaries.length) {
          const secAdd = completedSets * SECONDARY_FACTOR;
          secondaries.forEach((sm) => {
            wRec[sm] = (wRec[sm] || 0) + secAdd;
          });
        }
        // PR tracking
        const prev = exercisePRs[en.exerciseId];
        if (bestSetScore > 0 && (!prev || bestSetScore > prev.bestScore)) {
          exercisePRs[en.exerciseId] = {
            bestScore: bestSetScore,
            est1RM: bestSetScore,
          }; // simple estimated 1RM proxy
          weeklyPRCounts[wkKey] = (weeklyPRCounts[wkKey] || 0) + 1;
        }
      });
    });
    (self as any).postMessage({
      weeklyVolume,
      exercisePRs,
      weeklyPRCounts,
      lastComputed: Date.now(),
      version: VERSION,
    });
  } catch (err: any) {
    (self as any).postMessage({
      error: err?.message || String(err),
      version: VERSION,
    });
  }
};
