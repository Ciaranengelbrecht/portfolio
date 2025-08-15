import { DeloadConfig, UserProgram } from './types'
import { defaultProgram } from './defaults'

export function ensureProgram(p?: UserProgram | null): UserProgram {
  if(!p) return { ...defaultProgram, id: defaultProgram.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  // Basic sanity checks, self-heal
  let changed = false
  if(!p.id) { p.id = `prog_${Math.random().toString(36).slice(2,9)}`; changed = true }
  if(p.weekLengthDays < 5 || p.weekLengthDays > 10){ p.weekLengthDays = Math.min(10, Math.max(5, p.weekLengthDays)); changed = true }
  if(p.weeklySplit.length !== p.weekLengthDays){
    p.weeklySplit = [...defaultProgram.weeklySplit].slice(0,p.weekLengthDays)
    changed = true
  }
  if(p.mesoWeeks < 4 || p.mesoWeeks > 20){ p.mesoWeeks = defaultProgram.mesoWeeks; changed = true }
  if(!p.deload){ p.deload = { mode: 'last-week' } as any; changed = true }
  if(changed){ p.updatedAt = new Date().toISOString() }
  return p
}

export function computeDeloadWeeks(program: UserProgram): Set<number> {
  const weeks = new Set<number>()
  const d = program.deload
  if(d.mode === 'last-week') weeks.add(program.mesoWeeks)
  else if(d.mode === 'interval'){
    const n = Math.max(2, d.everyNWeeks|0)
    for(let w=n; w<=program.mesoWeeks; w+=n) weeks.add(w)
  }
  return weeks
}

export function describeDeload(deload: DeloadConfig){
  if(deload.mode==='none') return 'none'
  if(deload.mode==='last-week') return 'last week'
  if(deload.mode==='interval') return `every ${deload.everyNWeeks}w`
  return 'unknown'
}

export function programSummary(p: UserProgram){
  return `${p.name} · ${p.mesoWeeks} weeks · Deload: ${describeDeload(p.deload)}`
}

export function validateProgram(p: UserProgram): string[] {
  const errs: string[] = []
  if(p.weekLengthDays < 5 || p.weekLengthDays > 10) errs.push('Week length must be 5-10')
  if(p.weeklySplit.length !== p.weekLengthDays) errs.push('Weekly split length mismatch')
  if(p.mesoWeeks < 4 || p.mesoWeeks > 20) errs.push('Mesocycle weeks must be 4-20')
  if(!p.weeklySplit.some(d=>d.type !== 'Rest')) errs.push('At least one training day required')
  if(p.deload.mode==='interval' && (p.deload.everyNWeeks < 4 || p.deload.everyNWeeks > 12)) errs.push('Interval deload everyNWeeks must be 4-12')
  return errs
}
