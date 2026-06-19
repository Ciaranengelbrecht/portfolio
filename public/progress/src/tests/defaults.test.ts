import { describe, expect, it } from "vitest";

import { defaultSettings } from "../lib/defaults";

describe("defaultSettings", () => {
  it("enables the gym background by default", () => {
    expect(defaultSettings.themeV2?.gymBackground).toBe(true);
  });
});
