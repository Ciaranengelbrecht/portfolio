import { describe, expect, it } from "vitest";

import { buildPrevBestMap } from "../lib/prevBest";
import type { Session } from "../lib/types";

const makeSession = (
  id: string,
  phaseNumber: number,
  weekNumber: number,
  entries: Session["entries"]
): Session =>
  ({
    id,
    dateISO: `2026-06-${String(weekNumber).padStart(2, "0")}T00:00:00.000Z`,
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
  it("uses same-week earlier sessions before older weeks", () => {
    const map = buildPrevBestMap(
      [
        makeSession("1-2-6", 1, 2, [
          entry("bench", [{ setNumber: 1, weightKg: 100, reps: 5 }]),
        ]),
        makeSession("1-3-1", 1, 3, [
          entry("bench", [{ setNumber: 1, weightKg: 90, reps: 8 }]),
        ]),
      ],
      3,
      1,
      2
    );

    expect(map.bench?.set.weightKg).toBe(90);
    expect(map.bench?.set.reps).toBe(8);
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

  it("excludes the current session and future sessions", () => {
    const map = buildPrevBestMap(
      [
        makeSession("1-3-1", 1, 3, [
          entry("bench", [{ setNumber: 1, weightKg: 70, reps: 10 }]),
        ]),
        makeSession("1-3-2", 1, 3, [
          entry("bench", [{ setNumber: 1, weightKg: 120, reps: 5 }]),
        ]),
        makeSession("1-3-3", 1, 3, [
          entry("bench", [{ setNumber: 1, weightKg: 130, reps: 5 }]),
        ]),
        makeSession("1-4-0", 1, 4, [
          entry("bench", [{ setNumber: 1, weightKg: 140, reps: 5 }]),
        ]),
      ],
      3,
      1,
      2
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
