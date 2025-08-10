import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { THEMES, ThemeKey, ThemeVars } from './themes'
import { db } from '../lib/db'
import { Settings } from '../lib/types'

type Ctx = {
  themeKey: ThemeKey
  setThemeKey: (k: ThemeKey) => void
  applyVars: (vars: ThemeVars) => void
}

const ThemeCtx = createContext<Ctx>({ themeKey: 'default-glass', setThemeKey: ()=>{}, applyVars: ()=>{} })

function setMetaTheme(bg: string){
  try {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (meta) meta.content = bg
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }){
  const [themeKey, setThemeKeyState] = useState<ThemeKey>('default-glass')
  const applyVars = (vars: ThemeVars) => {
    const root = document.documentElement
    for (const [k,v] of Object.entries(vars)) root.style.setProperty(k, v)
    const glass = (vars['--card'] || '').includes('rgba(') || (vars['--card-backdrop']||'').includes('blur')
    root.setAttribute('data-card-style', glass ? 'glass' : 'solid')
    const bg = vars['--bg']?.startsWith('radial-gradient') ? (vars['--bg-muted'] || '#0b0f14') : (vars['--bg'] || '#0b0f14')
    setMetaTheme(bg)
    // toggle aurora background layer if present
    try {
      const body = document.body
      if (vars['--bg-layer'] && vars['--bg-layer'] !== 'none') body.setAttribute('data-bg-layer', 'on')
      else body.removeAttribute('data-bg-layer')
    } catch {}
  try { window.dispatchEvent(new CustomEvent('theme-change', { detail: { vars } })) } catch {}
  }

  const setThemeKey = async (key: ThemeKey) => {
    setThemeKeyState(key)
    const vars = THEMES[key]
    applyVars(vars)
  // Toggle dark mode class: all current themes are dark-styled; keep dark class on
  document.documentElement.classList.add('dark')
    const root = document.getElementById('root')
    if (root) {
      root.style.transition = 'opacity 200ms ease'
      root.style.opacity = '0.98'
      setTimeout(()=>{ root.style.opacity = '1'; root.style.transition = '' }, 220)
    }
    const s = await db.get<Settings>('settings','app')
    await db.put('settings', { ...(s||{ unit:'kg', deloadDefaults:{ loadPct:0.55, setPct:0.5 } } as any), id:'app', themeV2: { key } } as any)
  }

  useEffect(() => { (async () => {
    try {
      const s = await db.get<Settings>('settings','app')
  // prefer v2, fallback to earlier experimental theme object, otherwise default to 'default-glass'
  let key = ((s as any)?.themeV2?.key || (s as any)?.theme?.key) as ThemeKey | undefined
  if (!key || !THEMES[key as ThemeKey]) {
    key = 'default-glass'
    // self-heal persisted invalid/removed keys
    try { await db.put('settings', { ...(s||{} as any), id:'app', themeV2: { key } } as any) } catch {}
  }
  setThemeKeyState(key as ThemeKey)
  const vars = THEMES[key as ThemeKey]
      applyVars(vars)
  document.documentElement.classList.add('dark')
  try { window.dispatchEvent(new CustomEvent('theme-change', { detail: { key } })) } catch {}
    } catch {
      applyVars(THEMES['default-glass'])
    }
  })() }, [])

  const ctx = useMemo(() => ({ themeKey, setThemeKey, applyVars }), [themeKey])
  return <ThemeCtx.Provider value={ctx}>{children}</ThemeCtx.Provider>
}

export const useAppTheme = () => useContext(ThemeCtx)
