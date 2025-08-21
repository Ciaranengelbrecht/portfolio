import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Cache the last session we heard about from onAuthStateChange.
let lastAuthSession: any = null;
// Deduplicate concurrent waitForSession calls
let pendingWaitForSession: Promise<any> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<never>((_, rej) => {
      t = setTimeout(() => {
        rej(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    }),
  ]);
}

// Helper: robustly clear Supabase auth storage for this project
export function clearAuthStorage() {
  try {
    console.log("[auth] clearAuthStorage: start");
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    const keys = [
      `sb-${ref}-auth-token`,
      `sb-${ref}-provider-token`,
      "supabase.auth.token", // legacy
    ];
    for (const k of keys) localStorage.removeItem(k);
    // Best-effort sweep in case environment prefixes differ
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i) || "";
      if (k.startsWith("sb-") && k.includes(ref)) localStorage.removeItem(k);
    }
    console.log("[auth] clearAuthStorage: done");
  } catch {}
}

// Force a quick session validation; returns current session or null
export async function refreshSessionNow() {
  try {
    console.log("[auth] refreshSessionNow: getSession()");
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log("[auth] refreshSessionNow: getSession error", error?.message);
      return null;
    }
    try {
      window.dispatchEvent(
        new CustomEvent("sb-auth", { detail: { session: data.session } })
      );
    } catch {}
    return data.session ?? null;
  } catch {
    return null;
  }
}

// Emit auth events globally for UI refetches
try {
  supabase.auth.onAuthStateChange((evt, session) => {
    try {
      console.log(
        "[auth] onAuthStateChange:",
        evt,
        "user:",
        session?.user?.id || null
      );
      lastAuthSession = session || lastAuthSession;
      window.dispatchEvent(new CustomEvent("sb-auth", { detail: { session } }));
    } catch {}
  });
} catch {}

// Force refresh tokens if a session exists
export async function forceRefreshSession() {
  try {
    console.log("[auth] forceRefreshSession: checking current session");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      console.log("[auth] forceRefreshSession: no session");
      return null;
    }
    console.log("[auth] forceRefreshSession: refreshing...");
    const res = await supabase.auth.refreshSession();
    if (res.error)
      console.log(
        "[auth] forceRefreshSession: refresh error",
        res.error.message
      );
    try {
      window.dispatchEvent(
        new CustomEvent("sb-auth", { detail: { session: res.data.session } })
      );
    } catch {}
    return res.data.session;
  } catch {
    return null;
  }
}

// Wait for a valid session to be available (used to smooth over reload races)
export async function waitForSession(
  opts: { timeoutMs?: number; intervalMs?: number } = {}
) {
  // Immediate fast path from cached auth event
  if (lastAuthSession) return lastAuthSession;
  if (pendingWaitForSession) return pendingWaitForSession;
  const run = async () => {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const intervalMs = opts.intervalMs ?? 200;
  const start = Date.now();
  console.log("[auth] waitForSession: start", { timeoutMs, intervalMs });
  // Try fast path
  try {
    let { data } = await withTimeout(
      supabase.auth.getSession(),
      800,
      "getSession (initial)"
    );
    console.log(
      "[auth] waitForSession: initial getSession session?",
      !!data.session
    );
    if (data.session) {
      console.log("[auth] waitForSession: fast path hit");
      return data.session;
    }
  } catch (e: any) {
    console.log(
      "[auth] waitForSession: initial getSession timeout/error:",
      e?.message || e
    );
    if (lastAuthSession) {
      console.log(
        "[auth] waitForSession: using lastAuthSession from onAuthStateChange"
      );
      return lastAuthSession;
    }
  }
  // Nudge refresh once
  console.log("[auth] waitForSession: forceRefresh once");
  try {
    await withTimeout(
      supabase.auth.refreshSession(),
      1000,
      "refreshSession (nudge)"
    );
  } catch (e: any) {
    console.log(
      "[auth] waitForSession: refresh nudge timeout/error:",
      e?.message || e
    );
  }
  while (Date.now() - start < timeoutMs) {
    try {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        800,
        "getSession (loop)"
      );
      if (data.session) {
        console.log(
          "[auth] waitForSession: session present after",
          Date.now() - start,
          "ms"
        );
        return data.session;
      }
    } catch {}
    if (lastAuthSession) {
      console.log(
        "[auth] waitForSession: returning lastAuthSession from event after",
        Date.now() - start,
        "ms"
      );
      return lastAuthSession;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.log("[auth] waitForSession: timeout after", timeoutMs, "ms");
  return null;
  };
  try {
    pendingWaitForSession = run();
    const s = await pendingWaitForSession;
    return s;
  } finally {
    pendingWaitForSession = null;
  }
}

// Safely obtain the current user id without risking a long hang on Safari
export async function getOwnerIdFast(
  opts: { timeoutMs?: number } = {}
): Promise<string> {
  const t = opts.timeoutMs ?? 1500;
  // Prefer the event-cached session immediately to avoid Safari hangs
  if (lastAuthSession?.user?.id) return lastAuthSession.user.id;
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      Math.min(800, t),
      "getSession (owner)"
    );
    const id = data.session?.user?.id;
    if (id) return id;
  } catch (e: any) {
    console.log(
      "[auth] getOwnerIdFast: getSession timeout/error:",
      e?.message || e
    );
  }
  const s = await waitForSession({ timeoutMs: t });
  if (s?.user?.id) return s.user.id;
  throw new Error("Not signed in");
}
