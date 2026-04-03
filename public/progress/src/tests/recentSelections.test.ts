import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRecentSelections,
  readRecentSelections,
  rememberRecentSelection,
  sortByRecentSelection,
} from "../lib/recentSelections";

describe("recent selections", () => {
  beforeEach(() => {
    clearRecentSelections();
  });

  it("stores unique ids with newest first", () => {
    rememberRecentSelection("sessions:add", "a");
    rememberRecentSelection("sessions:add", "b");
    const next = rememberRecentSelection("sessions:add", "a");

    expect(next).toEqual(["a", "b"]);
    expect(readRecentSelections("sessions:add")).toEqual(["a", "b"]);
  });

  it("caps by max items", () => {
    rememberRecentSelection("templates:add", "one", 2);
    rememberRecentSelection("templates:add", "two", 2);
    rememberRecentSelection("templates:add", "three", 2);

    expect(readRecentSelections("templates:add")).toEqual(["three", "two"]);
  });

  it("handles malformed storage safely", () => {
    window.localStorage.setItem("progress:recent-selections:v1", "{bad json");
    expect(readRecentSelections("analytics:exercise")).toEqual([]);
  });

  it("sorts using recent rank then fallback comparator", () => {
    const items = [
      { id: "c", name: "Curl" },
      { id: "a", name: "Bench" },
      { id: "b", name: "Deadlift" },
    ];

    const sorted = sortByRecentSelection(
      items,
      (item) => item.id,
      ["b", "a"],
      (left, right) => left.name.localeCompare(right.name)
    );

    expect(sorted.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });
});
