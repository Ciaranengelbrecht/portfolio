import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";

interface RestTimerState {
  start: number;
  elapsed: number;
  running: boolean;
  finished?: boolean;
  alerted?: boolean;
}

interface FloatingRestTimerProps {
  /** All active rest timers keyed by entry ID */
  restTimers: Record<string, RestTimerState>;
  /** Target rest time in seconds */
  targetSeconds: number;
  /** Exercise names map for display */
  exerciseNames: Record<string, string>;
  /** Callback to stop a specific timer */
  onStop: (entryId: string) => void;
  /** Callback to restart a specific timer */
  onRestart: (entryId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Floating rest timer indicator that appears when any timer is running.
 * Shows prominently at the top of the viewport for visibility during workouts.
 */
export default function FloatingRestTimer({
  restTimers,
  targetSeconds,
  exerciseNames,
  onStop,
  onRestart,
  className,
}: FloatingRestTimerProps) {
  // Find the most relevant active timer (most recently started running timer)
  const activeTimer = useMemo(() => {
    const entries = Object.entries(restTimers);
    
    // First priority: running timers - pick the one that started most recently
    const runningTimers = entries.filter(([_, t]) => t.running && !t.finished);
    if (runningTimers.length > 0) {
      // Sort by start time descending (most recent first)
      runningTimers.sort((a, b) => b[1].start - a[1].start);
      const mostRecent = runningTimers[0];
      return { entryId: mostRecent[0], timer: mostRecent[1] };
    }
    
    // Second priority: finished but not dismissed (within last 3 seconds)
    // Also pick most recent
    const recentlyFinished = entries
      .filter(([_, t]) => t.finished && Date.now() - t.start - t.elapsed < 3000)
      .sort((a, b) => b[1].start - a[1].start)[0];
    if (recentlyFinished) return { entryId: recentlyFinished[0], timer: recentlyFinished[1] };
    
    return null;
  }, [restTimers]);

  if (!activeTimer) return null;

  const { entryId, timer } = activeTimer;
  const exerciseName = exerciseNames[entryId] || "Exercise";
  const totalSecs = timer.elapsed / 1000;
  const mm = Math.floor(totalSecs / 60);
  const ss = Math.floor(totalSecs) % 60;
  const reached = targetSeconds <= 0 ? true : totalSecs >= targetSeconds;
  const progressRatio = targetSeconds <= 0 ? 1 : Math.min(totalSecs / targetSeconds, 1);

  return (
    <AnimatePresence>
      <motion.div
        key="floating-rest-timer"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={clsx(
          "fixed top-16 left-1/2 z-[1100] -translate-x-1/2",
          "md:top-4",
          className
        )}
      >
        <div
          className={clsx(
            "flex items-center gap-3 rounded-2xl px-4 py-2.5",
            "border shadow-xl backdrop-blur-md",
            "transition-all duration-300",
            reached
              ? "bg-emerald-950/90 border-emerald-400/50 shadow-emerald-500/30"
              : "bg-slate-900/95 border-white/10 shadow-black/30"
          )}
        >
          {/* Circular progress indicator */}
          <div className="relative h-12 w-12 flex-shrink-0">
            <svg
              className="h-full w-full -rotate-90"
              viewBox="0 0 48 48"
            >
              {/* Background circle */}
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-slate-700/40"
              />
              {/* Progress circle */}
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - progressRatio)}
                className={clsx(
                  "transition-all duration-100",
                  reached ? "text-emerald-400" : "text-sky-400"
                )}
              />
            </svg>
            {/* Timer text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={clsx(
                  "text-xs font-bold tabular-nums",
                  reached ? "text-emerald-300" : "text-white"
                )}
              >
                {mm}:{ss.toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Info section */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-300">
              {exerciseName}
            </p>
            <p
              className={clsx(
                "text-[10px] font-semibold uppercase tracking-wider",
                reached ? "text-emerald-400" : "text-sky-400"
              )}
            >
              {reached ? "Ready!" : "Resting..."}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRestart(entryId)}
              className="rounded-lg bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
              title="Restart timer"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-8.624-2.849a5.5 5.5 0 019.201-2.466l.312.311h-2.433a.75.75 0 000 1.5h4.243a.75.75 0 00.75-.75V2.928a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 004.239 8.186a.75.75 0 001.449.39z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              onClick={() => onStop(entryId)}
              className="rounded-lg bg-white/10 p-2 text-white/70 transition hover:bg-red-500/20 hover:text-red-300"
              title="Stop timer"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar underneath */}
        <div className="mx-2 mt-1 h-1 overflow-hidden rounded-full bg-slate-800/80">
          <motion.div
            className={clsx(
              "h-full rounded-full",
              reached
                ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                : "bg-gradient-to-r from-sky-400 to-indigo-400"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progressRatio * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
