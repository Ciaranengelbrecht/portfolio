import type { IDBPDatabase, IDBPTransaction } from 'idb'

// v5: introduce Settings.themeV2 { key, customAccent?, prefersSystem? }
// Best-effort migration: if settings.theme exists, map to default-glass for dark, minimal-light for light.
export async function migrateV5(db: IDBPDatabase<any>, tx: IDBPTransaction<any, string[]>) {
  try {
    if (!db.objectStoreNames.contains('settings')) return
    const sStore = tx.objectStore('settings')
    const s = await sStore.get('app')
    if (!s) return
    if (!s.themeV2) {
      const legacy = s.theme as ('dark'|'light'|undefined)
      const key = legacy === 'light' ? 'minimal-light' : 'default-glass'
      s.themeV2 = { key }
      await (sStore as any).put(s, 'app')
    }
  } catch {
    // best-effort only
  }
}
