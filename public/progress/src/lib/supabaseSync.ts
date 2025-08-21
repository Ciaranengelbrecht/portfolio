import { supabase, waitForSession } from "./supabase";

type Table =
  | "exercises"
  | "sessions"
  | "measurements"
  | "templates"
  | "settings";

export function initSupabaseSync() {
  let subscribed = false;
  const start = async () => {
    if (subscribed) return;
    // Avoid hanging on Safari: wait briefly for a session using resilient helper
    const session = await waitForSession({ timeoutMs: 1500 });
    if (!session || subscribed) return;
    subscribed = true;
    const tables: Table[] = [
      "exercises",
      "sessions",
      "measurements",
      "templates",
      "settings",
    ];
    // Use a single multiplexed channel to reduce metadata queries & sockets
    const ch = supabase.channel('rt-all');
    tables.forEach(t => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (payload: any)=> {
        try {
          window.dispatchEvent(new CustomEvent('sb-change', { detail: { table: t, payload }}));
        } catch {}
      });
    });
    ch.subscribe();
  };
  start();
  supabase.auth.onAuthStateChange((_evt, session) => {
    if (!subscribed && session) start();
  });
}
