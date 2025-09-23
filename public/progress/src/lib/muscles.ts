// Centralized muscle icon mapping helper
// Provides a single source of truth for muscle group -> SVG asset path.
// Paths are relative so they work under the Vite base './' configuration.

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'other';

export const MUSCLE_ICON_PATHS: Record<MuscleGroup, string> = {
  chest: './muscles/chest.svg',
  back: './muscles/back.svg',
  shoulders: './muscles/shoulders.svg',
  biceps: './muscles/biceps.svg',
  triceps: './muscles/triceps.svg',
  forearms: './muscles/forearms.svg',
  quads: './muscles/quads.svg',
  hamstrings: './muscles/hamstrings.svg',
  glutes: './muscles/glutes.svg',
  calves: './muscles/calves.svg',
  core: './muscles/core.svg',
  other: './muscles/other.svg',
};

export function getMuscleIconPath(group?: string | null): string | undefined {
  if (!group) return MUSCLE_ICON_PATHS.other;
  const key = group.toLowerCase() as MuscleGroup;
  return (MUSCLE_ICON_PATHS as any)[key] || MUSCLE_ICON_PATHS.other;
}
