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
import { getAllCached, hasCachedData, setCacheOwner, warmPreload } from "../lib/dataCache";
import { getProfileProgram } from "../lib/profile";

type BootstrapStatus = "booting" | "ready" | "unauthenticated" | "error";

interface BootstrapState {
  status: BootstrapStatus;
  phase: "idle" | "auth" | "data" | "program" | "ready" | "error";
  session: any | null;
  authed: boolean;
  error: string | null;
  attempt: number;
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
};

const CRITICAL_STORES = [
  "settings",
  "exercises",
  "templates",
  "sessions",
  "measurements",
] as const;

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

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
    });

    try {
      const session = await waitForSession({ timeoutMs: 6000 });
      if (!session?.user?.id) {
        setIfCurrent({
          status: "unauthenticated",
          phase: "ready",
          session: null,
          authed: false,
          error: null,
        });
        return;
      }

      setCacheOwner(session.user.id);
      setIfCurrent({ session, authed: true, phase: "data" });

      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline && !hasCachedData([...CRITICAL_STORES])) {
        throw new Error("No cached user data available while offline");
      }

      await Promise.all(
        CRITICAL_STORES.map((store) =>
          getAllCached(store, {
            swr: !offline,
          })
        )
      );

      setIfCurrent({ phase: "program" });
      await getProfileProgram();

      if (!offline) {
        warmPreload(["exercises", "templates", "settings"], { swr: true });
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
      });
    } catch (error) {
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
