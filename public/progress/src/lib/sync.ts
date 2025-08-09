import { db } from './db'
import { Settings } from './types'

let pulling = false

function headers(token: string){
  return { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' }
}

function toPayload(blob: any){
  return JSON.stringify(blob, null, 2)
}

async function collectAll(){
  const [exercises, sessions, measurements, templates, settings] = await Promise.all([
    db.getAll('exercises'), db.getAll('sessions'), db.getAll('measurements'), db.getAll('templates'), db.get('settings','app')
  ])
  return { exercises, sessions, measurements, templates, settings }
}

export async function pullFromGist(cfg: NonNullable<Settings['cloudSync']>): Promise<boolean> {
  if (!cfg.enabled || !cfg.token || !cfg.gistId) return false
  try {
    pulling = true
    const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      headers: { ...headers(cfg.token), ...(cfg.etag ? { 'If-None-Match': cfg.etag } : {}) }
    })
    if (res.status === 304) return false // no changes
    if (!res.ok) return false
    const etag = res.headers.get('ETag') || undefined
    const data = await res.json()
    const file = data.files?.['liftlog.json']
    if (!file?.content) return false
    const json = JSON.parse(file.content)
    for (const e of json.exercises||[]) await db.put('exercises', e)
    for (const s of json.sessions||[]) await db.put('sessions', s)
    for (const m of json.measurements||[]) await db.put('measurements', m)
    if (json.settings) await db.put('settings', { ...json.settings, id:'app' })
    for (const t of json.templates||[]) await db.put('templates', t)
    const s = await db.get<Settings>('settings','app')
    await db.put('settings', { ...(s||{}), id:'app', cloudSync: { ...(s?.cloudSync||{}), provider:'gist', enabled:true, token: cfg.token, gistId: cfg.gistId, etag, lastPulledAt: new Date().toISOString() } })
    return true
  } finally {
    pulling = false
  }
  return false
}

export async function pushToGist(cfg: NonNullable<Settings['cloudSync']>) {
  if (!cfg.enabled || !cfg.token || pulling) return
  const body = await collectAll()
  const payload = {
    description: 'LiftLog backup',
    public: false,
    files: { 'liftlog.json': { content: toPayload(body) } }
  }
  if (cfg.gistId) {
    await fetch(`https://api.github.com/gists/${cfg.gistId}`, { method:'PATCH', headers: { ...headers(cfg.token), 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
  } else {
    const res = await fetch('https://api.github.com/gists', { method:'POST', headers: { ...headers(cfg.token), 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
    if (res.ok){
      const j = await res.json()
      const s = await db.get<Settings>('settings','app')
      await db.put('settings', { ...(s||{}), id:'app', cloudSync: { ...(s?.cloudSync||{}), provider:'gist', enabled:true, token: cfg.token, gistId: j.id } })
    }
  }
}

let debounceTimer: any
export async function syncDebounced(){
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    const s = await db.get<Settings>('settings','app')
    if (s?.cloudSync?.provider==='gist') await pushToGist(s.cloudSync!)
  }, 300)
}

let pollTimer: any
async function resolveGistId(token: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.github.com/gists?per_page=100', { headers: headers(token) })
    if (!res.ok) return
    const list = await res.json()
    const found = list.find((g: any) => g.files && g.files['liftlog.json'])
    return found?.id
  } catch { return }
}

export function startBackgroundPull(intervalMs = 5000) {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    const s = await db.get<Settings>('settings','app')
    if (s?.cloudSync?.provider==='gist' && s.cloudSync.enabled && s.cloudSync.token) {
      let cfg = s.cloudSync
      if (!cfg.gistId && cfg.token) {
        const id = await resolveGistId(cfg.token as string)
        if (id) {
          await db.put('settings', { ...(s||{}), id:'app', cloudSync: { ...cfg, gistId: id } })
          cfg = { ...cfg, gistId: id }
        }
      }
      if (cfg.gistId) await pullFromGist(cfg)
    }
  }, intervalMs)
}
