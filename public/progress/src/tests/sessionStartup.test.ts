import { describe, expect, it } from "vitest";

import {
  computeExercisePrScores,
  loadSessionsStartupBundle,
} from "../lib/sessionStartup";
import type { Exercise, Session, Settings, Template } from "../lib/types";

const makeSession = (
  id: string,
  weekNumber: number,
  entries: Session["entries"]
): Session =>
  ({
    id,
    dateISO: "2026-06-01T00:00:00.000Z",
    weekNumber,
    phase: 1,
    phaseNumber: 1,
    entries,
  } as Session);

describe("session startup helpers", () => {
  it("computes PR scores per exercise from a shared sessions snapshot", () => {
    const sessions = [
      makeSession("1-1-0", 1, [
        {
          id: "entry-a-1",
          exerciseId: "bench",
          sets: [
            { setNumber: 1, weightKg: 80, reps: 5 },
            { setNumber: 2, weightKg: 82.5, reps: 5 },
          ],
        },
        {
          id: "entry-b-1",
          exerciseId: "squat",
          sets: [{ setNumber: 1, weightKg: 120, reps: 3 }],
        },
      ]),
      makeSession("1-2-0", 2, [
        {
          id: "entry-a-2",
          exerciseId: "bench",
          sets: [{ setNumber: 1, weightKg: 90, reps: 4 }],
        },
      ]),
    ];

    expect(computeExercisePrScores(sessions)).toEqual({
      bench: 412.5,
      squat: 360,
    });
    expect(computeExercisePrScores(sessions, ["bench"])).toEqual({
      bench: 412.5,
    });
  });

  it("loads sessions once and reuses that snapshot for startup work", async () => {
    let sessionsReads = 0;
    const sessions = [
      makeSession("1-1-0", 1, [
        {
          id: "entry-a-1",
          exerciseId: "bench",
          sets: [{ setNumber: 1, weightKg: 80, reps: 5 }],
        },
      ]),
      makeSession("1-2-0", 2, [
        {
          id: "entry-a-current",
          exerciseId: "bench",
          sets: [{ setNumber: 1, weightKg: 95, reps: 5 }],
        },
      ]),
    ];
    const templates: Template[] = [];
    const exercises = [
      {
        id: "bench",
        name: "Bench Press",
        muscleGroup: "chest",
        defaults: { sets: 3, targetRepRange: "6-8" },
      },
    ] as Exercise[];
    const settings = { id: "app", unit: "kg" } as unknown as Settings;

    const bundle = await loadSessionsStartupBundle(
      {
        loadTemplates: async () => templates,
        loadExercises: async () => exercises,
        loadSettings: async () => settings,
        loadSessions: async () => {
          sessionsReads += 1;
          return sessions;
        },
      },
      {
        phase: 1,
        week: 2,
        day: 0,
        sessionId: "1-2-0",
        exerciseIds: ["bench"],
      }
    );

    expect(sessionsReads).toBe(1);
    expect(bundle.sessions).toBe(sessions);
    expect(bundle.templates).toBe(templates);
    expect(bundle.exercises).toBe(exercises);
    expect(bundle.settings).toBe(settings);
    expect(bundle.prevBestMap?.bench?.set.weightKg).toBe(80);
    expect(bundle.prScoresByExercise).toEqual({ bench: 475 });
  });
});
