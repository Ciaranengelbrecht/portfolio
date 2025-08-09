import { registerSW as viteRegister } from 'virtual:pwa-register'
import { pushLocalChanges, fullPull } from './supabaseSync'

export function registerSW() {
  try {
    const update = viteRegister({ immediate: true })
    // After registering SW in an installed app, nudge a sync shortly after load
    setTimeout(async () => {
      try {
        await pushLocalChanges()
        await fullPull()
      } catch {}
    }, 1500)
  } catch {}
}
