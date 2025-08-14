import { supabase } from './supabase'
import { UserProfile } from './types'

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (error && (error as any).code !== 'PGRST116') throw error
    if (!data) return { id: user.id }
    return data as any as UserProfile
  } catch (e) {
    console.warn('[profile] fetchUserProfile failed', e)
    return null
  }
}

export async function saveProfileTheme(themeV2: UserProfile['themeV2']): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')
    const payload = { id: user.id, themeV2 }
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return true
  } catch (e) {
    console.warn('[profile] saveProfileTheme failed', e)
    return false
  }
}
