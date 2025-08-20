import { lazy, Suspense, useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { getSettings, setSettings } from "./lib/helpers";
import { seedExercises } from './lib/seedExercises';
import { initSupabaseSync } from "./lib/supabaseSync";
import { ThemeProvider as LegacyThemeProvider } from "./lib/theme";
import { ThemeProvider as VarsThemeProvider } from "./theme/ThemeProvider";
import { ProgramProvider } from "./state/program";
import "./styles/theme.css";
import { registerSW } from "./lib/pwa";
import {
  supabase,
  clearAuthStorage,
  refreshSessionNow,
  forceRefreshSession,
  waitForSession,
} from "./lib/supabase";
import AuthModal from "./components/AuthModal";
import NavDrawer from "./components/NavDrawer";
import MobileTabs from "./components/MobileTabs";
import BackgroundFX from "./components/BackgroundFX";
import BigFlash from "./components/BigFlash";
import ECGBackground from "./components/ECGBackground";
import { SnackProvider, useSnack } from './state/snackbar';

const Dashboard = lazy(() => import("./features/dashboard/Dashboard"));
const Sessions = lazy(() => import("./pages/Sessions"));
const Measurements = lazy(() => import("./pages/Measurements"));
const Templates = lazy(() => import("./pages/Templates"));
const Store = lazy(() => import("./pages/Store"));
const Settings = lazy(() => import("./pages/Settings"));
const IntroAuthPage = lazy(() => import("./pages/auth/IntroAuthPage"));
const ProgramSettings = lazy(() => import("./pages/ProgramSettings"));
import RequireAuth from "./routes/guards/RequireAuth";
import { migrateToV6 } from "./lib/migrations/v6_program";
import { migrateToV7 } from "./lib/migrations/v7_exercise_muscles";
import { migrateToV8_LocalDate } from "./lib/migrations/v8_sessions_localdate";
import { warmPreload } from './lib/dataCache';
import { computeAggregates } from './lib/aggregates';

function Shell() {
  const { push } = useSnack();
  const navigate = useNavigate();
  const locationRef = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [bigFlash, setBigFlash] = useState<string | null>(null);
  push({ message: "Week Complete!" });
  push({ message: "Phase complete!" });
  useEffect(() => {
    if (!bigFlash) return;
    const t = setTimeout(() => setBigFlash(null), 1800);
    return () => clearTimeout(t);
  }, [bigFlash]);
  // dark class is managed by new ThemeProvider
  useEffect(() => {
    registerSW();
  }, []);
  // Warm and force-refresh session at startup; briefly wait for session to avoid flash of empty data
  useEffect(() => {
    (async () => {
      console.log("[App] init: waitForSession…");
      const s = await waitForSession({ timeoutMs: 6000 });
      console.log("[App] init: session?", !!s, "user:", s?.user?.id || null);
      if (s?.user?.email) setAuthEmail(s.user.email);
      setAuthChecked(true);
  // Seed global exercise catalogue once per device (idempotent if already present)
  seedExercises().catch(()=>{});
      // Preload core datasets (stale-while-revalidate) for snappier first navigation
  warmPreload(['sessions','exercises','measurements','templates','settings'], { swr: true });
  // Kick off aggregate computation (non-blocking)
  computeAggregates().catch(()=>{});
    })();
  }, []);
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      // apply accent and card style
      const root = document.documentElement;
      if (s.accentColor) root.style.setProperty("--accent", s.accentColor);
      if (s.cardStyle) root.setAttribute("data-card-style", s.cardStyle);
      if (s.reducedMotion) root.setAttribute("data-reduced-motion", "true");
      // ECG background settings
      if (s.ecg?.enabled) {
        document.body.dataset.ecg = 'on';
        const intensity = s.ecg.intensity || 'low';
  const map: Record<string,{opacity:string; speed:string; strokeWidth:string; dash:string}> = { low:{opacity:'0.15',speed:'46s', strokeWidth:'1.6', dash:'5 7'}, med:{opacity:'0.25',speed:'34s', strokeWidth:'2', dash:'5 5'}, high:{opacity:'0.35',speed:'26s', strokeWidth:'2.4', dash:'4 4'} };
  const cfg = map[intensity];
  root.style.setProperty('--ecg-opacity', cfg.opacity);
  root.style.setProperty('--ecg-speed', cfg.speed);
  root.style.setProperty('--ecg-stroke-w', cfg.strokeWidth);
  root.style.setProperty('--ecg-dash', cfg.dash);
  if(s.ecg.speedMs){ root.style.setProperty('--ecg-custom-speed-ms', String(s.ecg.speedMs)); }
  if(s.ecg.trailMs){ root.style.setProperty('--ecg-trail-ms', String(s.ecg.trailMs)); }
  if(s.ecg.color){ root.style.setProperty('--ecg-custom-color', s.ecg.color); }
      } else document.body.dataset.ecg = 'off';
      // Theme mode handling
      const applyThemeMode = () => {
        const mode = s.ui?.themeMode || 'dark';
        const preferSystem = mode === 'system';
        let effective: 'dark' | 'light' = 'dark';
        if (preferSystem) {
          const mq = window.matchMedia('(prefers-color-scheme: light)');
            effective = mq.matches ? 'light' : 'dark';
        } else effective = mode;
        document.body.dataset.theme = effective;
      };
      if(!s.ui?.instantThemeTransition){
        document.body.classList.add('theme-animate');
        setTimeout(()=> document.body.classList.remove('theme-animate'), 600);
      }
      applyThemeMode();
      if (s.ui?.themeMode === 'system') {
        try {
          const mq = window.matchMedia('(prefers-color-scheme: light)');
          const listener = () => applyThemeMode();
          mq.addEventListener('change', listener);
          setTimeout(()=> mq.removeEventListener('change', listener), 30000); // temp listener (can be persisted refactor later)
        } catch {}
      }
      // Compact mode
      if (s.ui?.compactMode) document.body.dataset.density = 'compact'; else delete document.body.dataset.density;
    })();
  }, []);
  // Initialize Supabase sync (pull, push queue, realtime)
  useEffect(() => {
    initSupabaseSync();
  }, []);

  // Lightweight remote migrations (idempotent via localStorage flags)
  useEffect(() => {
    (async () => {
      try {
        await waitForSession({ timeoutMs: 6000 });
        if (localStorage.getItem("mig_v6") !== "1") {
          await migrateToV6();
          localStorage.setItem("mig_v6", "1");
        }
  if (localStorage.getItem("mig_v7") !== "1") { await migrateToV7(); localStorage.setItem("mig_v7", "1"); }
  if (localStorage.getItem("mig_v8_localDate") !== "1") { await migrateToV8_LocalDate(); localStorage.setItem("mig_v8_localDate", "1"); }
      } catch (e) {
        console.warn("[App] migration runner error", e);
      }
    })();
  }, []);

  // If user opens a Supabase password recovery link, mark the flow and navigate AFTER session exists
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.hash.slice(1) || window.location.search
    );
    const type = params.get("type") || params.get("event");
    if (type === "recovery") {
      try {
        localStorage.setItem("sb_pw_reset", "1");
      } catch {}
    }

    let stopped = false;
    const maybeRouteToSettings = async () => {
      const flagged = localStorage.getItem("sb_pw_reset") === "1";
      if (!flagged) return;
      const s = await waitForSession({ timeoutMs: 1500 });
      if (s) {
        navigate("/settings");
        return true;
      }
      return false;
    };

    // Listen for auth changes and route when a session is ready
    const sub = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (localStorage.getItem("sb_pw_reset") === "1" && session) {
        navigate("/settings");
      }
    });

    // Poll briefly as a fallback in case session arrives before listener
    let tries = 0;
    const timer = setInterval(async () => {
      if (stopped) return;
      const done = await maybeRouteToSettings();
      if (done || ++tries > 25) {
        // ~5s
        clearInterval(timer);
      }
    }, 200);

    return () => {
      stopped = true;
      clearInterval(timer);
      sub.data.subscription.unsubscribe();
    };
  }, []);

  // Global auth indicator: keep a lightweight session state
  useEffect(() => {
    let timer: any = setTimeout(() => setAuthChecked(true), 1500);
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      console.log("[App] onAuthStateChange: user?", session?.user?.id || null);
      setAuthEmail(session?.user?.email ?? null);
      setAuthChecked(true);
    });
    // Prefer resilient waitForSession over direct getSession to avoid Safari stalls
    waitForSession({ timeoutMs: 1200 })
      .then((s) => {
        console.log(
          "[App] waitForSession (global): session?",
          !!s,
          "user:",
          s?.user?.id || null
        );
        setAuthEmail(s?.user?.email ?? null);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true))
      .finally(() => clearTimeout(timer));

    // Actively refresh session when returning to app, regaining network, and periodically
    const refresh = async () => {
      try {
        const s = await waitForSession({ timeoutMs: 1200 });
        console.log(
          "[App] refresh: session?",
          !!s,
          "user:",
          s?.user?.id || null
        );
        setAuthEmail(s?.user?.email ?? null);
      } catch {}
    };
    const onVis = async () => {
      if (document.visibilityState === "visible") {
        console.log("[App] visibilitychange: visible -> waitForSession");
        await waitForSession({ timeoutMs: 5000 });
        await refresh();
        try {
          const sess = await waitForSession({ timeoutMs: 1200 });
          console.log(
            "[App] visibilitychange: dispatch sb-auth, session?",
            !!sess
          );
          window.dispatchEvent(
            new CustomEvent("sb-auth", { detail: { session: sess } })
          );
        } catch {}
      }
    };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", refresh);
    // React to explicit auth events (from supabase.ts)
    const onAuth = (e: any) =>
      setAuthEmail(e?.detail?.session?.user?.email ?? null);
    window.addEventListener("sb-auth", onAuth as any);
    const iv = setInterval(refresh, 5 * 60 * 1000);

    return () => {
      try {
        clearTimeout(timer);
      } catch {}
      sub?.data?.subscription?.unsubscribe?.();
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", refresh);
      window.removeEventListener("sb-auth", onAuth as any);
      clearInterval(iv);
    };
  }, []);

  // Supabase sync handles online/visibility internally now
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      const start =
        s.dashboardPrefs?.startPage ||
        (s.dashboardPrefs?.openToLast ? "last" : "dashboard");
      const loc = locationRef.pathname;
      // Only auto-navigate on first load when at root path
      if (loc === "/" || loc === "") {
        if (
          start === "last" &&
          s.dashboardPrefs?.openToLast !== false &&
          s.dashboardPrefs?.lastLocation
        ) {
          navigate("/sessions");
        } else if (start === "sessions") navigate("/sessions");
        else if (start === "measurements") navigate("/measurements");
        else if (start === "dashboard") navigate("/");
      }
    })();
  }, []);

  const Tab = ({ to, label }: { to: string; label: string }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-2xl text-sm whitespace-nowrap ${
          isActive ? "bg-card text-white" : "text-gray-300"
        }`
      }
    >
      {label}
    </NavLink>
  );

  // Hide app shell (nav etc) on /auth route
  const authRoute = locationRef.pathname.startsWith("/auth");
  const [drawerOpen,setDrawerOpen] = useState(false);
  return (
    <SnackProvider>
      <div className="min-h-screen flex flex-col relative pb-12 md:pb-0" id="app-shell">
      {!authRoute && <BackgroundFX />}
      {/* ECG background (behind everything); toggled via body data attribute & settings */}
      {!authRoute && <ECGBackground />}
      {!authRoute && (
        <header className="sticky top-0 z-20 backdrop-blur bg-bg/70 border-b border-white/5">
          <div className="max-w-4xl mx-auto px-3 py-2 flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button className="md:hidden px-2 py-1 rounded-lg bg-slate-800 border border-white/10" aria-label="Open navigation" onClick={()=> setDrawerOpen(true)}>☰</button>
              <h1 className="hidden md:block text-base sm:text-lg font-semibold shrink-0">LiftLog</h1>
              <nav className="hidden md:flex gap-2 overflow-x-auto no-scrollbar flex-1">
                <Tab to="/" label="Dashboard" />
                <Tab to="/sessions" label="Sessions" />
                <Tab to="/measurements" label="Measurements" />
                <Tab to="/settings/program" label="Program" />
                <Tab to="/templates" label="Templates" />
                <Tab to="/store" label="Store" />
                <Tab to="/settings" label="Settings" />
              </nav>
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
                {!authChecked ? (
                  <span className="text-xs text-gray-400">…</span>
                ) : authEmail ? null : (
                  <button
                    className="btn-outline px-2 py-1 rounded-lg text-xs"
                    onClick={() => setAuthOpen(true)}
                  >
                    Sign in
                  </button>
                )}
            </div>
          </div>
        </header>
      )}
  {!authRoute && (
        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onSignedIn={() => {
            setAuthOpen(false);
            setToast("Signed in");
            setBigFlash("Signed in successfully");
          }}
        />
      )}
      {!authRoute && (
        <BigFlash
          open={!!bigFlash}
          message={bigFlash || ""}
          onClose={() => setBigFlash(null)}
        />
      )}
      {!authRoute && toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2 shadow-soft text-sm">
            {toast}
            <button
              className="ml-3 text-xs underline"
              onClick={() => setToast(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
  <main className="flex-1 w-full px-0 py-0">
        <Suspense fallback={<div className="p-6">Loading…</div>}>
          <Routes>
            <Route path="/auth" element={<IntroAuthPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/sessions"
              element={
                <RequireAuth>
                  <Sessions />
                </RequireAuth>
              }
            />
            <Route
              path="/measurements"
              element={
                <RequireAuth>
                  <Measurements />
                </RequireAuth>
              }
            />
            <Route
              path="/templates"
              element={
                <RequireAuth>
                  <Templates />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route
              path="/settings/program"
              element={
                <RequireAuth>
                  <ProgramSettings />
                </RequireAuth>
              }
            />
            <Route
              path="/store"
              element={
                <RequireAuth>
                  <Store />
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
      </main>
      {!authRoute && <MobileTabs />}
      <NavDrawer open={drawerOpen} onClose={()=> setDrawerOpen(false)} authEmail={authEmail} onSignOut={async()=>{ if(signingOut) return; setSigningOut(true); try { await supabase.auth.signOut({scope:'global'} as any); } finally { clearAuthStorage(); setAuthEmail(null); setSigningOut(false); setDrawerOpen(false); } }} />
      </div>
    </SnackProvider>
  );
}

export default function App() {
  const locationRef = useLocation();
  return (
    <LegacyThemeProvider>
      <VarsThemeProvider>
        <ProgramProvider>
          <Shell />
        </ProgramProvider>
      </VarsThemeProvider>
    </LegacyThemeProvider>
  );
}
