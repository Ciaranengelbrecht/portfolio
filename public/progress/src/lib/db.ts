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

async function getOwnerId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Not signed in')
  return id
}

export function isUsingLocalStorageFallback(){ return false }

export const db = {
  // No-op for cloud mode; realtime will notify pages to refresh
  async putFromSync<T extends any>(_store: keyof DBSchema, _value: any): Promise<void> { return },
  async deleteFromSync(_store: keyof DBSchema, _key: string) { return },

  async getAll<T = any>(store: keyof DBSchema): Promise<T[]> {
    const rows = await sbList(store as any)
    return rows.map((r: any) => store === 'settings' ? ({ ...r.data, id: 'app' }) : r.data)
  },
  async get<T = any>(store: keyof DBSchema, key: string): Promise<T | undefined> {
    const row = await sbGet(store as any, key)
    return row ? (store === 'settings' ? ({ ...row.data, id: 'app' } as any) : row.data) : undefined
  },
  async put<T extends any>(store: keyof DBSchema, value: any): Promise<void> {
    const owner = await getOwnerId()
    const id = value?.id ?? (store === 'settings' ? 'app' : undefined)
    if (!id) throw new Error('Missing id for put')
    await sbUpsert(store as any, owner, id, value)
  },
  async delete(store: keyof DBSchema, key: string) {
    const owner = await getOwnerId()
    await sbDelete(store as any, owner, key)
  }
}
