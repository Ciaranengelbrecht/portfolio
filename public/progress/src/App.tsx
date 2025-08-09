import { lazy, Suspense, useEffect } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { getSettings, setSettings } from './lib/helpers'
import { pullFromGist, startBackgroundPull } from './lib/sync'
import { ThemeProvider, useTheme } from './lib/theme'
import { registerSW } from './lib/pwa'
import PasscodeGate from './features/auth/PasscodeGate'
import BackgroundFX from './components/BackgroundFX'

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'))
const Sessions = lazy(() => import('./pages/Sessions'))
const Measurements = lazy(() => import('./pages/Measurements'))
const Templates = lazy(() => import('./pages/Templates'))
const Settings = lazy(() => import('./pages/Settings'))

function Shell() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  useEffect(() => { registerSW() }, [])
  useEffect(() => { (async () => {
    const s = await getSettings()
    // apply accent and card style
    const root = document.documentElement
    if (s.accentColor) root.style.setProperty('--accent', s.accentColor)
    if (s.cardStyle) root.setAttribute('data-card-style', s.cardStyle)
  })() }, [])
  // First-load pull for cloud sync (if configured)
  useEffect(() => { (async () => {
    const s = await getSettings()
    if (s.cloudSync?.enabled && s.cloudSync.provider==='gist' && s.cloudSync.token && s.cloudSync.gistId) {
      await pullFromGist(s.cloudSync)
  startBackgroundPull(30000)
    }
  })() }, [])
  useEffect(() => { (async () => {
    const s = await getSettings()
    const start = s.dashboardPrefs?.startPage || (s.dashboardPrefs?.openToLast ? 'last' : 'dashboard')
    if (start === 'last' && s.dashboardPrefs?.openToLast !== false && s.dashboardPrefs?.lastLocation) {
      navigate('/sessions')
    } else if (start === 'sessions') navigate('/sessions')
    else if (start === 'measurements') navigate('/measurements')
    else if (start === 'dashboard') navigate('/')
  })() }, [])

  const Tab = ({ to, label }: { to: string; label: string }) => (
    <NavLink to={to} className={({ isActive }) => `px-3 py-2 rounded-2xl text-sm ${isActive ? 'bg-card text-white' : 'text-gray-300'}`}>{label}</NavLink>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundFX />
      <header className="sticky top-0 z-10 backdrop-blur bg-bg/70 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">LiftLog</h1>
          <nav className="flex gap-2 overflow-x-auto">
            <Tab to="/" label="Dashboard" />
            <Tab to="/sessions" label="Sessions" />
            <Tab to="/measurements" label="Measurements" />
            <Tab to="/templates" label="Templates" />
            <Tab to="/settings" label="Settings" />
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        <Suspense fallback={<div>Loading…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/measurements" element={<Measurements />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <PasscodeGate>
        <Shell />
      </PasscodeGate>
    </ThemeProvider>
  )
}
