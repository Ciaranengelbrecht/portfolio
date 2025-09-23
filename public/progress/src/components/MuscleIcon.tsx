import React from 'react';

type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'other';

interface MuscleIconProps {
  group: MuscleGroup;
  size?: number;
  className?: string;
  highlightColor?: string; // override if needed
  title?: string; // accessible label
}

// Monochrome gradient base (subtle)
// Vibrant highlight path per muscle group
// Separate anterior/posterior base depending on muscle

const FRONT_GROUPS: MuscleGroup[] = [
  'chest','shoulders','biceps','triceps','forearms','quads','calves','core','other'
];

const BACK_GROUPS: MuscleGroup[] = [
  'back','hamstrings','glutes'
];

// Default highlight colors (could later be category-coded)
const HIGHLIGHT: Record<MuscleGroup,string> = {
  chest: '#f87171',
  back: '#60a5fa',
  shoulders: '#fbbf24',
  biceps: '#34d399',
  triceps: '#10b981',
  forearms: '#2dd4bf',
  quads: '#a78bfa',
  hamstrings: '#818cf8',
  glutes: '#fb7185',
  calves: '#f472b6',
  core: '#fb923c',
  other: '#c084fc'
};

// Base silhouette reused; highlight path changes.
// Coordinate system 0 0 64 64 (same as prior assets) for easy swap.

const MuscleIcon: React.FC<MuscleIconProps> = ({ group, size = 48, className = '', highlightColor, title }) => {
  const idBase = React.useId();
  const gradientId = `baseGrad-${idBase}`;
  const chosenHighlightColor = highlightColor || HIGHLIGHT[group];
  const isBack = BACK_GROUPS.includes(group);

  // Base front torso/limb simplified silhouette
  const frontBase = (
    <path
      d="M24 6h16l3 8c1 3 4 5 7 6v8c0 6-2 12-6 18-3 5-8 8-12 8s-9-3-12-8c-4-6-6-12-6-18v-8c3-1 6-3 7-6l3-8Z"
      fill={`url(#${gradientId})`}
      stroke="#475569"
      strokeWidth={2}
    />
  );

  // Back silhouette slightly tweaked (narrow waist, broader upper back)
  const backBase = (
    <path
      d="M22 6h20l4 7c2 3 5 5 8 6v8c0 6-2 13-7 20-4 5-9 8-15 8s-11-3-15-8c-5-7-7-14-7-20v-8c3-1 6-3 8-6l4-7Z"
      fill={`url(#${gradientId})`}
      stroke="#475569"
      strokeWidth={2}
    />
  );

  // Individual highlight shapes (kept minimal but distinct)
  const highlightPath = (() => {
    switch (group) {
      case 'chest':
        return <path d="M20 22c3-2 6-3 12-3s9 1 12 3v5c0 3-1 5-3 7-2 1-5 2-9 2s-7-1-9-2c-2-2-3-4-3-7v-5Z" fill={chosenHighlightColor} />;
      case 'back':
        return <path d="M24 20c2-3 6-5 8-5s6 2 8 5c2 4 3 7 3 11 0 3-1 6-2 8-2 4-5 6-9 6s-7-2-9-6c-1-2-2-5-2-8 0-4 1-7 3-11Z" fill={chosenHighlightColor} />;
      case 'shoulders':
        return <path d="M18 20c2-2 6-3 14-3s12 1 14 3c0 3-1 6-2 8-2 3-4 5-6 6-2-3-4-4-6-4s-4 1-6 4c-2-1-4-3-6-6-1-2-2-5-2-8Z" fill={chosenHighlightColor} />;
      case 'biceps':
        return <path d="M18 26c1-2 3-3 5-3 3 1 5 4 5 7 0 4-2 7-5 8-2 0-4-2-5-5-1-2-1-5 0-7Zm18 0c1-2 3-3 5-3 3 1 5 4 5 7 0 4-2 7-5 8-2 0-4-2-5-5-1-2-1-5 0-7Z" fill={chosenHighlightColor} />;
      case 'triceps':
        return <path d="M18 24c2-2 4-3 6-2 3 2 4 5 4 8 0 3-1 6-4 8-2 1-4 0-6-3-1-2-2-4-2-5 0-2 1-4 2-6Zm22 0c-2-2-4-3-6-2-3 2-4 5-4 8 0 3 1 6 4 8 2 1 4 0 6-3 1-2 2-4 2-5 0-2-1-4-2-6Z" fill={chosenHighlightColor} />;
      case 'forearms':
        return <path d="M16 30c1-2 3-3 5-2 3 2 4 5 4 9 0 3-1 6-4 8-2 1-4 0-5-2-1-2-2-5-2-7 0-2 1-4 2-6Zm32 0c-1-2-3-3-5-2-3 2-4 5-4 9 0 3 1 6 4 8 2 1 4 0 5-2 1-2 2-5 2-7 0-2-1-4-2-6Z" fill={chosenHighlightColor} />;
      case 'quads':
        return <path d="M22 32c3-2 6-3 10-3s7 1 10 3v6c0 2-1 5-2 7-2 4-5 6-8 6s-6-2-8-6c-1-2-2-5-2-7v-6Z" fill={chosenHighlightColor} />;
      case 'hamstrings':
        return <path d="M22 34c3-2 6-3 10-3s7 1 10 3v4c0 3-1 7-3 10-2 4-4 6-7 6s-5-2-7-6c-2-3-3-7-3-10v-4Z" fill={chosenHighlightColor} />;
      case 'glutes':
        return <path d="M20 26c2-2 6-3 12-3s10 1 12 3v4c0 2-1 5-2 7-2 3-5 5-10 5s-8-2-10-5c-1-2-2-5-2-7v-4Z" fill={chosenHighlightColor} />;
      case 'calves':
        return <path d="M22 38c3-2 6-3 10-3s7 1 10 3v2c0 3-1 6-3 9-2 3-4 5-7 5s-5-2-7-5c-2-3-3-6-3-9v-2Z" fill={chosenHighlightColor} />;
      case 'core':
        return <path d="M26 20c2-1 4-1 6-1s4 0 6 1v12c0 3-1 6-2 8-1 3-2 4-4 4s-3-1-4-4c-1-2-2-5-2-8V20Z" fill={chosenHighlightColor} />;
      case 'other':
        return <circle cx={32} cy={30} r={6} fill={chosenHighlightColor} />;
      default:
        return null;
    }
  })();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title || group}
      className={className}
    >
      <title>{title || group}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="60%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {isBack ? backBase : frontBase}
      {highlightPath}
    </svg>
  );
};

export default MuscleIcon;
