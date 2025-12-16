import { useMemo } from "react";
import { clsx } from "clsx";

interface SessionBreadcrumbProps {
  phase: number;
  week: number;
  day: number;
  dayLabel?: string;
  className?: string;
}

/**
 * Visual breadcrumb showing the current session location: Phase > Week > Day
 * Provides at-a-glance context for the user's position in their program
 */
export default function SessionBreadcrumb({
  phase,
  week,
  day,
  dayLabel,
  className,
}: SessionBreadcrumbProps) {
  const displayDay = dayLabel || `Day ${day + 1}`;

  return (
    <nav
      aria-label="Session location"
      className={clsx(
        "inline-flex items-center gap-1.5 text-[11px] font-medium",
        className
      )}
    >
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 border border-indigo-400/25 px-2 py-0.5 text-indigo-300">
        <svg
          className="h-3 w-3 opacity-70"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10 2L2 7v11a1 1 0 001 1h14a1 1 0 001-1V7l-8-5z" />
        </svg>
        Phase {phase}
      </span>
      <ChevronIcon />
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-400/25 px-2 py-0.5 text-emerald-300">
        <svg
          className="h-3 w-3 opacity-70"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
            clipRule="evenodd"
          />
        </svg>
        Week {week}
      </span>
      <ChevronIcon />
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-400/25 px-2 py-0.5 text-amber-300">
        <svg
          className="h-3 w-3 opacity-70"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
        {displayDay}
      </span>
    </nav>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="h-3 w-3 text-slate-500"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}
