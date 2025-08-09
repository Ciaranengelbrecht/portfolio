import { createContext, useContext, useEffect, useState } from 'react'

type ThemeCtx = { theme: 'dark'|'light'; setTheme: (t:'dark'|'light')=>void }
const Ctx = createContext<ThemeCtx>({ theme: 'dark', setTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark'|'light'>(() => (localStorage.getItem('theme') as 'dark'|'light') || 'dark')
  useEffect(() => { localStorage.setItem('theme', theme) }, [theme])
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}
export const useTheme = () => useContext(Ctx)
