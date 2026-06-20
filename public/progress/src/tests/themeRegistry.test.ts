import { describe, expect, it } from "vitest";
import {
  THEMES,
  THEME_CATEGORIES,
  THEME_META,
  THEME_MODE,
  type ThemeKey,
} from "../theme/themes";

const REQUIRED_THEME_VARS = [
  "--bg",
  "--bg-muted",
  "--card",
  "--card-border",
  "--text",
  "--text-muted",
  "--accent",
  "--accent-contrast",
  "--ring",
  "--shadow",
  "--glow",
  "--chart-1",
  "--chart-2",
  "--chart-grid",
  "--success",
  "--warning",
  "--danger",
  "--card-backdrop",
] as const;

const VIBE_THEME_VARS = [
  "--theme-texture",
  "--theme-texture-opacity",
  "--theme-surface-treatment",
  "--theme-border-treatment",
  "--theme-radius-scale",
  "--theme-shadow-style",
  "--theme-font-accent",
] as const;

describe("theme registry", () => {
  it("keeps every theme wired to metadata, mode, category, and core vars", () => {
    const keys = Object.keys(THEMES) as ThemeKey[];

    expect(keys.length).toBeGreaterThanOrEqual(39);
    expect(keys).toContain("midnight");
    expect(keys).toContain("iron-temple");
    expect(keys).toContain("candy-pop");

    for (const key of keys) {
      expect(THEME_META[key], `${key} missing metadata`).toBeTruthy();
      expect(THEME_MODE[key], `${key} missing mode`).toMatch(/^(dark|light)$/);
      expect(THEME_CATEGORIES).toContain(THEME_META[key].category as any);

      for (const varName of REQUIRED_THEME_VARS) {
        expect(THEMES[key][varName], `${key} missing ${varName}`).toBeTruthy();
      }
    }
  });

  it("gives full vibe themes the extended visual identity tokens", () => {
    const vibeThemes = (Object.keys(THEMES) as ThemeKey[]).filter(
      (key) => THEME_META[key].category === "Vibes",
    );

    expect(vibeThemes).toHaveLength(12);

    for (const key of vibeThemes) {
      for (const varName of VIBE_THEME_VARS) {
        expect(THEMES[key][varName], `${key} missing ${varName}`).toBeTruthy();
      }
    }
  });
});
