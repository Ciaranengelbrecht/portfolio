import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { getSettings, setSettings } from "./lib/helpers";
import { seedExercises } from "./lib/seedExercises";
import { initSupabaseSync } from "./lib/supabaseSync";
import { getFirstRunStatus } from "./lib/onboarding";
import { ThemeProvider as LegacyThemeProvider } from "./lib/theme";
import { ThemeProvider as VarsThemeProvider } from "./theme/ThemeProvider";
import { ProgramProvider, useProgram } from "./state/program";
import "./styles/theme.css";
import { registerSW } from "./lib/pwa";
import { preloadRoute } from "./lib/routePreload";
import {
  supabase,
  clearAuthStorage,
  waitForSession,
} from "./lib/supabase";
import AuthModal from "./components/AuthModal";
import NavDrawer from "./components/NavDrawer";
import MobileTabs from "./components/MobileTabs";
import BackgroundFX from "./components/BackgroundFX";
import BigFlash from "./components/BigFlash";
import ECGBackground from "./components/ECGBackground";
import ErrorBoundary from "./components/ErrorBoundary";
import { SmartSuspenseFallback } from "./components/SmartSuspenseFallback";
import { SnackProvider } from "./state/snackbar";
import {
  AppBootstrapError,
  AppBootstrapScreen,
} from "./components/AppBootstrapScreen";
import { BootstrapProvider, useBootstrap } from "./state/bootstrap";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard"));
const Analytics = lazy(() => import("./features/analytics/Analytics"));
const Sessions = lazy(() => import("./pages/Sessions"));
const Measurements = lazy(() => import("./pages/Measurements"));
const Templates = lazy(() => import("./pages/Templates"));
const Settings = lazy(() => import("./pages/Settings"));
const Recovery = lazy(() => import("./pages/Recovery"));
const IntroAuthPage = lazy(() => import("./pages/auth/IntroAuthPage"));
const ProgramSettings = lazy(() => import("./pages/ProgramSettings"));
const FirstRunExperience = lazy(
  () => import("./features/onboarding/FirstRunExperience")
);
import RequireAuth from "./routes/guards/RequireAuth";
import { migrateToV6 } from "./lib/migrations/v6_program";
import { migrateToV7 } from "./lib/migrations/v7_exercise_muscles";
import { migrateToV8_LocalDate } from "./lib/migrations/v8_sessions_localdate";
import { migrateToV9_BlankZeros } from "./lib/migrations/v9_blank_zeros";

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<SmartSuspenseFallback />}>{children}</Suspense>;
}

function Shell() {
  const boot = useBootstrap();
  const program = useProgram();
  const navigate = useNavigate();
  const locationRef = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [bigFlash, setBigFlash] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionDuration, setSessionDuration] = useState<string | null>(null);
  const [firstRunStatus, setFirstRunStatus] = useState<{
    checked: boolean;
    shouldShow: boolean;
  }>({ checked: false, shouldShow: false });
  const didApplyStartPage = useRef(false);
  // Hide app shell (nav etc) on /auth route
  const authRoute = locationRef.pathname.startsWith("/auth");
  const onboardingRoute = locationRef.pathname.startsWith("/welcome");
  const hideChrome = authRoute || onboardingRoute;
  useEffect(() => {
    if (!bigFlash) return;
    const t = setTimeout(() => setBigFlash(null), 1800);
    return () => clearTimeout(t);
  }, [bigFlash]);
  // dark class is managed by new ThemeProvider
  useEffect(() => {
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const start = () => registerSW();

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = (window as any).requestIdleCallback(start, {
        timeout: 2500,
      });
    } else {
      timeoutHandle = setTimeout(start, 1200);
    }

    return () => {
      if (
        idleHandle != null &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }
    };
  }, []);
  useEffect(() => {
    const email = boot.session?.user?.email || null;
    setAuthEmail(email);
    setAuthChecked(boot.status !== "booting");
  }, [boot.session?.user?.email, boot.status]);

  useEffect(() => {
    let cancelled = false;

    if (boot.status !== "ready" || !boot.authed || program.loading || !!program.error) {
      setFirstRunStatus({ checked: false, shouldShow: false });
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const status = await getFirstRunStatus(program.program);
        if (cancelled) return;
        setFirstRunStatus({ checked: true, shouldShow: status.shouldShowFirstRun });
        if (status.shouldShowFirstRun && !onboardingRoute) {
          navigate("/welcome", { replace: true });
        } else if (!status.shouldShowFirstRun && onboardingRoute) {
          navigate("/", { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[App] first-run status check failed", err);
        setFirstRunStatus({ checked: true, shouldShow: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    boot.status,
    boot.authed,
    program.loading,
    program.error,
    program.program?.id,
    onboardingRoute,
    navigate,
  ]);

  // Seed global exercise catalogue once per device (idempotent if already present)
  useEffect(() => {
    if (boot.status !== "ready" || !boot.authed) return;
    seedExercises().catch(() => {});
  }, [boot.status, boot.authed]);
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      // card style is still respected; theme variables are applied by ThemeProvider
      const root = document.documentElement;
      if (s.cardStyle) root.setAttribute("data-card-style", s.cardStyle);
      if (s.reducedMotion) root.setAttribute("data-reduced-motion", "true");
      // ECG background settings
      if (s.ecg?.enabled) {
        document.body.dataset.ecg = "on";
        const intensity = s.ecg.intensity || "low";
        const map: Record<
          string,
          { opacity: string; speed: string; strokeWidth: string; dash: string }
        > = {
          low: {
            opacity: "0.15",
            speed: "46s",
            strokeWidth: "1.6",
            dash: "5 7",
          },
          med: { opacity: "0.25", speed: "34s", strokeWidth: "2", dash: "5 5" },
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
        root.style.setProperty("--ecg-stroke-w", cfg.strokeWidth);
        root.style.setProperty("--ecg-dash", cfg.dash);
        if (s.ecg.speedMs) {
          root.style.setProperty(
            "--ecg-custom-speed-ms",
            String(s.ecg.speedMs)
          );
        }
        if (s.ecg.trailMs) {
          root.style.setProperty("--ecg-trail-ms", String(s.ecg.trailMs));
        }
        if (s.ecg.color) {
          root.style.setProperty("--ecg-custom-color", s.ecg.color);
        }
      } else document.body.dataset.ecg = "off";
      // Theme mode handling: app is dark-only
      const applyThemeMode = () => {
        document.body.dataset.theme = "dark";
        try {
          document.documentElement.setAttribute("data-theme", "dark");
          document.documentElement.style.colorScheme = "dark";
        } catch {}
      };
      if (!s.ui?.instantThemeTransition) {
        document.body.classList.add("theme-animate");
        setTimeout(() => document.body.classList.remove("theme-animate"), 600);
      }
      applyThemeMode();
      // Compact mode
      if (s.ui?.compactMode) document.body.dataset.density = "compact";
      else delete document.body.dataset.density;
    })();
  }, []);
  // Initialize Supabase sync (pull, push queue, realtime)
  useEffect(() => {
    try {
      // If user previously disabled realtime via legacy flag, auto re-enable now per updated requirement
      if (localStorage.getItem("disableRealtime") === "1") {
        localStorage.removeItem("disableRealtime");
        console.log(
          "[Realtime] legacy disable flag cleared; realtime re-enabled"
        );
      }
      if ((window as any).__DISABLE_REALTIME) {
        console.log(
          "[Realtime] hard-disabled via global window.__DISABLE_REALTIME"
        );
        return;
      }
    } catch {}
    initSupabaseSync();
  }, []);

  // Lightweight remote migrations (idempotent via localStorage flags)
  useEffect(() => {
    if (boot.status !== "ready" || !boot.authed) return;
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        await waitForSession({ timeoutMs: 2500 });
        if (cancelled) return;
        if (localStorage.getItem("mig_v6") !== "1") {
          await migrateToV6();
          if (cancelled) return;
          localStorage.setItem("mig_v6", "1");
        }
        if (localStorage.getItem("mig_v7") !== "1") {
          await migrateToV7();
          if (cancelled) return;
          localStorage.setItem("mig_v7", "1");
        }
        if (localStorage.getItem("mig_v8_localDate") !== "1") {
          await migrateToV8_LocalDate();
          if (cancelled) return;
          localStorage.setItem("mig_v8_localDate", "1");
        }
        if (localStorage.getItem("mig_v9_blankZeros") !== "1") {
          await migrateToV9_BlankZeros();
          if (cancelled) return;
          localStorage.setItem("mig_v9_blankZeros", "1");
        }
      } catch (e) {
        console.warn("[App] migration runner error", e);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = (window as any).requestIdleCallback(() => {
        void run();
      }, { timeout: 3500 });
    } else {
      timeoutHandle = setTimeout(() => {
        void run();
      }, 1500);
    }

    return () => {
      cancelled = true;
      if (
        idleHandle != null &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [boot.status, boot.authed]);

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

  // Supabase sync handles online/visibility internally now
  useEffect(() => {
    if (didApplyStartPage.current) return;
    if (boot.status !== "ready" || !boot.authed) return;
    if (!firstRunStatus.checked || firstRunStatus.shouldShow) return;
    didApplyStartPage.current = true;

    (async () => {
      const s = await getSettings();
      const start =
        s.dashboardPrefs?.startPage ||
        (s.dashboardPrefs?.openToLast ? "last" : "dashboard");
      const loc = locationRef.pathname;
      // Only auto-navigate on first load when at root path
      if (loc === "/" || loc === "") {
        if (start === "last" && s.dashboardPrefs?.openToLast !== false) {
          // Always open Sessions for "Last Session" start page.
          // Do not mark this as an explicit navigation intent: Sessions should
          // still validate any stored location and fall back to the latest
          // real training data when the stored target is stale.
          navigate("/sessions");
        } else if (start === "sessions") navigate("/sessions");
        else if (start === "measurements") navigate("/measurements");
        else if (start === "dashboard") navigate("/");
      }
    })();
  }, [
    boot.status,
    boot.authed,
    firstRunStatus.checked,
    firstRunStatus.shouldShow,
    locationRef.pathname,
    navigate,
  ]);

  const Tab = ({ to, label }: { to: string; label: string }) => (
    <NavLink
      to={to}
      onMouseEnter={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}
      onTouchStart={() => preloadRoute(to)}
      className={({ isActive }) =>
        `shrink-0 px-3 py-2 rounded-2xl text-sm whitespace-nowrap ${
          isActive ? "bg-card text-white" : "text-gray-300"
        }`
      }
    >
      {label}
    </NavLink>
  );

  // Session duration from Sessions page (broadcast via custom event)
  useEffect(() => {
    const handler = (e: CustomEvent<{ duration: string | null }>) => {
      setSessionDuration(e.detail.duration);
    };
    window.addEventListener('sessions-duration-update', handler as EventListener);
    return () => window.removeEventListener('sessions-duration-update', handler as EventListener);
  }, []);

  if (boot.status === "booting") {
    return <AppBootstrapScreen phase={boot.phase} />;
  }

  if (boot.status === "error") {
    return (
      <AppBootstrapError
        message={boot.error || "Unable to initialize app"}
        onRetry={boot.retry}
      />
    );
  }

  if (boot.authed && program.loading) {
    return <AppBootstrapScreen phase="program" />;
  }

  if (boot.authed && program.error) {
    return <AppBootstrapError message={program.error} onRetry={boot.retry} />;
  }

  return (
    <SnackProvider>
      <div
        className="min-h-screen flex flex-col relative pb-12 md:pb-0"
        id="app-shell"
      >
        {!hideChrome && <BackgroundFX />}
        {/* ECG background (behind everything); toggled via body data attribute & settings */}
        {!hideChrome && <ECGBackground />}
        {!hideChrome && (
          <header className="fixed top-0 left-0 right-0 z-40 backdrop-blur bg-bg/70 border-b border-white/5">
            <div className="max-w-4xl mx-auto px-3 py-2 flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="md:hidden flex items-center gap-1">
                  <button
                    className="px-2 py-1 rounded-lg bg-slate-800 border border-white/10"
                    aria-label="Open navigation"
                    onClick={() => setDrawerOpen(true)}
                  >
                    ☰
                  </button>
                  {/* Quick scroll jump (Sessions only) */}
                  {locationRef.pathname === "/sessions" && (
                    <div className="flex items-center gap-1">
                      <button
                        className="px-2 py-1 rounded-lg bg-slate-800 border border-white/10 text-[11px] leading-none"
                        aria-label="Jump to top"
                        title="Top"
                        onClick={() => {
                          try {
                            const el = document.getElementById(
                              "sessions-top-anchor"
                            );
                            if (el)
                              el.scrollIntoView({
                                block: "start",
                                behavior: "auto",
                              });
                            // Nudge to absolute top to avoid any residual wiggle
                            window.scrollTo({ top: 0, behavior: "auto" });
                          } catch {
                            window.scrollTo(0, 0);
                          }
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="px-2 py-1 rounded-lg bg-slate-800 border border-white/10 text-[11px] leading-none"
                        aria-label="Jump to bottom"
                        title="Bottom"
                        onClick={() => {
                          try {
                            const el = document.getElementById(
                              "sessions-bottom-anchor"
                            );
                            if (el)
                              el.scrollIntoView({
                                block: "end",
                                behavior: "auto",
                              });
                            const doc = document.documentElement;
                            const max = Math.max(
                              0,
                              (doc.scrollHeight || 0) - window.innerHeight
                            );
                            window.scrollTo({ top: max, behavior: "auto" });
                          } catch {
                            window.scrollTo(0, 1e9);
                          }
                        }}
                      >
                        ↓
                      </button>
                      <button
                        className="px-2 py-1 rounded-lg bg-slate-800 border border-white/10 text-[11px] leading-none"
                        aria-label="Collapse all exercises"
                        title="Collapse all"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('sessions-collapse-all'));
                        }}
                      >
                        ⊟
                      </button>
                      {/* Session duration in fixed header */}
                      {sessionDuration && (
                        <span
                          className="px-2 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-[11px] leading-none text-indigo-200 font-semibold tabular-nums"
                          title="Session duration"
                        >
                          ⏱ {sessionDuration}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <h1 className="hidden md:block text-base sm:text-lg font-semibold shrink-0">
                  LiftLog
                </h1>
                <nav className="hidden md:flex gap-2 overflow-x-auto no-scrollbar flex-1 pr-1">
                  <Tab to="/" label="Dashboard" />
                  <Tab to="/sessions" label="Sessions" />
                  <Tab to="/measurements" label="Measurements" />
                  <Tab to="/settings/program" label="Program" />
                  <Tab to="/templates" label="Templates" />
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
        {/* Spacer to account for fixed header height across all pages (non-auth) */}
        {!hideChrome && (
          <div style={{ height: "var(--app-header-h)" }} aria-hidden="true" />
        )}
        {!hideChrome && (
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
        {!hideChrome && (
          <BigFlash
            open={!!bigFlash}
            message={bigFlash || ""}
            onClose={() => setBigFlash(null)}
          />
        )}
        {!hideChrome && toast && (
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
          <ErrorBoundary>
            <Routes>
              <Route
                path="/auth/*"
                element={
                  <RouteSuspense>
                    <IntroAuthPage />
                  </RouteSuspense>
                }
              />
              <Route
                path="/welcome"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <FirstRunExperience />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Dashboard />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/analytics"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Analytics />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/sessions"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Sessions />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/recovery"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Recovery />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/measurements"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Measurements />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/templates"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Templates />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Settings />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/settings/program"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <ProgramSettings />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="*"
                element={<Navigate to={boot.authed ? "/" : "/auth"} replace />}
              />
            </Routes>
          </ErrorBoundary>
        </main>
        {!hideChrome && <MobileTabs />}
        <NavDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          authEmail={authEmail}
          onSignOut={async () => {
            if (signingOut) return;
            setSigningOut(true);
            try {
              await supabase.auth.signOut({ scope: "global" } as any);
            } finally {
              clearAuthStorage();
              setAuthEmail(null);
              setSigningOut(false);
              setDrawerOpen(false);
            }
          }}
        />
      </div>
    </SnackProvider>
  );
}

export default function App() {
  return (
    <LegacyThemeProvider>
      <VarsThemeProvider>
        <BootstrapProvider>
          <ProgramProvider>
            <Shell />
          </ProgramProvider>
        </BootstrapProvider>
      </VarsThemeProvider>
    </LegacyThemeProvider>
  );
}
