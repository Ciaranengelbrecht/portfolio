import { Exercise, Session, SessionEntry, Template } from "./types";
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
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const newEntries: SessionEntry[] = [];
  for (const exId of template.exerciseIds) {
    const planEntry = template.plan?.find(p=> p.exerciseId === exId);
    const entry: SessionEntry = {
      id: nanoid(),
      exerciseId: exId,
      sets: [],
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
