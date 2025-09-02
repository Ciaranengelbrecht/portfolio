import { useEffect, useMemo, useRef, useState } from "react";
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
import { playRestBeep, unlockAudio } from "../lib/audio";
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
  const hslToHex = (hsl: string): string => {
    try {
      const m = hsl.match(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/i);
      if (!m) return '#000000';
      let h = Number(m[1]); const s = Number(m[2])/100; const l = Number(m[3])/100;
      const c=(1-Math.abs(2*l-1))*s; const x=c*(1-Math.abs(((h/60)%2)-1)); const m0=l-c/2;
      let r=0,g=0,b=0; if(h<60){ r=c; g=x; b=0;} else if(h<120){ r=x; g=c; b=0;} else if(h<180){ r=0; g=c; b=x;} else if(h<240){ r=0; g=x; b=c;} else if(h<300){ r=x; g=0; b=c;} else { r=c; g=0; b=x; }
      const R=Math.round((r+m0)*255), G=Math.round((g+m0)*255), B=Math.round((b+m0)*255);
      const toHex=(n:number)=> n.toString(16).padStart(2,'0');
      return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
    } catch { return '#000000'; }
  };
  const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
    try {
      const m = hex.match(/^#([\da-f]{6})$/i);
      if (!m) return { h: 0, s: 0, l: 0 };
      const num = parseInt(m[1], 16);
      const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
      const rn = r / 255, gn = g / 255, bn = b / 255;
      const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      let h = 0, s = 0; const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
        switch (max) {
          case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
          case gn: h = (bn - rn) / d + 2; break;
          case bn: h = (rn - gn) / d + 4; break;
        }
        h *= 60;
      }
      return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    } catch { return { h: 0, s: 0, l: 0 }; }
  };
  const parseHslA = (v?: string): { h: number; s: number; l: number; a?: number } | null => {
    if (!v) return null;
    const m = v.match(/hsl(a)?\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*(?:\/\s*([0-9.]+))?\s*\)/i);
    if (!m) return null;
    return { h: Number(m[2]), s: Number(m[3]), l: Number(m[4]), a: m[5] != null ? Number(m[5]) : undefined };
  };
  const formatHslA = (h: number, s: number, l: number, a?: number) => a==null ? `hsl(${h} ${s}% ${l}%)` : `hsla(${h} ${s}% ${l}% / ${a})`;

  // Popover color picker using react-colorful (lazy imported)
  const ColorPicker = useMemo(() => ({ Comp: null as any }), []);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  useEffect(() => { (async ()=>{ try { const mod = await import('react-colorful'); (ColorPicker as any).Comp = mod.HexColorPicker; setPickerLoaded(true);} catch {} })(); }, []);
  const [openPicker, setOpenPicker] = useState<string|null>(null);
  const closePicker = ()=> setOpenPicker(null);
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
      sessionStorage.setItem("themePresetsCollapsed", themesCollapsed ? "1" : "0");
    } catch {}
  }, [themesCollapsed]);
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
    const [exercises, sessions, measurements, templates, settings] = await Promise.all([
      db.getAll("exercises"),
      db.getAll("sessions"),
      db.getAll("measurements"),
      db.getAll("templates"),
      db.get("settings", "app"),
    ]);

    // Helper: map for lookups
    const exerciseMap: Record<string, any> = Object.fromEntries(
      (exercises as any[]).map((e) => [e.id, e])
    );

    // Generic CSV escaping (wrap if needed)
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    // Raw JSON snapshot (for full fidelity restore)
    const json = JSON.stringify(
      { exercises, sessions, measurements, templates, settings, exportedAt: new Date().toISOString() },
      null,
      2
    );
    download("liftlog.json", json, "application/json");

    // Measurements CSV (retain original columns + potential localDate later)
    const measurementsCsv = [
      ["dateISO","weightKg","neck","chest","waist","hips","thigh","calf","upperArm","forearm"].join(","),
      ...measurements.map((m: any) =>
        [m.dateISO,m.weightKg||"",m.neck||"",m.chest||"",m.waist||"",m.hips||"",m.thigh||"",m.calf||"",m.upperArm||"",m.forearm||""].map(esc).join(",")
      ),
    ].join("\n");
    download("measurements.csv", measurementsCsv, "text/csv");

    // Exercises catalog CSV
    const exercisesCsv = [
      ["id","name","muscleGroup","secondaryMuscles","tags","defaultSets","defaultRepRange","deloadLoadPct","deloadSetPct","active","isOptional"].join(","),
      ...(exercises as any[]).map((e) => [
        e.id,
        e.name,
        e.muscleGroup,
        (e.secondaryMuscles||[]).join("|"),
        (e.tags||[]).join("|"),
        e.defaults?.sets ?? '',
        e.defaults?.targetRepRange ?? '',
        e.defaults?.deloadLoadPct ?? '',
        e.defaults?.deloadSetPct ?? '',
        e.active === false ? "false" : "true",
        e.isOptional ? "true" : "false",
      ].map(esc).join(","))
    ].join("\n");
    download("exercises.csv", exercisesCsv, "text/csv");

    // Session set-level detail (enhanced)
    const sessionSetsCsv = [
      [
        "sessionId","dateISO","localDate","phaseNumber","weekNumber","dayName","templateId","exerciseId","exerciseName","muscleGroup","setNumber","weightKg","reps","rpe","notes","targetRepRange"
      ].join(","),
      ...sessions.flatMap((sess: any) =>
        (sess.entries||[]).flatMap((entry: any) =>
          (entry.sets||[]).map((set: any) => {
            const ex = exerciseMap[entry.exerciseId];
            return [
              sess.id,
              sess.dateISO,
              sess.localDate || '',
              sess.phaseNumber || sess.phase || '',
              sess.weekNumber,
              sess.dayName || '',
              sess.templateId || '',
              entry.exerciseId,
              ex?.name || '',
              ex?.muscleGroup || '',
              set.setNumber,
              set.weightKg ?? '',
              set.reps ?? '',
              set.rpe ?? '',
              (entry.notes || '').replace(/\n/g,' ').slice(0,500),
              entry.targetRepRange || '',
            ].map(esc).join(",");
          })
        )
      )
    ].join("\n");
    download("session_sets.csv", sessionSetsCsv, "text/csv");

    // Session summary (one row per session)
    const sessionSummaryCsv = [
      [
        "sessionId","dateISO","localDate","phaseNumber","weekNumber","dayName","exerciseCount","totalSets","estimatedVolumeKg","loggedMinutes"
      ].join(","),
      ...sessions.map((sess: any) => {
        let totalSets = 0;
        let volume = 0;
        for (const entry of sess.entries || []) {
          totalSets += (entry.sets||[]).length;
          for (const set of entry.sets||[]) {
            if (typeof set.weightKg === 'number' && typeof set.reps === 'number') {
              volume += (set.weightKg || 0) * (set.reps || 0);
            }
          }
        }
        let minutes = '';
        if (sess.loggedStartAt && sess.loggedEndAt) {
          const ms = new Date(sess.loggedEndAt).getTime() - new Date(sess.loggedStartAt).getTime();
          if (ms > 0) minutes = (ms/60000).toFixed(1);
        }
        return [
          sess.id,
            sess.dateISO,
            sess.localDate || '',
            sess.phaseNumber || sess.phase || '',
            sess.weekNumber,
            sess.dayName || '',
            (sess.entries||[]).length,
            totalSets,
            volume ? volume.toFixed(1) : '',
            minutes
        ].map(esc).join(",");
      })
    ].join("\n");
    download("session_summary.csv", sessionSummaryCsv, "text/csv");

    // Templates CSV (plan expanded)
    const templatesCsv = [
      ["id","name","exerciseCount","exerciseNames","plan"].join(","),
      ...templates.map((t: any) => {
        const names = (t.exerciseIds||[]).map((id:string)=> exerciseMap[id]?.name || id);
        const plan = (t.plan||[]).map((p:any)=> {
          const ex = exerciseMap[p.exerciseId];
          return `${(ex?.name || p.exerciseId)}:${p.plannedSets}x${p.repRange}`;
        }).join("|");
        return [
          t.id,
          t.name,
          (t.exerciseIds||[]).length,
          names.join("|").slice(0,800),
          plan.slice(0,800)
        ].map(esc).join(",");
      })
    ].join("\n");
    download("templates.csv", templatesCsv, "text/csv");
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
        <div>
          <div className="font-medium mb-1">Rest Timer</div>
          <div className="text-xs text-muted mb-2">Default target rest time (seconds). Timer animates, beeps, and vibrates (if enabled) when this threshold is reached.</div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="number"
              min={30}
              max={300}
              className="input-app rounded-xl px-3 py-2 w-28"
              value={s.restTimerTargetSeconds ?? ''}
              onChange={(e)=> { const v=Number(e.target.value); if(isNaN(v)) return; setS(prev=> ({ ...prev, restTimerTargetSeconds: Math.max(30, Math.min(300,v)) })); }}
            />
            <div className="flex gap-2">
              {[60,90,120,150].map(preset=> (
                <button key={preset} className={`px-3 py-2 rounded-xl text-xs ${ (s.restTimerTargetSeconds||0)===preset? 'bg-emerald-600':'bg-slate-700' }`} onClick={()=> setS(prev=> ({ ...prev, restTimerTargetSeconds: preset }))}>{preset}s</button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-[11px] bg-card/40 border border-card rounded-xl px-2 py-1">
              <input
                type="checkbox"
                checked={s.restTimerStrongAlert !== false}
                onChange={(e)=> setS(prev=> ({ ...prev, restTimerStrongAlert: e.target.checked }))}
              />
              <span>Strong pulse</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] bg-card/40 border border-card rounded-xl px-2 py-1" title="Play a short beep when rest target is reached">
              <input
                type="checkbox"
                checked={s.restTimerBeep !== false}
                onChange={(e)=> setS(prev=> ({ ...prev, restTimerBeep: e.target.checked }))}
              />
              <span>Beep at target</span>
            </label>
            {s.restTimerBeep !== false && (
              <>
                <label className="flex items-center gap-2 text-[11px] bg-card/40 border border-card rounded-xl px-2 py-1">
                  <span>Style</span>
                  <select
                    className="bg-slate-800 rounded px-2 py-1"
                    value={s.restTimerBeepStyle || 'gentle'}
                    onChange={(e)=> setS(prev=> ({ ...prev, restTimerBeepStyle: e.target.value as any }))}
                  >
                    <option value="gentle">Gentle</option>
                    <option value="chime">Chime</option>
                    <option value="digital">Digital</option>
                    <option value="alarm">Alarm</option>
                    <option value="click">Click</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[11px] bg-card/40 border border-card rounded-xl px-2 py-1">
                  <span>Count</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="bg-slate-800 rounded px-2 py-1 w-16"
                    value={Math.max(1, Math.min(5, s.restTimerBeepCount ?? 2))}
                    onChange={(e)=> { const v = Number(e.target.value); if(Number.isFinite(v)) setS(prev=> ({ ...prev, restTimerBeepCount: Math.max(1, Math.min(5, Math.floor(v))) })); }}
                  />
                </label>
              </>
            )}
            <label className="flex items-center gap-1 text-[11px] bg-card/40 border border-card rounded-xl px-2 py-1" title="Brief white flash behind app when rest target first reached. Accessibility: may be intense for some users.">
              <input
                type="checkbox"
                checked={!!s.restTimerScreenFlash}
                onChange={(e)=> setS(prev=> ({ ...prev, restTimerScreenFlash: e.target.checked }))}
              />
              <span>Screen flash</span>
            </label>
            <BeepTester styleKey={s.restTimerBeepStyle || 'gentle'} count={Math.max(1, Math.min(5, s.restTimerBeepCount ?? 2))} />
            <button
              className="btn-primary px-3 py-2 rounded-xl text-xs"
              onClick={async ()=> { await db.put('settings', { ...s, id:'app' } as any); setToast('Rest timer saved'); }}
            >Save</button>
          </div>
          <div className="text-[10px] text-muted mt-1 leading-snug max-w-[580px]">
            Strong pulse enlarges and pulses the timer once target is reached. Beep uses subtle tones and respects browser autoplay policies (tap anywhere to unlock sound). Screen flash briefly inverts/whitens the background for high visibility. Disable if you prefer minimal motion or have sensitivity. Respects the global Reduce motion toggle for most animations.
          </div>
        </div>
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
          <button
            type="button"
            className="w-full flex items-center justify-between text-left px-3 py-2 bg-card/40 border border-card rounded-xl"
            onClick={() => setThemesCollapsed((v) => !v)}
            aria-expanded={!themesCollapsed}
            aria-controls="theme-presets-panel"
          >
            <span className="text-sm text-app flex items-center gap-2">
              <span
                className={`inline-block transform transition-transform duration-300 ${themesCollapsed ? "rotate-180" : ""}`}
                aria-hidden
              >
                ▾
              </span>
              Theme presets
            </span>
            <span className="text-xs text-muted">{Object.keys(THEMES).length} themes</span>
          </button>
          <div
            id="theme-presets-panel"
            className={`transition-all duration-400 ease-out ${themesCollapsed ? "max-h-0 opacity-0 pointer-events-none" : "max-h-[900px] opacity-100"}`}
            aria-hidden={themesCollapsed}
          >
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 px-1 pb-1">
              {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
                const customPreview = (k === 'custom' && s.themeV2?.customVars) ? { ...THEMES[k], ...s.themeV2.customVars } as Record<string,string> : THEMES[k];
                return (
                <button
                  key={k}
                  className={`rounded-xl p-3 text-left border border-card ${
                    themeKey === k ? "btn-primary" : "card-surface hover:opacity-90"
                  }`}
                  onClick={async () => {
                    const cur = await db.get("settings", "app");
                    await db.put("settings", {
                      ...(cur || {}),
                      id: "app",
                      themeV2: { ...((cur as any)?.themeV2 || {}), key: k },
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
                      style={{ background: customPreview["--bg-muted"] }}
                    />
                    <span
                      className="h-6 rounded border"
                      style={{
                        background: customPreview["--card"],
                        borderColor: customPreview["--card-border"],
                      }}
                    />
                    <span
                      className="h-6 rounded"
                      style={{ background: customPreview["--chart-1"] }}
                    />
                    <span
                      className="h-6 rounded"
                      style={{ background: customPreview["--chart-2"] }}
                    />
                  </div>
                </button>
              );})}
            </div>
          </div>
          <div className="text-xs text-muted mt-1">
            Changes are local until you press <strong>Save Theme</strong>.
          </div>
          {/* Custom Theme editor — visible only when the 'custom' theme is selected */}
          {themeKey === 'custom' && (
          <div className="mt-4 card-surface rounded-2xl p-4 md:p-5 border border-card shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">Custom theme</div>
              <span className="text-xs text-muted">Editing variables</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                ['--bg','Background'],
                ['--bg-muted','Background (muted)'],
                ['--text','Text'],
                ['--text-muted','Text (muted)'],
                ['--accent','Accent color'],
                ['--chart-1','Chart color A'],
                ['--chart-2','Chart color B'],
              ] as Array<[string,string]>).map(([key,label])=>{
                const current = (s.themeV2?.customVars && s.themeV2.customVars[key]) || THEMES['custom'][key];
                const hex = /^hsl\(/i.test(current||'') ? hslToHex(current!) : (current as string);
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="text-xs truncate" title={key}>{label}</div>
                    <button type="button" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-card bg-card/60"
                      onClick={()=> setOpenPicker(key)}
                      aria-haspopup="dialog"
                      aria-expanded={openPicker===key}
                      title={String(current)}
                    >
                      <span className="inline-block h-6 w-6 rounded border border-card" style={{ background: current }} />
                      <span className="text-xs">Edit</span>
                    </button>
                    {openPicker===key && pickerLoaded && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
                        <div className="w-full max-w-[380px] max-h-[90vh] overflow-auto rounded-2xl border border-card bg-card shadow-soft p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">{label}</div>
                            <button className="btn-outline px-2 py-1 rounded-md text-xs" onClick={closePicker}>Close</button>
                          </div>
                          {ColorPicker.Comp && (
                            <ColorPicker.Comp color={hex} onChange={async(v:string)=>{
                              const hs = hexToHsl(v); const cssVal = `hsl(${hs.h} ${hs.s}% ${hs.l}%)`;
                              const next: Settings = { ...s, themeV2:{ key: (s.themeV2?.key||'custom') as any, ...(s.themeV2||{}), customVars:{ ...(s.themeV2?.customVars||{}), [key]: cssVal } } } as any;
                              setS(next); await db.put('settings', { ...next, id:'app' } as any); if(themeKey==='custom') setThemeKey('custom');
                            }} />
                          )}
                          <div className="flex justify-end mt-3"><button className="btn-primary px-3 py-1.5 rounded-md text-xs" onClick={closePicker}>Done</button></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Card surface (with transparency) */}
              {([['--card','Card surface'],['--card-border','Card border']] as Array<[string,string]>).map(([key,label])=>{
                const current = (s.themeV2?.customVars && s.themeV2.customVars[key]) || THEMES['custom'][key];
                const hsla = parseHslA(current || '') || { h: 210, s: 20, l: 90, a: 0.08 };
                const hex = `#${((n:number)=>n.toString(16).padStart(2,'0'))(Math.round((hsla.l/100 + hsla.s/100*Math.min(hsla.l/100,1-hsla.l/100)) * 255))}`; // placeholder, picker will set from h/s/l via hexToHsl
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="text-xs truncate" title={key}>{label}</div>
                    <button type="button" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-card bg-card/60"
                      onClick={()=> setOpenPicker(key)} aria-haspopup="dialog" aria-expanded={openPicker===key} title={String(current)}>
                      <span className="inline-block h-6 w-6 rounded border border-card" style={{ background: current }} />
                      <span className="text-xs">Edit</span>
                    </button>
                    {openPicker===key && pickerLoaded && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
                        <div className="w-full max-w-[420px] max-h-[90vh] overflow-auto rounded-2xl border border-card bg-card shadow-soft p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">{label}</div>
                            <button className="btn-outline px-2 py-1 rounded-md text-xs" onClick={closePicker}>Close</button>
                          </div>
                          {ColorPicker.Comp && (
                            <ColorPicker.Comp color={hslToHex(formatHslA(hsla.h, hsla.s, hsla.l, undefined))} onChange={async(v:string)=>{
                              const hs = hexToHsl(v);
                              const nextVal = formatHslA(hs.h, hs.s, hs.l, hsla.a==null?0.08:hsla.a);
                              const next: Settings = { ...s, themeV2:{ key: (s.themeV2?.key||'custom') as any, ...(s.themeV2||{}), customVars:{ ...(s.themeV2?.customVars||{}), [key]: nextVal } } } as any;
                              setS(next); await db.put('settings', { ...next, id:'app' } as any); if(themeKey==='custom') setThemeKey('custom');
                            }} />
                          )}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1"><span>Alpha</span><span>{Math.round((hsla.a??0.08)*100)}</span></div>
                            <input className="w-full" type="range" min={0} max={100} defaultValue={Math.round((hsla.a??0.08)*100)} onChange={async(e)=>{
                              const a = Number(e.target.value)/100;
                              const nextVal = formatHslA(hsla.h, hsla.s, hsla.l, a);
                              const next: Settings = { ...s, themeV2:{ key: (s.themeV2?.key||'custom') as any, ...(s.themeV2||{}), customVars:{ ...(s.themeV2?.customVars||{}), [key]: nextVal } } } as any;
                              setS(next); await db.put('settings', { ...next, id:'app' } as any); if(themeKey==='custom') setThemeKey('custom');
                            }} />
                          </div>
                          <div className="flex justify-end mt-3"><button className="btn-primary px-3 py-1.5 rounded-md text-xs" onClick={closePicker}>Done</button></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Glow color editor */}
              {(()=>{
                const key='--glow';
                const cur = (s.themeV2?.customVars && s.themeV2.customVars[key]) || THEMES['custom'][key] || '0 0 32px hsla(210 90% 60% / 0.45)';
                const match = cur.match(/(.*?)(hsla?\(.*?\))(.*)/i);
                const colorPart = match?.[2] || 'hsla(210 90% 60% / 0.45)';
                const col = parseHslA(colorPart) || { h:210, s:90, l:60, a:0.45 };
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="text-xs truncate" title={key}>Glow color</div>
                    <button type="button" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-card bg-card/60" onClick={()=> setOpenPicker(key)} aria-haspopup="dialog" aria-expanded={openPicker===key} title={String(colorPart)}>
                      <span className="inline-block h-6 w-6 rounded border border-card" style={{ background: formatHslA(col.h, col.s, col.l, 1) }} />
                      <span className="text-xs">Edit</span>
                    </button>
                    {openPicker===key && pickerLoaded && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
                        <div className="w-full max-w-[380px] max-h-[90vh] overflow-auto rounded-2xl border border-card bg-card shadow-soft p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">Glow color</div>
                            <button className="btn-outline px-2 py-1 rounded-md text-xs" onClick={closePicker}>Close</button>
                          </div>
                          {ColorPicker.Comp && (
                            <ColorPicker.Comp color={hslToHex(formatHslA(col.h, col.s, col.l))} onChange={async(v:string)=>{
                              const hs = hexToHsl(v);
                              const nextColor = formatHslA(hs.h, hs.s, hs.l, col.a==null?0.45:col.a);
                              const nextString = cur.replace(/(hsla?\(.*?\))/, nextColor);
                              const next: Settings = { ...s, themeV2:{ key: (s.themeV2?.key||'custom') as any, ...(s.themeV2||{}), customVars:{ ...(s.themeV2?.customVars||{}), [key]: nextString } } } as any;
                              setS(next); await db.put('settings', { ...next, id:'app' } as any); if(themeKey==='custom') setThemeKey('custom');
                            }} />
                          )}
                          <div className="flex justify-between items-center gap-2 mt-3">
                            <button className="btn-outline px-2 py-1 rounded-md text-xs" onClick={async()=>{ const acc = (s.themeV2?.customVars?.['--accent']||THEMES['custom']['--accent']); const hs = parseHslA(acc||''); if(!hs) return; const nextColor = formatHslA(hs.h, hs.s, hs.l, col.a==null?0.45:col.a); const nextString = cur.replace(/(hsla?\(.*?\))/, nextColor); const next: Settings = { ...s, themeV2:{ key: (s.themeV2?.key||'custom') as any, ...(s.themeV2||{}), customVars:{ ...(s.themeV2?.customVars||{}), [key]: nextString } } } as any; setS(next); await db.put('settings', { ...next, id:'app' } as any); if(themeKey==='custom') setThemeKey('custom'); }}>Match accent</button>
                            <button className="btn-primary px-3 py-1.5 rounded-md text-xs" onClick={closePicker}>Done</button>
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
                onClick={async()=>{ const cur = await db.get('settings','app'); await db.put('settings', { ...(cur||{}), id:'app', themeV2:{ ...(cur?.themeV2||{}), key:'custom', customVars: s.themeV2?.customVars||{} } } as any); setThemeKey('custom'); setToast('Applied custom theme'); }}
              >Apply custom theme</button>
              <div className="text-xs text-muted">Tip: pick your accent first, then tune background and card for contrast. Save Theme to sync to profile.</div>
            </div>
          </div>
          )}
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
            {/* Theme fine tuning */}
            <label className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
              <span className="text-xs">Accent intensity</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={s.themeV2?.accentIntensity ?? 50}
                onChange={async (e) => {
                  const accentIntensity = Number(e.target.value);
                  const next: Settings = {
                    ...s,
                    themeV2: { key: (s.themeV2?.key||themeKey), ...(s.themeV2||{}), accentIntensity },
                  } as any;
                  setS(next);
                  await db.put("settings", { ...next, id: "app" } as any);
                  // re-apply theme with new intensity
                  setThemeKey((next.themeV2?.key || themeKey) as any);
                }}
              />
              <span className="text-xs tabular-nums w-8 text-right">{s.themeV2?.accentIntensity ?? 50}</span>
            </label>
            <label className="flex items-center gap-2 bg-card/40 border border-card rounded-xl px-3 py-2">
              <span className="text-xs">Glow strength</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={s.themeV2?.glowStrength ?? 50}
                onChange={async (e) => {
                  const glowStrength = Number(e.target.value);
                  const next: Settings = {
                    ...s,
                    themeV2: { key: (s.themeV2?.key||themeKey), ...(s.themeV2||{}), glowStrength },
                  } as any;
                  setS(next);
                  await db.put("settings", { ...next, id: "app" } as any);
                  setThemeKey((next.themeV2?.key || themeKey) as any);
                }}
              />
              <span className="text-xs tabular-nums w-8 text-right">{s.themeV2?.glowStrength ?? 50}</span>
            </label>
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

function BeepTester({ styleKey, count }: { styleKey: 'gentle'|'chime'|'digital'|'alarm'|'click'; count: number }) {
  return (
    <button
      className="px-3 py-2 rounded-xl text-xs bg-slate-700 hover:bg-slate-600"
      title="Play a preview beep"
  onClick={async () => { try { await unlockAudio(); (await import('../lib/audio')).playBeepStyle(styleKey, count); } catch {} }}
    >
      Test beep
    </button>
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
  const [collapsed, setCollapsed] = useState(true); // collapsed by default
  useEffect(() => {
    (async () => setList(await db.getAll("exercises")))();
  }, []);
  const save = async (i: number, k: "deloadLoadPct" | "deloadSetPct", v: number) => {
    const ex = list[i];
    const updated = { ...ex, defaults: { ...ex.defaults, [k]: v } };
    await db.put("exercises", updated);
    setList(list.map((e, idx) => (idx === i ? updated : e)));
  };
  // Persist collapse preference (session scope for now)
  useEffect(()=> { try { const raw = sessionStorage.getItem('exOverridesCollapsed'); if(raw!==null) setCollapsed(raw==='1'); } catch {} },[]);
  useEffect(()=> { try { sessionStorage.setItem('exOverridesCollapsed', collapsed? '1':'0'); } catch {} },[collapsed]);
  return (
    <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="exercise-overrides-body"
      >
        <span className="font-medium flex items-center gap-2">
          <span className={`inline-block transform transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>▾</span>
          Exercise deload overrides
        </span>
        <span className="text-xs text-muted">{list.length} exercises</span>
      </button>
      <div
        id="exercise-overrides-body"
        className={`transition-all duration-400 ease-out ${collapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[640px] opacity-100'} px-4 ${collapsed? '' : 'pb-4'}`}
        aria-hidden={collapsed}
      >
        <div className="text-sm text-muted mb-3">
          Set specific deload % for load and sets. Leave blank to use global defaults.
        </div>
        <div className="grid gap-2">
          {list.map((ex, i) => (
            <div
              key={ex.id}
              className="grid grid-cols-3 gap-2 items-center [@media(max-width:420px)]:grid-cols-1 [@media(max-width:560px)]:grid-cols-2 bg-slate-800/40 rounded-xl px-3 py-2"
            >
              <div className="truncate text-xs sm:text-sm">{ex.name}</div>
              <input
                aria-label="Load %"
                className="input-app rounded-xl px-3 py-2"
                placeholder="Load %"
                value={Math.round((ex.defaults.deloadLoadPct ?? NaN) * 100) || ""}
                onChange={(e) => save(i, "deloadLoadPct", Number(e.target.value) / 100)}
              />
              <input
                aria-label="Set %"
                className="input-app rounded-xl px-3 py-2"
                placeholder="Set %"
                value={Math.round((ex.defaults.deloadSetPct ?? NaN) * 100) || ""}
                onChange={(e) => save(i, "deloadSetPct", Number(e.target.value) / 100)}
              />
            </div>
          ))}
        </div>
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
