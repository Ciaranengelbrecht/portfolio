import { describe, expect, it } from "vitest";
import {
  buildGuidedSetupPlan,
  calculateVolumeTargets,
  suggestWeeklySplit,
} from "../lib/guidedSetup";
import type { Exercise, GuidedSetupState } from "../lib/types";

const makeExercise = (
  id: string,
  name: string,
  muscleGroup: Exercise["muscleGroup"],
  tags: string[],
  secondaryMuscles: Exercise["secondaryMuscles"] = []
): Exercise => ({
  id,
  name,
  muscleGroup,
  defaults: { sets: 3, targetRepRange: "8-12" },
  active: true,
  tags,
  secondaryMuscles,
});

describe("guided setup heuristics", () => {
  const exercises: Exercise[] = [
    makeExercise(
      "pushup",
      "Push-up (Standard)",
      "chest",
      ["bodyweight", "press", "compound", "vertical", "mg:chest"],
      ["triceps", "shoulders"]
    ),
    makeExercise(
      "bandfly",
      "Band Chest Fly",
      "chest",
      ["band", "fly", "isolation", "mg:chest"],
      ["shoulders"]
    ),
    makeExercise(
      "machinepress",
      "Machine Chest Press",
      "chest",
      ["machine", "press", "compound", "mg:chest"],
      ["triceps", "shoulders"]
    ),
    makeExercise(
      "dips",
      "Bench Dip",
      "triceps",
      ["bodyweight", "press", "compound", "mg:triceps"],
      ["chest"]
    ),
    makeExercise(
      "row",
      "Seated Cable Row",
      "back",
      ["cable", "pull", "compound", "mg:back"],
      ["biceps"]
    ),
    makeExercise(
      "squat",
      "Bodyweight Squat",
      "quads",
      ["bodyweight", "squat", "compound", "mg:quads"],
      ["glutes", "hamstrings"]
    ),
  ];

  it("prefers equipment-compatible anchor exercises for minimal setups", () => {
    const state: GuidedSetupState = {
      experience: "beginner",
      equipment: "minimal",
      goalEmphasis: "balanced",
      daysPerWeek: 4,
      preferredRestDays: [6],
      setsPerSession: 10,
      volumePreference: "lower",
      priorityMuscles: {
        primary: ["chest"],
        secondary: ["triceps"],
        maintenance: ["quads"],
      },
    };

    const plan = buildGuidedSetupPlan(state, exercises);
    const chestTemplate = plan.templates.find((tpl) =>
      tpl.focusMuscles.includes("chest")
    );
    expect(
      chestTemplate,
      "expected a chest-focused template to be generated"
    ).toBeDefined();
    const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]));
    const planNames = chestTemplate!.plan.map(
      (entry) => exerciseById.get(entry.exerciseId)?.name
    );

    expect(
      planNames,
      "machine chest press should not appear for minimal setup"
    ).not.toContain("Machine Chest Press");
    const anchorExerciseId = chestTemplate!.plan[0]?.exerciseId;
    expect(anchorExerciseId).toBeDefined();
    expect(exerciseById.get(anchorExerciseId!)?.name).toBe(
      "Push-up (Standard)"
    );
  });

  it("honours preferred rest days in schedule generation", () => {
    const state: GuidedSetupState = {
      daysPerWeek: 4,
      preferredRestDays: [0, 6],
    };
    const schedule = suggestWeeklySplit(state);
    const restLabels = schedule
      .filter((day) => day.type === "Rest")
      .map((day) => day.id);
    expect(restLabels).toContain("rest-0");
    expect(restLabels).toContain("rest-6");
  });

  it("weights primary muscles higher than maintenance targets", () => {
    const state: GuidedSetupState = {
      experience: "intermediate",
      goalEmphasis: "balanced",
      volumePreference: "standard",
      priorityMuscles: {
        primary: ["chest"],
        maintenance: ["quads"],
        secondary: [],
      },
    };
    const volume = calculateVolumeTargets(state);
    expect(volume.chest).toBeGreaterThan(volume.quads);
  });
});
