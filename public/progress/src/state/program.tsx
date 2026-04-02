import { createContext, useContext, useEffect, useState } from "react";
import { UserProgram } from "../lib/types";
import { ensureProgram } from "../lib/program";
import { fetchUserProfileStrict } from "../lib/profile";
import { useBootstrap } from "./bootstrap";

interface ProgramCtx {
  program: UserProgram | null;
  loading: boolean;
  ready: boolean;
  error: string | null;
  setProgram: (p: UserProgram) => void;
}
const ProgramContext = createContext<ProgramCtx>({
  program: null,
  loading: true,
  ready: false,
  error: null,
  setProgram: () => {},
});

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const boot = useBootstrap();
  const [program, setProgramState] = useState<UserProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (boot.status === "booting") {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    if (!boot.authed) {
      setProgramState(null);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchUserProfileStrict();
        if (cancelled) return;
        setProgramState(ensureProgram(profile?.program));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn("[program] hydrate failed", err);
        setProgramState(null);
        setError("Could not load program data");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boot.status, boot.authed, boot.attempt]);

  const setProgram = (p: UserProgram) => {
    setError(null);
    setProgramState(p);
  };

  return (
    <ProgramContext.Provider
      value={{
        program,
        loading,
        ready: !loading && !error,
        error,
        setProgram,
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
}
export const useProgram = () => useContext(ProgramContext);
