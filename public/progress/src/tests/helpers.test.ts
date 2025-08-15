import { describe, it, expect, beforeAll } from "vitest";
import { getDeloadPrescription } from "../lib/helpers";
import { db } from "../lib/db";
import { Exercise } from "../lib/types";

// mock DB with fake-indexeddb if necessary in vitest config

describe("deload prescription", () => {
  beforeAll(async () => {
    // seed one exercise and a prior week session
    const ex: Exercise = {
      id: "e1",
      name: "Bench",
      muscleGroup: "chest",
      defaults: { sets: 4, targetRepRange: "8-12" },
    };
    await db.put("exercises", ex);
    await db.put("sessions", {
      id: "1-1-0",
      dateISO: new Date().toISOString(),
      weekNumber: 1,
      phase: 1,
      entries: [
        {
          id: "se1",
          exerciseId: "e1",
          sets: [
            { setNumber: 1, weightKg: 100, reps: 8 },
            { setNumber: 2, weightKg: 100, reps: 8 },
          ],
        },
      ],
    });
  });

  it("uses 55% load and 50% sets by default on a deload week", async () => {
    // Provide a custom deloadWeeks set including week 2 for test determinism
    const p = await getDeloadPrescription("e1", 2, {
      deloadWeeks: new Set([2]),
    });
    expect(p.targetWeight).toBe(55);
    expect(p.targetSets).toBe(2); // 50% of 4
  });
});
