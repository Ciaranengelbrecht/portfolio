import { describe, expect, it } from "vitest";

import { buildPrevBestMap } from "../lib/prevBest";
import type { Session } from "../lib/types";

const makeSession = (
  id: string,
  phaseNumber: number,
  weekNumber: number,
  entries: Session["entries"],
  dateISO = `2026-06-${String(weekNumber).padStart(2, "0")}T00:00:00.000Z`
): Session =>
  ({
    id,
    dateISO,
    phase: phaseNumber,
    phaseNumber,
    weekNumber,
    entries,
  }) as Session;

const entry = (
  exerciseId: string,
  sets: Session["entries"][number]["sets"]
): Session["entries"][number] => ({
  id: `${exerciseId}-entry`,
  exerciseId,
  sets,
});

describe("buildPrevBestMap", () => {
  it("uses the latest filled history even when route context would exclude it", () => {
    const map = buildPrevBestMap(
      [
        makeSession("1-1-0", 1, 1, [
          entry("bench", [{ setNumber: 1, weightKg: null, reps: null }]),
        ]),
        makeSession("1-3-1", 1, 3, [
          entry("bench", [{ setNumber: 1, weightKg: 100, reps: 5 }]),
        ]),
      ],
      1,
      1,
      0,
      { activeSessionId: "1-1-0" }
    );

    expect(map.bench?.set.weightKg).toBe(100);
    expect(map.bench?.set.reps).toBe(5);
  });

  it("skips newer blank sessions and uses the latest filled set", () => {
    const map = buildPrevBestMap(
      [
        makeSession("1-1-0", 1, 1, [
          entry("bench", [{ setNumber: 1, weightKg: 50, reps: 10 }]),
        ]),
        makeSession("1-2-0", 1, 2, [
          entry("bench", [{ setNumber: 1, weightKg: null, reps: null }]),
        ]),
      ],
      3,
      1,
      0
    );

    expect(map.bench?.week).toBe(1);
    expect(map.bench?.set.weightKg).toBe(50);
    expect(map.bench?.set.reps).toBe(10);
  });

  it("excludes the active session even when it has the latest filled set", () => {
    const map = buildPrevBestMap(
      [
        makeSession("1-2-0", 1, 2, [
          entry("bench", [{ setNumber: 1, weightKg: 70, reps: 10 }]),
        ]),
        makeSession("1-3-0", 1, 3, [
          entry("bench", [{ setNumber: 1, weightKg: 140, reps: 5 }]),
        ]),
      ],
      3,
      1,
      0,
      { activeSessionId: "1-3-0" }
    );

    expect(map.bench?.set.weightKg).toBe(70);
    expect(map.bench?.set.reps).toBe(10);
  });

  it("falls back to previous phases per exercise", () => {
    const map = buildPrevBestMap(
      [
        makeSession("1-6-4", 1, 6, [
          entry("bench", [{ setNumber: 1, weightKg: 100, reps: 6 }]),
        ]),
        makeSession("2-1-1", 2, 1, [
          entry("squat", [{ setNumber: 1, weightKg: 140, reps: 4 }]),
        ]),
      ],
      1,
      2,
      2
    );

    expect(map.bench?.set.weightKg).toBe(100);
    expect(map.squat?.set.weightKg).toBe(140);
  });

  it("selects the best set in the newest relevant session by weight then reps", () => {
    const map = buildPrevBestMap(
      [
        makeSession("1-2-0", 1, 2, [
          entry("bench", [
            { setNumber: 1, weightKg: 80, reps: 8 },
            { setNumber: 2, weightKg: 82.5, reps: 5 },
            { setNumber: 3, weightKg: 80, reps: 10 },
          ]),
          entry("curl", [
            { setNumber: 1, weightKg: 20, reps: 8 },
            { setNumber: 2, weightKg: 20, reps: 12 },
          ]),
        ]),
      ],
      3,
      1,
      0
    );

    expect(map.bench?.set.weightKg).toBe(82.5);
    expect(map.bench?.set.reps).toBe(5);
    expect(map.curl?.set.weightKg).toBe(20);
    expect(map.curl?.set.reps).toBe(12);
  });
});
