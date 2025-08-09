import { supabase } from './supabase'
import { db } from './db'
import { sbUpsert, sbDelete, sbList } from './sbData'

type Table = 'exercises'|'sessions'|'measurements'|'templates'|'settings'
type PendingOp = { table: Table; type: 'upsert'|'delete'; id: string; data?: any }

const PENDING_KEY = 'liftlog:pendingOps'
let pushTimer: any

function readQueue(): PendingOp[]{
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)||'[]') } catch { return [] }
}
function writeQueue(q: PendingOp[]){ localStorage.setItem(PENDING_KEY, JSON.stringify(q)) }

export function enqueueUpsert(table: Table, id: string, data: any){
  const q = readQueue()
  const filtered = q.filter(op => !(op.table===table && op.id===id))
  filtered.push({ table, type:'upsert', id, data })
  writeQueue(filtered)
}
export function enqueueDelete(table: Table, id: string){
  const q = readQueue().filter(op => !(op.table===table && op.id===id))
  q.push({ table, type:'delete', id })
  writeQueue(q)
}

async function getOwnerId(): Promise<string|undefined> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id
}

export async function pushLocalChanges(){
  const owner = await getOwnerId()
  if(!owner) return
  let q = readQueue()
  if(!q.length) return
  const next: PendingOp[] = []
  for (const op of q){
    try {
      if(op.type==='upsert') await sbUpsert(op.table, owner, op.id, op.data)
      else await sbDelete(op.table, owner, op.id)
    } catch { next.push(op) }
  }
  writeQueue(next)
}

export function schedulePush(){
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushLocalChanges() }, 1500)
}

export async function fullPull(){
  const owner = await getOwnerId()
  if(!owner) return
  const tables: Table[] = ['exercises','sessions','measurements','templates','settings']
  for (const t of tables){
    const rows = await sbList(t)
    for (const row of rows){
      const data = (row as any).data
      if (t==='settings') await db.put('settings', { ...data, id:'app' })
      else await db.put(t as any, data)
    }
  }
}

export function initSupabaseSync(){
  supabase.auth.onAuthStateChange(async (_evt: any, session: any) => {
    if(session?.user){
      await fullPull()
      await pushLocalChanges()
      startRealtime()
    }
  })
  supabase.auth.getSession().then(async ({ data }: any) => {
    if (data?.session?.user){
      await fullPull()
      await pushLocalChanges()
      startRealtime()
    }
  })
  const onOnline = async () => { await pushLocalChanges(); await fullPull() }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onOnline() })
}

let realtimeStarted = false
function startRealtime(){
  if (realtimeStarted) return
  realtimeStarted = true
  const tables: Table[] = ['exercises','sessions','measurements','templates','settings']
  tables.forEach(t => {
    supabase.channel(`rt-${t}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: t }, async (payload: any) => {
        const row = payload.new || payload.old
        if (!row) return
        const data = row.data
        if (payload.eventType === 'DELETE') {
          await db.delete(t as any, row.id)
        } else {
          if (t==='settings') await db.put('settings', { ...data, id:'app' })
          else await db.put(t as any, data)
        }
      })
      .subscribe()
  })
}
