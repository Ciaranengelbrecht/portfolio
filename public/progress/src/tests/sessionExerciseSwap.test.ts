import { describe, expect, it } from "vitest";

import {
  applyExerciseSwapToCurrentAndFutureSessions,
  buildSwappedEntry,
  prepareFutureTemplateSwap,
  sessionHasLoggedWork,
} from "../lib/sessionExerciseSwap";
import { Exercise, Session, SessionEntry, Template, UserProgram } from "../lib/types";

const squat: Exercise = {
  id: "barbell-squat",
  name: "Barbell Squat",
  muscleGroup: "quads",
  defaults: { sets: 3, targetRepRange: "5-8" },
};

const hackSquat: Exercise = {
  id: "hack-squat",
  name: "Hack Squat",
  muscleGroup: "quads",
  defaults: { sets: 3, targetRepRange: "8-12" },
};

const makeEntry = (
  id: string,
  exerciseId: string,
  opts?: { sets?: SessionEntry["sets"] }
): SessionEntry => ({
  id,
  exerciseId,
  sets:
    opts?.sets ??
    [
      { setNumber: 1, weightKg: 100, reps: 5 },
      { setNumber: 2, weightKg: 100, reps: 5 },
    ],
});

const makeSession = (
  id: string,
  entries: SessionEntry[],
  overrides?: Partial<Session>
): Session => ({
  id,
  dateISO: "2026-03-27T00:00:00.000Z",
  localDate: "2026-03-27",
  weekNumber: Number(id.split("-")[1]),
  phaseNumber: Number(id.split("-")[0]),
  dayName: "Leg Heavy Day",
  programId: "program-1",
  entries,
  ...overrides,
});

describe("sessionExerciseSwap", () => {
  it("clears values but preserves set rows when building the swapped entry", () => {
    const swapped = buildSwappedEntry(makeEntry("entry-1", squat.id), hackSquat);

    expect(swapped.exerciseId).toBe(hackSquat.id);
    expect(swapped.targetRepRange).toBe("8-12");
    expect(swapped.sets).toEqual([
      { setNumber: 1, weightKg: null, reps: null },
      { setNumber: 2, weightKg: null, reps: null },
    ]);
  });

  it("updates the current session and eligible future same-day sessions", () => {
    const current = makeSession("1-2-1", [makeEntry("current-entry", squat.id)]);
    const futureSameDay = makeSession("1-3-1", [
      makeEntry("future-entry", squat.id, {
        sets: [{ setNumber: 1, weightKg: null, reps: null }],
      }),
    ]);
    const futureOtherDay = makeSession("1-3-2", [
      makeEntry("other-day-entry", squat.id, {
        sets: [{ setNumber: 1, weightKg: null, reps: null }],
      }),
    ]);
    const futureLogged = makeSession("1-4-1", [makeEntry("logged-entry", squat.id)], {
      entries: [
        makeEntry("logged-entry", squat.id, {
          sets: [{ setNumber: 1, weightKg: 120, reps: 4 }],
        }),
      ],
    });

    const result = applyExerciseSwapToCurrentAndFutureSessions({
      sessions: [current, futureSameDay, futureOtherDay, futureLogged],
      currentSession: current,
      currentEntryId: "current-entry",
      sourceExerciseId: squat.id,
      nextExercise: hackSquat,
      templateIdForFuture: "template-hack",
    });

    expect(result.updatedCurrentSession.entries[0].exerciseId).toBe(hackSquat.id);
    expect(result.updatedCurrentSession.templateId).toBe("template-hack");
    expect(result.updatedSessions).toHaveLength(1);
    expect(result.updatedSessions[0].id).toBe("1-3-1");
    expect(result.updatedSessions[0].entries[0].exerciseId).toBe(hackSquat.id);
    expect(result.futureSessionsChanged).toBe(1);
    expect(result.skippedLoggedSessionIds).toEqual(["1-4-1"]);
  });

  it("updates the shared template by cloning only the current day mapping", () => {
    const program: UserProgram = {
      id: "program-1",
      name: "Main Program",
      weekLengthDays: 3,
      weeklySplit: [
        { type: "Upper", templateId: "tpl-shared" },
        { type: "Legs", customLabel: "Leg Heavy Day", templateId: "tpl-shared" },
        { type: "Lower", templateId: "tpl-lower" },
      ],
      mesoWeeks: 6,
      deload: { mode: "none" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    };

    const sharedTemplate: Template = {
      id: "tpl-shared",
      name: "Shared Lower",
      exerciseIds: [squat.id, "leg-curl"],
      plan: [
        { exerciseId: squat.id, plannedSets: 3, repRange: "5-8" },
        { exerciseId: "leg-curl", plannedSets: 3, repRange: "10-15" },
      ],
    };

    const result = prepareFutureTemplateSwap({
      program,
      templates: [sharedTemplate],
      dayIndex: 1,
      sourceExerciseId: squat.id,
      nextExercise: hackSquat,
    });

    expect(result.templateChanged).toBe(true);
    expect(result.templateIdForFuture).not.toBe("tpl-shared");
    expect(result.nextProgram?.weeklySplit[0].templateId).toBe("tpl-shared");
    expect(result.nextProgram?.weeklySplit[1].templateId).toBe(result.templateIdForFuture);
    expect(result.nextTemplates).toHaveLength(2);
    expect(result.nextTemplates[0].exerciseIds[0]).toBe(squat.id);
    const cloned = result.nextTemplates.find(
      (template) => template.id === result.templateIdForFuture
    );
    expect(cloned?.exerciseIds[0]).toBe(hackSquat.id);
    expect(cloned?.plan?.[0].exerciseId).toBe(hackSquat.id);
  });

  it("detects whether a session already has logged work", () => {
    expect(
      sessionHasLoggedWork(
        makeSession("1-1-1", [
          makeEntry("entry-1", squat.id, {
            sets: [{ setNumber: 1, weightKg: null, reps: null }],
          }),
        ])
      )
    ).toBe(false);
    expect(
      sessionHasLoggedWork(makeSession("1-1-1", [makeEntry("entry-1", squat.id)]))
    ).toBe(true);
  });
});
