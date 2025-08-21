import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { THEMES, ThemeKey, ThemeVars } from "./themes";
import { db } from "../lib/db";
import { Settings } from "../lib/types";
import { fetchUserProfile } from "../lib/profile";

type Ctx = {
  themeKey: ThemeKey;
  setThemeKey: (k: ThemeKey) => void;
  applyVars: (vars: ThemeVars) => void;
};

const ThemeCtx = createContext<Ctx>({
  themeKey: "default-glass",
  setThemeKey: () => {},
  applyVars: () => {},
});

function setMetaTheme(bg: string) {
  try {
    const meta = document.querySelector(
      'meta[name="theme-color"]'
    ) as HTMLMetaElement | null;
    if (meta) meta.content = bg;
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>("default-glass");
  const applyVars = (vars: ThemeVars) => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    // Derive accent-rgb if not provided so glow utilities can adapt
    try {
      if(!("--accent-rgb" in vars) && vars["--accent"]) {
        const a = vars["--accent"];
        // Support hsl or hex (#rrggbb)
        let r:number|undefined,g:number|undefined,b:number|undefined;
        const hslMatch = a.match(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/i);
        if(hslMatch){
          const h=Number(hslMatch[1]); const s=Number(hslMatch[2])/100; const l=Number(hslMatch[3])/100;
          const c=(1-Math.abs(2*l-1))*s; const x=c*(1-Math.abs(((h/60)%2)-1)); const m=l-c/2; let rp=0,gp=0,bp=0;
          if(h<60){ rp=c; gp=x; bp=0;} else if(h<120){ rp=x; gp=c; bp=0;} else if(h<180){ rp=0; gp=c; bp=x;} else if(h<240){ rp=0; gp=x; bp=c;} else if(h<300){ rp=x; gp=0; bp=c;} else { rp=c; gp=0; bp=x; }
          r=Math.round((rp+m)*255); g=Math.round((gp+m)*255); b=Math.round((bp+m)*255);
        } else if(a.startsWith('#') && (a.length===7)) {
          r=parseInt(a.slice(1,3),16); g=parseInt(a.slice(3,5),16); b=parseInt(a.slice(5,7),16);
        }
        if(r!=null && g!=null && b!=null){ root.style.setProperty('--accent-rgb', `${r} ${g} ${b}`); }
      }
    } catch {}
    const glass =
      (vars["--card"] || "").includes("rgba(") ||
      (vars["--card-backdrop"] || "").includes("blur");
    root.setAttribute("data-card-style", glass ? "glass" : "solid");
    const bg = vars["--bg"]?.startsWith("radial-gradient")
      ? vars["--bg-muted"] || "#0b0f14"
      : vars["--bg"] || "#0b0f14";
    setMetaTheme(bg);
    // toggle aurora background layer if present
    try {
      const body = document.body;
      if (vars["--bg-layer"] && vars["--bg-layer"] !== "none")
        body.setAttribute("data-bg-layer", "on");
      else body.removeAttribute("data-bg-layer");
    } catch {}
    try {
      window.dispatchEvent(
        new CustomEvent("theme-change", { detail: { vars } })
      );
    } catch {}
  };

  const setThemeKey = async (key: ThemeKey) => {
    setThemeKeyState(key);
    const vars = THEMES[key];
    applyVars(vars);
    // Toggle dark mode class: all current themes are dark-styled; keep dark class on
    document.documentElement.classList.add("dark");
    const root = document.getElementById("root");
    if (root) {
      root.style.transition = "opacity 200ms ease";
      root.style.opacity = "0.98";
      setTimeout(() => {
        root.style.opacity = "1";
        root.style.transition = "";
      }, 220);
    }
    const s = await db.get<Settings>("settings", "app");
    await db.put("settings", {
      ...(s ||
        ({
          unit: "kg",
          deloadDefaults: { loadPct: 0.55, setPct: 0.5 },
        } as any)),
      id: "app",
      themeV2: { key },
    } as any);
  };

  useEffect(() => {
    (async () => {
      try {
        const s = await db.get<Settings>("settings", "app");
        // prefer v2, fallback to earlier experimental theme object, otherwise default to 'default-glass'
        let key = ((s as any)?.themeV2?.key || (s as any)?.theme?.key) as
          | ThemeKey
          | undefined;
        if (!key || !THEMES[key as ThemeKey]) {
          key = "default-glass";
          // self-heal persisted invalid/removed keys
          try {
            await db.put("settings", {
              ...(s || ({} as any)),
              id: "app",
              themeV2: { key },
            } as any);
          } catch {}
        }
        // Attempt profile override for cross-device persistence
        try {
          const profile = await fetchUserProfile();
          if (
            profile?.themeV2?.key &&
            THEMES[profile.themeV2.key as ThemeKey]
          ) {
            key = profile.themeV2.key as ThemeKey;
          }
        } catch {}
        setThemeKeyState(key as ThemeKey);
        const vars = THEMES[key as ThemeKey];
        applyVars(vars);
        document.documentElement.classList.add("dark");
        try {
          window.dispatchEvent(
            new CustomEvent("theme-change", { detail: { key } })
          );
        } catch {}
      } catch {
        applyVars(THEMES["default-glass"]);
      }
    })();
  }, []);

  // Apply profile theme when auth state changes (e.g., user signs in after initial mount)
  useEffect(() => {
    const onAuth = async (e: any) => {
      try {
        const session = e?.detail?.session;
        const userId = session?.user?.id;
        if (!userId) return;
        const profile = await fetchUserProfile();
        const pKey = profile?.themeV2?.key as ThemeKey | undefined;
        if (pKey && THEMES[pKey] && pKey !== themeKey) {
          // Use internal setter to persist + animate
          setThemeKey(pKey);
        }
      } catch (err) {
        console.warn("[theme] auth listener apply failed", err);
      }
    };
    window.addEventListener("sb-auth", onAuth);
    return () => window.removeEventListener("sb-auth", onAuth);
  }, [themeKey]);

  const ctx = useMemo(() => ({ themeKey, setThemeKey, applyVars }), [themeKey]);
  return <ThemeCtx.Provider value={ctx}>{children}</ThemeCtx.Provider>;
}

export const useAppTheme = () => useContext(ThemeCtx);
