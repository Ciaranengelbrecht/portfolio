import { useMemo, useCallback, useRef } from 'react';
import type { Session, Exercise } from './types';

/**
 * Memoized exercise map builder - prevents recreation on every render
 * Only rebuilds when exercise IDs actually change (not on unrelated updates)
 */
export function useExerciseMap(exercises: Exercise[]) {
  // Stable reference: only recreate if exercise IDs/order change
  const exerciseIds = useMemo(
    () => exercises.map(e => e.id).join(','),
    [exercises]
  );
  
  return useMemo(
    () => new Map(exercises.map((e) => [e.id, e] as const)),
    [exerciseIds] // eslint-disable-line react-hooks/exhaustive-deps
  );
}

/**
 * Debounced state updater for inputs - prevents re-render storms
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Stable session validator - only re-checks when session ID changes
 */
export function useSessionReady(session: Session | null, exMap: Map<string, Exercise>) {
  return useMemo(() => {
    if (!session) return false;
    if (session.entries.length === 0) return true; // empty session is valid
    return session.entries.every((en) => exMap.has(en.exerciseId));
  }, [session?.id, exMap]); // Intentionally only session.id, not full entries
}

/**
 * Extract muscle counts computation (heavy operation)
 */
export function computeMuscleCounts(
  session: Session | null,
  exMap: Map<string, Exercise>
): Record<string, number> {
  if (!session) return {};
  
  const counts: Record<string, number> = {};
  for (const entry of session.entries) {
    const ex = exMap.get(entry.exerciseId);
    if (!ex) continue;
    
    const completedSets = entry.sets.filter(
      (s) => s.completedAt && (s.reps || 0) > 0
    ).length;
    
    if (completedSets === 0) continue;
    
    // Primary muscle
    if (ex.muscleGroup) {
      counts[ex.muscleGroup] = (counts[ex.muscleGroup] || 0) + completedSets;
    }
    
    // Secondary muscles (0.5x weighting for compounds)
    if (ex.secondaryMuscles?.length) {
      const weight = 0.5;
      for (const muscle of ex.secondaryMuscles) {
        counts[muscle] = (counts[muscle] || 0) + completedSets * weight;
      }
    }
  }
  
  return counts;
}
