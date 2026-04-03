import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GuidedSetupWizard from "../guided-setup/GuidedSetupWizard";
import { db } from "../../lib/db";
import { getSettings, setSettings } from "../../lib/helpers";
import type { Exercise, Settings } from "../../lib/types";
import { createQuickStarterState } from "../../lib/onboarding";
import { buildGuidedSetupPlan } from "../../lib/guidedSetup";
import { applyGuidedSetupPlan } from "../../lib/guidedSetupApply";
import { useProgram } from "../../state/program";
import { useSnack } from "../../state/snackbar";

export default function FirstRunExperience() {
  const navigate = useNavigate();
  const { setProgram } = useProgram();
  const { push } = useSnack();

  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardMode, setWizardMode] = useState<"quick" | "advanced" | null>(
    null
  );
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [creatingStarter, setCreatingStarter] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const [settings, allExercises] = await Promise.all([
        getSettings(),
        db.getAll<Exercise>("exercises"),
      ]);
      if (!mounted) return;
      setSettingsState(settings);
      setExercises(allExercises);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const hasExerciseCatalog = exercises.length > 0;

  const statusCopy = useMemo(() => {
    if (loading) return "Preparing your starter experience...";
    if (!hasExerciseCatalog)
      return "Exercise catalog is still loading. You can still start setup.";
    return "Choose a path to get training quickly without overwhelm.";
  }, [hasExerciseCatalog, loading]);

  const markSkipped = async () => {
    const settings = settingsState || (await getSettings());
    const now = new Date().toISOString();
    const nextSettings: Settings = {
      ...settings,
      progress: {
        ...(settings.progress || {}),
        guidedSetup: {
          ...(settings.progress?.guidedSetup || {}),
          completed: false,
          skipped: true,
          starterCreated: false,
          lastUpdatedAt: now,
        },
      },
    };
    await setSettings(nextSettings);
    setSettingsState(nextSettings);
    push({ message: "You can start setup anytime from Dashboard." });
    navigate("/", { replace: true });
  };

  const createStarterPlan = async () => {
    if (!settingsState || !hasExerciseCatalog) return;
    setCreatingStarter(true);
    try {
      const starterState = createQuickStarterState();
      const plan = buildGuidedSetupPlan(starterState, exercises);
      const result = await applyGuidedSetupPlan({
        plan,
        settings: settingsState,
        exercises,
        meta: {
          completed: true,
          skipped: false,
          starterCreated: true,
          mode: "quick",
          lastCompletedStep: 0,
          clearDraft: true,
        },
      });
      setProgram(result.program);
      setSettingsState(result.settings);
      push({ message: "Starter plan created. You are ready to train." });
      navigate("/sessions", { replace: true });
    } catch (err) {
      console.error("[first-run] starter creation failed", err);
      push({ message: "Could not create starter plan. Try guided setup." });
    } finally {
      setCreatingStarter(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(56,189,248,0.12),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.10),transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_-45px_rgba(20,184,166,0.6)] backdrop-blur-xl sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-300/80">
            First run
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Start lifting, fast.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
            {statusCopy}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-2xl border border-emerald-300/35 bg-emerald-400/15 px-5 py-4 text-left transition hover:border-emerald-200/55 hover:bg-emerald-300/20"
              onClick={() => setWizardMode("quick")}
              disabled={loading || creatingStarter}
            >
              <div className="text-sm font-semibold text-white">Quick setup</div>
              <div className="mt-1 text-xs text-white/65">
                Minimal questions and a clean starter split in minutes.
              </div>
            </button>
            <button
              type="button"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-left transition hover:border-white/35 hover:bg-white/10"
              onClick={() => setWizardMode("advanced")}
              disabled={loading || creatingStarter}
            >
              <div className="text-sm font-semibold text-white">Advanced setup</div>
              <div className="mt-1 text-xs text-white/65">
                Full control over priorities, volume, and schedule details.
              </div>
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:border-white/35 hover:bg-white/10"
              onClick={() => setConfirmSkip((prev) => !prev)}
              disabled={loading || creatingStarter}
            >
              Skip for now
            </button>
            <span className="text-xs text-white/45">
              No lock-in. You can re-run setup anytime.
            </span>
          </div>

          {confirmSkip && (
            <div className="mt-5 rounded-2xl border border-white/12 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-white">
                Want a one-click starter plan before skipping?
              </p>
              <p className="mt-1 text-xs text-white/60">
                This creates a safe beginner-friendly program immediately. You can
                edit everything later.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
                  disabled={loading || creatingStarter || !hasExerciseCatalog}
                  onClick={createStarterPlan}
                >
                  {creatingStarter ? "Creating starter..." : "Create starter plan"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 hover:border-white/35 hover:bg-white/10"
                  disabled={loading || creatingStarter}
                  onClick={markSkipped}
                >
                  Continue without setup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {wizardMode && (
        <GuidedSetupWizard
          open={true}
          mode={wizardMode}
          onClose={() => setWizardMode(null)}
          onComplete={() => {
            push({ message: "Program ready. Start your first session." });
            navigate("/sessions", { replace: true });
          }}
        />
      )}
    </div>
  );
}
