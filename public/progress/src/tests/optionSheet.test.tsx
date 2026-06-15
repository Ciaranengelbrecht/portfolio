import { createRoot, type Root } from "react-dom/client";
import { act, useMemo, useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import OptionSheet, { type OptionSheetOption } from "../components/OptionSheet";

const flushFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

let setQueryExternal: ((value: string) => void) | null = null;

function SearchHarness() {
  const [query, setQuery] = useState("");
  setQueryExternal = setQuery;
  const options = useMemo<OptionSheetOption[]>(() => {
    return ["Barbell Squat", "Bench Press", "Cable Row"]
      .filter((label) => label.toLowerCase().includes(query.toLowerCase()))
      .map((label) => ({
        id: label,
        label,
        onSelect: () => {},
      }));
  }, [query]);

  return (
    <OptionSheet
      open
      title="Swap exercise"
      onClose={() => {}}
      searchValue={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search exercises"
      options={options}
    />
  );
}

describe("OptionSheet search", () => {
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
    setQueryExternal = null;
    document.body.innerHTML = "";
  });

  it("keeps the same focused search input while results update", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<SearchHarness />);
      await flushFrame();
    });

    const input = document.querySelector<HTMLInputElement>(
      'input[type="search"]'
    );
    expect(input).not.toBeNull();
    input!.focus();
    expect(document.activeElement).toBe(input);

    await act(async () => {
      setQueryExternal?.("bar");
      await flushFrame();
    });

    const nextInput = document.querySelector<HTMLInputElement>(
      'input[type="search"]'
    );
    expect(nextInput).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it("keeps search results in a safe-area padded scroll pane", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<SearchHarness />);
      await flushFrame();
    });

    const list = document.querySelector<HTMLElement>(
      "[data-option-sheet-list]"
    );
    const results = document.querySelector<HTMLElement>(
      "[data-option-sheet-results]"
    );
    const firstOption = document.querySelector<HTMLElement>("[data-option]");

    expect(list).not.toBeNull();
    expect(results).not.toBeNull();
    expect(firstOption).not.toBeNull();
    expect(list?.contains(results)).toBe(true);
    expect(list?.contains(firstOption)).toBe(true);
    expect(list?.className).toContain("min-h-0");
    expect(list?.style.overflowY).toBe("auto");
    expect(list?.getAttribute("style")).toContain("safe-area-inset-bottom");
    expect(results?.className).toContain("safe-area-inset-bottom");
  });
});
