import { clsx } from "clsx";

interface SkeletonProps {
  /** Width of the skeleton. Can be a Tailwind class or CSS value */
  width?: string;
  /** Height of the skeleton. Can be a Tailwind class or CSS value */
  height?: string;
  /** Make the skeleton a circle (for avatars, icons) */
  circle?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Number of skeleton lines to render (for text blocks) */
  lines?: number;
  /** Variant style */
  variant?: "default" | "card" | "text" | "button" | "input";
}

/**
 * Unified Skeleton component for consistent loading states across the app.
 * Uses the shimmer animation defined in index.css
 */
export function Skeleton({
  width,
  height,
  circle = false,
  className,
  lines = 1,
  variant = "default",
}: SkeletonProps) {
  const baseStyles = "skeleton-enhanced animate-pulse";

  const variantStyles: Record<string, string> = {
    default: "bg-slate-800/60 rounded-md",
    card: "bg-slate-800/40 rounded-xl border border-white/5",
    text: "bg-slate-700/50 rounded",
    button: "bg-slate-700/60 rounded-lg",
    input: "bg-slate-900/60 rounded-xl border border-slate-700/50",
  };

  const getSize = () => {
    const style: React.CSSProperties = {};
    
    if (width) {
      if (width.startsWith("w-") || width.includes("%") || width.includes("px") || width.includes("rem")) {
        // Let className handle it
      } else {
        style.width = width;
      }
    }
    
    if (height) {
      if (height.startsWith("h-") || height.includes("%") || height.includes("px") || height.includes("rem")) {
        // Let className handle it
      } else {
        style.height = height;
      }
    }
    
    return style;
  };

  if (lines > 1) {
    return (
      <div className={clsx("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              baseStyles,
              variantStyles.text,
              "h-4",
              i === lines - 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        baseStyles,
        variantStyles[variant],
        circle && "rounded-full",
        width?.startsWith("w-") && width,
        height?.startsWith("h-") && height,
        !width && !height && "w-full h-4",
        className
      )}
      style={getSize()}
    />
  );
}

/**
 * Skeleton for a card with header, body content, and optional footer
 */
export function SkeletonCard({
  className,
  showHeader = true,
  showFooter = false,
  lines = 3,
}: {
  className?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  lines?: number;
}) {
  return (
    <div
      className={clsx(
        "skeleton-card rounded-xl border border-white/5 bg-slate-900/40 p-4 space-y-4",
        className
      )}
    >
      {showHeader && (
        <div className="flex items-center gap-3">
          <Skeleton circle width="40px" height="40px" />
          <div className="flex-1 space-y-2">
            <Skeleton height="h-4" width="w-1/3" variant="text" />
            <Skeleton height="h-3" width="w-1/4" variant="text" />
          </div>
        </div>
      )}
      <Skeleton lines={lines} />
      {showFooter && (
        <div className="flex gap-2 pt-2 border-t border-white/5">
          <Skeleton height="h-8" width="w-20" variant="button" />
          <Skeleton height="h-8" width="w-20" variant="button" />
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton for an exercise row in sessions
 */
export function SkeletonExerciseRow({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/5 bg-slate-900/40 p-3 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton circle width="36px" height="36px" />
        <div className="flex-1">
          <Skeleton height="h-5" width="w-2/5" variant="text" />
        </div>
        <Skeleton height="h-6" width="w-16" variant="button" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height="h-10" variant="input" />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for a stat/metric display
 */
export function SkeletonStat({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { value: "h-5 w-12", label: "h-3 w-16" },
    md: { value: "h-7 w-16", label: "h-3 w-20" },
    lg: { value: "h-9 w-20", label: "h-4 w-24" },
  };

  return (
    <div className={clsx("space-y-1", className)}>
      <Skeleton height={sizes[size].value.split(" ")[0]} width={sizes[size].value.split(" ")[1]} variant="text" />
      <Skeleton height={sizes[size].label.split(" ")[0]} width={sizes[size].label.split(" ")[1]} variant="text" />
    </div>
  );
}

/**
 * Skeleton for chart loading state
 */
export function SkeletonChart({
  className,
  height = "h-48",
}: {
  className?: string;
  height?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/5 bg-slate-900/30 p-4 flex flex-col",
        height,
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton height="h-5" width="w-32" variant="text" />
        <div className="flex gap-2">
          <Skeleton height="h-6" width="w-16" variant="button" />
          <Skeleton height="h-6" width="w-16" variant="button" />
        </div>
      </div>
      <div className="flex-1 flex items-end gap-1 px-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 skeleton-enhanced bg-slate-700/30 rounded-t"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 px-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height="h-3" width="w-8" variant="text" />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for muscle/recovery card grid item
 */
export function SkeletonMuscleCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/10 bg-slate-950/75 p-3 space-y-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton circle width="36px" height="36px" />
          <div className="space-y-1">
            <Skeleton height="h-4" width="w-16" variant="text" />
            <Skeleton height="h-3" width="w-12" variant="text" />
          </div>
        </div>
        <Skeleton height="h-5" width="w-14" className="rounded-full" variant="button" />
      </div>
      <div className="flex items-end justify-between">
        <Skeleton height="h-8" width="w-12" variant="text" />
        <div className="text-right space-y-1">
          <Skeleton height="h-3" width="w-8" variant="text" />
          <Skeleton height="h-4" width="w-10" variant="text" />
        </div>
      </div>
      <Skeleton height="h-1.5" className="rounded-full" />
    </div>
  );
}

/**
 * Skeleton for list items
 */
export function SkeletonListItem({
  className,
  showAvatar = true,
}: {
  className?: string;
  showAvatar?: boolean;
}) {
  return (
    <div className={clsx("flex items-center gap-3 p-3", className)}>
      {showAvatar && <Skeleton circle width="40px" height="40px" />}
      <div className="flex-1 space-y-2">
        <Skeleton height="h-4" width="w-3/5" variant="text" />
        <Skeleton height="h-3" width="w-2/5" variant="text" />
      </div>
      <Skeleton height="h-8" width="w-8" className="rounded-lg" />
    </div>
  );
}

/**
 * Full page loading skeleton
 */
export function SkeletonPage({
  title = true,
  cards = 3,
}: {
  title?: boolean;
  cards?: number;
}) {
  return (
    <div className="space-y-6 p-4 animate-in fade-in duration-300">
      {title && (
        <div className="flex items-center justify-between">
          <Skeleton height="h-7" width="w-40" variant="text" />
          <Skeleton height="h-9" width="w-24" variant="button" />
        </div>
      )}
      <div className="space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} lines={2 + (i % 2)} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
