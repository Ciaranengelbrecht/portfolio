/// <reference types="vite/client" />
declare module '*.svg?url' {
  const src: string
  export default src
}
declare module 'virtual:pwa-register' {
  export function registerSW(options?: any): any
}
