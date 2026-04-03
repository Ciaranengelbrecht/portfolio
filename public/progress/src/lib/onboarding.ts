import { defaultProgram } from "./defaults";
import { getAllCached } from "./dataCache";
import { getSettings } from "./helpers";
import type {
  GuidedSetupState,
  Session,
  TrainingGoalEmphasis,
  UserProgram,
} from "./types";

export interface FirstRunStatus {
  shouldShowFirstRun: boolean;
  hasMeaningfulSessions: boolean;
  isDefaultProgram: boolean;
  guidedCompleted: boolean;
  guidedSkipped: boolean;
}

function hasMeaningfulSessionData(session: Session): boolean {
  if (!Array.isArray(session.entries) || !session.entries.length) return false;
  return session.entries.some((entry) =>
    Array.isArray(entry.sets)
      ? entry.sets.some((set) => {
          const weight = Number(set?.weightKg ?? 0);
          const reps = Number(set?.reps ?? 0);
          const rpe = Number(set?.rpe ?? 0);
          return weight > 0 || reps > 0 || rpe > 0;
        })
      : false
  );
}

function isDefaultProgram(program: UserProgram | null): boolean {
  if (!program) return true;
  return program.id === defaultProgram.id;
}

export async function getFirstRunStatus(
  program: UserProgram | null
): Promise<FirstRunStatus> {
  const settings = await getSettings();
  const sessions = await getAllCached<Session>("sessions", { swr: true });
  const meaningful = sessions.some(hasMeaningfulSessionData);
  const guided = settings.progress?.guidedSetup;
  const completed = guided?.completed === true;
  const skipped = guided?.skipped === true;
  const usingDefaultProgram = isDefaultProgram(program);

  return {
    shouldShowFirstRun:
      !completed && !skipped && usingDefaultProgram && !meaningful,
    hasMeaningfulSessions: meaningful,
    isDefaultProgram: usingDefaultProgram,
    guidedCompleted: completed,
    guidedSkipped: skipped,
  };
}

function quickPrimaryByGoal(goal: TrainingGoalEmphasis): GuidedSetupState["priorityMuscles"] {
  if (goal === "strength") {
    return {
      primary: ["quads", "back", "chest"],
      secondary: ["hamstrings", "shoulders"],
      maintenance: ["biceps", "triceps", "core"],
    };
  }
  if (goal === "hypertrophy") {
    return {
      primary: ["chest", "back", "shoulders"],
      secondary: ["quads", "hamstrings"],
      maintenance: ["biceps", "triceps", "core"],
    };
  }
  return {
    primary: ["chest", "back", "quads"],
    secondary: ["shoulders", "hamstrings"],
    maintenance: ["biceps", "triceps", "core"],
  };
}

export function createQuickStarterState(
  goal: TrainingGoalEmphasis = "balanced"
): GuidedSetupState {
  return {
    experience: "beginner",
    equipment: "commercial-gym",
    goalEmphasis: goal,
    daysPerWeek: 4,
    preferredRestDays: [6],
    setsPerSession: 10,
    volumePreference: "standard",
    priorityMuscles: quickPrimaryByGoal(goal),
  };
}

export function withQuickDefaults(
  state: GuidedSetupState,
  fallbackGoal: TrainingGoalEmphasis = "balanced"
): GuidedSetupState {
  const goal = state.goalEmphasis || fallbackGoal;
  return {
    ...state,
    setsPerSession: state.setsPerSession ?? 10,
    volumePreference: state.volumePreference ?? "standard",
    priorityMuscles:
      state.priorityMuscles?.primary?.length ||
      state.priorityMuscles?.secondary?.length ||
      state.priorityMuscles?.maintenance?.length
        ? state.priorityMuscles
        : quickPrimaryByGoal(goal),
  };
}
