import { supabase } from './supabase'

type Table = 'exercises'|'sessions'|'measurements'|'templates'|'settings'

export function initSupabaseSync(){
  let subscribed = false
  const start = async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session || subscribed) return
    subscribed = true
    const tables: Table[] = ['exercises','sessions','measurements','templates','settings']
    tables.forEach(t => {
      supabase.channel(`rt-${t}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
          // Consumers should refresh views by reloading data on their side as needed
          // We keep this minimal in cloud-only mode.
        })
        .subscribe()
    })
  }
  start()
  supabase.auth.onAuthStateChange(() => start())
}
