import { supabase } from './supabase'

type Table = 'exercises'|'sessions'|'measurements'|'templates'|'settings'

function storageKey(owner: string, id: string){ return `${owner}:${id}` }

export async function sbUpsert(table: Table, owner: string, id: string, data: any){
  const sk = storageKey(owner, id)
  // Prefer composite conflict target if available, fallback to legacy 'id'
  let { error } = await supabase.from(table).upsert({ id: sk, owner, data }, { onConflict: 'id,owner' as any })
  if (error && String(error.message || '').includes('no unique or exclusion constraint')) {
    const res = await supabase.from(table).upsert({ id: sk, owner, data }, { onConflict: 'id' })
    error = res.error as any
  }
  if (error) throw error
  // Cleanup legacy plain-id row to prevent duplicates
  await supabase.from(table).delete().eq('id', id).eq('owner', owner)
}

export async function sbDelete(table: Table, owner: string, id: string){
  const sk = storageKey(owner, id)
  // Delete both new and legacy keys
  const delNew = await supabase.from(table).delete().eq('id', sk).eq('owner', owner)
  const delOld = await supabase.from(table).delete().eq('id', id).eq('owner', owner)
  if(delNew.error) throw delNew.error
  if(delOld.error) throw delOld.error
}

export async function sbGet(table: Table, id: string){
  const { data: sess } = await supabase.auth.getSession()
  const owner = sess.session?.user?.id
  if (!owner) throw new Error('Not signed in')
  const sk = storageKey(owner, id)
  // Try new namespaced key first
  let { data, error } = await supabase
    .from(table)
    .select('id,data,owner,updated_at')
    .eq('id', sk)
    .eq('owner', owner)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  // Fallback: legacy plain id, migrate if found
  const legacy = await supabase
    .from(table)
    .select('id,data,owner,updated_at')
    .eq('id', id)
    .eq('owner', owner)
    .maybeSingle()
  if (legacy.error) throw legacy.error
  if (!legacy.data) return null
  // Migrate: write to namespaced id and remove old row
  const up = await supabase.from(table).upsert({ id: sk, owner, data: legacy.data.data }, { onConflict: 'id' })
  if (up.error) throw up.error
  await supabase.from(table).delete().eq('id', id).eq('owner', owner)
  return { ...legacy.data, id: sk }
}

export async function sbList(table: Table){
  const { data: sess } = await supabase.auth.getSession()
  const owner = sess.session?.user?.id
  if (!owner) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from(table)
    .select('id,data,owner,updated_at')
    .eq('owner', owner as any)
    .order('updated_at', { ascending: true })
  if(error) throw error
  return data
}
