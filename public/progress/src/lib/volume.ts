import { Exercise, Session } from './types';
import { db } from './db';

const SECONDARY_FACTOR = 0.5; // must match ProgramSettings allocator weight

export interface LoggedSetVolumeResult {
  perWeek: Record<number, Record<string, number>>; // week -> muscle -> weighted sets
  totals: Record<string, number>; // muscle -> weighted sets entire phase
  weeklyTotals: Record<number, number>; // week -> total weighted sets (all muscles)
}

export function countValidSets(entrySets: any[]): number {
  let c = 0;
  for(const s of entrySets||[]) {
    if((s.reps||0) > 0 || (s.weightKg||0) > 0) c++; // basic validity check
  }
  return c;
}

export async function computeLoggedSetVolume(phaseNumber?: number): Promise<LoggedSetVolumeResult> {
  const [sessions, exercises] = await Promise.all([
    db.getAll<Session>('sessions'),
    db.getAll<Exercise>('exercises')
  ]);
  const exMap = new Map(exercises.map(e=> [e.id, e]));
  const perWeek: Record<number, Record<string, number>> = {};
  const totals: Record<string, number> = {};
  const weeklyTotals: Record<number, number> = {};
  for(const s of sessions){
    const ph = s.phaseNumber || s.phase || 1;
    if(phaseNumber && ph !== phaseNumber) continue;
    const wk = s.weekNumber || 1;
    const wRec = perWeek[wk] || (perWeek[wk] = {});
    for(const entry of s.entries){
      const ex = exMap.get(entry.exerciseId);
      if(!ex) continue;
      const validSets = countValidSets(entry.sets);
      if(!validSets) continue;
      const primary = ex.muscleGroup || 'other';
      wRec[primary] = (wRec[primary]||0) + validSets;
      totals[primary] = (totals[primary]||0) + validSets;
      if(ex.secondaryMuscles){
        for(const sm of ex.secondaryMuscles){
          wRec[sm] = (wRec[sm]||0) + validSets * SECONDARY_FACTOR;
          totals[sm] = (totals[sm]||0) + validSets * SECONDARY_FACTOR;
        }
      }
      weeklyTotals[wk] = (weeklyTotals[wk]||0) + validSets + (ex.secondaryMuscles? ex.secondaryMuscles.length * validSets * SECONDARY_FACTOR: 0);
    }
  }
  return { perWeek, totals, weeklyTotals };
}
