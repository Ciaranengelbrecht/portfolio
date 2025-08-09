import { openDB, IDBPDatabase } from 'idb'
import { Exercise, Measurement, Session, Settings, Template } from './types'
import { migrateV2 } from './migrations/v2'
import { migrateV3 } from './migrations/v3'

const DB_NAME = 'liftlog'
const DB_VERSION = 3

export interface DBSchema {
  exercises: Exercise
  sessions: Session
  measurements: Measurement
  settings: Settings
  templates: Template
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null
let useLocal = false

export function getDB() {
  if (typeof indexedDB === 'undefined') {
    useLocal = true
  }
  if (!dbPromise && !useLocal) {
    dbPromise = openDB<DBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('measurements')) db.createObjectStore('measurements', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
    if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' })
  // run migrations for v2 -> v3
  migrateV2(db as any, tx as any)
  migrateV3(db as any, tx as any)
      }
    }).catch(() => { useLocal = true; return undefined as any })
  }
  return dbPromise!
}

function lsKey(store: string) { return `liftlog:${store}` }
function lsRead<T>(store: string): Record<string,T> {
  const raw = localStorage.getItem(lsKey(store))
  return raw ? JSON.parse(raw) : {}
}
function lsWrite<T>(store: string, data: Record<string,T>) {
  localStorage.setItem(lsKey(store), JSON.stringify(data))
}

export const db = {
  async getAll<T = any>(store: keyof DBSchema): Promise<T[]> {
    if (useLocal) {
      const obj = lsRead<T>(store)
      return Object.values(obj)
    }
    return (await getDB()).getAll(store as any)
  },
  async get<T = any>(store: keyof DBSchema, key: string): Promise<T | undefined> {
    if (useLocal) {
      const obj = lsRead<T>(store)
      return (obj as any)[key]
    }
    return (await getDB()).get(store as any, key)
  },
  async put<T extends any>(store: keyof DBSchema, value: any): Promise<void> {
    if (useLocal) {
      const obj = lsRead<any>(store)
      const k = value?.id ?? (store === 'settings' ? 'app' : undefined)
      if (!k) throw new Error('Missing key for localStorage put')
      obj[k] = value
      lsWrite(store, obj)
      return
    }
    const dbi = await getDB()
    if (store === 'settings') {
      await dbi.put(store as any, value as any, 'app')
    } else {
      await dbi.put(store as any, value as any)
    }
  },
  async delete(store: keyof DBSchema, key: string) {
    if (useLocal) {
      const obj = lsRead<any>(store)
      delete obj[key]
      lsWrite(store, obj)
      return
    }
    await (await getDB()).delete(store as any, key)
  }
}
