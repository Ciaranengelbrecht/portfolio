/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly [key: string]: string | boolean | undefined;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_RELEASE_CHANNEL?: string;
  readonly VITE_MONITORING_ENDPOINT?: string;
  readonly VITE_DELETE_ACCOUNT_FUNCTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
declare module '*.svg?url' {
  const src: string
  export default src
}
declare module 'virtual:pwa-register' {
  export function registerSW(options?: any): any
}
