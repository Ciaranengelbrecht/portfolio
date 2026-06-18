import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import GuidedAppIntro, {
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
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await flushFrame();
    });
    if (document.body.textContent?.includes(text)) return;
  }
  throw new Error(`Timed out waiting for text: ${text}`);
}

function installRect(node: HTMLElement) {
  node.getBoundingClientRect = () =>
    ({
      x: 96,
      y: 120,
      top: 120,
      left: 96,
      right: 196,
      bottom: 164,
      width: 100,
      height: 44,
      toJSON: () => ({}),
    } as DOMRect);
  node.getClientRects = () =>
    ({
      length: 1,
      item: () => node.getBoundingClientRect(),
      [0]: node.getBoundingClientRect(),
    } as unknown as DOMRectList);
}

function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label
  ) as HTMLButtonElement | undefined;
  expect(button).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

  it("saves skipped state from the subtle skip-all control", async () => {
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
    clickButton("Skip all");
    await act(async () => {
      await flushFrame();
    });

    const intro = getAppIntroState(current);
    expect(intro.pending).toBe(false);
    expect(intro.completed).toBe(false);
    expect(intro.skipped).toBe(true);
  });
});
