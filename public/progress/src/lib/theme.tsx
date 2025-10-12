import { createContext, useContext, useEffect, useState } from "react";

export type PresetId =
  | "emeraldGlass"
  | "blueNeon"
  | "sunsetSolid"
  | "monoMinimal"
  | "violetGlass";
export type Preset = {
  id: PresetId;
  name: string;
  theme: "dark" | "light";
  accent: string;
  cardStyle: "glass" | "solid" | "minimal";
  cssVars?: Record<string, string>;
};

export const THEME_PRESETS: Preset[] = [
  {
    id: "emeraldGlass",
    name: "Emerald Glass",
    theme: "dark",
    accent: "#22c55e",
    cardStyle: "glass",
    cssVars: {
      "--bg": "#0b1220",
      "--card": "rgba(17,24,39,0.6)",
    },
  },
  {
    id: "blueNeon",
    name: "Blue Neon",
    theme: "dark",
    accent: "#60a5fa",
    cardStyle: "glass",
    cssVars: {
      "--bg": "#0a1022",
      "--card": "rgba(10,15,30,0.6)",
    },
  },
  {
    id: "violetGlass",
    name: "Violet Glass",
    theme: "dark",
    accent: "#a78bfa",
    cardStyle: "glass",
    cssVars: {
      "--bg": "#0e1024",
      "--card": "rgba(17,24,39,0.6)",
    },
  },
];

type ThemeCtx = {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  applyPreset: (id: PresetId) => void;
};
const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  setTheme: () => {},
  applyPreset: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => "dark");
  useEffect(() => {
    try {
      localStorage.setItem("theme", "dark");
    } catch {}
  }, [theme]);
  // Apply persisted CSS vars
  useEffect(() => {
    try {
      const raw = localStorage.getItem("theme-css");
      if (raw) {
        const obj = JSON.parse(raw);
        const root = document.documentElement;
        for (const [k, v] of Object.entries(obj))
          root.style.setProperty(k, String(v));
      }
    } catch {}
  }, []);

  const applyPreset = (id: PresetId) => {
    const p = THEME_PRESETS.find((x) => x.id === id);
    if (!p) return;
  setTheme("dark");
    const root = document.documentElement;
  root.classList.add("dark");
    root.setAttribute("data-card-style", p.cardStyle);
    root.style.setProperty("--accent", p.accent);
    if (p.cssVars) {
      for (const [k, v] of Object.entries(p.cssVars))
        root.style.setProperty(k, v);
      try {
        localStorage.setItem("theme-css", JSON.stringify(p.cssVars));
      } catch {}
    }
    try {
      localStorage.setItem("theme-preset", p.id);
    } catch {}
  };

  return (
    <Ctx.Provider value={{ theme, setTheme, applyPreset }}>
      {children}
    </Ctx.Provider>
  );
}
export const useTheme = () => useContext(Ctx);
