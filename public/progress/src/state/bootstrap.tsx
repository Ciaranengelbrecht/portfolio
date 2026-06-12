import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { waitForSession } from "../lib/supabase";
import { computeAggregates } from "../lib/aggregates";
import {
  getAllCached,
  hasCachedData,
  setCacheOwner,
  warmPreload,
} from "../lib/dataCache";
import { getProfileProgram } from "../lib/profile";
import { trackError, trackMetric } from "../lib/monitoring";
import type { UserProgram } from "../lib/types";

type BootstrapStatus = "booting" | "ready" | "unauthenticated" | "error";

interface BootstrapState {
  status: BootstrapStatus;
  phase: "idle" | "auth" | "data" | "program" | "ready" | "error";
  session: any | null;
  authed: boolean;
  error: string | null;
  attempt: number;
  program: UserProgram | null;
}

interface BootstrapContextValue extends BootstrapState {
  retry: () => void;
}

const INITIAL_STATE: BootstrapState = {
  status: "booting",
  phase: "idle",
  session: null,
  authed: false,
  error: null,
  attempt: 0,
  program: null,
};

const SESSIONS_CRITICAL_STORES = [
  "settings",
  "exercises",
  "templates",
  "sessions",
] as const;

const DASHBOARD_CRITICAL_STORES = ["settings", "sessions", "exercises"] as const;
const MEASUREMENTS_CRITICAL_STORES = ["settings", "measurements"] as const;
const DEFAULT_CRITICAL_STORES = SESSIONS_CRITICAL_STORES;
const ALL_STORES = [
  "settings",
  "exercises",
  "templates",
  "sessions",
  "measurements",
] as const;

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export type BootstrapStore = (typeof ALL_STORES)[number];

export function getBootstrapCriticalStores(path = ""): BootstrapStore[] {
  const normalized = path || "/";
  if (normalized.startsWith("/measurements")) {
    return [...MEASUREMENTS_CRITICAL_STORES];
  }
  if (
    normalized.startsWith("/sessions") ||
    normalized === "/" ||
    normalized === ""
  ) {
    return [...SESSIONS_CRITICAL_STORES];
  }
  if (normalized.startsWith("/dashboard")) {
    return [...DASHBOARD_CRITICAL_STORES];
  }
  return [...DEFAULT_CRITICAL_STORES];
}

function readStartupPath() {
  if (typeof window === "undefined") return "/";
  const hashPath = window.location.hash.replace(/^#/, "").split("?")[0];
  return hashPath || window.location.pathname || "/";
}

function debugBootstrap(...args: unknown[]) {
  try {
    if (typeof window !== "undefined" && (window as any).__DEBUG_BOOTSTRAP) {
      console.log("[bootstrap]", ...args);
    }
  } catch {}
}

function bootNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function readBootError(error: unknown): string {
  if (!error) return "Unknown startup error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Startup failed";
}

export function BootstrapProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BootstrapState>(INITIAL_STATE);
  const [attempt, setAttempt] = useState(1);
  const runId = useRef(0);
  const stateRef = useRef<BootstrapState>(INITIAL_STATE);

  const boot = useCallback(async (currentAttempt: number) => {
    const id = ++runId.current;
    const setIfCurrent = (next: Partial<BootstrapState>) => {
      if (runId.current !== id) return;
      setState((prev) => ({ ...prev, ...next, attempt: currentAttempt }));
    };

    setIfCurrent({
      status: "booting",
      phase: "auth",
      error: null,
      session: null,
      authed: false,
      program: null,
    });

    try {
      const bootStartedAt = bootNow();
      const session = await waitForSession({ timeoutMs: 4500 });
      debugBootstrap("auth", Math.round(bootNow() - bootStartedAt), "ms");
      if (!session?.user?.id) {
        setIfCurrent({
          status: "unauthenticated",
          phase: "ready",
          session: null,
          authed: false,
          error: null,
          program: null,
        });
        return;
      }

      setCacheOwner(session.user.id);
      setIfCurrent({ session, authed: true, phase: "data" });
      const criticalStores = getBootstrapCriticalStores(readStartupPath());

      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline && !hasCachedData(criticalStores)) {
        throw new Error("No cached user data available while offline");
      }

      const dataStartedAt = bootNow();
      const dataPromise = Promise.all(
        criticalStores.map((store) =>
          getAllCached(store, {
            swr: !offline,
          })
        )
      );
      setIfCurrent({ phase: "program" });
      const programPromise = getProfileProgram();
      const [, program] = await Promise.all([dataPromise, programPromise]);
      debugBootstrap(
        "critical data + program",
        criticalStores,
        Math.round(bootNow() - dataStartedAt),
        "ms"
      );

      if (!offline) {
        const criticalStoreSet = new Set<BootstrapStore>(criticalStores);
        const deferredStores = ALL_STORES.filter(
          (store) => !criticalStoreSet.has(store)
        );
        const preloadStores = Array.from(
          new Set<BootstrapStore>([
            ...deferredStores,
            "exercises",
            "templates",
            "settings",
          ])
        );
        warmPreload(preloadStores, { swr: true });
        setTimeout(() => {
          void computeAggregates().catch(() => {});
        }, 800);
      }

      setIfCurrent({
        status: "ready",
        phase: "ready",
        error: null,
        session,
        authed: true,
        program,
      });
      trackMetric("bootstrap_ready_ms", Math.round(bootNow() - bootStartedAt), {
        authed: true,
        criticalStores: criticalStores.join(","),
      });
    } catch (error) {
      trackError(error, { source: "bootstrap", phase: "startup" });
      setIfCurrent({
        status: "error",
        phase: "error",
        error: readBootError(error),
      });
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAuth = (evt: Event) => {
      const detail = (evt as CustomEvent<{ session?: any }>).detail;
      const nextUserId = detail?.session?.user?.id;
      const currentUserId = stateRef.current.session?.user?.id;

      if (!nextUserId) {
        // Ignore transient null auth events during startup; only react as sign-out
        // when we were already authenticated.
        if (stateRef.current.authed || stateRef.current.status === "ready") {
          runId.current += 1;
          setState((prev) => ({
            ...prev,
            status: "unauthenticated",
            phase: "ready",
            session: null,
            authed: false,
            error: null,
          }));
        }
        return;
      }

      if (stateRef.current.status === "booting") {
        return;
      }

      if (
        nextUserId !== currentUserId ||
        stateRef.current.status === "unauthenticated" ||
        stateRef.current.status === "error"
      ) {
        setAttempt((prev) => prev + 1);
      }
    };

    const onOnline = () => {
      if (stateRef.current.status === "error") {
        setAttempt((prev) => prev + 1);
      }
    };

    window.addEventListener("sb-auth", onAuth as EventListener);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("sb-auth", onAuth as EventListener);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    void boot(attempt);
  }, [attempt, boot]);

  const value = useMemo<BootstrapContextValue>(
    () => ({
      ...state,
      retry: () => setAttempt((prev) => prev + 1),
    }),
    [state]
  );

  return (
    <BootstrapContext.Provider value={value}>
      {children}
    </BootstrapContext.Provider>
  );
}

export function useBootstrap() {
  const ctx = useContext(BootstrapContext);
  if (!ctx) throw new Error("useBootstrap must be used within BootstrapProvider");
  return ctx;
}
