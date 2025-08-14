import { describe, it, expect } from "vitest";
import {
  getDayCompletion,
  getWeekCompletion,
  getPhaseCompletion,
} from "./progress";
import type { Session } from "../../lib/types";

function makeSession(id: string, week: number, phase = 1, reps = 8): Session {
  return {
    id,
    dateISO: new Date().toISOString(),
    weekNumber: week as any,
    phaseNumber: phase,
    phase,
    entries: [
      {
        id: "e",
        exerciseId: "x",
        sets: [{ setNumber: 1, weightKg: 10, reps }],
      },
    ],
  };
}

describe("progress utils", () => {
  it("getDayCompletion detects valid sets", () => {
    expect(getDayCompletion(undefined)).toBe(false);
    const s: Session = makeSession("1-1-0", 1);
    expect(getDayCompletion(s)).toBe(true);
  });

  it("week completion 0/6, partial, and full", () => {
    const sessions: Session[] = [];
    let w = getWeekCompletion(1, 1, sessions);
    expect(w.completedDays).toBe(0);
    expect(w.totalDays).toBe(6);
    expect(w.percent).toBe(0);

    sessions.push(makeSession("1-1-0", 1));
    sessions.push(makeSession("1-1-2", 1));
    w = getWeekCompletion(1, 1, sessions);
    expect(w.completedDays).toBe(2);
    expect(w.percent).toBe(Math.round((2 / 6) * 100));

    for (const d of [1, 3, 4, 5]) sessions.push(makeSession(`1-1-${d}`, 1));
    w = getWeekCompletion(1, 1, sessions);
    expect(w.completedDays).toBe(6);
    expect(w.percent).toBe(100);
  });

  it("phase completion aggregates 9 weeks", () => {
    const sessions: Session[] = [];
    // Make week1 full, week2 3/6, others empty
    for (let d = 0; d < 6; d++) sessions.push(makeSession(`1-1-${d}`, 1));
    for (const d of [0, 2, 4]) sessions.push(makeSession(`1-2-${d}`, 2));
    const p = getPhaseCompletion(1, sessions);
    const w1 = 100;
    const w2 = Math.round((3 / 6) * 100);
    const expected = Math.round((w1 + w2) / 9);
    expect(p.weekPercents.length).toBe(9);
    expect(p.weekPercents[0]).toBe(100);
    expect(p.weekPercents[1]).toBe(w2);
    expect(p.percent).toBe(expected);
  });

  it("weekly target days affects denominator", () => {
    const sessions: Session[] = [
      makeSession("1-1-0", 1),
      makeSession("1-1-1", 1),
      makeSession("1-1-2", 1),
      makeSession("1-1-3", 1),
    ];
    const w5 = getWeekCompletion(1, 1, sessions, { weeklyTargetDays: 5 });
    expect(w5.totalDays).toBe(5);
    expect(w5.percent).toBe(Math.round((4 / 5) * 100));

    const w7 = getWeekCompletion(
      1,
      1,
      [
        ...sessions,
        makeSession("1-1-4", 1),
        makeSession("1-1-5", 1),
        makeSession("1-1-6", 1),
      ],
      { weeklyTargetDays: 6 }
    );
    // session on day 6 (rest) should not affect completedDays, remains 6 max
    expect(w7.completedDays).toBe(6);
    expect(w7.percent).toBe(100);
  });
});
