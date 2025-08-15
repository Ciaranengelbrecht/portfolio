import { supabase } from './supabase'
import { UserProfile, UserProgram, ArchivedProgram } from './types'

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (error && (error as any).code !== 'PGRST116') throw error
    if (!data) return { id: user.id }
    // Normalize column name: Postgres folded unquoted identifier to lowercase 'themev2'
    const norm: any = { ...data }
    if (norm.themeV2 === undefined && norm.themev2 !== undefined) {
      norm.themeV2 = norm.themev2
    }
    return norm as UserProfile
  } catch (e) {
    console.warn('[profile] fetchUserProfile failed', e)
    return null
  }
}

export async function saveProfileTheme(themeV2: UserProfile['themeV2']): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')
    // Use lowercase column name to match unquoted creation (themev2)
    const payload: any = { id: user.id, themev2: themeV2 }
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return true
  } catch (e) {
    // Graceful fallback if column not yet in PostgREST schema cache
    const code = (e as any)?.code
    if (code === 'PGRST204') {
      console.warn('[profile] themeV2 column missing in schema cache; falling back to creating profile row without themeV2')
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Attempt to upsert only the id so the row exists; theme still lives in settings locally
            await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' })
        }
      } catch (e2) {
        console.warn('[profile] fallback profile upsert failed', e2)
      }
      return false
    }
    console.warn('[profile] saveProfileTheme failed', e)
    return false
  }
}

export async function saveProfileProgram(program: UserProgram): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) throw new Error('Not signed in')
    const payload: any = { id: user.id, program }
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if(error) throw error
    return true
  } catch(e){
    console.warn('[profile] saveProfileProgram failed', e)
    return false
  }
}

export async function archiveCurrentProgram(newProgram: UserProgram, opts?: { phaseSpan?: { from:number; to:number } }): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) throw new Error('Not signed in')
    const { data, error } = await supabase.from('profiles').select('program, program_history').eq('id', user.id).single()
    if(error) throw error
    const history: ArchivedProgram[] = (data?.program_history || [])
    if(data?.program){
      const existing = data.program as UserProgram
      const archived: ArchivedProgram = {
        id: existing.id || `prog_${Math.random().toString(36).slice(2,9)}`,
        name: existing.name,
        summary: `${existing.name} · ${existing.mesoWeeks}w`,
        archivedAt: new Date().toISOString(),
        program: existing,
        phaseSpan: opts?.phaseSpan,
      }
      history.unshift(archived)
      // cap history
      if(history.length > 10) history.pop()
    }
    const payload: any = { id: user.id, program: newProgram, program_history: history }
    const { error: upErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if(upErr) throw upErr
    return true
  } catch(e){
    console.warn('[profile] archiveCurrentProgram failed', e)
    return false
  }
}

export async function restoreArchivedProgram(programId: string): Promise<UserProgram | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) throw new Error('Not signed in')
    const { data, error } = await supabase.from('profiles').select('program, program_history').eq('id', user.id).single()
    if(error) throw error
    const history: ArchivedProgram[] = (data?.program_history || [])
    const idx = history.findIndex(h => h.id === programId)
    if(idx === -1) return null
    const target = history[idx]
    // Move current program (if any) into history (top) before restoring
    const newHistory = [...history]
    const current = data?.program as UserProgram | undefined
    if(current){
      newHistory.unshift({ id: current.id || `prog_${Math.random().toString(36).slice(2,9)}`, name: current.name, summary: `${current.name} · ${current.mesoWeeks}w`, archivedAt: new Date().toISOString(), program: current })
    }
    // Remove restored one from its old position AFTER capturing
    const adjusted = newHistory.filter((h,i)=> !(i !== 0 && h.id === target.id))
    // Cap to 15
    while(adjusted.length > 15) adjusted.pop()
    const payload: any = { id: user.id, program: target.program, program_history: adjusted }
    const { error: upErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if(upErr) throw upErr
    return target.program
  } catch(e){
    console.warn('[profile] restoreArchivedProgram failed', e)
    return null
  }
}
