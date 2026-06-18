import { describe, expect, it } from "vitest";
import { defaultSettings } from "../lib/defaults";
import {
  APP_INTRO_VERSION,
  getAppIntroState,
  shouldRunAppIntro,
  withAppIntroCompleted,
  withAppIntroPending,
  withAppIntroSkipped,
} from "../lib/appIntro";

describe("app intro state helpers", () => {
  it("queues a pending intro for first-run completion or replay", () => {
    const next = withAppIntroPending(defaultSettings);
    const intro = getAppIntroState(next);

    expect(intro.pending).toBe(true);
    expect(intro.completed).toBe(false);
    expect(intro.skipped).toBe(false);
    expect(intro.version).toBe(APP_INTRO_VERSION);
    expect(shouldRunAppIntro(next)).toBe(true);
  });

  it("marks the intro completed without leaving it pending", () => {
    const pending = withAppIntroPending(defaultSettings);
    const completed = withAppIntroCompleted(pending, "2026-06-18T00:00:00.000Z");
    const intro = getAppIntroState(completed);

    expect(intro.pending).toBe(false);
    expect(intro.completed).toBe(true);
    expect(intro.skipped).toBe(false);
    expect(intro.lastSeenAt).toBe("2026-06-18T00:00:00.000Z");
    expect(shouldRunAppIntro(completed)).toBe(false);
  });

  it("marks the intro skipped and allows replay to reset the versioned state", () => {
    const skipped = withAppIntroSkipped(
      withAppIntroPending(defaultSettings),
      "2026-06-18T00:00:00.000Z"
    );
    expect(shouldRunAppIntro(skipped)).toBe(false);

    const replay = withAppIntroPending(skipped);
    const intro = getAppIntroState(replay);
    expect(intro.pending).toBe(true);
    expect(intro.completed).toBe(false);
    expect(intro.skipped).toBe(false);
    expect(intro.version).toBe(APP_INTRO_VERSION);
    expect(shouldRunAppIntro(replay)).toBe(true);
  });
});
