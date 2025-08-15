import { createContext, useContext, useEffect, useState } from 'react'
import { UserProgram } from '../lib/types'
import { ensureProgram } from '../lib/program'
import { fetchUserProfile } from '../lib/profile'

interface ProgramCtx {
  program: UserProgram | null
  setProgram: (p: UserProgram) => void
}
const ProgramContext = createContext<ProgramCtx>({ program: null, setProgram: ()=>{} })

export function ProgramProvider({ children }: { children: React.ReactNode }){
  const [program, setProgramState] = useState<UserProgram | null>(null)
  useEffect(()=>{ (async()=>{
    const profile = await fetchUserProfile();
    const p = ensureProgram(profile?.program)
    setProgramState(p)
  })() },[])
  const setProgram = (p: UserProgram) => { setProgramState(p) }
  return <ProgramContext.Provider value={{ program, setProgram }}>{children}</ProgramContext.Provider>
}
export const useProgram = () => useContext(ProgramContext)
