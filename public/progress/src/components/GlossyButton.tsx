import { motion } from 'framer-motion';
import { clsx } from 'clsx';

// Relaxed typing to avoid friction during UI polish; refine later with proper union merging.
interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'subtle' | 'outline';
  tone?: 'accent' | 'neutral' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const sizeClasses: Record<NonNullable<GlossyButtonProps['size']>, string> = {
  xs: 'text-[11px] px-2.5 py-1.5 rounded-lg gap-1',
  sm: 'text-xs px-3 py-2 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-5 py-3 rounded-xl gap-2'
};

export default function GlossyButton({
  children,
  className,
  variant = 'subtle',
  tone = 'accent',
  size = 'md',
  loading = false,
  iconLeft,
  iconRight,
  disabled,
  ...props
}: any){
  const toneMap = {
    accent: {
      solid: 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-black shadow-[0_4px_16px_-6px_rgba(16,185,129,0.55)] hover:from-emerald-400 hover:to-emerald-500',
      subtle: 'bg-gradient-to-b from-emerald-400/15 to-emerald-500/10 text-emerald-300 hover:from-emerald-400/25 hover:to-emerald-500/15',
      outline: 'border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
    },
    neutral: {
      solid: 'bg-gradient-to-b from-slate-300 to-slate-200 text-slate-900 hover:from-slate-200 hover:to-slate-100',
      subtle: 'bg-gradient-to-b from-white/10 to-white/5 text-gray-200 hover:from-white/20 hover:to-white/10',
      outline: 'border border-white/15 text-gray-200 hover:bg-white/5'
    },
    danger: {
      solid: 'bg-gradient-to-b from-rose-500 to-rose-600 text-white hover:from-rose-400 hover:to-rose-500',
      subtle: 'bg-gradient-to-b from-rose-400/15 to-rose-500/10 text-rose-300 hover:from-rose-400/25 hover:to-rose-500/15',
      outline: 'border border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
    }
  } as const;

  const base = 'relative inline-flex items-center font-medium transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed select-none';
  const gloss = variant === 'solid' ? 'before:absolute before:inset-0 before:[background:linear-gradient(140deg,rgba(255,255,255,0.35),rgba(255,255,255,0)_40%)] before:opacity-60 before:mix-blend-overlay before:rounded-inherit' : 'before:absolute before:inset-0 before:rounded-inherit before:bg-[linear-gradient(160deg,rgba(255,255,255,0.25),rgba(255,255,255,0)_55%)] before:opacity-40';
  const motionProps = {
    whileTap: { scale: 0.96 },
    whileHover: { y: -2 },
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  };

  return (
    <motion.button
      {...motionProps}
      {...props}
      disabled={disabled || loading}
  className={clsx(base, gloss, (sizeClasses as any)[size], (toneMap as any)[tone][variant], className, 'overflow-hidden')}
      data-variant={variant}
      data-tone={tone}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center bg-black/20 backdrop-blur-[1px]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </span>
      )}
      {iconLeft && <span className="shrink-0 inline-flex">{iconLeft}</span>}
      <span className={clsx('relative z-[1] flex-1 text-center', loading && 'opacity-0')}>{children}</span>
      {iconRight && <span className="shrink-0 inline-flex">{iconRight}</span>}
    </motion.button>
  );
}
