import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// Helper: robustly clear Supabase auth storage for this project
export function clearAuthStorage() {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
    const keys = [
      `sb-${ref}-auth-token`,
      `sb-${ref}-provider-token`,
      'supabase.auth.token', // legacy
    ]
    for (const k of keys) localStorage.removeItem(k)
    // Best-effort sweep in case environment prefixes differ
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i) || ''
      if (k.startsWith('sb-') && k.includes(ref)) localStorage.removeItem(k)
    }
  } catch {}
}

// Force a quick session validation; returns current session or null
export async function refreshSessionNow(){
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    try { window.dispatchEvent(new CustomEvent('sb-auth', { detail: { session: data.session } })) } catch {}
    return data.session ?? null
  } catch { return null }
}

// Emit auth events globally for UI refetches
try {
  supabase.auth.onAuthStateChange((_evt, session) => {
    try { window.dispatchEvent(new CustomEvent('sb-auth', { detail: { session } })) } catch {}
  })
} catch {}

// Force refresh tokens if a session exists
export async function forceRefreshSession(){
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return null
    const res = await supabase.auth.refreshSession()
    try { window.dispatchEvent(new CustomEvent('sb-auth', { detail: { session: res.data.session } })) } catch {}
    return res.data.session
  } catch { return null }
}

// Wait for a valid session to be available (used to smooth over reload races)
export async function waitForSession(opts: { timeoutMs?: number; intervalMs?: number } = {}){
  const timeoutMs = opts.timeoutMs ?? 8000
  const intervalMs = opts.intervalMs ?? 200
  const start = Date.now()
  // Try fast path
  let { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  // Nudge refresh once
  await forceRefreshSession()
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return null
}
