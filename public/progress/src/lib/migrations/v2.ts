import type { IDBPDatabase, IDBPTransaction } from 'idb'

export async function migrateV2(db: IDBPDatabase<any>, tx: IDBPTransaction<any, string[]>) {
  // v2 migration: backfill settings.dashboardPrefs and exercise.isOptional
  try {
    if (db.objectStoreNames.contains('settings')) {
      const sStore = tx.objectStore('settings')
      const s = await sStore.get('app')
      if (s && !s.dashboardPrefs) {
        s.dashboardPrefs = { range: '8w' }
        await (sStore as any).put(s, 'app')
      }
    }
    if (db.objectStoreNames.contains('exercises')) {
      const eStore = tx.objectStore('exercises')
      // getAllKeys/getAll are available on idb stores
      const all: any[] = await eStore.getAll()
      for (const ex of all) {
        if (typeof ex.isOptional === 'undefined') {
          ex.isOptional = false
          await (eStore as any).put(ex)
        }
      }
    }
  } catch {
    // best-effort; ignore if environment doesn't support during upgrade
  }
}
