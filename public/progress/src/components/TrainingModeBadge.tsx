import { clsx } from "clsx";
import type { TrainingMode } from "../lib/types";

interface TrainingModeBadgeProps {
  mode: TrainingMode;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const MODE_CONFIG: Record<
  TrainingMode,
  { label: string; icon: string; bg: string; border: string; text: string }
> = {
  bulk: {
    label: "Bulk",
    icon: "↑",
    bg: "bg-green-500/15",
    border: "border-green-400/30",
    text: "text-green-300",
  },
  cut: {
    label: "Cut",
    icon: "↓",
    bg: "bg-red-500/15",
    border: "border-red-400/30",
    text: "text-red-300",
  },
  maintenance: {
    label: "Maint",
    icon: "→",
    bg: "bg-blue-500/15",
    border: "border-blue-400/30",
    text: "text-blue-300",
  },
};

/**
 * Compact badge showing the training mode (bulk/cut/maintenance)
 * Designed to be subtle but informative at a glance
 */
export default function TrainingModeBadge({
  mode,
  size = "xs",
  className,
}: TrainingModeBadgeProps) {
  const config = MODE_CONFIG[mode];

  const sizeClasses = {
    xs: "text-[9px] px-1.5 py-0.5 gap-0.5",
    sm: "text-[10px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-wide",
        config.bg,
        config.border,
        config.text,
        sizeClasses[size],
        className
      )}
      title={`Training mode: ${config.label}`}
    >
      <span className="opacity-80">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export { MODE_CONFIG };
