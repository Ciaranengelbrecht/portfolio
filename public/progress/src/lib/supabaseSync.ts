import { supabase, waitForSession } from "./supabase";

type Table =
  | "exercises"
  | "sessions"
  | "measurements"
  | "templates"
  | "settings";

// Lazy realtime: subscribe tables only when pages request them
let channel: ReturnType<typeof supabase.channel> | null = null;
const subscribedTables = new Set<Table>();
let authReady = false;

async function ensureChannel() {
  if (channel) return channel;
  // Wait (briefly) for a session before creating channel; fallback after timeout
  await waitForSession({ timeoutMs: 1200 }).catch(()=> null);
  channel = supabase.channel('rt-all');
  channel.subscribe();
  return channel;
}

export async function requestRealtime(table: Table) {
  try {
  // Allow a dev-only hard override via global flag, but ignore legacy localStorage disable key (we now always enable realtime by default)
  if ((typeof window !== 'undefined' && (window as any).__DISABLE_REALTIME)) return;
  } catch {}
  if (subscribedTables.has(table)) return;
  const ch = await ensureChannel();
  ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any)=> {
    try {
      window.dispatchEvent(new CustomEvent('sb-change', { detail: { table, payload }}));
    } catch {}
  });
  subscribedTables.add(table);
}

export function initSupabaseSync() {
  // Auth listener so late logins can still attach future table subscriptions
  supabase.auth.onAuthStateChange((_evt, session) => {
    authReady = !!session;
  });
}
