/**
 * Loading Skeleton components for better perceived performance
 * Show structure while data loads instead of blank spinners
 */

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Generic skeleton box with shimmer animation
 */
export function SkeletonBox({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton-enhanced rounded-lg ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton for session list page
 */
export function SessionsPageSkeleton() {
  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <SkeletonBox className="h-8 w-48" />
        <SkeletonBox className="h-10 w-32" />
      </div>

      {/* Week selector skeleton */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <SkeletonBox key={i} className="h-12 w-16 flex-shrink-0" />
        ))}
      </div>

      {/* Session cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-800/30 rounded-xl p-6 space-y-4 border border-slate-700/30">
          {/* Session header */}
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-6 w-40" />
            <SkeletonBox className="h-8 w-24" />
          </div>

          {/* Exercise entries */}
          {[1, 2, 3].map((j) => (
            <div key={j} className="space-y-2">
              <SkeletonBox className="h-5 w-32" />
              <div className="flex gap-2">
                <SkeletonBox className="h-10 flex-1" />
                <SkeletonBox className="h-10 flex-1" />
                <SkeletonBox className="h-10 w-16" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for dashboard page with charts
 */
export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-10 w-56" />
        <SkeletonBox className="h-10 w-32" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800/30 rounded-xl p-6 space-y-3 border border-slate-700/30">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-8 w-20" />
            <SkeletonBox className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Main chart */}
      <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
        <SkeletonBox className="h-6 w-48 mb-4" />
        <SkeletonBox className="h-64 w-full" />
      </div>

      {/* Secondary charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
            <SkeletonBox className="h-5 w-40 mb-4" />
            <SkeletonBox className="h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for measurements page
 */
export function MeasurementsSkeleton() {
  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-8 w-48" />
        <SkeletonBox className="h-10 w-40" />
      </div>

      {/* Chart area */}
      <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBox className="h-6 w-32" />
          <SkeletonBox className="h-8 w-24" />
        </div>
        <SkeletonBox className="h-72 w-full" />
      </div>

      {/* Measurement list */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
            <SkeletonBox className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-4 w-32" />
              <SkeletonBox className="h-3 w-48" />
            </div>
            <SkeletonBox className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for templates page
 */
export function TemplatesSkeleton() {
  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <SkeletonBox className="h-8 w-40" />
        <SkeletonBox className="h-10 w-36" />
      </div>

      {/* Template cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-slate-800/30 rounded-xl p-6 space-y-4 border border-slate-700/30">
            <SkeletonBox className="h-6 w-3/4" />
            <div className="space-y-2">
              <SkeletonBox className="h-4 w-full" />
              <SkeletonBox className="h-4 w-5/6" />
              <SkeletonBox className="h-4 w-4/6" />
            </div>
            <div className="flex gap-2 pt-2">
              <SkeletonBox className="h-9 flex-1" />
              <SkeletonBox className="h-9 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Generic list skeleton (reusable)
 */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
          <SkeletonBox className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-4 w-3/4" />
            <SkeletonBox className="h-3 w-1/2" />
          </div>
          <SkeletonBox className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Compact skeleton for inline loading (e.g., inside buttons)
 */
export function InlineSkeleton({ width = 'w-20' }: { width?: string }) {
  return <SkeletonBox className={`h-4 ${width} inline-block`} />;
}

/**
 * Chart skeleton (for recharts lazy loading)
 */
export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`${height} w-full relative overflow-hidden bg-slate-800/30 rounded-lg border border-slate-700/30`}>
      {/* Animated shimmer effect */}
      <div className="absolute inset-0 animate-pulse">
        {/* Y-axis */}
        <div className="absolute left-2 top-4 bottom-8 w-12 space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBox key={i} className="h-2 w-full" />
          ))}
        </div>

        {/* Chart area */}
        <div className="absolute left-16 right-4 top-4 bottom-8 flex items-end gap-2">
          {[60, 80, 50, 90, 70, 85, 65, 75, 95, 55].map((height, i) => (
            <SkeletonBox
              key={i}
              className="flex-1"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* X-axis */}
        <div className="absolute left-16 right-4 bottom-2 flex justify-between">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBox key={i} className="h-2 w-8" />
          ))}
        </div>
      </div>
    </div>
  );
}
