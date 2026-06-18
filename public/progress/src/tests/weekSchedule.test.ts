import { describe, expect, it } from "vitest";
import type { Settings, UserProgram } from "../lib/types";
import {
  getEffectiveWeeklySplit,
  getOverrideAffectedDayIds,
  getPullForwardSourceDayId,
  getWeekScheduleKey,
} from "../lib/weekSchedule";

const program: UserProgram = {
  id: "program-1",
  name: "PPL",
  weekLengthDays: 7,
  weeklySplit: [
    { type: "Push", templateId: "push-a" },
    { type: "Pull", templateId: "pull-a" },
    { type: "Rest" },
    { type: "Legs", templateId: "legs-a" },
    { type: "Push", templateId: "push-b" },
    { type: "Pull", templateId: "pull-b" },
    { type: "Rest" },
  ],
  mesoWeeks: 9,
  deload: { mode: "last-week" },
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  version: 1,
};

function settingsFor(overrides: NonNullable<Settings["progress"]>["weekScheduleOverrides"]) {
  return {
    unit: "kg",
    deloadDefaults: { loadPct: 0.55, setPct: 0.5 },
    progress: { weekScheduleOverrides: overrides },
  } as Settings;
}

describe("week schedule overrides", () => {
  it("returns the base split when no override exists", () => {
    const split = getEffectiveWeeklySplit(program, settingsFor({}), 1, 1);
    expect(split.map((day) => day.type)).toEqual([
      "Push",
      "Pull",
      "Rest",
      "Legs",
      "Push",
      "Pull",
      "Rest",
    ]);
    expect(split).not.toBe(program.weeklySplit);
  });

  it("swaps two days for only the keyed phase and week", () => {
    const key = getWeekScheduleKey(program.id, 1, 2);
    const settings = settingsFor({
      [key]: [
        {
          id: "swap-1",
          type: "day-swap",
          fromDayId: 0,
          toDayId: 2,
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    });

    expect(getEffectiveWeeklySplit(program, settings, 1, 2).map((d) => d.type))
      .toEqual(["Rest", "Pull", "Push", "Legs", "Push", "Pull", "Rest"]);
    expect(getEffectiveWeeklySplit(program, settings, 1, 1).map((d) => d.type))
      .toEqual(["Push", "Pull", "Rest", "Legs", "Push", "Pull", "Rest"]);
  });

  it("pulls the next training day forward through a rest day", () => {
    const key = getWeekScheduleKey(program.id, 1, 3);
    const settings = settingsFor({
      [key]: [
        {
          id: "pull-1",
          type: "pull-forward",
          restDayId: 2,
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    });

    expect(getPullForwardSourceDayId(program.weeklySplit, 2)).toBe(3);
    expect(getEffectiveWeeklySplit(program, settings, 1, 3).map((d) => d.type))
      .toEqual(["Push", "Pull", "Legs", "Rest", "Push", "Pull", "Rest"]);
  });

  it("ignores invalid overrides safely", () => {
    const key = getWeekScheduleKey(program.id, 1, 4);
    const badSwap = {
      id: "bad-swap",
      type: "day-swap" as const,
      fromDayId: 0,
      toDayId: 100,
      createdAt: "2026-06-01T00:00:00.000Z",
    };
    const settings = settingsFor({ [key]: [badSwap] });

    expect(getOverrideAffectedDayIds(program.weeklySplit, badSwap)).toEqual([]);
    expect(getEffectiveWeeklySplit(program, settings, 1, 4).map((d) => d.type))
      .toEqual(["Push", "Pull", "Rest", "Legs", "Push", "Pull", "Rest"]);
  });
});
