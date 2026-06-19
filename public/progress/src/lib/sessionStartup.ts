import { buildPrevBestMap, type PrevBestLookup } from "./prevBest";
import type { Exercise, Session, Settings, Template } from "./types";

export type SessionsStartupBundle = {
  templates: Template[];
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
  prevBestMap: PrevBestLookup | null;
  prScoresByExercise: Record<string, number>;
};

type StartupLoaders = {
  loadTemplates: () => Promise<Template[]>;
  loadExercises: () => Promise<Exercise[]>;
  loadSessions: () => Promise<Session[]>;
  loadSettings: () => Promise<Settings>;
};

export type StartupView = {
  phase: number;
  week: number;
  day: number;
  sessionId?: string | null;
  templateId?: string | null;
  exerciseIds?: string[];
};

export function computeExercisePrScores(
  sessions: Session[],
  exerciseIds?: Iterable<string>
): Record<string, number> {
  const allowed = exerciseIds ? new Set(exerciseIds) : null;
  const scores: Record<string, number> = {};

  for (const session of sessions) {
    if (!Array.isArray(session.entries)) continue;
    for (const entry of session.entries) {
      if (allowed && !allowed.has(entry.exerciseId)) continue;
      if (!Array.isArray(entry.sets)) continue;
      for (const set of entry.sets) {
        const score = (set.weightKg ?? 0) * (set.reps ?? 0);
        if (score > (scores[entry.exerciseId] ?? 0)) {
          scores[entry.exerciseId] = score;
        }
      }
    }
  }

  return scores;
}

export async function loadSessionsStartupBundle(
  loaders: StartupLoaders,
  view: StartupView
): Promise<SessionsStartupBundle> {
  const [templates, exercises, sessions, settings] = await Promise.all([
    loaders.loadTemplates(),
    loaders.loadExercises(),
    loaders.loadSessions(),
    loaders.loadSettings(),
  ]);

  const prevBestMap = buildPrevBestMap(
    sessions,
    view.week,
    view.phase,
    view.day,
    { activeSessionId: view.sessionId }
  );
  const prScoresByExercise = computeExercisePrScores(
    sessions,
    view.exerciseIds
  );

  return {
    templates,
    exercises,
    sessions,
    settings,
    prevBestMap,
    prScoresByExercise,
  };
}
