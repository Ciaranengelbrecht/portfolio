import { Exercise, Session, SessionEntry, SetEntry, Template } from "./types";
import { getDeloadPrescription, getSettings } from "./helpers";
import { nanoid } from "nanoid";

export interface ImportOptions {
  append: boolean;
  weekNumber: number;
  deloadWeeks?: Set<number>;
}

export async function importFromTemplate(
  session: Session,
  template: Template,
  exercises: Exercise[],
  opts: ImportOptions
): Promise<Session> {
  const settings = await getSettings();
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  // Preload shared datasets once if deload prescriptions will be computed
  let preload: { sessions?: Session[]; exercises?: Exercise[]; settings?: any } | undefined;
  if (opts.deloadWeeks && opts.deloadWeeks.has(opts.weekNumber)) {
    const sessions = await import('./db').then(m=> m.db.getAll<Session>('sessions'));
    preload = { sessions, exercises, settings };
  }
  const makeSets = async (exId: string): Promise<SetEntry[]> => {
    // Check template plan override first
    const planEntry = template.plan?.find(p=> p.exerciseId === exId);
    if (opts.deloadWeeks && opts.deloadWeeks.has(opts.weekNumber)) {
      const dl = await getDeloadPrescription(exId, opts.weekNumber, {
        deloadWeeks: opts.deloadWeeks,
      }, preload);
      if (!dl.inactive) {
        const avgReps = 8;
        return Array.from({ length: dl.targetSets }, (_, i) => ({
          setNumber: i + 1,
          weightKg: dl.targetWeight,
          reps: avgReps,
        }));
      }
    }
  const plannedRows = planEntry?.plannedSets;
  const fallbackRows = settings.defaultSetRows ?? exMap.get(exId)?.defaults.sets ?? 3;
  const rows = Math.max(1, Math.min(12, plannedRows || fallbackRows));
  // Use null so inputs appear blank; suggestions / placeholders supply guidance.
  return Array.from({ length: rows }, (_, i) => ({ setNumber: i + 1, weightKg: null, reps: null } as SetEntry));
  };
  const newEntries: SessionEntry[] = [];
  for (const exId of template.exerciseIds) {
    const planEntry = template.plan?.find(p=> p.exerciseId === exId);
    const entry: SessionEntry = {
      id: nanoid(),
      exerciseId: exId,
      sets: await makeSets(exId),
      targetRepRange: planEntry?.repRange || exMap.get(exId)?.defaults.targetRepRange,
    };
    newEntries.push(entry);
  }
  const merged = opts.append
    ? [...(session.entries || []), ...newEntries]
    : newEntries;
  return { ...session, entries: merged };
}

// v7: remove artificial max phase; keep sane lower bound
export function clampPhase(n: number, min = 1) {
  return Math.max(min, Math.round(n));
}
