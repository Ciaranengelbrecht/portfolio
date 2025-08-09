import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { getSettings, setSettings } from './lib/helpers'
import { initSupabaseSync } from './lib/supabaseSync'
import { ThemeProvider, useTheme } from './lib/theme'
import { registerSW } from './lib/pwa'
import { supabase, clearAuthStorage } from './lib/supabase'
import AuthModal from './components/AuthModal'
import BackgroundFX from './components/BackgroundFX'
import BigFlash from './components/BigFlash'

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'))
const Sessions = lazy(() => import('./pages/Sessions'))
const Measurements = lazy(() => import('./pages/Measurements'))
const Templates = lazy(() => import('./pages/Templates'))
const Settings = lazy(() => import('./pages/Settings'))

function Shell() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const locationRef = useLocation()
  const [authChecked, setAuthChecked] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [bigFlash, setBigFlash] = useState<string | null>(null)
  // Auto-dismiss small toast notifications
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!bigFlash) return
    const t = setTimeout(() => setBigFlash(null), 1800)
    return () => clearTimeout(t)
  }, [bigFlash])
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  useEffect(() => { registerSW() }, [])
  useEffect(() => { (async () => {
    const s = await getSettings()
    // apply accent and card style
    const root = document.documentElement
    if (s.accentColor) root.style.setProperty('--accent', s.accentColor)
    if (s.cardStyle) root.setAttribute('data-card-style', s.cardStyle)
  })() }, [])
  // Initialize Supabase sync (pull, push queue, realtime)
  useEffect(() => { initSupabaseSync() }, [])

  // If user opens a Supabase password recovery link, mark the flow and navigate AFTER session exists
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    const type = params.get('type') || params.get('event')
    if (type === 'recovery') {
      try { localStorage.setItem('sb_pw_reset', '1') } catch {}
    }

    let stopped = false
    const maybeRouteToSettings = async () => {
      const flagged = localStorage.getItem('sb_pw_reset') === '1'
      if (!flagged) return
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        navigate('/settings')
        return true
      }
      return false
    }

    // Listen for auth changes and route when a session is ready
    const sub = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (localStorage.getItem('sb_pw_reset') === '1' && session) {
        navigate('/settings')
      }
    })

    // Poll briefly as a fallback in case session arrives before listener
    let tries = 0
    const timer = setInterval(async () => {
      if (stopped) return
      const done = await maybeRouteToSettings()
      if (done || ++tries > 25) { // ~5s
        clearInterval(timer)
      }
    }, 200)

    return () => { stopped = true; clearInterval(timer); sub.data.subscription.unsubscribe() }
  }, [])

  // Global auth indicator: keep a lightweight session state
  useEffect(() => {
    let timer: any = setTimeout(() => setAuthChecked(true), 1500)
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthEmail(session?.user?.email ?? null)
      setAuthChecked(true)
    })
    supabase.auth.getSession()
      .then(({ data }) => {
        setAuthEmail(data?.session?.user?.email ?? null)
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
      .finally(() => clearTimeout(timer))
    return () => { try { clearTimeout(timer) } catch {}; sub?.data?.subscription?.unsubscribe?.() }
  }, [])

  // Supabase sync handles online/visibility internally now
  useEffect(() => { (async () => {
    const s = await getSettings()
    const start = s.dashboardPrefs?.startPage || (s.dashboardPrefs?.openToLast ? 'last' : 'dashboard')
  const loc = locationRef.pathname
    // Only auto-navigate on first load when at root path
    if (loc === '/' || loc === ''){
      if (start === 'last' && s.dashboardPrefs?.openToLast !== false && s.dashboardPrefs?.lastLocation) {
        navigate('/sessions')
      } else if (start === 'sessions') navigate('/sessions')
      else if (start === 'measurements') navigate('/measurements')
      else if (start === 'dashboard') navigate('/')
    }
  })() }, [])

  const Tab = ({ to, label }: { to: string; label: string }) => (
    <NavLink to={to} className={({ isActive }) => `px-3 py-2 rounded-2xl text-sm ${isActive ? 'bg-card text-white' : 'text-gray-300'}`}>{label}</NavLink>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundFX />
      <header className="sticky top-0 z-10 backdrop-blur bg-bg/70 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">LiftLog</h1>
          <div className="flex items-center gap-3">
            <nav className="flex gap-2 overflow-x-auto">
              <Tab to="/" label="Dashboard" />
              <Tab to="/sessions" label="Sessions" />
              <Tab to="/measurements" label="Measurements" />
              <Tab to="/templates" label="Templates" />
              <Tab to="/settings" label="Settings" />
            </nav>
            <div className="flex items-center gap-2">
              {!authChecked ? (
                <span className="text-xs text-gray-400">…</span>
              ) : authEmail ? (
                <>
                  <span className="text-xs text-emerald-400">Signed in</span>
                  <button
                    className={`px-2 py-1 rounded-lg text-xs ${signingOut ? 'bg-slate-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    disabled={signingOut}
                    onClick={async () => {
                      setSigningOut(true)
                      try {
                        await supabase.auth.signOut({ scope: 'global' } as any)
                      } finally {
                        try { localStorage.removeItem('sb_pw_reset'); clearAuthStorage() } catch {}
                        // Double-check session is gone
                        try {
                          let tries = 0
                          while (tries++ < 10) {
                            const { data } = await supabase.auth.getSession()
                            if (!data.session) break
                            await new Promise(r => setTimeout(r, 100))
                          }
                        } catch {}
                        setAuthEmail(null)
                        navigate('/')
                        setSigningOut(false)
                        setToast('Signed out')
                        setBigFlash('Signed out successfully')
                      }
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  className="bg-slate-700 px-2 py-1 rounded-lg text-xs"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
  <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} onSignedIn={()=>{ setAuthOpen(false); setToast('Signed in'); setBigFlash('Signed in successfully') }} />
  <BigFlash open={!!bigFlash} message={bigFlash||''} onClose={()=>setBigFlash(null)} />
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2 shadow-soft text-sm">
            {toast}
            <button className="ml-3 text-xs underline" onClick={()=>setToast(null)}>Dismiss</button>
          </div>
        </div>
      )}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        {/* Auth gate: only allow viewing data routes when signed in; Settings always accessible */}
        {authChecked && !authEmail && locationRef.pathname !== '/settings' ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-16">
            <div className="text-lg font-medium">Please sign in to view your data</div>
            <div className="text-sm text-gray-400">Your local data remains on this device but is hidden until you sign in.</div>
            <div className="flex gap-2">
              <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={() => setAuthOpen(true)}>Sign in</button>
            </div>
          </div>
        ) : (
          <Suspense fallback={<div>Loading…</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/measurements" element={<Measurements />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default function App() {
  const locationRef = useLocation()
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  )
}
