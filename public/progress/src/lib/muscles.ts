// Centralized muscle icon mapping helper
// Provides a single source of truth for muscle group -> SVG asset path.
// Paths are relative so they work under the Vite base './' configuration.

export type MuscleGroup =
  | 'chest'
  | 'lats'        // back width (lat pulldowns, pull-ups, rows)
  | 'traps'       // upper back (shrugs, upright rows, face pulls)
  | 'delts'       // front/lateral delts (overhead press, lateral raises, front raises)
  | 'reardelts'   // rear delts (rear delt fly, face pulls, reverse pec deck)
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'other'
  // Legacy aliases
  | 'back'
  | 'shoulders'
  | 'legs';

export const MUSCLE_ICON_PATHS: Record<string, string> = {
  // Primary muscle groups with specific icons
  chest: './muscles/chest.svg',
  lats: './muscles/backlats.svg',
  traps: './muscles/traps.svg',
  delts: './muscles/delts.svg',
  reardelts: './muscles/reardelt.svg',
  biceps: './muscles/biceps.svg',
  triceps: './muscles/triceps.svg',
  forearms: './muscles/forearms.svg',
  quads: './muscles/quads.svg',
  hamstrings: './muscles/hamstrings.svg',
  glutes: './muscles/glutes.svg',
  calves: './muscles/calves.svg',
  core: './muscles/core.svg',
  other: './muscles/other.svg',
  // Legacy aliases - map to new icons
  back: './muscles/backlats.svg',
  shoulders: './muscles/delts.svg',
  legs: './muscles/quads.svg',
};

export function getMuscleIconPath(group?: string | null): string | undefined {
  if (!group) return MUSCLE_ICON_PATHS.other;
  const key = group.toLowerCase();
  if (MUSCLE_ICON_PATHS[key]) return MUSCLE_ICON_PATHS[key];
  // Graceful fallbacks for aggregated labels used in analytics
  if (key === 'arms') return MUSCLE_ICON_PATHS.biceps;
  return MUSCLE_ICON_PATHS.other;
}

/** Map legacy muscle group names to new specific ones */
export function normalizeMuscleGroup(group: string): string {
  const lower = group.toLowerCase();
  // Keep specific new groups as-is
  if (['lats', 'traps', 'delts', 'reardelts'].includes(lower)) return lower;
  // Map legacy to new
  if (lower === 'back') return 'lats';
  if (lower === 'shoulders') return 'delts';
  if (lower === 'legs') return 'quads';
  return lower;
}
