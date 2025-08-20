import { Variants } from 'framer-motion';

export const durations = {
  xs: 0.15,
  sm: 0.22,
  md: 0.35,
  lg: 0.55,
};

export const easings = {
  standard: [0.32,0.72,0.33,1],
  entrance: [0.34,1.56,0.64,1],
  exit: [0.4,0,1,1],
};

export const fadeSlideUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: durations.sm, ease: easings.standard } },
  exit: { opacity: 0, y: 8, transition: { duration: durations.xs, ease: easings.exit } }
};

export const scaleIn: Variants = {
  initial: { opacity:0, scale: .92 },
  animate: { opacity:1, scale:1, transition:{ duration: durations.sm, ease: easings.entrance } },
  exit: { opacity:0, scale:.94, transition:{ duration: durations.xs, ease: easings.exit } }
};

export const fade: Variants = {
  initial: { opacity:0 },
  animate: { opacity:1, transition:{ duration: durations.xs } },
  exit: { opacity:0, transition:{ duration: durations.xs } }
};

export const slideFromRight: Variants = {
  initial: { x: '16%', opacity:0 },
  animate: { x: 0, opacity:1, transition:{ duration: durations.md, ease: easings.standard } },
  exit: { x: '12%', opacity:0, transition:{ duration: durations.sm, ease: easings.exit } }
};

export const springBar = {
  type: 'spring', stiffness: 160, damping: 24, mass: 0.6
};

export const prefersReducedMotion = () => {
  if(typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const maybeDisable = <T extends Record<string, any>>(variants:T):T => {
  if(prefersReducedMotion()){
    const clone: any = { ...variants };
    for(const key of Object.keys(clone)){
      clone[key] = { ...clone[key] };
      if('y' in clone[key]) delete clone[key].y;
      if('x' in clone[key]) delete clone[key].x;
      if('scale' in clone[key]) delete clone[key].scale;
      clone[key].transition = { duration: 0 };
    }
    return clone;
  }
  return variants;
};
