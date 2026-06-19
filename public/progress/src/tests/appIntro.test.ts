import { describe, expect, it } from "vitest";
import { defaultSettings } from "../lib/defaults";
import {
  APP_INTRO_PAGE_IDS,
  APP_INTRO_VERSION,
  getAppIntroState,
  getPendingAppIntroPages,
  shouldRunAppIntro,
  withAppIntroCompleted,
  withAppIntroPageCompleted,
  withAppIntroPagePending,
  withAppIntroPageSkipped,
  withAppIntroPending,
  withAppIntroSkipped,
} from "../lib/appIntro";

describe("app intro state helpers", () => {
  it("queues every page for the full first-run tour", () => {
    const next = withAppIntroPending(defaultSettings);
    const intro = getAppIntroState(next);

    expect(intro.pending).toBe(true);
    expect(intro.completed).toBe(false);
    expect(intro.skipped).toBe(false);
    expect(intro.version).toBe(APP_INTRO_VERSION);
    expect(getPendingAppIntroPages(next)).toEqual(APP_INTRO_PAGE_IDS);
    expect(shouldRunAppIntro(next)).toBe(true);
  });

  it("queues a single page replay without changing other page states", () => {
    const completed = withAppIntroCompleted(
      withAppIntroPending(defaultSettings),
      "2026-06-18T00:00:00.000Z"
    );
    const replay = withAppIntroPagePending(completed, "analytics");
    const intro = getAppIntroState(replay);

    expect(getPendingAppIntroPages(replay)).toEqual(["analytics"]);
    expect(intro.pages.analytics.pending).toBe(true);
    expect(intro.pages.sessions.completed).toBe(true);
    expect(intro.pages.dashboard.completed).toBe(true);
  });

  it("marks one page completed and leaves the remaining tour pending", () => {
    const pending = withAppIntroPending(defaultSettings);
    const next = withAppIntroPageCompleted(
      pending,
      "sessions",
      "2026-06-18T00:00:00.000Z"
    );
    const intro = getAppIntroState(next);

    expect(intro.pages.sessions.completed).toBe(true);
    expect(intro.pages.sessions.pending).toBe(false);
    expect(getPendingAppIntroPages(next)[0]).toBe("dashboard");
    expect(shouldRunAppIntro(next)).toBe(true);
  });

  it("skips one page only and leaves other page intros eligible", () => {
    const pending = withAppIntroPending(defaultSettings);
    const next = withAppIntroPageSkipped(
      pending,
      "dashboard",
      "2026-06-18T00:00:00.000Z"
    );
    const intro = getAppIntroState(next);

    expect(intro.pages.dashboard.skipped).toBe(true);
    expect(intro.pages.sessions.pending).toBe(true);
    expect(intro.pages.analytics.pending).toBe(true);
    expect(getPendingAppIntroPages(next)).not.toContain("dashboard");
  });

  it("marks all pages skipped when skipping all", () => {
    const skipped = withAppIntroSkipped(
      withAppIntroPending(defaultSettings),
      "2026-06-18T00:00:00.000Z"
    );
    const intro = getAppIntroState(skipped);

    expect(shouldRunAppIntro(skipped)).toBe(false);
    expect(intro.pending).toBe(false);
    expect(intro.skipped).toBe(true);
    expect(APP_INTRO_PAGE_IDS.every((pageId) => intro.pages[pageId].skipped)).toBe(true);
  });

  it("does not auto-launch old v1 completed state", () => {
    const legacy = {
      ...defaultSettings,
      progress: {
        ...(defaultSettings.progress || {}),
        appIntro: {
          completed: true,
          skipped: false,
          pending: false,
          version: 1,
          lastSeenAt: "2026-06-18T00:00:00.000Z",
        },
      },
    };

    expect(shouldRunAppIntro(legacy)).toBe(false);
    expect(getPendingAppIntroPages(legacy)).toEqual([]);
  });
});
