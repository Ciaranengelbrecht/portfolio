import { useEffect, useRef, useState } from "react";
import { useTheme, THEME_PRESETS } from "../lib/theme";
import { useAppTheme } from "../theme/ThemeProvider";
import { THEMES, ThemeKey } from "../theme/themes";
import { useNavigate } from "react-router-dom";
import BigFlash from "../components/BigFlash";
import { db } from "../lib/db";
import { Settings } from "../lib/types";
import {
  defaultSettings,
  defaultExercises,
  defaultTemplates,
} from "../lib/defaults";
import { saveProfileTheme } from "../lib/profile";
import { supabase, clearAuthStorage, waitForSession } from "../lib/supabase";

export default function SettingsPage() {
  const { applyPreset } = useTheme();
  const { themeKey, setThemeKey } = useAppTheme();
  const [themeSaved, setThemeSaved] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [s, setS] = useState<Settings>(defaultSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{
    lastPull?: string;
    lastPush?: string;
    error?: string;
  }>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [authChecked, setAuthChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bigFlash, setBigFlash] = useState<string | null>(null);
  // Auto-dismiss toast notifications after ~1.8s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!bigFlash) return;
    const t = setTimeout(() => setBigFlash(null), 1800);
    return () => clearTimeout(t);
  }, [bigFlash]);

  useEffect(() => {
    (async () => {
      const current = await db.get<Settings>("settings", "app");
      if (!current) {
        // seed
        await db.put("settings", { ...defaultSettings, id: "app" } as any);
        for (const e of defaultExercises) await db.put("exercises", e);
        for (const t of defaultTemplates) await db.put("templates", t);
        setS(defaultSettings);
      } else {
        setS(current);
      }
    })();
  }, []);

  useEffect(() => {
    // Track supabase auth state
    const sub = supabase.auth.onAuthStateChange(
      async (_evt: any, session: any) => {
        setUserEmail(session?.user?.email || undefined);
        setAuthChecked(true);
      }
    );
    const onAuth = (e: any) =>
      setUserEmail(e?.detail?.session?.user?.email || undefined);
    window.addEventListener("sb-auth", onAuth);
    // get current session once (resilient)
    let timer = setTimeout(() => setAuthChecked(true), 1500);
    waitForSession({ timeoutMs: 1200 })
      .then((s: any) => {
        setUserEmail(s?.user?.email || undefined);
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

  const save = async () => {
    await db.put("settings", { ...s, id: "app" } as any);
  };

  // testSync removed with Gist sync

  const exportData = async () => {
    const [exercises, sessions, measurements, templates, settings] =
      await Promise.all([
        db.getAll("exercises"),
        db.getAll("sessions"),
        db.getAll("measurements"),
        db.getAll("templates"),
        db.get("settings", "app"),
      ]);
    const json = JSON.stringify(
      { exercises, sessions, measurements, templates, settings },
      null,
      2
    );
    download("liftlog.json", json, "application/json");
    // CSVs
    const msCsv = [
      "dateISO,weightKg,neck,chest,waist,hips,thigh,calf,upperArm,forearm",
      ...measurements.map((m: any) =>
        [
          m.dateISO,
          m.weightKg || "",
          m.neck || "",
          m.chest || "",
          m.waist || "",
          m.hips || "",
          m.thigh || "",
          m.calf || "",
          m.upperArm || "",
          m.forearm || "",
        ].join(",")
      ),
    ].join("\n");
    download("measurements.csv", msCsv, "text/csv");
    const ssCsv = [
      "id,dateISO,phase,weekNumber,templateId,dayName,exerciseId,setNumber,weightKg,reps,notes",
      ...sessions.flatMap((s: any) =>
        s.entries.flatMap((e: any) =>
          e.sets.map((set: any) =>
            [
              s.id,
              s.dateISO,
              s.phase || "",
              s.weekNumber,
              s.templateId || "",
              s.dayName || "",
              e.exerciseId,
              set.setNumber,
              set.weightKg,
              set.reps,
              (e.notes || "").replaceAll(",", ";"),
            ].join(",")
          )
        )
      ),
    ].join("\n");
    download("sessions.csv", ssCsv, "text/csv");
  };

  // Gist sync removed; Supabase sync is automatic

  const importData = async (file: File) => {
    const text = await file.text();
    const json = JSON.parse(text);
    for (const e of json.exercises || []) await db.put("exercises", e);
    for (const s of json.sessions || []) await db.put("sessions", s);
    for (const m of json.measurements || []) await db.put("measurements", m);
    for (const t of json.templates || []) await db.put("templates", t);
    if (json.settings)
      await db.put("settings", { ...json.settings, id: "app" });
    alert("Imported");
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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>
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
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="mb-2">
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
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-app">Signed in as {userEmail}</span>
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
                    setUserEmail(undefined);
                    navigate("/");
                    setBusy(null);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
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
              <div className="flex gap-2 flex-wrap">
                <button
                  className="btn-primary px-3 py-3 rounded-xl"
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
                      setUserEmail(data.user?.email || email);
                      setToast("Signed in");
                      setBigFlash("Signed in successfully");
                    }
                    setBusy(null);
                  }}
                >
                  Sign in
                </button>
                <button
                  className="btn-outline px-3 py-3 rounded-xl"
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
                      setUserEmail(data.user?.email || email);
                      setToast("Account created");
                      setBigFlash("Signed in successfully");
                    }
                    setBusy(null);
                  }}
                >
                  Create account
                </button>
                <button
                  className="btn-outline px-3 py-3 rounded-xl"
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
                <div className="flex items-center gap-2">
                  <input
                    className="input-app rounded-xl px-3 py-3"
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
                        setUserEmail(data?.user?.email || email);
                        setToast("Signed in via OTP");
                      }
                      setBusy(null);
                    }}
                  >
                    Verify OTP
                  </button>
                </div>
                <button
                  className="btn-outline px-3 py-3 rounded-xl"
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
              <div className="mt-2 space-y-2">
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
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="space-y-1">
            <div className="text-sm text-app">Units</div>
            <select
              className="input-app rounded-xl px-3 py-2"
              value={s.unit}
              onChange={(e) => setS({ ...s, unit: e.target.value as any })}
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Theme</div>
            <select
              className="input-app rounded-xl px-3 py-2"
              value={s.theme}
              onChange={(e) => setS({ ...s, theme: e.target.value as any })}
            >
              <option value="dark">dark</option>
              <option value="light">light</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Deload load %</div>
            <input
              className="input-app rounded-xl px-3 py-2"
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
              className="input-app rounded-xl px-3 py-2"
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
            <div className="text-sm text-app">Start Page</div>
            <select
              className="input-app rounded-xl px-3 py-2"
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
          <label className="space-y-1">
            <div className="text-sm text-app">Open to last session</div>
            <select
              className="input-app rounded-xl px-3 py-2"
              value={String(s.dashboardPrefs?.openToLast ?? true)}
              onChange={(e) =>
                setS({
                  ...s,
                  dashboardPrefs: {
                    ...(s.dashboardPrefs || {}),
                    openToLast: e.target.value === "true",
                  },
                })
              }
            >
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Accent Color</div>
            <input
              type="color"
              className="input-app rounded-xl px-3 py-2 h-10"
              value={s.accentColor || "#22c55e"}
              onChange={(e) => {
                const v = e.target.value;
                setS({ ...s, accentColor: v });
                document.documentElement.style.setProperty("--accent", v);
              }}
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Card Style</div>
            <select
              className="input-app rounded-xl px-3 py-2"
              value={s.cardStyle || "glass"}
              onChange={(e) => {
                const v = e.target.value as any;
                setS({ ...s, cardStyle: v });
                document.documentElement.setAttribute("data-card-style", v);
              }}
            >
              <option value="glass">Glass</option>
              <option value="solid">Solid</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Auto-advance session</div>
            <select
              className="input-app rounded-xl px-3 py-2"
              value={String(s.autoAdvanceSession ?? false)}
              onChange={(e) =>
                setS({ ...s, autoAdvanceSession: e.target.value === "true" })
              }
            >
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">
              Default set rows per exercise
            </div>
            <input
              className="input-app rounded-xl px-3 py-2"
              inputMode="numeric"
              value={s.defaultSetRows ?? 3}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^\d*$/.test(v)) return;
                const n = Math.max(1, Math.min(6, Number(v || "3")));
                setS({ ...s, defaultSetRows: n });
              }}
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Measurement units</div>
            <select
              className="input-app rounded-xl px-3 py-2"
              value={s.measurementUnits || "metric"}
              onChange={(e) =>
                setS({ ...s, measurementUnits: e.target.value as any })
              }
            >
              <option value="metric">cm / kg</option>
              <option value="imperial">in / lb</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-sm text-app">Privacy: unlock</div>
            <select
              className="input-app rounded-xl px-3 py-2"
              value={s.privacyUnlockMode || "everyLaunch"}
              onChange={(e) =>
                setS({ ...s, privacyUnlockMode: e.target.value as any })
              }
            >
              <option value="everyLaunch">Require passcode every launch</option>
              <option value="remember24h">Remember unlock for 24h</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary px-3 py-2 rounded-xl" onClick={save}>
            Save
          </button>
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
          <button
            className="px-3 py-2 rounded-xl text-white"
            style={{ background: "var(--danger)" }}
            onClick={resetData}
          >
            Reset data
          </button>
        </div>
        {/* Cloud Sync (Gist) removed. Supabase sync runs automatically when signed in. */}
      </div>

      {/* Appearance */}
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="font-medium">Appearance</div>
        <div className="space-y-2">
          <div className="text-sm text-app">Theme presets</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
              <button
                key={k}
                className={`rounded-xl p-3 text-left border border-card ${
                  themeKey === k
                    ? "btn-primary"
                    : "card-surface hover:opacity-90"
                }`}
                onClick={async () => {
                  const cur = await db.get("settings", "app");
                  await db.put("settings", {
                    ...(cur || {}),
                    id: "app",
                    themeV2: { key: k },
                  });
                  // apply live
                  setThemeKey(k);
                }}
              >
                <div className="font-medium text-sm capitalize">
                  {k.replace(/-/g, " ")}
                </div>
                <div className="mt-2 grid grid-cols-6 gap-1 items-center">
                  <span
                    className="col-span-3 h-6 rounded"
                    style={{ background: THEMES[k]["--bg-muted"] }}
                  />
                  <span
                    className="h-6 rounded border"
                    style={{
                      background: THEMES[k]["--card"],
                      borderColor: THEMES[k]["--card-border"],
                    }}
                  />
                  <span
                    className="h-6 rounded"
                    style={{ background: THEMES[k]["--chart-1"] }}
                  />
                  <span
                    className="h-6 rounded"
                    style={{ background: THEMES[k]["--chart-2"] }}
                  />
                </div>
              </button>
            ))}
          </div>
          <div className="text-xs text-muted mt-1">
            Changes are local until you press <strong>Save Theme</strong>.
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-2">
            <button
              className="btn-primary px-3 py-2 rounded-xl"
              onClick={async () => {
                const cur = await db.get<Settings>("settings", "app");
                const ok = await saveProfileTheme(cur?.themeV2);
                setThemeSaved(ok);
                setToast(
                  ok ? "Theme saved to profile" : "Failed to save theme"
                );
              }}
            >
              Save Theme
            </button>
            {themeSaved === true && (
              <span className="text-xs text-emerald-400">Saved ✓</span>
            )}
            {themeSaved === false && (
              <span className="text-xs text-red-400">Not saved</span>
            )}
            <label className="flex items-center gap-2 text-xs bg-card/40 border border-card rounded-xl px-3 py-2">
              <span>Reduce motion</span>
              <input
                type="checkbox"
                checked={!!s.reducedMotion}
                onChange={(e) => {
                  const val = e.target.checked;
                  setS({ ...s, reducedMotion: val });
                  if (val)
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
            </label>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <div className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                <span>Theme mode</span>
                <select
                  className="bg-transparent outline-none"
                  value={s.ui?.themeMode || 'dark'}
                  onChange={async (e)=>{
                    const mode=e.target.value as any;
                    const next={ ...s, ui:{ ...(s.ui||{}), themeMode: mode } };
                    setS(next);
                    await db.put('settings',{ ...next, id:'app' } as any);
                    // Apply immediately
                    document.documentElement.setAttribute('data-theme', mode==='system'? (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'): mode);
                    // body attribute update is handled in root App but we set for immediate feedback
                  }}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>
              <label className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                <span>Compact UI</span>
                <input type="checkbox" checked={!!s.ui?.compactMode} onChange={async(e)=>{
                  const val=e.target.checked; const next={ ...s, ui:{ ...(s.ui||{}), compactMode: val } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); document.documentElement.setAttribute('data-density', val? 'compact':'normal'); }} />
              </label>
              <label className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                <span>Instant theme</span>
                <input type="checkbox" checked={!!s.ui?.instantThemeTransition} onChange={async(e)=>{ const val=e.target.checked; const next={ ...s, ui:{ ...(s.ui||{}), instantThemeTransition: val } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); if(val) document.documentElement.classList.remove('theme-animate'); else document.documentElement.classList.add('theme-animate'); }} />
              </label>
              <label className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                <span>Smoothing default</span>
                <input type="checkbox" checked={!!s.ui?.smoothingDefault} onChange={async(e)=>{ const val=e.target.checked; const next={ ...s, ui:{ ...(s.ui||{}), smoothingDefault: val } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); }} />
              </label>
              {/* ECG background toggle */}
              <label className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                <span>ECG bg</span>
                <input type="checkbox" checked={!!s.ecg?.enabled} onChange={async(e)=>{ const enabled=e.target.checked; const next ={ ...s, ecg:{ ...(s.ecg||{}), enabled } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); document.body.dataset.ecg = enabled? 'on':'off'; }} />
              </label>
              {s.ecg?.enabled && (
                <>
                  <div className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                    <span>Intensity</span>
                    <select className="bg-transparent outline-none" value={s.ecg?.intensity||'low'} onChange={async(e)=>{ const intensity=e.target.value as any; const next={ ...s, ecg:{ ...(s.ecg||{}), intensity, enabled:true } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); const root=document.documentElement; const map: Record<string,{opacity:string; speed:string; strokeWidth:string; dash:string}>={ low:{opacity:'0.15',speed:'46s', strokeWidth:'1.6', dash:'5 7'}, med:{opacity:'0.25',speed:'34s', strokeWidth:'2', dash:'5 5'}, high:{opacity:'0.35',speed:'26s', strokeWidth:'2.4', dash:'4 4'} }; const cfg=map[intensity]; root.style.setProperty('--ecg-opacity', cfg.opacity); root.style.setProperty('--ecg-speed', cfg.speed); root.style.setProperty('--ecg-stroke-w', cfg.strokeWidth); root.style.setProperty('--ecg-dash', cfg.dash); }}>
                      <option value="low">Low</option>
                      <option value="med">Med</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                    <span>Shape</span>
                    <select className="bg-transparent outline-none" value={s.ecg?.shape||'classic'} onChange={async(e)=>{ const shape=e.target.value as any; const next={ ...s, ecg:{ ...(s.ecg||{}), shape, enabled:true } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); /* rerender component picks up shape via settings */ }}>
                      <option value="classic">Classic</option>
                      <option value="smooth">Smooth</option>
                      <option value="spikes">Spikes</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                    <span>Speed</span>
                    <input type="range" min={4000} max={180000} step={1000} value={s.ecg?.speedMs||42000} onChange={async(e)=>{ const speedMs=Number(e.target.value); const next={ ...s, ecg:{ ...(s.ecg||{}), speedMs, enabled:true } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); document.documentElement.style.setProperty('--ecg-custom-speed-ms', String(speedMs)); }} />
                  </div>
                  <div className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                    <span>Trail</span>
                    <input title={String(s.ecg?.trailMs||2000)+ ' ms'} type="range" min={400} max={8000} step={100} value={s.ecg?.trailMs||2000} onChange={async(e)=>{ const trailMs=Number(e.target.value); const next={ ...s, ecg:{ ...(s.ecg||{}), trailMs, enabled:true } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); document.documentElement.style.setProperty('--ecg-trail-ms', String(trailMs)); }} />
                  </div>
                  <div className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                    <span>Spikes</span>
                    <input type="range" min={1} max={5} step={1} value={s.ecg?.spikes||1} onChange={async(e)=>{ const spikes=Number(e.target.value); const next={ ...s, ecg:{ ...(s.ecg||{}), spikes, enabled:true } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); /* waveform picks up via settings fetch on next animation cycle */ }} />
                    <span className="text-xs opacity-70">{s.ecg?.spikes||1}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
                    <span>Color</span>
                    <input type="color" value={s.ecg?.color || '#22c55e'} onChange={async(e)=>{ const color=e.target.value; const next={ ...s, ecg:{ ...(s.ecg||{}), color, enabled:true } }; setS(next); await db.put('settings',{ ...next, id:'app' } as any); document.documentElement.style.setProperty('--ecg-custom-color', color); }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safety */}
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="font-medium">Safety</div>
        <label className="flex items-center justify-between input-app rounded-xl px-3 py-3">
          <span className="text-sm text-app">
            Confirm before deleting items
          </span>
          <input
            type="checkbox"
            checked={!!s.confirmDestructive}
            onChange={(e) =>
              setS({ ...s, confirmDestructive: e.target.checked })
            }
          />
        </label>
        <button className="btn-primary px-3 py-3 rounded-xl" onClick={save}>
          Save Safety Settings
        </button>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="font-medium">Progress</div>
        <label className="flex items-center justify-between input-app rounded-xl px-3 py-3">
          <span className="text-sm text-app">Weekly target days</span>
          <input
            className="input-app rounded px-2 py-1 w-16 text-center"
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
        <label className="flex items-center justify-between input-app rounded-xl px-3 py-3">
          <span className="text-sm text-app">Gamification effects</span>
          <input
            type="checkbox"
            checked={s.progress?.gamification ?? true}
            onChange={(e) =>
              setS({
                ...s,
                progress: {
                  ...(s.progress || {}),
                  gamification: e.target.checked,
                },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between input-app rounded-xl px-3 py-3">
          <span className="text-sm text-app">Show deload hints</span>
          <input
            type="checkbox"
            checked={s.progress?.showDeloadHints ?? true}
            onChange={(e) =>
              setS({
                ...s,
                progress: {
                  ...(s.progress || {}),
                  showDeloadHints: e.target.checked,
                },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between input-app rounded-xl px-3 py-3">
          <span className="text-sm text-app">Show previous week hints</span>
          <input
            type="checkbox"
            checked={s.progress?.showPrevHints ?? true}
            onChange={(e) =>
              setS({
                ...s,
                progress: {
                  ...(s.progress || {}),
                  showPrevHints: e.target.checked,
                },
              })
            }
          />
        </label>
        <button className="btn-primary px-3 py-3 rounded-xl" onClick={save}>
          Save Progress Settings
        </button>
      </div>

      <ExerciseOverrides />
  <ExerciseLibraryManager />
  <WeeklyVolumeTargets />
    </div>
  );
}

function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
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

function ExerciseOverrides() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    (async () => setList(await db.getAll("exercises")))();
  }, []);
  const save = async (
    i: number,
    k: "deloadLoadPct" | "deloadSetPct",
    v: number
  ) => {
    const ex = list[i];
    const updated = { ...ex, defaults: { ...ex.defaults, [k]: v } };
    await db.put("exercises", updated);
    setList(list.map((e, idx) => (idx === i ? updated : e)));
  };
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
      <div className="font-medium">Exercise deload overrides</div>
      <div className="text-sm text-muted">
        Set specific deload % for load and sets. Leave blank to use global
        defaults.
      </div>
      <div className="grid gap-2">
        {list.map((ex, i) => (
          <div
            key={ex.id}
            className="grid grid-cols-3 gap-2 items-center [@media(max-width:420px)]:grid-cols-1 [@media(max-width:560px)]:grid-cols-2"
          >
            <div className="truncate">{ex.name}</div>
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

// New: Exercise library manager (primary + secondary muscles editing)
function ExerciseLibraryManager(){
  const [list,setList] = useState<any[]>([]);
  const [q,setQ] = useState("");
  const [creating,setCreating] = useState("");
  useEffect(()=> { (async ()=> setList(await db.getAll('exercises')))(); },[]);
  const ALL: string[] = ['chest','back','shoulders','triceps','biceps','legs','hamstrings','quads','glutes','calves','core','other'];
  const update = async (id:string, mut:(ex:any)=>any) => {
    setList(ls=> ls.map(ex=> ex.id===id? mut({...ex}): ex));
    const ex = list.find(e=> e.id===id);
    if(!ex) return; const next = mut({...ex}); await db.put('exercises', next);
  };
  const addSecondary = (ex:any, m:string) => update(ex.id, e=> ({...e, secondaryMuscles: [...(e.secondaryMuscles||[]), m]}));
  const removeSecondary = (ex:any, m:string) => update(ex.id, e=> ({...e, secondaryMuscles: (e.secondaryMuscles||[]).filter((x:string)=> x!==m)}));
  const createExercise = async () => {
    const name = creating.trim(); if(!name) return; if(list.some(e=> e.name.toLowerCase()===name.toLowerCase())){ alert('Exists'); return; }
    const ex={ id: crypto.randomUUID?.() || Date.now()+'' , name, muscleGroup:'other', defaults:{ sets:3, targetRepRange:'8-12' }, active:true, secondaryMuscles:[] };
    await db.put('exercises', ex); setList([ex, ...list]); setCreating('');
  };
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
      <div className="font-medium">Exercise Library</div>
      <div className="text-sm text-muted">Edit primary and secondary muscles. Secondary muscles contribute indirect volume (0.5x) in allocator.</div>
      <div className="flex flex-wrap gap-2 items-center">
        <input className="input-app rounded-xl px-3 py-2" placeholder="Search" value={q} onChange={e=> setQ(e.target.value)} />
        <div className="flex gap-2 items-center">
          <input className="input-app rounded-xl px-3 py-2" placeholder="New exercise" value={creating} onChange={e=> setCreating(e.target.value)} />
          <button className="btn-primary px-3 py-2 rounded-xl" onClick={createExercise}>Add</button>
        </div>
      </div>
      <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
        {list.filter(ex=> ex.name.toLowerCase().includes(q.toLowerCase())).map(ex=> {
          const remaining = ALL.filter(m=> m!==ex.muscleGroup && !(ex.secondaryMuscles||[]).includes(m));
          return (
            <div key={ex.id} className="p-3 rounded-xl bg-slate-800 space-y-2">
              <div className="flex justify-between gap-2 flex-wrap">
                <input className="bg-slate-700 rounded px-2 py-1 text-sm flex-1 min-w-[160px]" value={ex.name} onChange={e=> update(ex.id, x=> ({...x, name: e.target.value}))} />
                <select className="bg-slate-700 rounded px-2 py-1 text-sm" value={ex.muscleGroup} onChange={e=> update(ex.id, x=> ({...x, muscleGroup: e.target.value}))}>
                  {ALL.map(m=> <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-1 items-center text-[10px]">
                {(ex.secondaryMuscles||[]).map((m:string)=> (
                  <span key={m} className="bg-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1">{m}<button onClick={()=> removeSecondary(ex,m)} className="opacity-70 hover:opacity-100">×</button></span>
                ))}
                {remaining.length>0 && (
                  <details className="bg-slate-700/40 rounded px-1 py-0.5">
                    <summary className="cursor-pointer select-none">+ add</summary>
                    <div className="mt-1 flex flex-wrap gap-1 max-w-[240px]">
                      {remaining.map(m=> <button key={m} className="bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded" onClick={()=> addSecondary(ex,m)}>{m}</button>)}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyVolumeTargets(){
  const [targets,setTargets] = useState<Record<string, number>>({});
  useEffect(()=>{ (async()=>{ const s = await db.get('settings','app'); setTargets(s?.volumeTargets||{}); })(); },[]);
  const MUSCLES = ['chest','back','quads','hamstrings','glutes','shoulders','biceps','triceps','calves','core'];
  const save = async ()=> { const cur = await db.get('settings','app'); await db.put('settings',{ ...(cur||{}), id:'app', volumeTargets: targets }); };
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
      <div className="font-medium">Weekly Volume Targets</div>
      <div className="text-sm text-muted">Set desired weighted set targets per muscle. Used for allocator and dashboard progress bars.</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {MUSCLES.map(m=> (
          <label key={m} className="space-y-1">
            <span className="text-xs capitalize text-app">{m}</span>
            <input type="number" min={0} max={40} value={targets[m]??''} onChange={e=> setTargets(t=> ({...t, [m]: Number(e.target.value)}))} className="input-app rounded-xl px-2 py-2 w-full text-sm" />
          </label>
        ))}
      </div>
      <button className="btn-primary px-3 py-2 rounded-xl" onClick={save}>Save Volume Targets</button>
    </div>
  );
}
