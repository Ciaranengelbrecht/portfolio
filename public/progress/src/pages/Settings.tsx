import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import { Settings } from '../lib/types'
import { defaultSettings, defaultExercises, defaultTemplates } from '../lib/defaults'

export default function SettingsPage(){
  const [s, setS] = useState<Settings>(defaultSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const [token, setToken] = useState('')
  const [gistId, setGistId] = useState('')
  const [status, setStatus] = useState<{ lastPull?: string; lastPush?: string; error?: string }>({})

  useEffect(() => { (async () => {
    const current = await db.get<Settings>('settings','app')
    if (!current) {
      // seed
      await db.put('settings', { ...defaultSettings, id:'app' } as any)
      for (const e of defaultExercises) await db.put('exercises', e)
      for (const t of defaultTemplates) await db.put('templates', t)
      setS(defaultSettings)
    } else { setS(current); setToken(current.cloudSync?.token||''); setGistId(current.cloudSync?.gistId||''); setStatus({ lastPull: current.cloudSync?.lastPulledAt, lastPush: current.cloudSync?.lastPushedAt, error: current.cloudSync?.lastError }) }
   })() }, [])

  const save = async () => {
    await db.put('settings', { ...s, id:'app', cloudSync: token ? { provider:'gist', enabled:true, token, gistId: gistId||undefined } : undefined } as any)
  }

  const testSync = async () => {
    const ss = await db.get<Settings>('settings','app')
    if (!ss?.cloudSync?.token) return alert('Set token first')
    const mod = await import('../lib/sync')
    const ok = await mod.pushToGist({ ...ss.cloudSync!, enabled: true }) as any
    const pulled = await mod.pullFromGist({ ...ss.cloudSync!, enabled: true })
    const now = new Date().toISOString()
    const refreshed = await db.get<Settings>('settings','app')
    setStatus({ lastPull: refreshed?.cloudSync?.lastPulledAt || (pulled? now: undefined), lastPush: refreshed?.cloudSync?.lastPushedAt || (ok? now: undefined), error: refreshed?.cloudSync?.lastError })
    alert(`Push: ${ok ? 'OK' : 'Fail'}; Pull: ${pulled ? 'Changed' : 'No change/Fail'}`)
  }

  const exportData = async () => {
    const [exercises, sessions, measurements, templates, settings] = await Promise.all([
      db.getAll('exercises'), db.getAll('sessions'), db.getAll('measurements'), db.getAll('templates'), db.get('settings','app')
    ])
    const json = JSON.stringify({ exercises, sessions, measurements, templates, settings }, null, 2)
    download('liftlog.json', json, 'application/json')
    // CSVs
    const msCsv = ['dateISO,weightKg,neck,chest,waist,hips,thigh,calf,upperArm,forearm', ...measurements.map((m:any)=>[
      m.dateISO,m.weightKg||'',m.neck||'',m.chest||'',m.waist||'',m.hips||'',m.thigh||'',m.calf||'',m.upperArm||'',m.forearm||''
    ].join(','))].join('\n')
    download('measurements.csv', msCsv, 'text/csv')
    const ssCsv = ['id,dateISO,phase,weekNumber,templateId,dayName,exerciseId,setNumber,weightKg,reps,notes',
      ...sessions.flatMap((s:any) => s.entries.flatMap((e:any) => e.sets.map((set:any) => [
        s.id,s.dateISO,s.phase||'',s.weekNumber,s.templateId||'',s.dayName||'',e.exerciseId,set.setNumber,set.weightKg,set.reps,(e.notes||'').replaceAll(',',';')
      ].join(','))))
    ].join('\n')
    download('sessions.csv', ssCsv, 'text/csv')
  }

  const pullCloud = async () => {
    const ss = await db.get<Settings>('settings','app')
    if (!ss?.cloudSync?.token || !ss.cloudSync.enabled) return alert('Set token and save first')
    const mod = await import('../lib/sync')
    const changed = await mod.pullFromGist(ss.cloudSync)
    const refreshed = await db.get<Settings>('settings','app')
    setStatus({ lastPull: refreshed?.cloudSync?.lastPulledAt, lastPush: refreshed?.cloudSync?.lastPushedAt, error: refreshed?.cloudSync?.lastError })
    alert(changed? 'Pulled updates' : 'No changes or failed')
  }
  const pushCloud = async () => {
    const ss = await db.get<Settings>('settings','app')
    if (!ss?.cloudSync?.token || !ss.cloudSync.enabled) return alert('Set token and save first')
    const mod = await import('../lib/sync')
    const ok = await mod.pushToGist(ss.cloudSync)
    const refreshed = await db.get<Settings>('settings','app')
    setStatus({ lastPull: refreshed?.cloudSync?.lastPulledAt, lastPush: refreshed?.cloudSync?.lastPushedAt, error: refreshed?.cloudSync?.lastError })
    alert(ok? 'Pushed' : 'Push failed')
  }

  const importData = async (file: File) => {
    const text = await file.text()
    const json = JSON.parse(text)
    for (const e of json.exercises||[]) await db.put('exercises', e)
    for (const s of json.sessions||[]) await db.put('sessions', s)
    for (const m of json.measurements||[]) await db.put('measurements', m)
    for (const t of json.templates||[]) await db.put('templates', t)
    if (json.settings) await db.put('settings', { ...json.settings, id:'app' })
    alert('Imported')
  }

  const resetData = async () => {
    for (const k of ['exercises','sessions','measurements','templates'] as const){
      const items = await db.getAll<any>(k)
      for (const it of items) await db.delete(k, (it as any).id)
    }
    await db.put('settings', { ...defaultSettings, id:'app' } as any)
    location.reload()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Units</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={s.unit} onChange={e=>setS({...s, unit: e.target.value as any})}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Theme</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={s.theme} onChange={e=>setS({...s, theme: e.target.value as any})}>
              <option value="dark">dark</option>
              <option value="light">light</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Deload load %</div>
            <input className="bg-slate-800 rounded-xl px-3 py-2" inputMode="decimal" value={Math.round(s.deloadDefaults.loadPct*100)} onChange={e=>setS({...s, deloadDefaults: { ...s.deloadDefaults, loadPct: Number(e.target.value)/100 }})} />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Deload set %</div>
            <input className="bg-slate-800 rounded-xl px-3 py-2" inputMode="decimal" value={Math.round(s.deloadDefaults.setPct*100)} onChange={e=>setS({...s, deloadDefaults: { ...s.deloadDefaults, setPct: Number(e.target.value)/100 }})} />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Start Page</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={s.dashboardPrefs?.startPage||'last'} onChange={e=>setS({...s, dashboardPrefs: { ...(s.dashboardPrefs||{}), startPage: e.target.value as any }})}>
              <option value="last">Last Session</option>
              <option value="dashboard">Dashboard</option>
              <option value="sessions">Sessions</option>
              <option value="measurements">Measurements</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Open to last session</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={String(s.dashboardPrefs?.openToLast ?? true)} onChange={e=>setS({...s, dashboardPrefs: { ...(s.dashboardPrefs||{}), openToLast: e.target.value==='true' }})}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Accent Color</div>
            <input type="color" className="bg-slate-800 rounded-xl px-3 py-2 h-10" value={s.accentColor||'#22c55e'} onChange={e=>{ const v=e.target.value; setS({...s, accentColor: v}); document.documentElement.style.setProperty('--accent', v) }} />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Card Style</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={s.cardStyle||'glass'} onChange={e=>{ const v=e.target.value as any; setS({...s, cardStyle: v}); document.documentElement.setAttribute('data-card-style', v) }}>
              <option value="glass">Glass</option>
              <option value="solid">Solid</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Auto-advance session</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={String(s.autoAdvanceSession??false)} onChange={e=>setS({...s, autoAdvanceSession: e.target.value==='true'})}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Default set rows per exercise</div>
            <input className="bg-slate-800 rounded-xl px-3 py-2" inputMode="numeric" value={s.defaultSetRows??3} onChange={e=>{ const v=e.target.value; if(!/^\d*$/.test(v)) return; const n=Math.max(1,Math.min(6,Number(v||'3'))); setS({...s, defaultSetRows: n}) }} />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Measurement units</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={s.measurementUnits||'metric'} onChange={e=>setS({...s, measurementUnits: e.target.value as any})}>
              <option value="metric">cm / kg</option>
              <option value="imperial">in / lb</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Privacy: unlock</div>
            <select className="bg-slate-800 rounded-xl px-3 py-2" value={s.privacyUnlockMode||'everyLaunch'} onChange={e=>setS({...s, privacyUnlockMode: e.target.value as any})}>
              <option value="everyLaunch">Require passcode every launch</option>
              <option value="remember24h">Remember unlock for 24h</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl" onClick={save}>Save</button>
          <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={exportData}>Export JSON & CSV</button>
          <input type="file" hidden ref={fileRef} accept="application/json" onChange={e=>{ const f=e.target.files?.[0]; if(f) importData(f) }} />
          <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={()=>fileRef.current?.click()}>Import JSON</button>
          <button className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-xl" onClick={resetData}>Reset data</button>
        </div>
        <div className="mt-4 border-t border-slate-700 pt-3 space-y-2">
          <div className="font-medium">Cloud Sync (GitHub Gist)</div>
          <div className="text-sm text-gray-400">Store an encrypted backup in your private Gist. Use a token with gist scope. Leave Gist ID blank to create one on first push.</div>
          <div className="grid grid-cols-2 gap-3">
            <input className="bg-slate-800 rounded-xl px-3 py-2" placeholder="GitHub token" value={token} onChange={e=>setToken(e.target.value)} />
            <input className="bg-slate-800 rounded-xl px-3 py-2" placeholder="Gist ID (optional)" value={gistId} onChange={e=>setGistId(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={pullCloud}>Pull</button>
            <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={pushCloud}>Push</button>
            <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={testSync}>Test</button>
          </div>
          <div className="text-xs text-gray-400">
            Last Pull: {status.lastPull || '—'} | Last Push: {status.lastPush || '—'} {status.error ? `| Error: ${status.error}` : ''}
          </div>
        </div>
      </div>

      <ExerciseOverrides />
    </div>
  )
}

function download(name: string, content: string, type: string){
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function ExerciseOverrides(){
  const [list, setList] = useState<any[]>([])
  useEffect(() => { (async () => setList(await db.getAll('exercises')))() }, [])
  const save = async (i:number, k:'deloadLoadPct'|'deloadSetPct', v:number) => {
    const ex = list[i]
    const updated = { ...ex, defaults: { ...ex.defaults, [k]: v } }
    await db.put('exercises', updated)
    setList(list.map((e,idx)=> idx===i? updated: e))
  }
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
      <div className="font-medium">Exercise deload overrides</div>
      <div className="text-sm text-gray-400">Set specific deload % for load and sets. Leave blank to use global defaults.</div>
      <div className="grid gap-2">
        {list.map((ex,i)=> (
          <div key={ex.id} className="grid grid-cols-3 gap-2 items-center">
            <div className="truncate">{ex.name}</div>
            <input aria-label="Load %" className="bg-slate-800 rounded-xl px-3 py-2" placeholder="Load %" value={Math.round((ex.defaults.deloadLoadPct?? NaN)*100) || ''} onChange={e=>save(i,'deloadLoadPct', Number(e.target.value)/100)} />
            <input aria-label="Set %" className="bg-slate-800 rounded-xl px-3 py-2" placeholder="Set %" value={Math.round((ex.defaults.deloadSetPct?? NaN)*100) || ''} onChange={e=>save(i,'deloadSetPct', Number(e.target.value)/100)} />
          </div>
        ))}
      </div>
    </div>
  )
}
