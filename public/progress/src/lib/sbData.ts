import { supabase } from './supabase'

type Table = 'exercises'|'sessions'|'measurements'|'templates'|'settings'

export async function sbUpsert(table: Table, owner: string, id: string, data: any){
  const { error } = await supabase.from(table).upsert({ id, owner, data }).eq('id', id)
  if(error) throw error
}

export async function sbDelete(table: Table, owner: string, id: string){
  const { error } = await supabase.from(table).delete().eq('id', id).eq('owner', owner)
  if(error) throw error
}

export async function sbGet(table: Table, id: string){
  const { data, error } = await supabase.from(table).select('id,data,owner,updated_at').eq('id', id).maybeSingle()
  if(error) throw error
  return data || null
}

export async function sbList(table: Table){
  const { data, error } = await supabase.from(table).select('id,data,owner,updated_at').order('updated_at', { ascending: true })
  if(error) throw error
  return data
}
