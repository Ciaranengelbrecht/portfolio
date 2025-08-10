import { Exercise, Measurement, Session, Settings, Template } from './types'
import { supabase } from './supabase'
import { sbUpsert, sbDelete, sbList, sbGet } from './sbData'

export interface DBSchema {
  exercises: Exercise
  sessions: Session
  measurements: Measurement
  settings: Settings
  templates: Template
}

function isTestEnv(){
  try {
    const node = typeof process !== 'undefined' && (process as any)?.env?.NODE_ENV === 'test'
    const vite = typeof import.meta !== 'undefined' && (import.meta as any)?.env?.MODE === 'test'
    return !!(node || vite)
  } catch (e) {
    return false
  }
}

// Minimal in-memory store used only when running unit tests (no Supabase auth)
const MEM: { [K in keyof DBSchema]: Map<string, any> } = {
  exercises: new Map(),
  sessions: new Map(),
  measurements: new Map(),
  settings: new Map(),
  templates: new Map(),
}

async function getOwnerId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) {
    if (isTestEnv()) return 'test-owner'
    throw new Error('Not signed in')
  }
  return id
}

export function isUsingLocalStorageFallback(){ return false }

export const db = {
  // No-op for cloud mode; realtime will notify pages to refresh
  async putFromSync<T extends any>(_store: keyof DBSchema, _value: any): Promise<void> { return },
  async deleteFromSync(_store: keyof DBSchema, _key: string) { return },

  async getAll<T = any>(store: keyof DBSchema): Promise<T[]> {
    if (isTestEnv()) {
      return Array.from(MEM[store].values()) as any
    }
    const rows = await sbList(store as any)
    return rows.map((r: any) => store === 'settings' ? ({ ...r.data, id: 'app' }) : r.data)
  },
  async get<T = any>(store: keyof DBSchema, key: string): Promise<T | undefined> {
    if (isTestEnv()) {
      return MEM[store].get(key)
    }
    const row = await sbGet(store as any, key)
    return row ? (store === 'settings' ? ({ ...row.data, id: 'app' } as any) : row.data) : undefined
  },
  async put<T extends any>(store: keyof DBSchema, value: any): Promise<void> {
    const id = value?.id ?? (store === 'settings' ? 'app' : undefined)
    if (!id) throw new Error('Missing id for put')
    if (isTestEnv()) {
      MEM[store].set(id, value)
      return
    }
    const owner = await getOwnerId()
    await sbUpsert(store as any, owner, id, value)
  },
  async delete(store: keyof DBSchema, key: string) {
    if (isTestEnv()) {
      MEM[store].delete(key)
      return
    }
    const owner = await getOwnerId()
    await sbDelete(store as any, owner, key)
  }
}
