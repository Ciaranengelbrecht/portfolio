import { Exercise, Session, SessionEntry, SetEntry, Template } from './types'
import { getDeloadPrescription, getSettings } from './helpers'
import { nanoid } from 'nanoid'

export interface ImportOptions { append: boolean; weekNumber: number; deloadWeeks?: Set<number> }

export async function importFromTemplate(session: Session, template: Template, exercises: Exercise[], opts: ImportOptions): Promise<Session> {
  const settings = await getSettings()
  const exMap = new Map(exercises.map(e => [e.id, e]))
  const makeSets = async (exId: string): Promise<SetEntry[]> => {
    // Program-aware deload: if week is in provided deloadWeeks, apply prescription
    if (opts.deloadWeeks && opts.deloadWeeks.has(opts.weekNumber)) {
      const dl = await getDeloadPrescription(exId, opts.weekNumber, { deloadWeeks: opts.deloadWeeks })
      if(!dl.inactive){
        const avgReps = 8
        return Array.from({ length: dl.targetSets }, (_, i) => ({ setNumber: i + 1, weightKg: dl.targetWeight, reps: avgReps }))
      }
    }
    const rows = Math.max(1, Math.min(6, settings.defaultSetRows ?? (exMap.get(exId)?.defaults.sets ?? 3)))
    return Array.from({ length: rows }, (_, i) => ({ setNumber: i + 1, weightKg: 0, reps: 0 }))
  }
  const newEntries: SessionEntry[] = []
  for (const exId of template.exerciseIds) {
    const entry: SessionEntry = { id: nanoid(), exerciseId: exId, sets: await makeSets(exId) }
    newEntries.push(entry)
  }
  const merged = opts.append ? [...(session.entries||[]), ...newEntries] : newEntries
  return { ...session, entries: merged }
}

// v7: remove artificial max phase; keep sane lower bound
export function clampPhase(n: number, min = 1) { return Math.max(min, Math.round(n)) }
