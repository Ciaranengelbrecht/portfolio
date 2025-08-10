import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from './GlassCard'
import { db } from '../lib/db'
import { getSettings, setDashboardPrefs, getDashboardPrefs } from '../lib/helpers'
import { Session, Settings } from '../lib/types'
import { getWeekCompletion, getPhaseCompletion, isPhaseEnd } from '../features/progress/progress'
import { useNavigate } from 'react-router-dom'

function Pill({ active, label, onClick, title }:{ active:boolean; label:string; onClick:()=>void; title:string }){
  return (
    <button className={`px-2 py-1 rounded-full text-xs ${active? 'bg-[var(--accent)] text-black shadow-[0_0_12px_rgba(34,197,94,0.5)]':'bg-slate-800 text-gray-300'}`} onClick={onClick} title={title}>
      {label}
    </button>
  )
}

function ProgressBar({ percent }:{ percent:number }){
  return (
    <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
      <motion.div className="h-full" style={{ background:'var(--accent)' }} initial={{ width: 0 }} animate={{ width: `${Math.min(100,Math.max(0,percent))}%` }} transition={{ type:'spring', stiffness: 120, damping: 20 }} />
    </div>
  )
}

export default function ProgressBars(){
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [settings, setSettingsState] = useState<Settings|undefined>()
  const [curPhase, setCurPhase] = useState(1)
  const [curWeek, setCurWeek] = useState(1)
  const [toast, setToast] = useState<string|null>(null)

  useEffect(() => { (async () => {
    setSessions(await db.getAll('sessions'))
    const s = await getSettings(); setSettingsState(s); setCurPhase(s.currentPhase||1)
    const prefs = await getDashboardPrefs(); if (prefs.lastLocation) setCurWeek(prefs.lastLocation.weekNumber)
  })() }, [])

  useEffect(() => {
    const onChange = (e:any) => { if (e?.detail?.table === 'sessions' || e?.detail?.table === 'settings') refresh() }
    window.addEventListener('sb-change', onChange as any)
    return () => window.removeEventListener('sb-change', onChange as any)
  }, [])

  const refresh = async () => {
    setSessions(await db.getAll('sessions'))
    const s = await getSettings(); setSettingsState(s); setCurPhase(s.currentPhase||1)
    try { const prefs = await getDashboardPrefs(); if (prefs.lastLocation) setCurWeek(prefs.lastLocation.weekNumber) } catch {}
  }

  const weeklyTarget = Math.max(3, Math.min(6, settings?.progress?.weeklyTargetDays ?? 6))

  const week = useMemo(() => getWeekCompletion(curPhase, curWeek, sessions, { weeklyTargetDays: weeklyTarget }), [curPhase, curWeek, sessions, weeklyTarget])
  const phase = useMemo(() => getPhaseCompletion(curPhase, sessions, { weeklyTargetDays: weeklyTarget }), [curPhase, sessions, weeklyTarget])

  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const sessionForDay = (dayId:number) => sessions.find(s => s.id === `${curPhase}-${curWeek}-${dayId}`)

  const openDay = async (dayId: number) => {
    // Navigate to sessions; Sessions page will create missing session
    await setDashboardPrefs({ lastLocation: { phaseNumber: curPhase, weekNumber: curWeek as any, dayId } })
    navigate('/sessions')
  }

  const weekDots = Array.from({ length: 9 }, (_,i)=>i)

  useEffect(() => {
    if (!settings || settings.progress?.gamification === false) return
    if (week.completedDays >= weeklyTarget) {
      // simple celebratory toast; confetti can be integrated later if desired
      setToast('Week Complete!')
      const t = setTimeout(()=>setToast(null), 1500); return () => clearTimeout(t)
    }
  }, [week.completedDays, weeklyTarget, settings?.progress?.gamification])

  useEffect(() => {
    if (!settings || settings.progress?.gamification === false) return
    if (phase.percent >= 100) {
      setToast('Phase complete!')
      const t = setTimeout(()=>setToast(null), 1500); return () => clearTimeout(t)
    }
  }, [phase.percent, settings?.progress?.gamification])

  const extraBeyondTarget = () => {
    // Count rest-day session as extra beyond target
    const rest = sessionForDay(6)
    return rest && (rest.entries?.some(e=> e.sets?.some(s=> (s.reps||0)>0)) ) ? 1 : 0
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {toast && (
        <div className="md:col-span-2">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2 shadow-soft text-sm inline-block">{toast}</div>
        </div>
      )}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="font-medium">This Week</div>
          {isPhaseEnd(curWeek) && <span className="text-[10px] bg-slate-700 rounded px-2 py-0.5">Deload Week</span>}
        </div>
        <div className="flex items-center justify-between mb-2 text-sm">
          <div>{week.percent}%</div>
          <div className="text-gray-400">
            {week.completedDays + extraBeyondTarget()}/{weeklyTarget}
            {week.completedDays + extraBeyondTarget() > weeklyTarget ? (
              <span className="ml-1 text-[10px] bg-yellow-500 text-black rounded px-1">+{(week.completedDays + extraBeyondTarget())-weeklyTarget}</span>
            ) : null}
          </div>
        </div>
        <ProgressBar percent={week.percent} />
        {week.completedDays===0 && (
          <div className="mt-2 text-xs text-gray-400">
            No sessions yet. <button className="underline" onClick={()=>openDay(0)}>Log first session</button>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {dayLabels.map((d,i)=> {
            const sess = sessionForDay(i)
            const tip = sess ? `${new Date(sess.dateISO).toLocaleDateString()} • ${sess.entries.length} exercises` : 'No session yet'
            return (
              <Pill key={i} active={!!week.dayMap[i as 0|1|2|3|4|5|6]} label={d} onClick={()=>openDay(i)} title={tip} />
            )
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="font-medium mb-2">Phase {curPhase}</div>
        <div className="flex items-center justify-between mb-2 text-sm">
          <div>{phase.percent}%</div>
          <div className="text-gray-400">Week {curWeek} of 9</div>
        </div>
        <ProgressBar percent={phase.percent} />
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {weekDots.map((i)=> (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${phase.weekPercents[i]>0? 'bg-[var(--accent)]':'bg-slate-700'} ${i+1===curWeek? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-900':''}`}></div>
          ))}
        </div>
  {curWeek<9 && phase.weekPercents.slice(0,8).every(p=>p>=100) && (settings?.progress?.showDeloadHints ?? true) && (
          <div className="mt-2 text-xs text-gray-400">Deload next week</div>
        )}
        {curWeek===9 && phase.weekPercents[8] >= 50 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm">Phase complete</span>
            <button className="text-xs bg-emerald-600 rounded px-2 py-1" onClick={async ()=>{
              const s = await getSettings(); const next = (s.currentPhase||1)+1
              await db.put('settings', { ...s, id:'app', currentPhase: next })
              setCurPhase(next)
              await setDashboardPrefs({ lastLocation: { phaseNumber: next, weekNumber: 1 as any, dayId: 0 } })
              navigate('/sessions')
            }}>Start Phase {curPhase+1}</button>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
