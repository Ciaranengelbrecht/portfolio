import type { Settings } from "./types";

export const APP_INTRO_VERSION = 1;

export type AppIntroState = NonNullable<
  NonNullable<Settings["progress"]>["appIntro"]
>;

export function getAppIntroState(settings: Settings): Required<AppIntroState> {
  const current = settings.progress?.appIntro || {};
  return {
    completed: current.completed === true,
    skipped: current.skipped === true,
    pending: current.pending === true,
    version:
      typeof current.version === "number"
        ? current.version
        : APP_INTRO_VERSION,
    lastSeenAt: current.lastSeenAt || "",
  };
}

export function shouldRunAppIntro(settings: Settings): boolean {
  const intro = getAppIntroState(settings);
  return (
    intro.pending === true &&
    intro.version === APP_INTRO_VERSION &&
    !intro.completed &&
    !intro.skipped
  );
}

export function withAppIntroPending(settings: Settings): Settings {
  return {
    ...settings,
    progress: {
      ...(settings.progress || {}),
      appIntro: {
        completed: false,
        skipped: false,
        pending: true,
        version: APP_INTRO_VERSION,
        lastSeenAt: settings.progress?.appIntro?.lastSeenAt,
      },
    },
  };
}

export function withAppIntroCompleted(
  settings: Settings,
  now = new Date().toISOString()
): Settings {
  return {
    ...settings,
    progress: {
      ...(settings.progress || {}),
      appIntro: {
        completed: true,
        skipped: false,
        pending: false,
        version: APP_INTRO_VERSION,
        lastSeenAt: now,
      },
    },
  };
}

export function withAppIntroSkipped(
  settings: Settings,
  now = new Date().toISOString()
): Settings {
  return {
    ...settings,
    progress: {
      ...(settings.progress || {}),
      appIntro: {
        completed: false,
        skipped: true,
        pending: false,
        version: APP_INTRO_VERSION,
        lastSeenAt: now,
      },
    },
  };
}
