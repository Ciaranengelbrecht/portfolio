const PHASE_LABELS: Record<string, string> = {
  idle: "Preparing app",
  auth: "Verifying session",
  data: "Loading your data",
  program: "Finalizing program",
  ready: "Ready",
  error: "Unable to load",
};

export function AppBootstrapScreen({ phase }: { phase: string }) {
  const label = PHASE_LABELS[phase] || "Loading";
  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/80 shadow-soft p-8 text-center space-y-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 text-lg font-semibold">
          LL
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">LiftLog</h1>
          <p className="text-sm text-slate-300/80">Loading your latest training state</p>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function AppBootstrapError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-red-500/30 bg-slate-900/90 shadow-soft p-8 text-center space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-400/40 bg-red-500/15 text-red-200 text-lg font-semibold">
          !
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Could not load your data</h1>
          <p className="text-sm text-slate-300/80">{message}</p>
        </div>
        <button
          className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
