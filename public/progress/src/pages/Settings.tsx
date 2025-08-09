import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import { Settings } from '../lib/types'
import { defaultSettings, defaultExercises, defaultTemplates } from '../lib/defaults'
import { supabase, clearAuthStorage } from '../lib/supabase'

export default function SettingsPage(){
  const [s, setS] = useState<Settings>(defaultSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ lastPull?: string; lastPush?: string; error?: string }>({})
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [userEmail, setUserEmail] = useState<string|undefined>()
  const [authChecked, setAuthChecked] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { (async () => {
    const current = await db.get<Settings>('settings','app')
    if (!current) {
      // seed
      await db.put('settings', { ...defaultSettings, id:'app' } as any)
      for (const e of defaultExercises) await db.put('exercises', e)
      for (const t of defaultTemplates) await db.put('templates', t)
      setS(defaultSettings)
  } else { setS(current) }
   })() }, [])

  useEffect(() => {
    // Track supabase auth state
    const sub = supabase.auth.onAuthStateChange(async (_evt: any, session: any) => {
      setUserEmail(session?.user?.email || undefined)
      setAuthChecked(true)
    })
    // get current session once
    let timer = setTimeout(() => setAuthChecked(true), 1500)
    supabase.auth.getSession()
      .then(({ data }: any) => {
        setUserEmail(data?.session?.user?.email || undefined)
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
      .finally(() => { clearTimeout(timer) })
    return () => { try { clearTimeout(timer) } catch {}; sub?.data?.subscription?.unsubscribe?.() }
  }, [])

  // Handle password recovery deep-links from Supabase (type=recovery in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    const type = params.get('type') || params.get('event')
    const isRecovery = type === 'recovery' || localStorage.getItem('sb_pw_reset') === '1'
    if (isRecovery) {
      try { localStorage.setItem('sb_pw_reset', '1') } catch {}
      // Inform user to set new password in the section below
      // Avoid alert loops by only showing once
      if (!sessionStorage.getItem('pw_reset_alert')) {
        alert('Enter a new password below to complete your reset.')
        sessionStorage.setItem('pw_reset_alert', '1')
      }
    }
  }, [])

  const save = async () => { await db.put('settings', { ...s, id:'app' } as any) }

  // testSync removed with Gist sync

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

  // Gist sync removed; Supabase sync is automatic

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
  <Toast open={!!toast} message={toast||''} onClose={()=>setToast(null)} />
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="mb-2">
          <div className="font-medium">Account (Supabase)</div>
          <div className="text-sm text-gray-400">Sign in to sync via Supabase. Offline still works; changes sync when you reconnect.</div>
          {!authChecked ? (
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">Checking session…</div>
          ) : userEmail ? (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-gray-300">Signed in as {userEmail}</span>
              <button className={`px-3 py-2 rounded-xl ${busy==='signout' ? 'bg-slate-600' : 'bg-slate-700 hover:bg-slate-600'}`} disabled={busy==='signout'} onClick={async ()=>{
                setBusy('signout')
                try { await supabase.auth.signOut({ scope: 'global' } as any); setToast('Signed out') } finally {
                  try { localStorage.removeItem('sb_pw_reset'); clearAuthStorage() } catch {}
                  // Verify session gone
                  try {
                    let tries = 0
                    while (tries++ < 10) {
                      const { data } = await supabase.auth.getSession()
                      if (!data.session) break
                      await new Promise(r => setTimeout(r, 100))
                    }
                  } catch {}
                  setUserEmail(undefined)
                  setBusy(null)
                }
              }}>Sign out</button>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              <input className="bg-slate-800 rounded-xl px-3 py-2 w-full" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
              <input className="bg-slate-800 rounded-xl px-3 py-2 w-full" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={async ()=>{
                  if(!email || !password) return alert('Enter email and password')
                  setBusy('signin')
                  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
                  if(error) alert('Sign-in error: ' + error.message)
                  else { setUserEmail(data.user?.email || email); setToast('Signed in') }
                  setBusy(null)
                }}>Sign in</button>
                <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={async ()=>{
                  if(!email || !password) return alert('Enter email and password')
                  if(password !== password2) return alert('Passwords do not match')
                  const redirectTo = window.location.origin + window.location.pathname
                  setBusy('signup')
                  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
                  if(error) alert('Sign-up error: ' + error.message)
                  else if (!data.session) alert('Check your email to confirm your account.')
                  else { setUserEmail(data.user?.email || email); setToast('Account created') }
                  setBusy(null)
                }}>Create account</button>
                <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={async ()=>{
                  if(!email) return alert('Enter your email')
                  const redirectTo = window.location.origin + window.location.pathname
                  setBusy('otp')
                  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
                  if(error) alert('Magic link error: ' + error.message)
                  else alert('Magic link sent. Check your email.')
                  setBusy(null)
                }}>Send magic link</button>
                <div className="flex items-center gap-2">
                  <input className="bg-slate-800 rounded-xl px-3 py-2" placeholder="OTP code" value={otp} onChange={e=>setOtp(e.target.value)} />
                  <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={async ()=>{
                    if(!email || !otp) return alert('Enter email and OTP code')
                    setBusy('verify')
                    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' as any })
                    if(error) alert('OTP error: ' + error.message)
                    else { setUserEmail(data?.user?.email || email); setToast('Signed in via OTP') }
                    setBusy(null)
                  }}>Verify OTP</button>
                </div>
                <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={async ()=>{
                  if(!email) return alert('Enter your email')
                  // Ensure the redirect points to the exact app entry so Supabase hashes are preserved
                  const base = window.location.origin + window.location.pathname
                  // If we're at /progress, send to /progress/dist/; if already /progress/dist, keep it
                  const redirectTo = base.includes('/dist') ? base : (base.replace(/\/?$/, '/') + 'dist/')
                  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
                  if (error) alert('Reset error: ' + error.message)
                  else alert('Password reset email sent. Check your inbox.')
                }}>Forgot password</button>
              </div>
              <input className="bg-slate-800 rounded-xl px-3 py-2 w-full" placeholder="Confirm password (for create)" type="password" value={password2} onChange={e=>setPassword2(e.target.value)} />
              <div className="text-xs text-gray-400">To use password sign-in, ensure Email provider is enabled in Supabase Authentication. If email confirmation is on, you’ll need to confirm via email after creating an account.</div>
            </div>
          )}
        </div>
        {/* Password recovery completion (when coming from email link) */}
        {(() => {
          const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
          const type = params.get('type') || params.get('event')
          const isRecovery = (type === 'recovery') || (localStorage.getItem('sb_pw_reset') === '1')
          if (isRecovery) {
            return (
              <div className="mt-2 space-y-2">
                <div className="text-sm text-gray-300">Reset your password</div>
                <input className="bg-slate-800 rounded-xl px-3 py-2 w-full" placeholder="New password" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
                <button className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl" onClick={async ()=>{
                   if(!newPassword) return alert('Enter a new password')
                   // Ensure Supabase has a valid session (from the email link hash) before updating
                   const { data } = await supabase.auth.getSession()
                   if (!data.session) {
                     alert('Recovery session not established yet. Please re-open the email link in this browser and try again.')
                     return
                   }
                   const { error } = await supabase.auth.updateUser({ password: newPassword })
                  if(error) alert('Could not set password: ' + error.message)
                  else {
                    alert('Password updated. You are now signed in.')
                    // Clean recovery params so refreshes are clean
                    const url = new URL(window.location.href)
                     // Some providers put tokens in hash; remove only after update
                     url.hash = ''
                    history.replaceState(null, '', url.toString())
                    try { localStorage.removeItem('sb_pw_reset') } catch {}
                  }
                }}>Set new password</button>
              </div>
            )
          }
          return null
        })()}
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
  {/* Cloud Sync (Gist) removed. Supabase sync runs automatically when signed in. */}
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

// lightweight inline snackbar for Settings page
function Toast({ open, message, onClose }:{ open:boolean; message:string; onClose:()=>void }){
  if (!open) return null
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50">
      <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2 shadow-soft text-sm">
        {message}
        <button className="ml-3 text-xs underline" onClick={onClose}>Dismiss</button>
      </div>
    </div>
  )
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
