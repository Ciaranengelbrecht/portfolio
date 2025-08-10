import { registerSW as viteRegister } from 'virtual:pwa-register'

export function registerSW() {
  try {
  const updateSW = viteRegister({ immediate: true, onNeedRefresh() { try { updateSW(true) } catch {} } })
  // If a new service worker is available, activate it and reload
  setInterval(() => { try { updateSW() } catch {} }, 60_000)
  } catch {}
}
