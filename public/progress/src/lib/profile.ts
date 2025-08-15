import { supabase } from './supabase'
import { UserProfile, UserProgram } from './types'

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
