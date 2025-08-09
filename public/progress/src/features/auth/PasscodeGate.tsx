import { useEffect, useState } from 'react'
import { getSettings, setSettings } from '../../lib/helpers'
import GlassCard from '../../components/GlassCard'

const PASS = 'cizza'
const KEY = 'liftlog_unlocked'

export default function PasscodeGate({ children }: { children: React.ReactNode }){
  const [ok, setOk] = useState<boolean>(false)
  const [val, setVal] = useState('')
  const [shake, setShake] = useState(false)
  useEffect(() => { (async () => {
    const s = await getSettings()
    const remember = s.privacyUnlockMode === 'remember24h'
    const now = Date.now()
    const until = s.unlockedUntil ? new Date(s.unlockedUntil).getTime() : 0
    if (remember && until > now) { setOk(true); return }
    setOk(sessionStorage.getItem(KEY) === '1')
  })() }, [])
  useEffect(() => { (async () => {
    if (ok) {
      sessionStorage.setItem(KEY,'1')
      const s = await getSettings()
      if (s.privacyUnlockMode === 'remember24h') {
        const until = new Date(Date.now() + 24*60*60*1000).toISOString()
        await setSettings({ ...s, unlockedUntil: until })
      }
    }
  })() }, [ok])
  if (ok) return <>{children}</>
  return (
    <div className="min-h-screen grid place-items-center">
      <GlassCard className={shake? 'animate-[shake_0.2s]' : ''}>
        <div className="text-lg font-semibold mb-2">Enter passcode</div>
        <input autoFocus className="bg-slate-800 rounded-xl px-3 py-2" value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter'){ if (val===PASS) setOk(true); else { setShake(true); setTimeout(()=>setShake(false), 250) }}}} />
        <div className="text-xs text-gray-400 mt-2">This is a convenience lock only; not secure.</div>
      </GlassCard>
    </div>
  )
}
