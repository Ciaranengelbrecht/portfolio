import { registerSW as viteRegister } from 'virtual:pwa-register'

export function registerSW() {
  try {
    viteRegister({ immediate: true })
  } catch {}
}
