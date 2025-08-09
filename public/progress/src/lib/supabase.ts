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
