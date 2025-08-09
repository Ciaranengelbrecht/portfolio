import type { IDBPDatabase, IDBPTransaction } from 'idb'

export async function migrateV3(db: IDBPDatabase<any>, tx: IDBPTransaction<any, string[]>) {
  try {
    // 1) Ensure settings.currentPhase exists
    if (db.objectStoreNames.contains('settings')) {
      const sStore = tx.objectStore('settings')
      const s = await sStore.get('app')
      if (s && typeof s.currentPhase === 'undefined') {
        s.currentPhase = 1
        await (sStore as any).put(s, 'app')
      }
    }

    // 2) Update sessions ids to include phase if not present; default phase=1
    if (db.objectStoreNames.contains('sessions')) {
      const store = tx.objectStore('sessions')
      const all: any[] = await store.getAll()
      for (const s of all) {
        if (!s) continue
        const hasPhaseInId = typeof s.id === 'string' && s.id.split('-').length === 3
        if (!hasPhaseInId) {
          const parts = String(s.id).split('-')
          const week = Number(parts[0]) || s.weekNumber || 1
          const day = Number(parts[1]) || 0
          s.phase = s.phase ?? 1
          s.phaseNumber = s.phaseNumber ?? s.phase
          s.weekNumber = week as any
          // new id: phase-week-day
          const newId = `${s.phase}-${week}-${day}`
          await (store as any).delete(s.id)
          s.id = newId
          await (store as any).put(s)
        } else if (typeof s.phase === 'undefined' || typeof s.phaseNumber === 'undefined') {
          // backfill phase from id
          const [ph] = String(s.id).split('-')
          s.phase = Number(ph) || 1
          s.phaseNumber = s.phaseNumber ?? s.phase
          await (store as any).put(s)
        }
      }
    }

    // 3) Add missing Upper C / Lower C templates if not present
    if (db.objectStoreNames.contains('templates') && db.objectStoreNames.contains('exercises')) {
      const tStore = tx.objectStore('templates')
      const eStore = tx.objectStore('exercises')
      const templates: any[] = await tStore.getAll()
      const hasUpperC = templates.some(t => t.name === 'Upper C')
      const hasLowerC = templates.some(t => t.name === 'Lower C')
      if (!hasUpperC || !hasLowerC) {
        const ex: any[] = await eStore.getAll()
        const idByName = new Map(ex.map(e => [e.name, e.id]))
        const make = (name: string, names: string[]) => ({ id: crypto.randomUUID?.() || `${Date.now()}-${name}` , name, exerciseIds: names.map(n => idByName.get(n)).filter(Boolean) })
        const upperANames = ['Incline DB Press','Pec Deck','Cable Row','Lat Pulldown/Pull-ups','Triceps Pushdown','Overhead Extension','Bayesian Curl','Lateral Raise']
        const lowerANames = ['Seated Leg Curl','Leg Press/Hack Squat','Leg Press Calf Raise','Leg Extension','Abs (Cable Crunch or Leg Raises)']
        if (!hasUpperC) await (tStore as any).put(make('Upper C', upperANames))
        if (!hasLowerC) await (tStore as any).put(make('Lower C', lowerANames))
      }
    }
  } catch {
    // best-effort
  }
}
