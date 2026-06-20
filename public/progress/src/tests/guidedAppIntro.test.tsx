import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import GuidedAppIntro, {
  getGuidedIntroCardStyle,
  type GuidedAppIntroPage,
  type GuidedAppIntroStep,
} from "../components/GuidedAppIntro";
import { defaultSettings } from "../lib/defaults";
import { getAppIntroState, withAppIntroPending } from "../lib/appIntro";
import type { Settings } from "../lib/types";

const flushFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

async function waitForText(text: string) {
  for (let i = 0; i < 80; i += 1) {
    await act(async () => {
      await flushFrame();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    if (document.body.textContent?.includes(text)) return;
  }
  throw new Error(`Timed out waiting for text: ${text}`);
}

function installRect(
  node: HTMLElement,
  rect: Partial<DOMRect> = {}
) {
  const nextRect = {
    x: rect.x ?? rect.left ?? 96,
    y: rect.y ?? rect.top ?? 120,
    top: rect.top ?? rect.y ?? 120,
    left: rect.left ?? rect.x ?? 96,
    right: rect.right ?? (rect.left ?? rect.x ?? 96) + (rect.width ?? 100),
    bottom: rect.bottom ?? (rect.top ?? rect.y ?? 120) + (rect.height ?? 44),
    width: rect.width ?? 100,
    height: rect.height ?? 44,
    toJSON: () => ({}),
  } as DOMRect;
  node.getBoundingClientRect = () =>
    nextRect;
  node.getClientRects = () =>
    ({
      length: 1,
      item: () => node.getBoundingClientRect(),
      [0]: node.getBoundingClientRect(),
    } as unknown as DOMRectList);
}

async function clickButton(label: string) {
  let button: HTMLButtonElement | undefined;
  for (let i = 0; i < 80; i += 1) {
    button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        candidate.textContent?.trim() === label &&
        !(candidate as HTMLButtonElement).disabled
    ) as HTMLButtonElement | undefined;
    if (button) break;
    await act(async () => {
      await flushFrame();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
  }
  expect(button).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

describe("GuidedAppIntro", () => {
  let root: Root | null = null;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = "";
    setViewport(1024, 768);
  });

  it("skips optional missing targets and shows the next available step", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const target = document.createElement("button");
    target.dataset.tourId = "visible-target";
    target.textContent = "Visible target";
    installRect(target);
    document.body.appendChild(target);

    let current: Settings = withAppIntroPending(defaultSettings);
    const steps: GuidedAppIntroStep[] = [
      {
        id: "missing",
        title: "Missing",
        body: "This should be skipped.",
        targetIds: ["missing-target"],
        optional: true,
      },
      {
        id: "visible",
        title: "Visible step",
        body: "This should be shown.",
        targetIds: ["visible-target"],
      },
    ];

    root = createRoot(host);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/sessions"]}>
          <GuidedAppIntro
            steps={steps}
            settingsApi={{
              getSettings: async () => current,
              setSettings: async (next) => {
                current =
                  typeof next === "function" ? await next(current) : next;
              },
            }}
          />
        </MemoryRouter>
      );
      await flushFrame();
    });

    await waitForText("Visible step");
    expect(document.body.textContent).not.toContain("This should be skipped.");
  });

  it("saves skipped state from the skip-all control", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const target = document.createElement("button");
    target.dataset.tourId = "skip-target";
    target.textContent = "Skip target";
    installRect(target);
    document.body.appendChild(target);

    let current: Settings = withAppIntroPending(defaultSettings);

    root = createRoot(host);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/sessions"]}>
          <GuidedAppIntro
            steps={[
              {
                id: "skip",
                title: "Skip step",
                body: "Skip body",
                targetIds: ["skip-target"],
              },
            ]}
            settingsApi={{
              getSettings: async () => current,
              setSettings: async (next) => {
                current =
                  typeof next === "function" ? await next(current) : next;
              },
            }}
          />
        </MemoryRouter>
      );
      await flushFrame();
    });

    await waitForText("Skip step");
    await clickButton("Skip all");
    await act(async () => {
      await flushFrame();
    });

    const intro = getAppIntroState(current);
    expect(intro.pending).toBe(false);
    expect(intro.skipped).toBe(true);
    expect(intro.pages.sessions.skipped).toBe(true);
  });

  it("skips only the current page and advances to the next page group", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const first = document.createElement("button");
    first.dataset.tourId = "page-one";
    first.textContent = "Page one target";
    installRect(first);
    document.body.appendChild(first);
    const second = document.createElement("button");
    second.dataset.tourId = "page-two";
    second.textContent = "Page two target";
    installRect(second);
    document.body.appendChild(second);

    let current: Settings = withAppIntroPending(defaultSettings);
    const pages: GuidedAppIntroPage[] = [
      {
        pageId: "sessions",
        label: "Training",
        route: "/sessions",
        steps: [
          {
            id: "one",
            title: "Training page",
            body: "First body",
            targetIds: ["page-one"],
          },
        ],
      },
      {
        pageId: "dashboard",
        label: "Dashboard",
        route: "/sessions",
        steps: [
          {
            id: "two",
            title: "Dashboard page",
            body: "Second body",
            targetIds: ["page-two"],
          },
        ],
      },
    ];

    root = createRoot(host);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/sessions"]}>
          <GuidedAppIntro
            pages={pages}
            settingsApi={{
              getSettings: async () => current,
              setSettings: async (next) => {
                current =
                  typeof next === "function" ? await next(current) : next;
              },
            }}
          />
        </MemoryRouter>
      );
      await flushFrame();
    });

    await waitForText("Training page");
    await clickButton("Skip page");
    await waitForText("Dashboard page");

    const intro = getAppIntroState(current);
    expect(intro.pages.sessions.skipped).toBe(true);
    expect(intro.pages.dashboard.pending).toBe(true);
  });

  it("does not reload settings while an active tour navigates between routes", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const first = document.createElement("button");
    first.dataset.tourId = "first-route-target";
    first.textContent = "First route target";
    installRect(first);
    document.body.appendChild(first);
    const second = document.createElement("button");
    second.dataset.tourId = "second-route-target";
    second.textContent = "Second route target";
    installRect(second, { top: 240 });
    document.body.appendChild(second);

    let current: Settings = withAppIntroPending(defaultSettings);
    let getCalls = 0;

    const pages: GuidedAppIntroPage[] = [
      {
        pageId: "sessions",
        label: "Training",
        route: "/sessions",
        steps: [
          {
            id: "first",
            title: "First route",
            body: "First body",
            targetIds: ["first-route-target"],
          },
        ],
      },
      {
        pageId: "dashboard",
        label: "Dashboard",
        route: "/dashboard-test",
        steps: [
          {
            id: "second",
            title: "Second route",
            body: "Second body",
            targetIds: ["second-route-target"],
          },
        ],
      },
    ];

    root = createRoot(host);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/sessions"]}>
          <GuidedAppIntro
            pages={pages}
            settingsApi={{
              getSettings: async () => {
                getCalls += 1;
                return current;
              },
              setSettings: async (next) => {
                current =
                  typeof next === "function" ? await next(current) : next;
              },
            }}
          />
        </MemoryRouter>
      );
      await flushFrame();
    });

    await waitForText("First route");
    await clickButton("Next page");
    await waitForText("Second route");

    expect(getCalls).toBe(1);
  });

  it("places the card away from the highlighted target when there is room", () => {
    setViewport(390, 720);
    const target = { top: 120, left: 60, width: 160, height: 64 };
    const style = getGuidedIntroCardStyle(target, {
      width: 360,
      height: 180,
    }) as { top: number; left: number; width: number };

    expect(style.top).toBeGreaterThanOrEqual(
      target.top + target.height + 16
    );
    expect(style.left).toBeGreaterThanOrEqual(12);
    expect(style.left + style.width).toBeLessThanOrEqual(378);
  });

  it("places the card above low targets instead of covering them", () => {
    setViewport(390, 720);
    const target = { top: 520, left: 80, width: 160, height: 64 };
    const style = getGuidedIntroCardStyle(target, {
      width: 360,
      height: 180,
    }) as { top: number };

    expect(style.top + 180).toBeLessThanOrEqual(target.top - 16);
  });
});
