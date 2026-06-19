import type { Settings } from "./types";

export const APP_INTRO_VERSION = 2;

export const APP_INTRO_PAGE_IDS = [
  "sessions",
  "dashboard",
  "analytics",
  "recovery",
  "measurements",
  "program",
  "templates",
  "settings",
] as const;

export type AppIntroPageId = (typeof APP_INTRO_PAGE_IDS)[number];

export type AppIntroPageState = {
  completed: boolean;
  skipped: boolean;
  pending: boolean;
  lastSeenAt: string;
};

export type AppIntroState = {
  completed: boolean;
  skipped: boolean;
  pending: boolean;
  version: number;
  lastSeenAt: string;
  pages: Record<AppIntroPageId, AppIntroPageState>;
};

const emptyPageState = (): AppIntroPageState => ({
  completed: false,
  skipped: false,
  pending: false,
  lastSeenAt: "",
});

const normalizePageState = (raw: unknown): AppIntroPageState => {
  const value =
    raw && typeof raw === "object"
      ? (raw as Partial<AppIntroPageState>)
      : {};
  return {
    completed: value.completed === true,
    skipped: value.skipped === true,
    pending: value.pending === true,
    lastSeenAt: typeof value.lastSeenAt === "string" ? value.lastSeenAt : "",
  };
};

export function getAppIntroState(settings: Settings): AppIntroState {
  const current = settings.progress?.appIntro || {};
  const rawPages =
    current.pages && typeof current.pages === "object" ? current.pages : {};
  const pages = APP_INTRO_PAGE_IDS.reduce((acc, pageId) => {
    acc[pageId] = normalizePageState(rawPages[pageId]);
    return acc;
  }, {} as Record<AppIntroPageId, AppIntroPageState>);

  return {
    completed: current.completed === true,
    skipped: current.skipped === true,
    pending: current.pending === true,
    version:
      typeof current.version === "number"
        ? current.version
        : APP_INTRO_VERSION,
    lastSeenAt: current.lastSeenAt || "",
    pages,
  };
}

export function getPendingAppIntroPages(settings: Settings): AppIntroPageId[] {
  const intro = getAppIntroState(settings);
  if (intro.version !== APP_INTRO_VERSION || !intro.pending) return [];
  return APP_INTRO_PAGE_IDS.filter((pageId) => {
    const page = intro.pages[pageId];
    return page.pending && !page.completed && !page.skipped;
  });
}

export function shouldRunAppIntro(settings: Settings): boolean {
  return getPendingAppIntroPages(settings).length > 0;
}

function withPages(
  settings: Settings,
  pages: Record<AppIntroPageId, AppIntroPageState>,
  pending = APP_INTRO_PAGE_IDS.some((pageId) => pages[pageId].pending)
): Settings {
  return {
    ...settings,
    progress: {
      ...(settings.progress || {}),
      appIntro: {
        completed: APP_INTRO_PAGE_IDS.every(
          (pageId) => pages[pageId].completed || pages[pageId].skipped
        ),
        skipped: APP_INTRO_PAGE_IDS.every((pageId) => pages[pageId].skipped),
        pending,
        version: APP_INTRO_VERSION,
        lastSeenAt: settings.progress?.appIntro?.lastSeenAt,
        pages,
      },
    },
  };
}

export function withAppIntroPending(settings: Settings): Settings {
  const current = getAppIntroState(settings);
  const pages = APP_INTRO_PAGE_IDS.reduce((acc, pageId) => {
    acc[pageId] = {
      ...current.pages[pageId],
      completed: false,
      skipped: false,
      pending: true,
    };
    return acc;
  }, {} as Record<AppIntroPageId, AppIntroPageState>);
  return withPages(settings, pages, true);
}

export function withAppIntroPagePending(
  settings: Settings,
  pageId: AppIntroPageId
): Settings {
  const current = getAppIntroState(settings);
  const pages = { ...current.pages };
  pages[pageId] = {
    ...emptyPageState(),
    ...pages[pageId],
    completed: false,
    skipped: false,
    pending: true,
  };
  return withPages(settings, pages, true);
}

export function withAppIntroPageCompleted(
  settings: Settings,
  pageId: AppIntroPageId,
  now = new Date().toISOString()
): Settings {
  const current = getAppIntroState(settings);
  const pages = { ...current.pages };
  pages[pageId] = {
    ...pages[pageId],
    completed: true,
    skipped: false,
    pending: false,
    lastSeenAt: now,
  };
  const next = withPages(settings, pages);
  return {
    ...next,
    progress: {
      ...(next.progress || {}),
      appIntro: {
        ...(next.progress?.appIntro || {}),
        lastSeenAt: now,
      },
    },
  };
}

export function withAppIntroPageSkipped(
  settings: Settings,
  pageId: AppIntroPageId,
  now = new Date().toISOString()
): Settings {
  const current = getAppIntroState(settings);
  const pages = { ...current.pages };
  pages[pageId] = {
    ...pages[pageId],
    completed: false,
    skipped: true,
    pending: false,
    lastSeenAt: now,
  };
  const next = withPages(settings, pages);
  return {
    ...next,
    progress: {
      ...(next.progress || {}),
      appIntro: {
        ...(next.progress?.appIntro || {}),
        lastSeenAt: now,
      },
    },
  };
}

export function withAppIntroCompleted(
  settings: Settings,
  now = new Date().toISOString()
): Settings {
  const current = getAppIntroState(settings);
  const pages = APP_INTRO_PAGE_IDS.reduce((acc, pageId) => {
    acc[pageId] = {
      ...current.pages[pageId],
      completed: true,
      skipped: false,
      pending: false,
      lastSeenAt: now,
    };
    return acc;
  }, {} as Record<AppIntroPageId, AppIntroPageState>);
  return {
    ...withPages(settings, pages, false),
    progress: {
      ...(settings.progress || {}),
      appIntro: {
        completed: true,
        skipped: false,
        pending: false,
        version: APP_INTRO_VERSION,
        lastSeenAt: now,
        pages,
      },
    },
  };
}

export function withAppIntroSkipped(
  settings: Settings,
  now = new Date().toISOString()
): Settings {
  const current = getAppIntroState(settings);
  const pages = APP_INTRO_PAGE_IDS.reduce((acc, pageId) => {
    const page = current.pages[pageId];
    if (page.completed) {
      acc[pageId] = { ...page, pending: false };
      return acc;
    }
    acc[pageId] = {
      ...page,
      completed: false,
      skipped: true,
      pending: false,
      lastSeenAt: now,
    };
    return acc;
  }, {} as Record<AppIntroPageId, AppIntroPageState>);
  return {
    ...withPages(settings, pages, false),
    progress: {
      ...(settings.progress || {}),
      appIntro: {
        completed: false,
        skipped: true,
        pending: false,
        version: APP_INTRO_VERSION,
        lastSeenAt: now,
        pages,
      },
    },
  };
}
