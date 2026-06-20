import { AppLoader } from "./AppLoader";

const PHASE_LABELS: Record<string, string> = {
  idle: "Preparing app",
  auth: "",
  data: "Loading route-critical training data",
  program: "Loading program setup",
  ready: "Ready",
  error: "Unable to load",
};

export function AppBootstrapScreen({
  phase,
  exiting = false,
}: {
  phase: string;
  exiting?: boolean;
}) {
  const label = PHASE_LABELS[phase] || "Loading";
  return <AppLoader phase={label} exiting={exiting} />;
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
