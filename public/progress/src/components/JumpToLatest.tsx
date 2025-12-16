import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";

interface JumpToLatestProps {
  /** Callback when the button is clicked */
  onJump: () => void;
  /** Whether the user is currently viewing the latest session */
  isAtLatest: boolean;
  /** Label to show (e.g., "Phase 2, Week 3") */
  latestLabel?: string;
  /** Threshold in pixels before showing the button */
  scrollThreshold?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Floating button that appears when user has scrolled away from their latest session.
 * Allows quick navigation back to the most recent workout.
 */
export default function JumpToLatest({
  onJump,
  isAtLatest,
  latestLabel,
  scrollThreshold = 200,
  className,
}: JumpToLatestProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  // Reset dismissed state when user navigates to latest
  useEffect(() => {
    if (isAtLatest) {
      setDismissed(false);
    }
  }, [isAtLatest]);

  const handleClick = useCallback(() => {
    onJump();
    setDismissed(true);
  }, [onJump]);

  const shouldShow = !isAtLatest && isScrolled && !dismissed;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={clsx(
            "fixed bottom-24 left-1/2 z-[1050] -translate-x-1/2",
            "md:bottom-8",
            className
          )}
        >
          <button
            onClick={handleClick}
            className={clsx(
              "group flex items-center gap-2 rounded-full",
              "bg-gradient-to-r from-emerald-600 to-teal-600",
              "px-4 py-2.5 text-sm font-semibold text-white",
              "shadow-lg shadow-emerald-600/30",
              "border border-emerald-400/30",
              "transition-all duration-200",
              "hover:shadow-xl hover:shadow-emerald-500/40",
              "hover:scale-105 active:scale-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            )}
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-y-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                clipRule="evenodd"
              />
            </svg>
            <span>Jump to Latest</span>
            {latestLabel && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                {latestLabel}
              </span>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
