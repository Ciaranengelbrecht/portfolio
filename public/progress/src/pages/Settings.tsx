import { getMuscleIconPath } from "../lib/muscles";
import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppTheme } from "../theme/ThemeProvider";
import { THEMES, ThemeKey, THEME_META, THEME_CATEGORIES } from "../theme/themes";
import { useNavigate } from "react-router-dom";
import BigFlash from "../components/BigFlash";
import { db } from "../lib/db";
import { triggerExportDownload, importFromRawJson } from "../lib/exportImport";
import { Settings } from "../lib/types";
import GuidedSetupWizard from "../features/guided-setup/GuidedSetupWizard";
import {
  defaultSettings,
  defaultExercises,
  defaultTemplates,
} from "../lib/defaults";
import { unlockAudio, setBeepVolumeScalar } from "../lib/audio";
import { saveProfileTheme } from "../lib/profile";
import { supabase, clearAuthStorage, waitForSession } from "../lib/supabase";
import { getSettings, setSettings } from "../lib/helpers";
import { ListSkeleton } from "../components/LoadingSkeletons";

type SettingsTabId =
  | "general"
  | "appearance"
  | "progress"
  | "library"
  | "safety";

const SETTINGS_TABS: Array<{
  id: SettingsTabId;
  label: string;
  description: string;
}> = [
  {
    id: "general",
    label: "General",
    description: "Account, guided setup, and workout defaults.",
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme presets, visual tuning, and motion settings.",
  },
  {
    id: "progress",
    label: "Progress",
    description: "Weekly targets, hints, and progression behavior.",
  },
  {
    id: "library",
    label: "Exercise Library",
    description: "Exercise metadata, deload overrides, and tags.",
  },
  {
    id: "safety",
    label: "Data & Safety",
    description: "Destructive action protection and data import/export.",
  },
];

const VOLUME_TARGET_MUSCLES = [
  "chest",
  "lats",
  "traps",
  "delts",
  "reardelts",
  "quads",
  "hamstrings",
  "glutes",
  "biceps",
  "triceps",
  "forearms",
  "calves",
  "core",
] as const;

const EXERCISE_LIBRARY_MUSCLES = [
  "chest",
  "lats",
  "traps",
  "delts",
  "reardelts",
  "triceps",
  "biceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "other",
] as const;

export default function SettingsPage() {
  const { themeKey, setThemeKey } = useAppTheme();
  const [themeSaved, setThemeSaved] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [s, setS] = useState<Settings>(defaultSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileEmailDraft, setProfileEmailDraft] = useState("");
  const [profilePasswordCurrent, setProfilePasswordCurrent] = useState("");
  const [profilePasswordNext, setProfilePasswordNext] = useState("");
  const [profilePasswordConfirm, setProfilePasswordConfirm] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bigFlash, setBigFlash] = useState<string | null>(null);
  const [showGuidedSetup, setShowGuidedSetup] = useState(false);
  const [exerciseOverrideCount, setExerciseOverrideCount] = useState<
    number | null
  >(null);
  const [exerciseLibraryCount, setExerciseLibraryCount] = useState<
    number | null
  >(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Settings | null>(null);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const lastSavedSettingsRef = useRef<string>("");
  const pendingSaveRef = useRef<number | null>(null);

  const activeTabMeta = useMemo(
    () => SETTINGS_TABS.find((tab) => tab.id === activeTab) || SETTINGS_TABS[0],
    [activeTab]
  );

  const hasPendingAutosave =
    settingsHydrated && JSON.stringify(s) !== lastSavedSettingsRef.current;

  const applyAuthIdentity = (user?: any) => {
    setUserEmail(user?.email || undefined);
    setProfileEmailDraft(user?.email || "");
    const metadata = user?.user_metadata || {};
    const rawName = metadata.display_name ?? metadata.full_name ?? "";
    const nextName = typeof rawName === "string" ? rawName : "";
    setProfileNameDraft(nextName);
    if (!user) {
      setProfilePasswordCurrent("");
      setProfilePasswordNext("");
      setProfilePasswordConfirm("");
    }
  };

  type SectionCardProps = {
    id: string;
    eyebrow?: string;
    title: string;
    description?: string;
    badge?: ReactNode;
    children: ReactNode;
  };

  const SectionCard = ({
    id,
    eyebrow,
    title,
    description,
    badge,
    children,
  }: SectionCardProps) => {
    return (
      <section
        id={`settings-${id}`}
        className="settings-panel"
      >
        <div className="settings-panel-head flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            {eyebrow && (
              <div className="settings-panel-eyebrow text-[10px] uppercase tracking-[0.32em] text-white/40">
                {eyebrow}
              </div>
            )}
            <h3 className="text-lg font-semibold text-slate-100 leading-tight">
              {title}
            </h3>
            {description && (
              <p className="settings-panel-description text-sm text-slate-300/80">
                {description}
              </p>
            )}
          </div>
          {badge && (
            <div className="ml-auto text-right text-xs text-slate-400">
              {badge}
            </div>
          )}
        </div>
        <div className="settings-panel-body space-y-4">{children}</div>
      </section>
    );
  };

  const hslToHex = (hsl: string): string => {
    try {
      const m = hsl.match(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/i);
      if (!m) return "#000000";
      let h = Number(m[1]);
      const s = Number(m[2]) / 100;
      const l = Number(m[3]) / 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m0 = l - c / 2;
      let r = 0,
        g = 0,
        b = 0;
      if (h < 60) {
        r = c;
        g = x;
        b = 0;
      } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
      } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
      } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
      } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
      } else {
        r = c;
        g = 0;
        b = x;
      }
      const R = Math.round((r + m0) * 255),
        G = Math.round((g + m0) * 255),
        B = Math.round((b + m0) * 255);
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
    } catch {
      return "#000000";
    }
  };
  const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
    try {
      const m = hex.match(/^#([\da-f]{6})$/i);
      if (!m) return { h: 0, s: 0, l: 0 };
      const num = parseInt(m[1], 16);
      const r = (num >> 16) & 255,
        g = (num >> 8) & 255,
        b = num & 255;
      const rn = r / 255,
        gn = g / 255,
        bn = b / 255;
      const max = Math.max(rn, gn, bn),
        min = Math.min(rn, gn, bn);
      let h = 0,
        s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
        switch (max) {
          case rn:
            h = (gn - bn) / d + (gn < bn ? 6 : 0);
            break;
          case gn:
            h = (bn - rn) / d + 2;
            break;
          case bn:
            h = (rn - gn) / d + 4;
            break;
        }
        h *= 60;
      }
      return {
        h: Math.round(h),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      };
    } catch {
      return { h: 0, s: 0, l: 0 };
    }
  };

  const parseHslA = (
    v?: string
  ): { h: number; s: number; l: number; a?: number } | null => {
    if (!v) return null;
    const m = v.match(
      /hsl(a)?\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*(?:\/\s*([0-9.]+))?\s*\)/i
    );
    if (!m) return null;
    return {
      h: Number(m[2]),
      s: Number(m[3]),
      l: Number(m[4]),
      a: m[5] != null ? Number(m[5]) : undefined,
    };
  };
  const formatHslA = (h: number, s: number, l: number, a?: number) =>
    a == null ? `hsl(${h} ${s}% ${l}%)` : `hsla(${h} ${s}% ${l}% / ${a})`;

  // Popover color picker using react-colorful (lazy imported)
  const ColorPicker = useMemo(() => ({ Comp: null as any }), []);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const mod = await import("react-colorful");
        (ColorPicker as any).Comp = mod.HexColorPicker;
        setPickerLoaded(true);
      } catch {}
    })();
  }, []);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const closePicker = () => setOpenPicker(null);
  // Collapse state for Theme presets (default collapsed to save space)
  const [themesCollapsed, setThemesCollapsed] = useState(true);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("themePresetsCollapsed");
      if (raw !== null) setThemesCollapsed(raw === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "themePresetsCollapsed",
        themesCollapsed ? "1" : "0"
      );
    } catch {}
  }, [themesCollapsed]);

  useEffect(() => {
    if (!bigFlash) return;
    const t = setTimeout(() => setBigFlash(null), 1800);
    return () => clearTimeout(t);
  }, [bigFlash]);

  useEffect(() => {
    (async () => {
      try {
        const current = await getSettings();
        const hadExisting = await db.get<Settings>("settings", "app");
        if (!hadExisting) {
          // seed default catalogue once for first-run accounts
          for (const e of defaultExercises) await db.put("exercises", e);
          for (const t of defaultTemplates) await db.put("templates", t);
        }
        setS(current);
        lastSavedSettingsRef.current = JSON.stringify(current);
        setUndoSnapshot(null);
      } catch (err) {
        // Keep app usable even if remote read fails; autosave will write back when available.
        setS(defaultSettings);
        lastSavedSettingsRef.current = JSON.stringify(defaultSettings);
        setUndoSnapshot(null);
        console.warn("[settings] initial hydrate failed; using defaults", err);
      } finally {
        setSettingsHydrated(true);
      }
    })();
  }, []);

  const parseSerializedSettings = (serialized: string): Settings | null => {
    if (!serialized) return null;
    try {
      return JSON.parse(serialized) as Settings;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!settingsHydrated) return;
    const serialized = JSON.stringify(s);
    if (serialized === lastSavedSettingsRef.current) return;
    const previousSaved = parseSerializedSettings(lastSavedSettingsRef.current);

    const timer = window.setTimeout(async () => {
      try {
        await setSettings(s);
        lastSavedSettingsRef.current = serialized;
        if (previousSaved) {
          setUndoSnapshot(previousSaved);
        }
      } catch (err) {
        console.warn("[settings] autosave failed", err);
      }
    }, 250);
    pendingSaveRef.current = timer;

    return () => {
      if (pendingSaveRef.current != null) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, [s, settingsHydrated]);

  useEffect(() => {
    if (!settingsHydrated) return;
    const flushSettingsNow = async () => {
      const serialized = JSON.stringify(s);
      if (serialized === lastSavedSettingsRef.current) return;
      const previousSaved = parseSerializedSettings(lastSavedSettingsRef.current);
      try {
        await setSettings(s);
        lastSavedSettingsRef.current = serialized;
        if (previousSaved) {
          setUndoSnapshot(previousSaved);
        }
      } catch (err) {
        console.warn("[settings] flush save failed", err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flushSettingsNow();
      }
    };
    const onPageHide = () => {
      void flushSettingsNow();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [s, settingsHydrated]);

  useEffect(() => {
    // Track supabase auth state
    const sub = supabase.auth.onAuthStateChange(
      async (_evt: any, session: any) => {
        applyAuthIdentity(session?.user);
        setAuthChecked(true);
      }
    );
    const onAuth = (e: any) => {
      const session = e?.detail?.session;
      applyAuthIdentity(session?.user);
    };
    window.addEventListener("sb-auth", onAuth);
    // get current session once (resilient)
    let timer = setTimeout(() => setAuthChecked(true), 1500);
    waitForSession({ timeoutMs: 1200 })
      .then((s: any) => {
        applyAuthIdentity(s?.user);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true))
      .finally(() => {
        clearTimeout(timer);
      });
    return () => {
      try {
        clearTimeout(timer);
      } catch {}
      sub?.data?.subscription?.unsubscribe?.();
      window.removeEventListener("sb-auth", onAuth);
    };
  }, []);

  // Handle password recovery deep-links from Supabase (type=recovery in URL)
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.hash.slice(1) || window.location.search
    );
    const type = params.get("type") || params.get("event");
    const isRecovery =
      type === "recovery" || localStorage.getItem("sb_pw_reset") === "1";
    if (isRecovery) {
      try {
        localStorage.setItem("sb_pw_reset", "1");
      } catch {}
      // Inform user to set new password in the section below
      // Avoid alert loops by only showing once
      if (!sessionStorage.getItem("pw_reset_alert")) {
        alert("Enter a new password below to complete your reset.");
        sessionStorage.setItem("pw_reset_alert", "1");
      }
    }
  }, []);

  const saveNow = async (message = "Settings saved") => {
    if (pendingSaveRef.current != null) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    const serialized = JSON.stringify(s);
    const previousSaved = parseSerializedSettings(lastSavedSettingsRef.current);
    await setSettings(s);
    lastSavedSettingsRef.current = serialized;
    if (previousSaved) {
      setUndoSnapshot(previousSaved);
    }
    setToast(message);
  };

  const undoLastSave = async () => {
    if (!undoSnapshot) return;
    const serialized = JSON.stringify(undoSnapshot);
    await setSettings(undoSnapshot);
    lastSavedSettingsRef.current = serialized;
    setS(undoSnapshot);
    setUndoSnapshot(null);
    setToast("Reverted to previous saved settings");
  };

  // testSync removed with Gist sync

  const exportData = async () => {
    await triggerExportDownload({
      includeRawJson: true,
      prettyJson: true,
      excludeEmptySessions: true,
    });
  };

  // Gist sync removed; Supabase sync is automatic

  const importData = async (file: File) => {
    const text = await file.text();
    let result;
    if (file.name.endsWith(".json")) {
      result = await importFromRawJson(text);
    } else {
      // Minimal zip support fallback: instruct user (full zip parsing could be added if needed)
      if (/manifest\.json/.test(text.substring(0, 200))) {
        alert(
          "Please extract zip and import raw.json (zip parsing not implemented inline)."
        );
        return;
      }
      result = await importFromRawJson(text);
    }
    alert(
      `Imported: ${Object.entries(result.inserted)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`
    );
  };

  const resetData = async () => {
    if (
      s.confirmDestructive &&
      !window.confirm("Reset all local data? This cannot be undone.")
    )
      return;
    for (const k of [
      "exercises",
      "sessions",
      "measurements",
      "templates",
    ] as const) {
      const items = await db.getAll<any>(k);
      for (const it of items) await db.delete(k, (it as any).id);
    }
    await db.put("settings", { ...defaultSettings, id: "app" } as any);
    location.reload();
  };

  const deleteAccountAndData = async () => {
    try {
      if (!authChecked) {
        alert("Please wait until your session is checked.");
        return;
      }
      const sess = await waitForSession({ timeoutMs: 3000 });
      if (!sess?.user?.id) {
        alert("You need to be signed in to delete your cloud account.");
        return;
      }
      // Multi‑step confirmation
      if (
        !window.confirm(
          "Delete your LiftLog account and all synced data? This cannot be undone."
        )
      )
        return;
      if (
        !window.confirm(
          "Final confirmation: permanently delete account and data?"
        )
      )
        return;

      setBusy("delete");
      const uid = sess.user.id as string;

      // 1) Delete remote rows owned by the user (RLS permits owner deletes)
      try {
        const tables = [
          "exercises",
          "sessions",
          "measurements",
          "templates",
          "settings",
        ] as const;
        for (const t of tables) {
          await supabase.from(t).delete().eq("owner", uid);
        }
      } catch (e) {
        console.warn("[Delete] remote row cleanup issue", e);
      }

      // 2) Attempt to delete auth user via admin function (optional backend). If not available, sign out and proceed.
      try {
        // Optional: call a secured endpoint if configured (not required to ship UI)
        // await fetch('/api/delete-user', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ uid }) });
      } catch {}

      // 3) Clear local data
      for (const k of [
        "exercises",
        "sessions",
        "measurements",
        "templates",
      ] as const) {
        const items = await db.getAll<any>(k);
        for (const it of items) await db.delete(k, (it as any).id);
      }
      try {
        await db.delete("settings", "app");
      } catch {}

      // 4) Sign out and navigate to a confirmation/info page
      try {
        await supabase.auth.signOut({ scope: "global" } as any);
      } catch {}
      clearAuthStorage();
      alert(
        "Your account data has been deleted."
      );
      window.location.href =
        "https://ciaranengelbrecht.com/delete-account-liftlog.html";
    } finally {
      setBusy(null);
    }
  };

  if (!settingsHydrated) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <ListSkeleton items={6} />
      </div>
    );
  }

  return (
    <div className="settings-page space-y-4 pb-20">
      <div className="settings-shell space-y-3">
        <div className="space-y-1 min-w-0">
          <h2 className="settings-page-title text-xl font-semibold text-white">
            Settings
          </h2>
          <p className="text-sm text-white/70 leading-snug">
            Mobile-first control center for your training preferences, account,
            and data.
          </p>
        </div>

        <div className="settings-tab-strip no-scrollbar" role="tablist" aria-label="Settings categories">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="settings-tab-chip"
              data-active={activeTab === tab.id ? "true" : "false"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-status-strip flex flex-col gap-2">
          <p className="text-xs text-white/75 leading-snug">{activeTabMeta.description}</p>
          <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
            <div className="text-xs text-white/70 min-w-0">
              {userEmail ? `Sync: ${userEmail}` : "Sync: Offline mode"} · {hasPendingAutosave ? "Autosave pending" : "Saved"}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-outline px-3 py-2 rounded-xl text-xs settings-utility-btn"
                onClick={() => void saveNow()}
              >
                Save now
              </button>
              <button
                type="button"
                className="btn-outline px-3 py-2 rounded-xl text-xs settings-utility-btn disabled:opacity-50"
                onClick={() => void undoLastSave()}
                disabled={!undoSnapshot}
              >
                Undo last save
              </button>
            </div>
          </div>
        </div>
      </div>
      <GuidedSetupWizard
        open={showGuidedSetup}
        onClose={() => setShowGuidedSetup(false)}
        onComplete={() =>
          setToast(
            "Guided setup ready! Adjust templates anytime under Program settings."
          )
        }
      />
      <Toast
        open={!!toast}
        message={toast || ""}
        onClose={() => setToast(null)}
      />
      <BigFlash
        open={!!bigFlash}
        message={bigFlash || ""}
        onClose={() => setBigFlash(null)}
      />
      {activeTab === "general" && (
        <SectionCard
          id="general"
          eyebrow="Core"
          title="General settings"
          description="Configure rest timer alerts, Supabase sync, and workout defaults."
          badge={<span>{userEmail ? "Signed in" : "Offline mode"}</span>}
        >
        <div className="settings-highlight-card flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">
              {s.progress?.guidedSetup?.completed
                ? "Refine your training plan"
                : "Jump-start your training plan"}
            </div>
            <p className="text-xs text-white/70">
              {s.progress?.guidedSetup?.completed
                ? "Re-run guided setup anytime to refresh your split, volume targets, and starter templates."
                : "Launch guided setup to craft a personalised split, volume targets, and starter templates in minutes."}
            </p>
          </div>
          <button
            className="btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold"
            onClick={() => setShowGuidedSetup(true)}
          >
            {s.progress?.guidedSetup?.completed
              ? "Re-run guided setup"
              : "Launch guided setup"}
          </button>
        </div>
        <div className="space-y-2">
          <div className="font-medium mb-1">Rest Timer</div>
          <div className="text-xs text-muted mb-2">
            Default target rest time (seconds). Timer animates, beeps, and
            vibrates (if enabled) when this threshold is reached.
          </div>
          <div className="settings-rest-grid">
            <label className="settings-inline-field settings-inline-field-stack">
              <span className="settings-inline-label">Target seconds</span>
              <input
                type="number"
                min={30}
                max={300}
                className="input-app rounded-xl px-3 py-2 settings-input-compact"
                value={s.restTimerTargetSeconds ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (isNaN(v)) return;
                  setS((prev) => ({
                    ...prev,
                    restTimerTargetSeconds: Math.max(30, Math.min(300, v)),
                  }));
                }}
              />
            </label>
            <div className="settings-inline-field settings-inline-field-stack min-[390px]:col-span-2 lg:col-span-2">
              <span className="settings-inline-label">Quick presets</span>
              <div className="settings-chip-row">
                {[60, 90, 120, 150].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`settings-preset-chip ${(s.restTimerTargetSeconds || 0) === preset ? "is-active" : ""}`}
                    onClick={() =>
                      setS((prev) => ({
                        ...prev,
                        restTimerTargetSeconds: preset,
                      }))
                    }
                  >
                    {preset}s
                  </button>
                ))}
              </div>
            </div>
            <SettingsSwitchRow
              label="Strong pulse"
              checked={s.restTimerStrongAlert !== false}
              onChange={(checked) =>
                setS((prev) => ({ ...prev, restTimerStrongAlert: checked }))
              }
              className="settings-switch-row-compact"
            />
            <SettingsSwitchRow
              label="Beep at target"
              description="Play a short beep when rest target is reached"
              checked={s.restTimerBeep !== false}
              onChange={(checked) =>
                setS((prev) => ({ ...prev, restTimerBeep: checked }))
              }
              className="settings-switch-row-compact"
            />
            {s.restTimerBeep !== false && (
              <>
                <div className="settings-inline-field settings-inline-field-stack min-[390px]:col-span-2 lg:col-span-3">
                  <span className="settings-inline-label">Beep style</span>
                  <SegmentedControl
                    ariaLabel="Rest timer beep style"
                    value={s.restTimerBeepStyle || "gentle"}
                    options={[
                      { value: "gentle", label: "Gentle" },
                      { value: "chime", label: "Chime" },
                      { value: "digital", label: "Digital" },
                      { value: "alarm", label: "Alarm" },
                      { value: "click", label: "Click" },
                    ]}
                    className="settings-segmented-tight settings-segmented-wrap"
                    onChange={(next) =>
                      setS((prev) => ({
                        ...prev,
                        restTimerBeepStyle: next as any,
                      }))
                    }
                  />
                </div>
                <label className="settings-inline-field">
                  <span className="settings-inline-label">Beep count</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="input-app rounded-xl px-3 py-2 settings-input-compact"
                    value={Math.max(1, Math.min(5, s.restTimerBeepCount ?? 2))}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v))
                        setS((prev) => ({
                          ...prev,
                          restTimerBeepCount: Math.max(
                            1,
                            Math.min(5, Math.floor(v))
                          ),
                        }));
                    }}
                  />
                </label>
                <label
                  className="settings-inline-field settings-inline-field-stack min-[390px]:col-span-2 lg:col-span-2"
                  title="Make the beep louder to cut through music (50% to 300%)."
                >
                  <span className="settings-inline-label">Beep volume</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={50}
                      max={300}
                      step={10}
                      className="settings-range"
                      value={Math.max(
                        50,
                        Math.min(300, s.restTimerBeepVolume ?? 140)
                      )}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v))
                          setS((prev) => ({
                            ...prev,
                            restTimerBeepVolume: Math.max(
                              50,
                              Math.min(300, Math.floor(v))
                            ),
                          }));
                      }}
                    />
                    <span className="tabular-nums w-11 text-right text-xs text-white/85">
                      {Math.max(50, Math.min(300, s.restTimerBeepVolume ?? 140))}%
                    </span>
                  </div>
                </label>
              </>
            )}
            <SettingsSwitchRow
              label="Screen flash"
              description="Brief white flash behind app when rest target is reached"
              checked={!!s.restTimerScreenFlash}
              onChange={(checked) =>
                setS((prev) => ({ ...prev, restTimerScreenFlash: checked }))
              }
              className="settings-switch-row-compact"
            />
            <div className="flex items-end">
              <BeepTester
                styleKey={s.restTimerBeepStyle || "gentle"}
                count={Math.max(1, Math.min(5, s.restTimerBeepCount ?? 2))}
                volumePct={Math.max(50, Math.min(300, s.restTimerBeepVolume ?? 140))}
              />
            </div>
          </div>
          <div className="text-[10px] text-muted mt-1 leading-snug max-w-[580px]">
            Strong pulse enlarges and pulses the timer once target is reached.
            Beep uses subtle tones and respects browser autoplay policies (tap
            anywhere to unlock sound). Screen flash briefly inverts/whitens the
            background for high visibility. Disable if you prefer minimal motion
            or have sensitivity. Respects the global Reduce motion toggle for
            most animations.
          </div>
        </div>
        <div className="settings-subpanel mb-1">
          <div className="font-medium">Account (Supabase)</div>
          <div className="text-sm text-muted">
            Sign in to sync via Supabase. Offline still works; changes sync when
            you reconnect.
          </div>
          {!authChecked ? (
            <div className="flex items-center gap-3 mt-2 text-sm text-muted">
              Checking session…
            </div>
          ) : userEmail ? (
            <div className="space-y-3 mt-2">
              <div className="settings-inline-field">
                <div className="min-w-0">
                  <div className="settings-switch-label">Signed in</div>
                  <div className="settings-switch-description truncate">
                    {userEmail}
                  </div>
                </div>
                <button
                  className={`px-3 py-2 rounded-xl ${
                    busy === "signout" ? "btn-outline" : "btn-primary"
                  }`}
                  disabled={busy === "signout"}
                  onClick={async () => {
                    setBusy("signout");
                    try {
                      await supabase.auth.signOut({ scope: "global" } as any);
                      setToast("Signed out");
                      setBigFlash("Signed out successfully");
                    } finally {
                      try {
                        localStorage.removeItem("sb_pw_reset");
                        clearAuthStorage();
                      } catch {}
                      // Verify session gone (resilient)
                      try {
                        let tries = 0;
                        while (tries++ < 10) {
                          const s = await waitForSession({ timeoutMs: 800 });
                          if (!s) break;
                          await new Promise((r) => setTimeout(r, 100));
                        }
                      } catch {}
                      applyAuthIdentity(undefined);
                      navigate("/");
                      setBusy(null);
                    }
                  }}
                >
                  {busy === "signout" ? "Signing out…" : "Sign out"}
                </button>
              </div>

              <div className="settings-subpanel space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">
                    Profile
                  </div>
                  <span className="settings-static-pill text-[10px]">Live</span>
                </div>
                <label className="space-y-1">
                  <div className="text-xs text-white/80">Display name</div>
                  <input
                    className="input-app rounded-xl px-3 py-2 w-full"
                    placeholder="How should we address you?"
                    maxLength={40}
                    value={profileNameDraft}
                    onChange={(e) => setProfileNameDraft(e.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/80">Email</div>
                  <input
                    className="input-app rounded-xl px-3 py-2 w-full"
                    placeholder="you@example.com"
                    value={profileEmailDraft}
                    onChange={(e) => setProfileEmailDraft(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary px-3 py-2 rounded-xl"
                    disabled={busy === "profile-name" || !profileNameDraft.trim()}
                    onClick={async () => {
                      const nextName = profileNameDraft.trim();
                      if (!nextName) return alert("Enter a display name");
                      setBusy("profile-name");
                      try {
                        const { data: userData } = await supabase.auth.getUser();
                        const current = userData.user;
                        if (!current) {
                          alert("Session expired. Please sign in again.");
                          return;
                        }
                        const metadata = current.user_metadata || {};
                        const { data, error } = await supabase.auth.updateUser({
                          data: {
                            ...metadata,
                            display_name: nextName,
                            full_name: nextName,
                          },
                        });
                        if (error) {
                          alert("Could not update profile name: " + error.message);
                          return;
                        }
                        applyAuthIdentity(data.user);
                        setToast("Profile name updated");
                        setBigFlash("Name saved");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === "profile-name" ? "Saving…" : "Save name"}
                  </button>
                  <button
                    className="btn-outline px-3 py-2 rounded-xl"
                    disabled={busy === "profile-name"}
                    onClick={async () => {
                      const { data } = await supabase.auth.getUser();
                      const metadata = data.user?.user_metadata || {};
                      const rawName = metadata.display_name ?? metadata.full_name ?? "";
                      setProfileNameDraft(
                        typeof rawName === "string" ? rawName : ""
                      );
                    }}
                  >
                    Reset
                  </button>
                  <button
                    className="btn-outline px-3 py-2 rounded-xl"
                    disabled={busy === "profile-email" || !profileEmailDraft.trim()}
                    onClick={async () => {
                      const nextEmail = profileEmailDraft.trim().toLowerCase();
                      if (!/.+@.+\..+/.test(nextEmail)) {
                        alert("Enter a valid email address");
                        return;
                      }
                      if (nextEmail === (userEmail || "").toLowerCase()) {
                        alert("Enter a different email address to update");
                        return;
                      }
                      setBusy("profile-email");
                      try {
                        const { error } = await supabase.auth.updateUser({
                          email: nextEmail,
                        });
                        if (error) {
                          alert("Could not update email: " + error.message);
                          return;
                        }
                        setProfileEmailDraft(nextEmail);
                        setToast("Check your inbox to confirm your new email");
                        setBigFlash("Email update requested");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === "profile-email" ? "Updating…" : "Update email"}
                  </button>
                </div>
                <p className="text-[11px] text-muted leading-snug">
                  Name updates sync instantly. Email updates require confirmation via your inbox.
                </p>
              </div>

              <div className="settings-subpanel space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">
                  Security
                </div>
                <div className="grid grid-cols-1 min-[460px]:grid-cols-2 gap-2">
                  <input
                    className="input-app rounded-xl px-3 py-2"
                    placeholder="Current password"
                    type="password"
                    value={profilePasswordCurrent}
                    onChange={(e) => setProfilePasswordCurrent(e.target.value)}
                  />
                  <input
                    className="input-app rounded-xl px-3 py-2"
                    placeholder="New password"
                    type="password"
                    value={profilePasswordNext}
                    onChange={(e) => setProfilePasswordNext(e.target.value)}
                  />
                  <input
                    className="input-app rounded-xl px-3 py-2 min-[460px]:col-span-2"
                    placeholder="Confirm new password"
                    type="password"
                    value={profilePasswordConfirm}
                    onChange={(e) => setProfilePasswordConfirm(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span
                    className={`px-2 py-1 rounded-full border ${
                      profilePasswordNext.length >= 8
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    8+ characters
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full border ${
                      profilePasswordNext.length > 0 &&
                      profilePasswordNext === profilePasswordConfirm
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    Passwords match
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary px-3 py-2 rounded-xl"
                    disabled={
                      busy === "profile-password" ||
                      !profilePasswordCurrent ||
                      profilePasswordNext.length < 8 ||
                      profilePasswordNext !== profilePasswordConfirm
                    }
                    onClick={async () => {
                      if (!userEmail) return;
                      if (!profilePasswordCurrent)
                        return alert("Enter your current password");
                      if (!profilePasswordNext || profilePasswordNext.length < 8)
                        return alert("New password must be at least 8 characters");
                      if (profilePasswordNext !== profilePasswordConfirm)
                        return alert("New passwords do not match");
                      if (profilePasswordCurrent === profilePasswordNext)
                        return alert("Use a different password from your current one");

                      setBusy("profile-password");
                      try {
                        const { error: verifyError } =
                          await supabase.auth.signInWithPassword({
                            email: userEmail,
                            password: profilePasswordCurrent,
                          });
                        if (verifyError) {
                          alert("Current password is incorrect.");
                          return;
                        }
                        const { error } = await supabase.auth.updateUser({
                          password: profilePasswordNext,
                        });
                        if (error) {
                          alert("Could not update password: " + error.message);
                          return;
                        }
                        setProfilePasswordCurrent("");
                        setProfilePasswordNext("");
                        setProfilePasswordConfirm("");
                        setToast("Password updated");
                        setBigFlash("Password changed");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === "profile-password"
                      ? "Updating…"
                      : "Update password"}
                  </button>
                  <button
                    className="btn-outline px-3 py-2 rounded-xl"
                    disabled={busy === "profile-reset-email"}
                    onClick={async () => {
                      if (!userEmail) return;
                      const base =
                        window.location.origin + window.location.pathname;
                      const redirectTo = base.includes("/dist")
                        ? base
                        : base.replace(/\/?$/, "/") + "dist/";
                      setBusy("profile-reset-email");
                      try {
                        const { error } =
                          await supabase.auth.resetPasswordForEmail(userEmail, {
                            redirectTo,
                          });
                        if (error) {
                          alert("Reset error: " + error.message);
                          return;
                        }
                        setToast("Password reset email sent");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === "profile-reset-email"
                      ? "Sending…"
                      : "Send reset link"}
                  </button>
                </div>
                <p className="text-[11px] text-muted leading-snug">
                  For magic-link accounts or re-auth prompts, use Send reset link.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 mt-2">
              <input
                className="input-app rounded-xl px-3 py-3 w-full"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input-app rounded-xl px-3 py-3 w-full"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                <button
                  className="btn-primary px-3 py-3 rounded-xl w-full"
                  onClick={async () => {
                    if (!email || !password)
                      return alert("Enter email and password");
                    setBusy("signin");
                    const { data, error } =
                      await supabase.auth.signInWithPassword({
                        email,
                        password,
                      });
                    if (error) alert("Sign-in error: " + error.message);
                    else {
                      applyAuthIdentity(data.user);
                      setToast("Signed in");
                      setBigFlash("Signed in successfully");
                    }
                    setBusy(null);
                  }}
                >
                  Sign in
                </button>
                <button
                  className="btn-outline px-3 py-3 rounded-xl w-full"
                  onClick={async () => {
                    if (!email || !password)
                      return alert("Enter email and password");
                    if (password !== password2)
                      return alert("Passwords do not match");
                    const redirectTo =
                      window.location.origin + window.location.pathname;
                    setBusy("signup");
                    const { data, error } = await supabase.auth.signUp({
                      email,
                      password,
                      options: { emailRedirectTo: redirectTo },
                    });
                    if (error) alert("Sign-up error: " + error.message);
                    else if (!data.session)
                      alert("Check your email to confirm your account.");
                    else {
                      applyAuthIdentity(data.user);
                      setToast("Account created");
                      setBigFlash("Signed in successfully");
                    }
                    setBusy(null);
                  }}
                >
                  Create account
                </button>
                <button
                  className="btn-outline px-3 py-3 rounded-xl w-full"
                  onClick={async () => {
                    if (!email) return alert("Enter your email");
                    const redirectTo =
                      window.location.origin + window.location.pathname;
                    setBusy("otp");
                    const { error } = await supabase.auth.signInWithOtp({
                      email,
                      options: { emailRedirectTo: redirectTo },
                    });
                    if (error) alert("Magic link error: " + error.message);
                    else alert("Magic link sent. Check your email.");
                    setBusy(null);
                  }}
                >
                  Send magic link
                </button>
                <div className="flex items-center gap-2 min-[420px]:col-span-2">
                  <input
                    className="input-app rounded-xl px-3 py-3 flex-1"
                    placeholder="OTP code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                  <button
                    className="btn-outline px-3 py-3 rounded-xl"
                    onClick={async () => {
                      if (!email || !otp)
                        return alert("Enter email and OTP code");
                      setBusy("verify");
                      const { data, error } = await supabase.auth.verifyOtp({
                        email,
                        token: otp,
                        type: "email" as any,
                      });
                      if (error) alert("OTP error: " + error.message);
                      else {
                        applyAuthIdentity(data?.user);
                        setToast("Signed in via OTP");
                      }
                      setBusy(null);
                    }}
                  >
                    Verify OTP
                  </button>
                </div>
                <button
                  className="btn-outline px-3 py-3 rounded-xl w-full min-[420px]:col-span-2"
                  onClick={async () => {
                    if (!email) return alert("Enter your email");
                    // Ensure the redirect points to the exact app entry so Supabase hashes are preserved
                    const base =
                      window.location.origin + window.location.pathname;
                    // If we're at /progress, send to /progress/dist/; if already /progress/dist, keep it
                    const redirectTo = base.includes("/dist")
                      ? base
                      : base.replace(/\/?$/, "/") + "dist/";
                    const { error } = await supabase.auth.resetPasswordForEmail(
                      email,
                      { redirectTo }
                    );
                    if (error) alert("Reset error: " + error.message);
                    else alert("Password reset email sent. Check your inbox.");
                  }}
                >
                  Forgot password
                </button>
              </div>
              <input
                className="input-app rounded-xl px-3 py-3 w-full"
                placeholder="Confirm password (for create)"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
              <div className="text-xs text-muted">
                To use password sign-in, ensure Email provider is enabled in
                Supabase Authentication. If email confirmation is on, you’ll
                need to confirm via email after creating an account.
              </div>
            </div>
          )}
        </div>
        {/* Password recovery completion (when coming from email link) */}
        {(() => {
          const params = new URLSearchParams(
            window.location.hash.slice(1) || window.location.search
          );
          const type = params.get("type") || params.get("event");
          const isRecovery =
            type === "recovery" || localStorage.getItem("sb_pw_reset") === "1";
          if (isRecovery) {
            return (
              <div className="settings-subpanel mt-2 space-y-2">
                <div className="text-sm text-app">Reset your password</div>
                <input
                  className="input-app rounded-xl px-3 py-3 w-full"
                  placeholder="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  className="btn-primary px-3 py-3 rounded-xl"
                  onClick={async () => {
                    if (!newPassword) return alert("Enter a new password");
                    // Ensure Supabase has a valid session (from the email link hash) before updating
                    const s = await waitForSession({ timeoutMs: 2000 });
                    if (!s) {
                      alert(
                        "Recovery session not established yet. Please re-open the email link in this browser and try again."
                      );
                      return;
                    }
                    const { error } = await supabase.auth.updateUser({
                      password: newPassword,
                    });
                    if (error)
                      alert("Could not set password: " + error.message);
                    else {
                      alert("Password updated. You are now signed in.");
                      // Clean recovery params so refreshes are clean
                      const url = new URL(window.location.href);
                      // Some providers put tokens in hash; remove only after update
                      url.hash = "";
                      history.replaceState(null, "", url.toString());
                      try {
                        localStorage.removeItem("sb_pw_reset");
                      } catch {}
                    }
                  }}
                >
                  Set new password
                </button>
              </div>
            );
          }
          return null;
        })()}
        <div className="grid grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <div className="text-sm text-app">Units</div>
            <SegmentedControl
              ariaLabel="Weight unit"
              value={s.unit || "kg"}
              options={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
              className="settings-segmented-compact"
              onChange={(next) => setS({ ...s, unit: next as any })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-sm text-app">Theme mode</div>
            <div className="settings-static-row">
              <span>Dark</span>
              <span className="settings-static-pill">Locked</span>
            </div>
          </div>
          <label className="space-y-1">
            <div className="text-sm text-app">Deload load %</div>
            <input
              className="input-app rounded-xl px-3 py-2 settings-input-compact"
              inputMode="decimal"
              value={Math.round(s.deloadDefaults.loadPct * 100)}
              onChange={(e) =>
                setS({
                  ...s,
                  deloadDefaults: {
                    ...s.deloadDefaults,
                    loadPct: Number(e.target.value) / 100,
                  },
                })
              }
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Deload set %</div>
            <input
              className="input-app rounded-xl px-3 py-2 settings-input-compact"
              inputMode="decimal"
              value={Math.round(s.deloadDefaults.setPct * 100)}
              onChange={(e) =>
                setS({
                  ...s,
                  deloadDefaults: {
                    ...s.deloadDefaults,
                    setPct: Number(e.target.value) / 100,
                  },
                })
              }
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Start page</div>
            <select
              className="input-app rounded-xl px-3 py-2 settings-select-medium"
              value={s.dashboardPrefs?.startPage || "last"}
              onChange={(e) =>
                setS({
                  ...s,
                  dashboardPrefs: {
                    ...(s.dashboardPrefs || {}),
                    startPage: e.target.value as any,
                  },
                })
              }
            >
              <option value="last">Last Session</option>
              <option value="dashboard">Dashboard</option>
              <option value="sessions">Sessions</option>
              <option value="measurements">Measurements</option>
            </select>
          </label>
          <SettingsSwitchRow
            label="Open to last session"
            checked={s.dashboardPrefs?.openToLast ?? true}
            onChange={(checked) =>
              setS({
                ...s,
                dashboardPrefs: {
                  ...(s.dashboardPrefs || {}),
                  openToLast: checked,
                },
              })
            }
            className="settings-switch-row-compact"
          />
          <div className="space-y-1.5">
            <div className="text-sm text-app">Card style</div>
            <SegmentedControl
              ariaLabel="Card style"
              value={s.cardStyle || "glass"}
              options={[
                { value: "glass", label: "Glass" },
                { value: "solid", label: "Solid" },
                { value: "minimal", label: "Minimal" },
              ]}
              className="settings-segmented-tight"
              onChange={(next) => {
                const v = next as any;
                setS({ ...s, cardStyle: v });
                document.documentElement.setAttribute("data-card-style", v);
              }}
            />
          </div>
          <SettingsSwitchRow
            label="Auto-advance session"
            checked={!!s.autoAdvanceSession}
            onChange={(checked) => setS({ ...s, autoAdvanceSession: checked })}
            className="settings-switch-row-compact"
          />
          <label className="space-y-1">
            <div className="text-sm text-app">
              Default set rows per exercise
            </div>
            <input
              className="input-app rounded-xl px-3 py-2 settings-input-compact"
              inputMode="numeric"
              value={s.defaultSetRows ?? 3}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^\d*$/.test(v)) return;
                const nRaw = Number(v === "" ? "0" : v);
                const n = Math.max(0, Math.min(6, isNaN(nRaw) ? 0 : nRaw));
                setS({ ...s, defaultSetRows: n });
              }}
            />
          </label>
          <div className="space-y-1.5">
            <div className="text-sm text-app">Measurement units</div>
            <SegmentedControl
              ariaLabel="Measurement units"
              value={s.measurementUnits || "metric"}
              options={[
                { value: "metric", label: "cm / kg" },
                { value: "imperial", label: "in / lb" },
              ]}
              onChange={(next) =>
                setS({ ...s, measurementUnits: next as any })
              }
            />
          </div>
          <div className="space-y-1.5 min-[390px]:col-span-2 xl:col-span-1">
            <div className="text-sm text-app">Privacy unlock</div>
            <SegmentedControl
              ariaLabel="Privacy unlock mode"
              value={s.privacyUnlockMode || "everyLaunch"}
              options={[
                { value: "everyLaunch", label: "Every launch" },
                { value: "remember24h", label: "Remember 24h" },
              ]}
              onChange={(next) =>
                setS({ ...s, privacyUnlockMode: next as any })
              }
            />
          </div>
        </div>
        <p className="text-xs text-muted">
          Data import/export and reset actions are under the Data &amp; Safety tab.
        </p>
        </SectionCard>
      )}

      {/* Appearance */}
      {activeTab === "appearance" && (
        <SectionCard
          id="appearance"
          eyebrow="Customization"
          title="Appearance"
          description="Adjust theme presets, fine-tune visuals, and control motion preferences."
          badge={
            <span className="text-xs text-muted">
              {Object.keys(THEMES).length} themes
            </span>
          }
        >
        <div className="space-y-2">
          <button
            type="button"
            className="w-full flex items-center justify-between text-left px-3 py-2 bg-card/40 border border-card rounded-xl"
            onClick={() => setThemesCollapsed((v) => !v)}
            aria-expanded={!themesCollapsed}
            aria-controls="theme-presets-panel"
          >
            <span className="text-sm text-app flex items-center gap-2">
              <span
                className={`inline-block transform transition-transform duration-300 ${
                  themesCollapsed ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ▾
              </span>
              Theme presets
            </span>
            <span className="text-xs text-muted">
              {Object.keys(THEMES).length} themes
            </span>
          </button>
          <div
            id="theme-presets-panel"
            className={`transition-all duration-400 ease-out ${
              themesCollapsed
                ? "max-h-0 opacity-0 pointer-events-none"
                : "max-h-[1400px] opacity-100"
            }`}
            aria-hidden={themesCollapsed}
          >
            <div className="mt-3 space-y-4 px-1 pb-1">
              {THEME_CATEGORIES.map((category) => {
                const themesInCategory = (Object.keys(THEMES) as ThemeKey[]).filter(
                  (k) => THEME_META[k]?.category === category
                );
                if (themesInCategory.length === 0) return null;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                        {category}
                      </span>
                      <span className="flex-1 h-px bg-card-border/30" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {themesInCategory.map((k) => {
                        const customPreview =
                          k === "custom" && s.themeV2?.customVars
                            ? ({ ...THEMES[k], ...s.themeV2.customVars } as Record<string, string>)
                            : THEMES[k];
                        const meta = THEME_META[k];
                        return (
                          <button
                            key={k}
                            className={`rounded-xl p-3 text-left border transition-all duration-200 ${
                              themeKey === k
                                ? "border-accent bg-accent/10 ring-1 ring-accent/50"
                                : "border-card card-surface hover:border-accent/40 hover:scale-[1.02]"
                            }`}
                            onClick={() => {
                              setS((prev) => ({
                                ...prev,
                                themeV2: {
                                  ...((prev as any).themeV2 || {}),
                                  key: k,
                                },
                              } as any));
                              setThemeKey(k);
                            }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium text-sm capitalize truncate">
                                {k.replace(/-/g, " ")}
                              </span>
                              {themeKey === k && (
                                <span className="settings-static-pill text-[10px]">Active</span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted truncate mb-2">
                              {meta?.description || ""}
                            </div>
                            <div className="flex gap-1 items-center">
                              <span
                                className="flex-1 h-5 rounded-l"
                                style={{ background: customPreview["--bg-muted"] }}
                              />
                              <span
                                className="w-5 h-5 rounded border"
                                style={{
                                  background: customPreview["--card"],
                                  borderColor: customPreview["--card-border"],
                                }}
                              />
                              <span
                                className="w-5 h-5 rounded"
                                style={{ background: customPreview["--accent"] }}
                              />
                              <span
                                className="w-5 h-5 rounded-r"
                                style={{ background: customPreview["--chart-2"] }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-xs text-muted mt-1">
            Theme changes autosave locally. Use <strong>Save Theme</strong> to
            sync to your profile.
          </div>
          {/* Custom Theme editor — visible only when the 'custom' theme is selected */}
          {themeKey === "custom" && (
            <div className="mt-4 card-surface rounded-2xl p-4 md:p-5 border border-card shadow-soft space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">Custom theme</div>
                <span className="text-xs text-muted">Editing variables</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(
                  [
                    ["--bg", "Background"],
                    ["--bg-muted", "Background (muted)"],
                    ["--text", "Text"],
                    ["--text-muted", "Text (muted)"],
                    ["--accent", "Accent color"],
                    ["--chart-1", "Chart color A"],
                    ["--chart-2", "Chart color B"],
                  ] as Array<[string, string]>
                ).map(([key, label]) => {
                  const current =
                    (s.themeV2?.customVars && s.themeV2.customVars[key]) ||
                    THEMES["custom"][key];
                  const hex = /^hsl\(/i.test(current || "")
                    ? hslToHex(current!)
                    : (current as string);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <div className="text-xs truncate" title={key}>
                        {label}
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-card bg-card/60"
                        onClick={() => setOpenPicker(key)}
                        aria-haspopup="dialog"
                        aria-expanded={openPicker === key}
                        title={String(current)}
                      >
                        <span
                          className="inline-block h-6 w-6 rounded border border-card"
                          style={{ background: current }}
                        />
                        <span className="text-xs">Edit</span>
                      </button>
                      {openPicker === key && pickerLoaded && (
                        <div
                          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center"
                          role="dialog"
                          aria-modal="true"
                        >
                          <div className="w-full max-w-[min(90vw,380px)] max-h-[min(90dvh,calc(100dvh-2rem))] overflow-auto rounded-2xl border border-card bg-card shadow-soft p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">{label}</div>
                              <button
                                className="btn-outline px-2 py-1 rounded-md text-xs"
                                onClick={closePicker}
                              >
                                Close
                              </button>
                            </div>
                            {ColorPicker.Comp && (
                              <ColorPicker.Comp
                                color={hex}
                                onChange={(v: string) => {
                                  const hs = hexToHsl(v);
                                  const cssVal = `hsl(${hs.h} ${hs.s}% ${hs.l}%)`;
                                  const next: Settings = {
                                    ...s,
                                    themeV2: {
                                      key: (s.themeV2?.key || "custom") as any,
                                      ...(s.themeV2 || {}),
                                      customVars: {
                                        ...(s.themeV2?.customVars || {}),
                                        [key]: cssVal,
                                      },
                                    },
                                  } as any;
                                  setS(next);
                                  if (themeKey === "custom")
                                    setThemeKey("custom");
                                }}
                              />
                            )}
                            <div className="flex justify-end mt-3">
                              <button
                                className="btn-primary px-3 py-1.5 rounded-md text-xs"
                                onClick={closePicker}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Card surface (with transparency) */}
                {(
                  [
                    ["--card", "Card surface"],
                    ["--card-border", "Card border"],
                  ] as Array<[string, string]>
                ).map(([key, label]) => {
                  const current =
                    (s.themeV2?.customVars && s.themeV2.customVars[key]) ||
                    THEMES["custom"][key];
                  const hsla = parseHslA(current || "") || {
                    h: 210,
                    s: 20,
                    l: 90,
                    a: 0.08,
                  };
                  const hex = `#${((n: number) =>
                    n.toString(16).padStart(2, "0"))(
                    Math.round(
                      (hsla.l / 100 +
                        (hsla.s / 100) *
                          Math.min(hsla.l / 100, 1 - hsla.l / 100)) *
                        255
                    )
                  )}`; // placeholder, picker will set from h/s/l via hexToHsl
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <div className="text-xs truncate" title={key}>
                        {label}
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-card bg-card/60"
                        onClick={() => setOpenPicker(key)}
                        aria-haspopup="dialog"
                        aria-expanded={openPicker === key}
                        title={String(current)}
                      >
                        <span
                          className="inline-block h-6 w-6 rounded border border-card"
                          style={{ background: current }}
                        />
                        <span className="text-xs">Edit</span>
                      </button>
                      {openPicker === key && pickerLoaded && (
                        <div
                          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center"
                          role="dialog"
                          aria-modal="true"
                        >
                          <div className="w-full max-w-[min(92vw,420px)] max-h-[min(90dvh,calc(100dvh-2rem))] overflow-auto rounded-2xl border border-card bg-card shadow-soft p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">{label}</div>
                              <button
                                className="btn-outline px-2 py-1 rounded-md text-xs"
                                onClick={closePicker}
                              >
                                Close
                              </button>
                            </div>
                            {ColorPicker.Comp && (
                              <ColorPicker.Comp
                                color={hslToHex(
                                  formatHslA(hsla.h, hsla.s, hsla.l, undefined)
                                )}
                                onChange={(v: string) => {
                                  const hs = hexToHsl(v);
                                  const nextVal = formatHslA(
                                    hs.h,
                                    hs.s,
                                    hs.l,
                                    hsla.a == null ? 0.08 : hsla.a
                                  );
                                  const next: Settings = {
                                    ...s,
                                    themeV2: {
                                      key: (s.themeV2?.key || "custom") as any,
                                      ...(s.themeV2 || {}),
                                      customVars: {
                                        ...(s.themeV2?.customVars || {}),
                                        [key]: nextVal,
                                      },
                                    },
                                  } as any;
                                  setS(next);
                                  if (themeKey === "custom")
                                    setThemeKey("custom");
                                }}
                              />
                            )}
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Alpha</span>
                                <span>
                                  {Math.round((hsla.a ?? 0.08) * 100)}
                                </span>
                              </div>
                              <input
                                className="settings-range"
                                type="range"
                                min={0}
                                max={100}
                                defaultValue={Math.round(
                                  (hsla.a ?? 0.08) * 100
                                )}
                                onChange={(e) => {
                                  const a = Number(e.target.value) / 100;
                                  const nextVal = formatHslA(
                                    hsla.h,
                                    hsla.s,
                                    hsla.l,
                                    a
                                  );
                                  const next: Settings = {
                                    ...s,
                                    themeV2: {
                                      key: (s.themeV2?.key || "custom") as any,
                                      ...(s.themeV2 || {}),
                                      customVars: {
                                        ...(s.themeV2?.customVars || {}),
                                        [key]: nextVal,
                                      },
                                    },
                                  } as any;
                                  setS(next);
                                  if (themeKey === "custom")
                                    setThemeKey("custom");
                                }}
                              />
                            </div>
                            <div className="flex justify-end mt-3">
                              <button
                                className="btn-primary px-3 py-1.5 rounded-md text-xs"
                                onClick={closePicker}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Glow color editor */}
                {(() => {
                  const key = "--glow";
                  const cur =
                    (s.themeV2?.customVars && s.themeV2.customVars[key]) ||
                    THEMES["custom"][key] ||
                    "0 0 32px hsla(210 90% 60% / 0.45)";
                  const match = cur.match(/(.*?)(hsla?\(.*?\))(.*)/i);
                  const colorPart = match?.[2] || "hsla(210 90% 60% / 0.45)";
                  const col = parseHslA(colorPart) || {
                    h: 210,
                    s: 90,
                    l: 60,
                    a: 0.45,
                  };
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <div className="text-xs truncate" title={key}>
                        Glow color
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-card bg-card/60"
                        onClick={() => setOpenPicker(key)}
                        aria-haspopup="dialog"
                        aria-expanded={openPicker === key}
                        title={String(colorPart)}
                      >
                        <span
                          className="inline-block h-6 w-6 rounded border border-card"
                          style={{
                            background: formatHslA(col.h, col.s, col.l, 1),
                          }}
                        />
                        <span className="text-xs">Edit</span>
                      </button>
                      {openPicker === key && pickerLoaded && (
                        <div
                          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center"
                          role="dialog"
                          aria-modal="true"
                        >
                          <div className="w-full max-w-[min(90vw,380px)] max-h-[min(90dvh,calc(100dvh-2rem))] overflow-auto rounded-2xl border border-card bg-card shadow-soft p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">
                                Glow color
                              </div>
                              <button
                                className="btn-outline px-2 py-1 rounded-md text-xs"
                                onClick={closePicker}
                              >
                                Close
                              </button>
                            </div>
                            {ColorPicker.Comp && (
                              <ColorPicker.Comp
                                color={hslToHex(
                                  formatHslA(col.h, col.s, col.l)
                                )}
                                onChange={(v: string) => {
                                  const hs = hexToHsl(v);
                                  const nextColor = formatHslA(
                                    hs.h,
                                    hs.s,
                                    hs.l,
                                    col.a == null ? 0.45 : col.a
                                  );
                                  const nextString = cur.replace(
                                    /(hsla?\(.*?\))/,
                                    nextColor
                                  );
                                  const next: Settings = {
                                    ...s,
                                    themeV2: {
                                      key: (s.themeV2?.key || "custom") as any,
                                      ...(s.themeV2 || {}),
                                      customVars: {
                                        ...(s.themeV2?.customVars || {}),
                                        [key]: nextString,
                                      },
                                    },
                                  } as any;
                                  setS(next);
                                  if (themeKey === "custom")
                                    setThemeKey("custom");
                                }}
                              />
                            )}
                            <div className="flex justify-between items-center gap-2 mt-3">
                              <button
                                className="btn-outline px-2 py-1 rounded-md text-xs"
                                onClick={() => {
                                  const acc =
                                    s.themeV2?.customVars?.["--accent"] ||
                                    THEMES["custom"]["--accent"];
                                  const hs = parseHslA(acc || "");
                                  if (!hs) return;
                                  const nextColor = formatHslA(
                                    hs.h,
                                    hs.s,
                                    hs.l,
                                    col.a == null ? 0.45 : col.a
                                  );
                                  const nextString = cur.replace(
                                    /(hsla?\(.*?\))/,
                                    nextColor
                                  );
                                  const next: Settings = {
                                    ...s,
                                    themeV2: {
                                      key: (s.themeV2?.key || "custom") as any,
                                      ...(s.themeV2 || {}),
                                      customVars: {
                                        ...(s.themeV2?.customVars || {}),
                                        [key]: nextString,
                                      },
                                    },
                                  } as any;
                                  setS(next);
                                  if (themeKey === "custom")
                                    setThemeKey("custom");
                                }}
                              >
                                Match accent
                              </button>
                              <button
                                className="btn-primary px-3 py-1.5 rounded-md text-xs"
                                onClick={closePicker}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary px-3 py-2 rounded-xl"
                  onClick={() => {
                    setS((prev) => ({
                      ...prev,
                      themeV2: {
                        ...((prev as any).themeV2 || {}),
                        key: "custom",
                        customVars: s.themeV2?.customVars || {},
                      },
                    } as any));
                    setThemeKey("custom");
                    setToast("Applied custom theme");
                  }}
                >
                  Apply custom theme
                </button>
                <div className="text-xs text-muted">
                  Tip: pick your accent first, then tune background and card for
                  contrast. Save Theme to sync to profile.
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap mt-2">
            <button
              className="btn-primary px-3 py-2 rounded-xl"
              onClick={async () => {
                const ok = await saveProfileTheme(s.themeV2);
                setThemeSaved(ok);
                setToast(
                  ok ? "Theme saved to profile" : "Failed to save theme"
                );
              }}
            >
              Save Theme
            </button>
            {/* Theme fine tuning */}
            <label className="settings-inline-field settings-inline-field-stack min-w-[220px]">
              <span className="settings-inline-label">Accent intensity</span>
              <div className="flex items-center gap-2 w-full">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  className="settings-range"
                  value={s.themeV2?.accentIntensity ?? 50}
                  onChange={(e) => {
                    const accentIntensity = Number(e.target.value);
                    const next: Settings = {
                      ...s,
                      themeV2: {
                        key: s.themeV2?.key || themeKey,
                        ...(s.themeV2 || {}),
                        accentIntensity,
                      },
                    } as any;
                    setS(next);
                    // re-apply theme with new intensity
                    setThemeKey((next.themeV2?.key || themeKey) as any);
                  }}
                />
                <span className="text-xs tabular-nums w-8 text-right text-white/85">
                  {s.themeV2?.accentIntensity ?? 50}
                </span>
              </div>
            </label>
            <label className="settings-inline-field settings-inline-field-stack min-w-[220px]">
              <span className="settings-inline-label">Glow strength</span>
              <div className="flex items-center gap-2 w-full">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  className="settings-range"
                  value={s.themeV2?.glowStrength ?? 50}
                  onChange={(e) => {
                    const glowStrength = Number(e.target.value);
                    const next: Settings = {
                      ...s,
                      themeV2: {
                        key: s.themeV2?.key || themeKey,
                        ...(s.themeV2 || {}),
                        glowStrength,
                      },
                    } as any;
                    setS(next);
                    setThemeKey((next.themeV2?.key || themeKey) as any);
                  }}
                />
                <span className="text-xs tabular-nums w-8 text-right text-white/85">
                  {s.themeV2?.glowStrength ?? 50}
                </span>
              </div>
            </label>
            {themeSaved === true && (
              <span className="text-xs text-emerald-400">Saved ✓</span>
            )}
            {themeSaved === false && (
              <span className="text-xs text-red-400">Not saved</span>
            )}
            <div className="settings-switch-grid w-full">
              <SettingsSwitchRow
                label="Reduce motion"
                checked={!!s.reducedMotion}
                onChange={(checked) => {
                  setS({ ...s, reducedMotion: checked });
                  if (checked)
                    document.documentElement.setAttribute(
                      "data-reduced-motion",
                      "true"
                    );
                  else
                    document.documentElement.removeAttribute(
                      "data-reduced-motion"
                    );
                }}
              />
              <div className="settings-static-row">
                <span>Theme mode</span>
                <span className="settings-static-pill">Dark locked</span>
              </div>
              <SettingsSwitchRow
                label="Compact UI"
                checked={!!s.ui?.compactMode}
                onChange={(checked) => {
                  const next = {
                    ...s,
                    ui: { ...(s.ui || {}), compactMode: checked },
                  };
                  setS(next);
                  document.documentElement.setAttribute(
                    "data-density",
                    checked ? "compact" : "normal"
                  );
                }}
              />
              <SettingsSwitchRow
                label="Instant theme"
                checked={!!s.ui?.instantThemeTransition}
                onChange={(checked) => {
                  const next = {
                    ...s,
                    ui: { ...(s.ui || {}), instantThemeTransition: checked },
                  };
                  setS(next);
                  if (checked)
                    document.documentElement.classList.remove("theme-animate");
                  else
                    document.documentElement.classList.add("theme-animate");
                }}
              />
              <SettingsSwitchRow
                label="Smoothing default"
                checked={!!s.ui?.smoothingDefault}
                onChange={(checked) => {
                  const next = {
                    ...s,
                    ui: { ...(s.ui || {}), smoothingDefault: checked },
                  };
                  setS(next);
                }}
              />
              <SettingsSwitchRow
                label="ECG background"
                checked={!!s.ecg?.enabled}
                onChange={(checked) => {
                  const next = { ...s, ecg: { ...(s.ecg || {}), enabled: checked } };
                  setS(next);
                  document.body.dataset.ecg = checked ? "on" : "off";
                }}
              />
              {s.ecg?.enabled && (
                <details className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-white/85">
                    Advanced ECG controls
                  </summary>
                  <div className="mt-3 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                    <div className="settings-inline-field">
                      <span>Intensity</span>
                      <select
                        className="input-app rounded-xl px-2 py-1 settings-select-compact"
                        value={s.ecg?.intensity || "low"}
                        onChange={(e) => {
                          const intensity = e.target.value as any;
                          const next = {
                            ...s,
                            ecg: { ...(s.ecg || {}), intensity, enabled: true },
                          };
                          setS(next);
                          const root = document.documentElement;
                          const map: Record<
                            string,
                            {
                              opacity: string;
                              speed: string;
                              strokeWidth: string;
                              dash: string;
                            }
                          > = {
                            low: {
                              opacity: "0.15",
                              speed: "46s",
                              strokeWidth: "1.6",
                              dash: "5 7",
                            },
                            med: {
                              opacity: "0.25",
                              speed: "34s",
                              strokeWidth: "2",
                              dash: "5 5",
                            },
                            high: {
                              opacity: "0.35",
                              speed: "26s",
                              strokeWidth: "2.4",
                              dash: "4 4",
                            },
                          };
                          const cfg = map[intensity];
                          root.style.setProperty("--ecg-opacity", cfg.opacity);
                          root.style.setProperty("--ecg-speed", cfg.speed);
                          root.style.setProperty(
                            "--ecg-stroke-w",
                            cfg.strokeWidth
                          );
                          root.style.setProperty("--ecg-dash", cfg.dash);
                        }}
                      >
                        <option value="low">Low</option>
                        <option value="med">Med</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="settings-inline-field">
                      <span>Shape</span>
                      <select
                        className="input-app rounded-xl px-2 py-1 settings-select-compact"
                        value={s.ecg?.shape || "classic"}
                        onChange={(e) => {
                          const shape = e.target.value as any;
                          const next = {
                            ...s,
                            ecg: { ...(s.ecg || {}), shape, enabled: true },
                          };
                          setS(next);
                        }}
                      >
                        <option value="classic">Classic</option>
                        <option value="smooth">Smooth</option>
                        <option value="spikes">Spikes</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </div>
                    <div className="settings-inline-field settings-inline-field-stack">
                      <span>Speed</span>
                      <input
                        type="range"
                        min={4000}
                        max={180000}
                        step={1000}
                        className="settings-range"
                        value={s.ecg?.speedMs || 42000}
                        onChange={(e) => {
                          const speedMs = Number(e.target.value);
                          const next = {
                            ...s,
                            ecg: { ...(s.ecg || {}), speedMs, enabled: true },
                          };
                          setS(next);
                          document.documentElement.style.setProperty(
                            "--ecg-custom-speed-ms",
                            String(speedMs)
                          );
                        }}
                      />
                    </div>
                    <div className="settings-inline-field settings-inline-field-stack">
                      <span>Trail</span>
                      <input
                        title={String(s.ecg?.trailMs || 2000) + " ms"}
                        type="range"
                        min={400}
                        max={8000}
                        step={100}
                        className="settings-range"
                        value={s.ecg?.trailMs || 2000}
                        onChange={(e) => {
                          const trailMs = Number(e.target.value);
                          const next = {
                            ...s,
                            ecg: { ...(s.ecg || {}), trailMs, enabled: true },
                          };
                          setS(next);
                          document.documentElement.style.setProperty(
                            "--ecg-trail-ms",
                            String(trailMs)
                          );
                        }}
                      />
                    </div>
                    <div className="settings-inline-field settings-inline-field-stack">
                      <span>Spikes</span>
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          step={1}
                          className="settings-range"
                          value={s.ecg?.spikes || 1}
                          onChange={(e) => {
                            const spikes = Number(e.target.value);
                            const next = {
                              ...s,
                              ecg: { ...(s.ecg || {}), spikes, enabled: true },
                            };
                            setS(next);
                          }}
                        />
                        <span className="text-xs tabular-nums text-white/80 w-4 text-right">
                          {s.ecg?.spikes || 1}
                        </span>
                      </div>
                    </div>
                    <div className="settings-inline-field">
                      <span>Color</span>
                      <input
                        type="color"
                        value={s.ecg?.color || "#22c55e"}
                        onChange={(e) => {
                          const color = e.target.value;
                          const next = {
                            ...s,
                            ecg: { ...(s.ecg || {}), color, enabled: true },
                          };
                          setS(next);
                          document.documentElement.style.setProperty(
                            "--ecg-custom-color",
                            color
                          );
                        }}
                      />
                    </div>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
        </SectionCard>
      )}

      {/* Safety */}
      {activeTab === "safety" && (
        <SectionCard
          id="safety"
          eyebrow="Guard rails"
          title="Data and safety"
          description="Control destructive actions and manage import/export/reset workflows."
        >
          <div className="settings-subpanel space-y-3">
            <SettingsSwitchRow
              label="Confirm before deleting items"
              checked={!!s.confirmDestructive}
              onChange={(checked) =>
                setS({ ...s, confirmDestructive: checked })
              }
            />
            <p className="text-xs text-white/70 leading-snug">
              Export creates a full backup. Import merges data from a previous export.
            </p>
          </div>
          <div className="settings-subpanel">
            <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-2">
              <button
                className="btn-outline px-3 py-2 rounded-xl"
                onClick={exportData}
              >
                Export JSON & CSV
              </button>
              <input
                type="file"
                hidden
                ref={fileRef}
                accept="application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importData(f);
                }}
              />
              <button
                className="btn-outline px-3 py-2 rounded-xl"
                onClick={() => fileRef.current?.click()}
              >
                Import JSON
              </button>
              <a
                className="btn-outline px-3 py-2 rounded-xl inline-flex items-center justify-center"
                href="https://ciaranengelbrecht.com/delete-account-liftlog.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Deletion info
              </a>
            </div>
          </div>

          <div className="settings-danger-zone space-y-3">
            <p className="text-xs font-medium text-red-200/90">
              Danger zone: these actions are permanent and cannot be undone.
            </p>
            <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-2">
              <button
                className="settings-danger-btn"
                onClick={resetData}
              >
                Reset data
              </button>
              {userEmail && (
                <button
                  className="settings-danger-btn"
                  disabled={busy === "delete"}
                  onClick={deleteAccountAndData}
                >
                  {busy === "delete" ? "Deleting…" : "Delete account & data"}
                </button>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Progress */}
      {activeTab === "progress" && (
        <SectionCard
          id="progress"
          eyebrow="Motivation"
          title="Progress"
          description="Tune weekly targets and gameplay effects that keep training fresh."
        >
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3">
            <label className="settings-inline-field">
              <span className="text-sm text-app">Weekly target days</span>
              <input
                className="input-app rounded-xl px-2 py-1 w-16 text-center"
                inputMode="numeric"
                value={s.progress?.weeklyTargetDays ?? 6}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!/^\d*$/.test(v)) return;
                  const n = Math.max(3, Math.min(6, Number(v || "6")));
                  setS({
                    ...s,
                    progress: { ...(s.progress || {}), weeklyTargetDays: n },
                  });
                }}
              />
            </label>
            <SettingsSwitchRow
              label="Gamification effects"
              checked={s.progress?.gamification ?? true}
              onChange={(checked) =>
                setS({
                  ...s,
                  progress: {
                    ...(s.progress || {}),
                    gamification: checked,
                  },
                })
              }
            />
            <SettingsSwitchRow
              label="Show deload hints"
              checked={s.progress?.showDeloadHints ?? true}
              onChange={(checked) =>
                setS({
                  ...s,
                  progress: {
                    ...(s.progress || {}),
                    showDeloadHints: checked,
                  },
                })
              }
            />
            <SettingsSwitchRow
              label="Show previous week hints"
              checked={s.progress?.showPrevHints ?? true}
              onChange={(checked) =>
                setS({
                  ...s,
                  progress: {
                    ...(s.progress || {}),
                    showPrevHints: checked,
                  },
                })
              }
            />
          </div>
          <p className="text-xs text-muted">Changes in this section autosave.</p>
        </SectionCard>
      )}

      {activeTab === "library" && (
        <>
          <SectionCard
            id="exerciseOverrides"
            eyebrow="Deload"
            title="Exercise overrides"
            description="Set per-exercise deload load and set percentages to override the global defaults."
            badge={
              <span className="text-xs text-muted">
                {exerciseOverrideCount == null
                  ? "Loading"
                  : `${exerciseOverrideCount} exercise${
                      exerciseOverrideCount === 1 ? "" : "s"
                    }`}
              </span>
            }
          >
            <ExerciseOverrides onCountChange={setExerciseOverrideCount} />
          </SectionCard>

          <SectionCard
            id="exerciseLibrary"
            eyebrow="Library"
            title="Exercise library"
            description="Search, edit, and tag exercises with primary and secondary muscles."
            badge={
              <span className="text-xs text-muted">
                {exerciseLibraryCount == null
                  ? "Loading"
                  : `${exerciseLibraryCount} exercise${
                      exerciseLibraryCount === 1 ? "" : "s"
                    }`}
              </span>
            }
          >
            <div className="settings-subpanel flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
              <div className="text-xs text-white/70">
                Program split and workout structure live in Program settings.
              </div>
              <button
                type="button"
                className="btn-outline px-3 py-1.5 rounded-lg text-xs"
                onClick={() => navigate("/settings/program")}
              >
                Open Program settings
              </button>
            </div>
            <ExerciseLibraryManager onCountChange={setExerciseLibraryCount} />
          </SectionCard>
        </>
      )}

      {activeTab === "progress" && (
        <SectionCard
          id="volumeTargets"
          eyebrow="Targets"
          title="Weekly volume targets"
          description="Define set targets per muscle group to guide programming and dashboards."
          badge={
            <span className="text-xs text-muted">
              {VOLUME_TARGET_MUSCLES.length} muscle groups
            </span>
          }
        >
          <WeeklyVolumeTargets
            targets={s.volumeTargets || {}}
            onChange={(volumeTargets) => setS((prev) => ({ ...prev, volumeTargets }))}
          />
        </SectionCard>
      )}
    </div>
  );
}

type SegmentedOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  value: string;
  options: SegmentedOption[];
  onChange: (next: string) => void;
  ariaLabel: string;
  className?: string;
};

function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={["settings-segmented", className].filter(Boolean).join(" ")}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className="settings-segmented-option"
            data-active={active ? "true" : "false"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type SettingsSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
};

function SettingsSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled,
}: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className="settings-switch"
      data-checked={checked ? "true" : "false"}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-thumb" />
    </button>
  );
}

type SettingsSwitchRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
};

function SettingsSwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: SettingsSwitchRowProps) {
  return (
    <div
      className={["settings-switch-row", className].filter(Boolean).join(" ")}
    >
      <div className="min-w-0">
        <div className="settings-switch-label">{label}</div>
        {description ? (
          <div className="settings-switch-description">{description}</div>
        ) : null}
      </div>
      <SettingsSwitch
        checked={checked}
        onChange={onChange}
        ariaLabel={label}
        disabled={disabled}
      />
    </div>
  );
}

function BeepTester({
  styleKey,
  count,
  volumePct,
}: {
  styleKey: "gentle" | "chime" | "digital" | "alarm" | "click";
  count: number;
  volumePct: number;
}) {
  return (
    <button
      className="btn-outline px-3 py-2 rounded-xl text-xs"
      title="Play a preview beep"
      onClick={async () => {
        try {
          await unlockAudio();
          const volPct = Math.max(30, Math.min(300, volumePct));
          setBeepVolumeScalar(volPct / 100);
          (await import("../lib/audio")).playBeepStyle(styleKey, count);
        } catch {}
      }}
    >
      Test beep
    </button>
  );
}

// lightweight inline snackbar for Settings page
function Toast({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50">
      <div className="card-surface border border-card rounded-xl px-4 py-2 shadow-soft text-sm">
        {message}
        <button className="ml-3 text-xs underline" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

type ExerciseOverridesProps = {
  onCountChange?: (count: number) => void;
};

function ExerciseOverrides({ onCountChange }: ExerciseOverridesProps) {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const exercises = await db.getAll("exercises");
      setList(exercises);
      onCountChange?.(exercises.length);
    })();
  }, [onCountChange]);

  const save = async (
    i: number,
    k: "deloadLoadPct" | "deloadSetPct",
    v: number
  ) => {
    const ex = list[i];
    const updated = { ...ex, defaults: { ...ex.defaults, [k]: v } };
    await db.put("exercises", updated);
    const next = list.map((e, idx) => (idx === i ? updated : e));
    setList(next);
    onCountChange?.(next.length);
  };

  if (!list.length) {
    return (
      <div className="text-sm text-muted">
        No exercises yet. Add some in the library below to customise deloads.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        Set specific deload % for load and sets. Leave blank to use global
        defaults.
      </div>
      <div className="grid gap-2">
        {list.map((ex, i) => (
          <div
            key={ex.id}
            className="grid grid-cols-1 min-[430px]:grid-cols-[1.2fr_1fr_1fr] gap-2 items-center bg-slate-900/40 rounded-2xl px-3 py-2.5 border border-white/5"
          >
            <div className="truncate text-xs sm:text-sm">{ex.name}</div>
            <input
              aria-label="Load %"
              className="input-app rounded-xl px-3 py-2"
              placeholder="Load %"
              value={Math.round((ex.defaults.deloadLoadPct ?? NaN) * 100) || ""}
              onChange={(e) =>
                save(i, "deloadLoadPct", Number(e.target.value) / 100)
              }
            />
            <input
              aria-label="Set %"
              className="input-app rounded-xl px-3 py-2"
              placeholder="Set %"
              value={Math.round((ex.defaults.deloadSetPct ?? NaN) * 100) || ""}
              onChange={(e) =>
                save(i, "deloadSetPct", Number(e.target.value) / 100)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type ExerciseLibraryManagerProps = {
  onCountChange?: (count: number) => void;
};

// New: Exercise library manager (primary + secondary muscles editing)
function ExerciseLibraryManager({
  onCountChange,
}: ExerciseLibraryManagerProps) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>(""); // empty => all
  useEffect(() => {
    (async () => {
      const exercises = await db.getAll("exercises");
      setList(exercises);
      onCountChange?.(exercises.length);
    })();
  }, [onCountChange]);
  const ALL = EXERCISE_LIBRARY_MUSCLES;
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return list
      .filter((ex) => ex.name.toLowerCase().includes(query))
      .filter((ex) => !muscleFilter || ex.muscleGroup === muscleFilter);
  }, [list, muscleFilter, q]);
  const update = async (id: string, mut: (ex: any) => any) => {
    const current = list.find((e) => e.id === id);
    if (!current) return;
    const next = mut({ ...current });
    await db.put("exercises", next);
    setList((ls) => {
      const derived = ls.map((ex) => (ex.id === id ? next : ex));
      onCountChange?.(derived.length);
      return derived;
    });
  };
  const addSecondary = (ex: any, m: string) =>
    update(ex.id, (e) => ({
      ...e,
      secondaryMuscles: [...(e.secondaryMuscles || []), m],
    }));
  const removeSecondary = (ex: any, m: string) =>
    update(ex.id, (e) => ({
      ...e,
      secondaryMuscles: (e.secondaryMuscles || []).filter(
        (x: string) => x !== m
      ),
    }));
  const createExercise = async () => {
    const name = creating.trim();
    if (!name) return;
    if (list.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      alert("Exists");
      return;
    }
    const ex = {
      id: crypto.randomUUID?.() || Date.now() + "",
      name,
      muscleGroup: "other",
      defaults: { sets: 3, targetRepRange: "8-12" },
      active: true,
      secondaryMuscles: [],
    };
    await db.put("exercises", ex);
    setList((prev) => {
      const next = [ex, ...prev];
      onCountChange?.(next.length);
      return next;
    });
    setCreating("");
  };
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        Edit primary and secondary muscles. Secondary muscles contribute
        indirect volume (0.5x) in allocator.
      </div>
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-2 items-center">
        <input
          className="input-app rounded-xl px-3 py-2 w-full"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <input
            className="input-app rounded-xl px-3 py-2 flex-1"
            placeholder="New exercise"
            value={creating}
            onChange={(e) => setCreating(e.target.value)}
          />
          <button
            className="btn-primary px-3 py-2 rounded-xl"
            onClick={createExercise}
          >
            Add
          </button>
        </div>
      </div>
      {/* Muscle filter chips */}
      <div className="flex flex-wrap gap-1 pt-1 pb-1">
        <button
          onClick={() => setMuscleFilter("")}
          className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition whitespace-nowrap ${
            muscleFilter === ""
              ? "bg-emerald-600/70 border-emerald-400 text-white shadow-inner"
              : "bg-slate-700/60 border-white/10 text-slate-200 hover:bg-slate-600/60"
          }`}
        >
          All
        </button>
        {ALL.map((m) => (
          <button
            key={m}
            onClick={() => setMuscleFilter((prev) => (prev === m ? "" : m))}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl border transition whitespace-nowrap capitalize ${
              muscleFilter === m
                ? "bg-emerald-600/70 border-emerald-400 text-white shadow-inner"
                : "bg-slate-700/60 border-white/10 text-slate-200 hover:bg-slate-600/60"
            }`}
            title={`Filter by ${m}`}
          >
            {/* icon */}
            {(() => {
              try {
                const p = getMuscleIconPath(m);
                return p ? (
                  <img
                    src={p}
                    alt={m}
                    className="w-4 h-4 object-contain opacity-80"
                  />
                ) : null;
              } catch {
                return null;
              }
            })()}
            <span>{m}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1 pb-1">
        {list.length === 0 ? (
          <div className="text-sm text-muted">
            No exercises yet. Add some above to start customising deloads.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted">
            No exercises match the current filters.
          </div>
        ) : (
          filtered.map((ex) => {
            const remaining = ALL.filter(
              (m) =>
                m !== ex.muscleGroup && !(ex.secondaryMuscles || []).includes(m)
            );
            return (
              <div
                key={ex.id}
                className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2"
              >
                <div className="flex justify-between gap-2 flex-wrap">
                  <input
                    className="input-app rounded-xl px-2 py-1.5 text-sm flex-1 min-w-[160px]"
                    value={ex.name}
                    onChange={(e) =>
                      update(ex.id, (x) => ({ ...x, name: e.target.value }))
                    }
                  />
                  <select
                    className="input-app rounded-xl px-2 py-1.5 text-sm"
                    value={ex.muscleGroup}
                    onChange={(e) =>
                      update(ex.id, (x) => ({
                        ...x,
                        muscleGroup: e.target.value,
                      }))
                    }
                  >
                    {ALL.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1 items-center text-[10px]">
                  {(ex.secondaryMuscles || []).map((m: string) => (
                    <span
                      key={m}
                      className="bg-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1"
                    >
                      {m}
                      <button
                        onClick={() => removeSecondary(ex, m)}
                        className="opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {remaining.length > 0 && (
                    <details className="bg-slate-700/40 rounded px-1 py-0.5">
                      <summary className="cursor-pointer select-none">
                        + add
                      </summary>
                      <div className="mt-1 flex flex-wrap gap-1 max-w-[240px]">
                        {remaining.map((m) => (
                          <button
                            key={m}
                            className="bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded"
                            onClick={() => addSecondary(ex, m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

type WeeklyVolumeTargetsProps = {
  targets: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
};

function WeeklyVolumeTargets({
  targets,
  onChange,
}: WeeklyVolumeTargetsProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        Set desired weighted set targets per muscle. Used for allocator and
        dashboard progress bars. Changes autosave.
      </div>
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {VOLUME_TARGET_MUSCLES.map((m) => (
          <label key={m} className="space-y-1">
            <span className="text-xs capitalize text-app">{m}</span>
            <input
              type="number"
              min={0}
              max={40}
              value={targets[m] ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  const next = { ...targets };
                  delete next[m];
                  onChange(next);
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                onChange({ ...targets, [m]: Math.max(0, Math.min(40, n)) });
              }}
              className="input-app rounded-xl px-2 py-2 w-full text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
