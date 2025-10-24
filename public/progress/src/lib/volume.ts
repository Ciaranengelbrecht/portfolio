import { Exercise, Session } from "./types";
import { db } from "./db";

const SECONDARY_FACTOR = 0.5; // must match ProgramSettings allocator weight

export interface LoggedSetVolumeResult {
  perWeek: Record<number, Record<string, number>>; // week -> muscle -> weighted sets
  totals: Record<string, number>; // muscle -> weighted sets entire phase
  weeklyTotals: Record<number, number>; // week -> total weighted sets (all muscles)
}

export function countValidSets(entrySets: any[]): number {
  let c = 0;
  for (const s of entrySets || []) {
    if ((s.reps || 0) > 0 || (s.weightKg || 0) > 0) c++; // basic validity check
  }
  return c;
}

function addToStringMap(
  target: Record<string, number>,
  key: string,
  amount: number
) {
  if (!amount) return;
  target[key] = (target[key] || 0) + amount;
}

function addToNumberMap(
  target: Record<number, number>,
  key: number,
  amount: number
) {
  if (!amount) return;
  target[key] = (target[key] || 0) + amount;
}

function sanitizeMuscleList(list: Exercise["secondaryMuscles"]): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function computeLoggedSetVolume(
  phaseNumber?: number,
  deps?: { sessions?: Session[]; exercises?: Exercise[] }
): Promise<LoggedSetVolumeResult> {
  const [sessions, exercises] = await Promise.all([
    (async () => deps?.sessions || (await db.getAll<Session>("sessions")))(),
    (async () => deps?.exercises || (await db.getAll<Exercise>("exercises")))(),
  ]);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const perWeek: Record<number, Record<string, number>> = {};
  const totals: Record<string, number> = {};
  const weeklyTotals: Record<number, number> = {};
  for (const s of sessions) {
    const ph = s.phaseNumber || s.phase || 1;
    if (phaseNumber && ph !== phaseNumber) continue;
    const wk = s.weekNumber || 1;
    const wRec = perWeek[wk] || (perWeek[wk] = {});
    for (const entry of s.entries) {
      const ex = exMap.get(entry.exerciseId);
      if (!ex) continue;
      const validSets = countValidSets(entry.sets);
      if (!validSets) continue;
      const primary = ex.muscleGroup || "other";
      const secondaryMuscles = sanitizeMuscleList(ex.secondaryMuscles);
      const primaryContribution = validSets;
      addToStringMap(wRec, primary, primaryContribution);
      addToStringMap(totals, primary, primaryContribution);

      let weightedTotal = primaryContribution;
      if (secondaryMuscles.length) {
        const secondaryContribution = validSets * SECONDARY_FACTOR;
        for (const sm of secondaryMuscles) {
          addToStringMap(wRec, sm, secondaryContribution);
          addToStringMap(totals, sm, secondaryContribution);
          weightedTotal += secondaryContribution;
        }
      }
      addToNumberMap(weeklyTotals, wk, weightedTotal);
    }
  }
  return { perWeek, totals, weeklyTotals };
}
