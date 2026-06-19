import { describe, expect, it } from "vitest";

import { getNextSetPrefill } from "../lib/sessionSetPrefill";
import type { SessionEntry } from "../lib/types";

const entry = (sets: SessionEntry["sets"]): SessionEntry => ({
  id: "entry-1",
  exerciseId: "bench",
  sets,
});

describe("getNextSetPrefill", () => {
  it("prefills the first set from the previous best", () => {
    const prefill = getNextSetPrefill(entry([]), {
      bench: {
        week: 3,
        set: { setNumber: 2, weightKg: 90, reps: 8, rpe: 8 },
      },
    });

    expect(prefill).toEqual({ weightKg: 90, reps: 8, rpe: 8 });
  });

  it("copies the latest current set after manual edits", () => {
    const prefill = getNextSetPrefill(
      entry([
        { setNumber: 1, weightKg: 92.5, reps: 7, rpe: 9 },
      ]),
      {
        bench: {
          week: 3,
          set: { setNumber: 1, weightKg: 90, reps: 8, rpe: 8 },
        },
      }
    );

    expect(prefill).toEqual({ weightKg: 92.5, reps: 7, rpe: 9 });
  });

  it("copies the immediately previous set for later sets", () => {
    const prefill = getNextSetPrefill(
      entry([
        { setNumber: 1, weightKg: 92.5, reps: 7 },
        { setNumber: 2, weightKg: 95, reps: 6 },
      ])
    );

    expect(prefill).toEqual({ weightKg: 95, reps: 6, rpe: undefined });
  });

  it("keeps blank current rows blank instead of falling back to previous best", () => {
    const prefill = getNextSetPrefill(
      entry([{ setNumber: 1, weightKg: null, reps: null }]),
      {
        bench: {
          week: 3,
          set: { setNumber: 1, weightKg: 90, reps: 8 },
        },
      }
    );

    expect(prefill).toEqual({ weightKg: null, reps: null, rpe: undefined });
  });
});
