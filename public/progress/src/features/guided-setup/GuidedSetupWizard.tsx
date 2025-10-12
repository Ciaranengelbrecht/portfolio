import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { db } from "../../lib/db";
import { getSettings, setSettings } from "../../lib/helpers";
import {
  EquipmentAccessLevel,
  Exercise,
  GuidedSetupScheduleDay,
  GuidedSetupState,
  GuidedTemplateDraft,
  MuscleGroup,
  Session,
  SessionEntry,
  SetEntry,
  Settings,
  Template,
  TrainingExperienceLevel,
  TrainingGoalEmphasis,
  UserProgram,
  VolumePreferenceLevel,
} from "../../lib/types";
import {
  buildGuidedSetupPlan,
  GuidedSetupPlanResult,
} from "../../lib/guidedSetup";
import { useSnack } from "../../state/snackbar";
import { archiveCurrentProgram, saveProfileProgram } from "../../lib/profile";
import { useProgram } from "../../state/program";
import { nanoid } from "nanoid";

const STEP_TITLES = [
  "Welcome",
  "Your background",
  "Schedule",
  "Focus areas",
  "Volume & effort",
  "Review",
];

const DEFAULT_STATE: GuidedSetupState = {
  experience: "intermediate",
  equipment: "commercial-gym",
  goalEmphasis: "balanced",
  daysPerWeek: 4,
  preferredRestDays: [6],
  setsPerSession: 12,
  volumePreference: "standard",
  priorityMuscles: {
    primary: [],
    secondary: [],
    maintenance: [],
  },
};

const DAY_OPTIONS = [
  { idx: 0, label: "Mon" },
  { idx: 1, label: "Tue" },
  { idx: 2, label: "Wed" },
  { idx: 3, label: "Thu" },
  { idx: 4, label: "Fri" },
  { idx: 5, label: "Sat" },
  { idx: 6, label: "Sun" },
];

const EXPERIENCE_OPTIONS: {
  value: TrainingExperienceLevel;
  label: string;
  desc: string;
}[] = [
  {
    value: "beginner",
    label: "Beginner",
    desc: "< 1 year lifting or returning after long break",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    desc: "1-3 years consistent training",
  },
  {
    value: "advanced",
    label: "Advanced",
    desc: "> 3 years, comfortable pushing high volume",
  },
];

const EQUIPMENT_OPTIONS: {
  value: EquipmentAccessLevel;
  label: string;
  desc: string;
}[] = [
  {
    value: "commercial-gym",
    label: "Commercial gym",
    desc: "Full access to machines and free weights",
  },
  {
    value: "home-gym",
    label: "Home gym",
    desc: "Barbell/dumbbells with rack or cable",
  },
  {
    value: "minimal",
    label: "Minimal equipment",
    desc: "Bands, bodyweight, light dumbbells",
  },
];

const GOAL_OPTIONS: {
  value: TrainingGoalEmphasis;
  label: string;
  desc: string;
}[] = [
  {
    value: "hypertrophy",
    label: "Muscle growth",
    desc: "Higher reps, pump-driven sessions",
  },
  {
    value: "balanced",
    label: "Balanced",
    desc: "Blend of strength and hypertrophy",
  },
  {
    value: "strength",
    label: "Strength",
    desc: "Lower reps, heavier compounds",
  },
];

const MUSCLE_OPTIONS: { value: MuscleGroup; label: string }[] = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "triceps", label: "Triceps" },
  { value: "biceps", label: "Biceps" },
  { value: "forearms", label: "Forearms" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "glutes", label: "Glutes" },
  { value: "calves", label: "Calves" },
  { value: "core", label: "Core" },
];

const VOLUME_OPTIONS: {
  value: VolumePreferenceLevel;
  label: string;
  desc: string;
}[] = [
  {
    value: "lower",
    label: "Lower",
    desc: "Prefer shorter sessions (8-10 sets)",
  },
  {
    value: "standard",
    label: "Standard",
    desc: "Comfortable with 10-14 sets per session",
  },
  {
    value: "higher",
    label: "Higher",
    desc: "Enjoy higher workloads (14-18 sets)",
  },
];

interface GuidedSetupWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function GuidedSetupWizard({
  open,
  onClose,
  onComplete,
}: GuidedSetupWizardProps) {
  const { push } = useSnack();
  const { program, setProgram } = useProgram();
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [state, setState] = useState<GuidedSetupState>(DEFAULT_STATE);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [planPreview, setPlanPreview] = useState<GuidedSetupPlanResult | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Load settings/exercises when opened
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      const [s, ex] = await Promise.all([
        getSettings(),
        db.getAll<Exercise>("exercises"),
      ]);
      if (!mounted) return;
      setSettingsState(s);
      const draft = s.progress?.guidedSetup?.draft;
      const mergedState: GuidedSetupState = {
        ...DEFAULT_STATE,
        ...(draft || {}),
      };
      setState(mergedState);
      if (typeof s.progress?.guidedSetup?.lastCompletedStep === "number") {
        setActiveStep(
          Math.min(
            STEP_TITLES.length - 1,
            s.progress?.guidedSetup?.lastCompletedStep || 0
          )
        );
      } else {
        setActiveStep(0);
      }
      setExercises(ex);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  // Persist draft progress (debounced)
  useEffect(() => {
    if (!open || !settings) return;
    const handle = setTimeout(async () => {
      const nextGuided = {
        ...(settings.progress?.guidedSetup || {}),
        draft: state,
        lastCompletedStep: Math.max(
          settings.progress?.guidedSetup?.lastCompletedStep ?? 0,
          activeStep
        ),
        lastUpdatedAt: new Date().toISOString(),
        completed: settings.progress?.guidedSetup?.completed ?? false,
      };
      const nextSettings: Settings = {
        ...settings,
        progress: {
          ...(settings.progress || {}),
          guidedSetup: nextGuided,
        },
      };
      setSettingsState(nextSettings);
      await setSettings(nextSettings);
    }, 600);
    return () => clearTimeout(handle);
  }, [open, state, activeStep]);

  // Generate preview when inputs change and exercises are loaded
  useEffect(() => {
    if (!open || !exercises.length) return;
    try {
      const nextPlan = buildGuidedSetupPlan(state, exercises);
      setPlanPreview(nextPlan);
    } catch (e) {
      console.warn("[guided-setup] preview generation failed", e);
    }
  }, [open, state, exercises]);

  const stepComplete = useMemo(() => {
    return [
      true,
      Boolean(state.experience && state.equipment && state.goalEmphasis),
      Boolean(state.daysPerWeek && state.daysPerWeek >= 3),
      Boolean(state.priorityMuscles?.primary?.length),
      Boolean(state.setsPerSession && state.volumePreference),
      Boolean(planPreview),
    ];
  }, [state, planPreview]);

  const canGoNext = stepComplete[activeStep];
  const atEnd = activeStep === STEP_TITLES.length - 1;

  if (!open) return null;

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const goNext = () => {
    if (!canGoNext) return;
    setActiveStep((s) => Math.min(STEP_TITLES.length - 1, s + 1));
  };
  const goBack = () => {
    setActiveStep((s) => Math.max(0, s - 1));
  };

  const updateState = (patch: Partial<GuidedSetupState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const updatePriority = (
    key: "primary" | "secondary" | "maintenance",
    value: MuscleGroup[]
  ) => {
    setState((prev) => ({
      ...prev,
      priorityMuscles: {
        primary:
          key === "primary" ? value : prev.priorityMuscles?.primary || [],
        secondary:
          key === "secondary" ? value : prev.priorityMuscles?.secondary || [],
        maintenance:
          key === "maintenance"
            ? value
            : prev.priorityMuscles?.maintenance || [],
      },
    }));
  };

  const toggleRestDay = (idx: number) => {
    const current = new Set(state.preferredRestDays || []);
    if (current.has(idx)) current.delete(idx);
    else current.add(idx);
    updateState({
      preferredRestDays: Array.from(current).sort((a, b) => a - b),
    });
  };

  const handleFinish = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const plan = buildGuidedSetupPlan(state, exercises);
      const templatesToSave = await prepareTemplates(plan.templates);
      await Promise.all(
        templatesToSave.map((template) => db.put("templates", template))
      );
      const schedule = plan.schedule;
      const templateByScheduleId = new Map<string, GuidedTemplateDraft>();
      const templateByIndex = new Map<number, GuidedTemplateDraft>();
      plan.templates.forEach((draft) => {
        if (draft.scheduleDayId) {
          templateByScheduleId.set(draft.scheduleDayId, draft);
        }
        if (typeof draft.scheduleIndex === "number") {
          templateByIndex.set(draft.scheduleIndex, draft);
        }
      });
      const weeklySplitWithTemplates = plan.program.weeklySplit.map(
        (day, idx) => {
          const scheduleDay = schedule[idx];
          if (!scheduleDay) return { ...day };
          const draft =
            (scheduleDay.id && templateByScheduleId.get(scheduleDay.id)) ||
            templateByIndex.get(idx);
          return {
            ...day,
            customLabel: scheduleDay.label || day.customLabel,
            templateId:
              scheduleDay.type !== "Rest" && draft ? draft.id : undefined,
          };
        }
      );
      const programToSave: UserProgram = {
        ...plan.program,
        weekLengthDays: schedule.length,
        weeklySplit: weeklySplitWithTemplates,
        updatedAt: now,
      };
      const trainingDayCount = weeklySplitWithTemplates.filter(
        (d) => d.type !== "Rest"
      ).length;
      const nextSettings: Settings = {
        ...settings,
        volumeTargets: {
          ...(settings.volumeTargets || {}),
          ...plan.volumeTargets,
        },
        progress: {
          ...(settings.progress || {}),
          weeklyTargetDays: trainingDayCount,
          guidedSetup: {
            completed: true,
            lastCompletedStep: STEP_TITLES.length - 1,
            lastUpdatedAt: now,
            draft: undefined,
          },
        },
      };
      await populateGuidedSessions({
        program: programToSave,
        schedule,
        templates: templatesToSave,
        exercises,
        settings: nextSettings,
      });
      const result = await archiveCurrentProgram(programToSave);
      if (!result) {
        await saveProfileProgram(programToSave);
      }
      setProgram(programToSave);
      await setSettings(nextSettings);
      setSettingsState(nextSettings);
      push({
        message: "Guided program created and saved!",
      });
      onComplete?.();
      onClose();
    } catch (e) {
      console.error("[guided-setup] finish failed", e);
      push({
        message: "Something went wrong saving the guided setup.",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentPlan = planPreview;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur"
        onClick={handleClose}
      />
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-2xl">
        <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-300/80">
              Guided setup
            </p>
            <h2 className="text-xl font-semibold text-white">
              {STEP_TITLES[activeStep]}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/70 hover:text-white"
            disabled={saving}
          >
            Close
          </button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden border-r border-white/10 bg-slate-950/40 px-4 py-6 md:block">
            <ol className="space-y-3 text-sm text-white/60">
              {STEP_TITLES.map((title, idx) => (
                <li key={title} className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                      idx === activeStep
                        ? "bg-emerald-500 text-slate-950"
                        : stepComplete[idx]
                        ? "bg-emerald-500/30 text-emerald-200"
                        : "bg-white/5 text-white/40"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={clsx(
                      idx === activeStep && "text-white",
                      !stepComplete[idx] && "text-white/40"
                    )}
                  >
                    {title}
                  </span>
                </li>
              ))}
            </ol>
          </aside>
          <main className="max-h-[70vh] overflow-y-auto px-6 py-6">
            {loading ? (
              <div className="flex h-56 items-center justify-center text-sm text-white/60">
                Loading guided setup…
              </div>
            ) : (
              <StepContent
                step={activeStep}
                state={state}
                plan={currentPlan}
                exercises={exercises}
                onStateChange={updateState}
                onPriorityChange={updatePriority}
                onToggleRestDay={toggleRestDay}
              />
            )}
          </main>
        </div>
        <footer className="border-t border-white/10 bg-slate-950/60 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/50">
            Step {activeStep + 1} of {STEP_TITLES.length}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={goBack}
              disabled={activeStep === 0 || saving}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-white/30 disabled:opacity-50"
            >
              Back
            </button>
            {atEnd ? (
              <button
                onClick={handleFinish}
                disabled={!canGoNext || saving}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Create my program"}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canGoNext || saving}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                Next
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

interface StepContentProps {
  step: number;
  state: GuidedSetupState;
  plan: GuidedSetupPlanResult | null;
  exercises: Exercise[];
  onStateChange: (patch: Partial<GuidedSetupState>) => void;
  onPriorityChange: (
    key: "primary" | "secondary" | "maintenance",
    value: MuscleGroup[]
  ) => void;
  onToggleRestDay: (idx: number) => void;
}

function StepContent({
  step,
  state,
  plan,
  exercises,
  onStateChange,
  onPriorityChange,
  onToggleRestDay,
}: StepContentProps) {
  switch (step) {
    case 0:
      return <WelcomeStep exercises={exercises.length} />;
    case 1:
      return <BackgroundStep state={state} onStateChange={onStateChange} />;
    case 2:
      return (
        <ScheduleStep
          state={state}
          onChange={onStateChange}
          onToggleRestDay={onToggleRestDay}
        />
      );
    case 3:
      return <FocusStep state={state} onPriorityChange={onPriorityChange} />;
    case 4:
      return <VolumeStep state={state} onChange={onStateChange} />;
    case 5:
      return <ReviewStep plan={plan} exercises={exercises} />;
    default:
      return null;
  }
}

function WelcomeStep({ exercises }: { exercises: number }) {
  return (
    <div className="space-y-4">
      <p className="text-lg font-medium text-white">
        Let’s build your personalised program.
      </p>
      <p className="text-sm text-white/70">
        We’ll ask about your schedule, goals, and priorities, then craft a
        weekly split, volume targets, and starter templates. You can tweak
        everything later – this is just a guided jump-start.
      </p>
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-white/70">
        <ul className="list-disc space-y-2 pl-5">
          <li>Distribute training days to match your availability.</li>
          <li>Emphasise the muscle groups you want to grow fastest.</li>
          <li>
            Seed your Templates with smart exercise suggestions ({exercises}{" "}
            catalogued).
          </li>
          <li>Save the program to immediately populate future sessions.</li>
        </ul>
      </div>
      <p className="text-xs text-white/40">
        Tip: you can leave and come back at any time – your answers will be
        saved.
      </p>
    </div>
  );
}

function BackgroundStep({
  state,
  onStateChange,
}: {
  state: GuidedSetupState;
  onStateChange: (patch: Partial<GuidedSetupState>) => void;
}) {
  return (
    <div className="space-y-6">
      <GuidanceCard
        title="Why we ask this"
        description="These choices teach the guide how hard to push, what gear to lean on, and which adaptations you prioritise."
        bullets={[
          "Experience influences mesocycle length, deload strategy, and overall volume bias.",
          "Equipment narrows exercise candidates so we only recommend movements you can actually perform.",
          "Goal emphasis skews exercise selection and rep targets toward strength or hypertrophy cues.",
        ]}
      />
      <Section title="Training experience">
        <OptionGrid>
          {EXPERIENCE_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              active={state.experience === opt.value}
              onClick={() => onStateChange({ experience: opt.value })}
              title={opt.label}
              description={opt.desc}
            />
          ))}
        </OptionGrid>
      </Section>
      <Section title="Equipment access">
        <OptionGrid>
          {EQUIPMENT_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              active={state.equipment === opt.value}
              onClick={() => onStateChange({ equipment: opt.value })}
              title={opt.label}
              description={opt.desc}
            />
          ))}
        </OptionGrid>
      </Section>
      <Section title="Goal emphasis">
        <OptionGrid>
          {GOAL_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              active={state.goalEmphasis === opt.value}
              onClick={() => onStateChange({ goalEmphasis: opt.value })}
              title={opt.label}
              description={opt.desc}
            />
          ))}
        </OptionGrid>
      </Section>
    </div>
  );
}

function ScheduleStep({
  state,
  onChange,
  onToggleRestDay,
}: {
  state: GuidedSetupState;
  onChange: (patch: Partial<GuidedSetupState>) => void;
  onToggleRestDay: (idx: number) => void;
}) {
  return (
    <div className="space-y-6">
      <GuidanceCard
        title="Scheduling tips"
        description="We blend your slider choice with preferred rest days to build a seven-day rhythm that actually sticks."
        bullets={[
          "The split starts with tried-and-true patterns (UL, PPL, etc.) and adapts as days change.",
          "Marking rest days locks them in first; any extras are spaced using our recovery defaults.",
          "You can always reshuffle templates later—this sets a confident baseline to iterate on.",
        ]}
      />
      <Section title="How many training days per week?">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <input
            type="range"
            min={3}
            max={7}
            value={state.daysPerWeek ?? 4}
            onChange={(e) => onChange({ daysPerWeek: Number(e.target.value) })}
            className="w-full sm:w-64"
          />
          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white/80">
            <div className="text-xs uppercase tracking-[0.3em] text-white/50">
              Training days
            </div>
            <div className="text-xl font-semibold text-white">
              {state.daysPerWeek ?? 4} days/week
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40">
          The guide fills the remaining days as recovery to keep your week
          balanced.
        </p>
      </Section>
      <Section title="Preferred rest days">
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((day) => {
            const active = state.preferredRestDays?.includes(day.idx);
            return (
              <button
                key={day.idx}
                onClick={() => onToggleRestDay(day.idx)}
                className={clsx(
                  "rounded-xl px-3 py-2 text-sm",
                  active
                    ? "bg-emerald-500/80 text-slate-950"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-white/40">
          Pick the days you prefer to keep free. We’ll honour as many as
          possible based on your chosen schedule.
        </p>
      </Section>
    </div>
  );
}

function FocusStep({
  state,
  onPriorityChange,
}: {
  state: GuidedSetupState;
  onPriorityChange: (
    key: "primary" | "secondary" | "maintenance",
    value: MuscleGroup[]
  ) => void;
}) {
  const toggle = (
    key: "primary" | "secondary" | "maintenance",
    value: MuscleGroup
  ) => {
    const current = new Set(state.priorityMuscles?.[key] || []);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    onPriorityChange(key, Array.from(current));
  };
  const getActive = (key: "primary" | "secondary" | "maintenance") =>
    new Set(state.priorityMuscles?.[key] || []);
  return (
    <div className="space-y-6">
      <GuidanceCard
        title="How priorities work"
        description="We redistribute weekly sets based on these lanes so primaries get more love without neglecting the rest."
        bullets={[
          "Primary muscles receive the highest weighting in each day’s allocation and lead template slots.",
          "Secondary picks stay present with slightly lower volume—perfect for steady progress.",
          "Maintenance choices get enough touch-points to hold gains while freeing sets elsewhere.",
        ]}
      />
      <Section
        title="Primary priorities"
        subtitle="Choose the muscles you most want to develop. Aim for 2-4 choices."
      >
        <TagGrid
          options={MUSCLE_OPTIONS}
          active={getActive("primary")}
          onToggle={(value) => toggle("primary", value as MuscleGroup)}
          accent="emerald"
        />
      </Section>
      <Section
        title="Secondary focus"
        subtitle="Muscles you’d still like to improve. We’ll keep them present without overloading."
      >
        <TagGrid
          options={MUSCLE_OPTIONS}
          active={getActive("secondary")}
          onToggle={(value) => toggle("secondary", value as MuscleGroup)}
          accent="sky"
        />
      </Section>
      <Section
        title="Maintenance"
        subtitle="Areas you’re happy to maintain. Volume will be lower."
      >
        <TagGrid
          options={MUSCLE_OPTIONS}
          active={getActive("maintenance")}
          onToggle={(value) => toggle("maintenance", value as MuscleGroup)}
          accent="slate"
        />
      </Section>
    </div>
  );
}

function VolumeStep({
  state,
  onChange,
}: {
  state: GuidedSetupState;
  onChange: (patch: Partial<GuidedSetupState>) => void;
}) {
  return (
    <div className="space-y-6">
      <GuidanceCard
        title="Volume calibration"
        description="We translate these sliders into muscle-level weekly targets, then back into per-session sets."
        bullets={[
          "Session sets cap between 8–20 to keep workouts efficient and repeatable.",
          "Strength skew favours heavier compounds with slightly lower per-exercise sets.",
          "Hypertrophy bias adds accessory variety while safeguarding recovery via planned deloads.",
        ]}
      />
      <Section title="How many sets per session feels right?">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <input
            type="range"
            min={8}
            max={20}
            step={1}
            value={state.setsPerSession ?? 12}
            onChange={(e) =>
              onChange({ setsPerSession: Number(e.target.value) })
            }
            className="w-full sm:w-64"
          />
          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white/80">
            <div className="text-xs uppercase tracking-[0.3em] text-white/50">
              Target sets
            </div>
            <div className="text-xl font-semibold text-white">
              {state.setsPerSession ?? 12} sets/session
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40">
          We’ll balance compound and accessory work to stay close to this
          target.
        </p>
      </Section>
      <Section title="Preferred workload">
        <OptionGrid>
          {VOLUME_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              active={state.volumePreference === opt.value}
              onClick={() => onChange({ volumePreference: opt.value })}
              title={opt.label}
              description={opt.desc}
            />
          ))}
        </OptionGrid>
      </Section>
    </div>
  );
}

function ReviewStep({
  plan,
  exercises,
}: {
  plan: GuidedSetupPlanResult | null;
  exercises: Exercise[];
}) {
  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex.name])),
    [exercises]
  );
  if (!plan)
    return (
      <div className="flex h-48 items-center justify-center text-sm text-white/60">
        Configure previous steps to see your plan.
      </div>
    );
  const volumeEntries = Object.entries(plan.volumeTargets) as [
    MuscleGroup,
    number
  ][];
  return (
    <div className="space-y-6">
      <GuidanceCard
        title="Before you create your program"
        description="Glance over the split, template suggestions, and weekly volume to make sure it matches your intent."
        bullets={[
          "Weekly split shows the auto-planned pattern with quick notes on where primaries land.",
          "Suggested templates list anchor/support exercises—swap anything out after saving if needed.",
          "Volume targets feed progress dashboards and auto-progressions so dial them in confidently.",
        ]}
      />
      <Section title="Weekly split">
        <div className="grid gap-3 md:grid-cols-2">
          {plan.schedule.map((day: GuidedSetupScheduleDay) => (
            <div
              key={day.id}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
            >
              <div className="text-sm font-semibold text-white">
                {day.label}
              </div>
              <div className="text-xs text-emerald-300/80">{day.type}</div>
              {day.note && (
                <div className="mt-2 text-xs text-white/60">{day.note}</div>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Suggested templates">
        <div className="space-y-3">
          {plan.templates.map((tpl: GuidedTemplateDraft) => {
            const highlightMap = new Map(
              (tpl.highlights || []).map((h) => [h.exerciseId, h.role])
            );
            return (
              <div
                key={tpl.id}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
              >
                <div className="flex items-center justify-between text-sm text-white">
                  <span className="font-semibold">{tpl.name}</span>
                  <span className="text-xs text-white/40">
                    {tpl.focusMuscles.join(", ")}
                  </span>
                </div>
                {tpl.note && (
                  <p className="mt-2 text-xs text-white/55">{tpl.note}</p>
                )}
                <ul className="mt-3 space-y-1 text-xs text-white/65">
                  {tpl.plan.map((p: GuidedTemplateDraft["plan"][number]) => {
                    const exerciseName =
                      exerciseMap.get(p.exerciseId) || "Exercise";
                    const highlightRole = highlightMap.get(p.exerciseId);
                    return (
                      <li
                        key={p.exerciseId}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>
                          {exerciseName} – {p.plannedSets} sets @ {p.repRange}
                        </span>
                        {highlightRole && (
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              highlightRole === "anchor"
                                ? "bg-emerald-500/20 text-emerald-200"
                                : "bg-white/10 text-white/60"
                            )}
                          >
                            {highlightRole === "anchor" ? "Anchor" : "Support"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Volume targets">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-white/70">
          {volumeEntries
            .filter(([, value]) => value > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([muscle, value]) => (
              <div
                key={muscle}
                className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2"
              >
                <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                  {muscle}
                </div>
                <div className="text-sm font-semibold text-white">
                  {value.toFixed(1)} sets / week
                </div>
              </div>
            ))}
        </div>
      </Section>
    </div>
  );
}

async function prepareTemplates(
  drafts: GuidedTemplateDraft[]
): Promise<Template[]> {
  const existing = await db.getAll<Template>("templates");
  const nameSet = new Set(existing.map((t) => t.name.toLowerCase()));
  const ensureName = (raw: string) => {
    const base = raw.trim() || "Guided Day";
    let candidate = base;
    let counter = 2;
    while (nameSet.has(candidate.toLowerCase())) {
      candidate = `${base} (${counter++})`;
    }
    nameSet.add(candidate.toLowerCase());
    return candidate;
  };
  return drafts.map((draft) => ({
    id: draft.id || `tpl_${nanoid(6)}`,
    name: ensureName(draft.name),
    exerciseIds: draft.exerciseIds,
    plan: draft.plan.map((p) => ({
      exerciseId: p.exerciseId,
      plannedSets: p.plannedSets,
      repRange: p.repRange,
      progression: {
        scheme: "linear" as const,
        incrementKg: 2.5,
        addRepsFirst: true,
      },
    })),
  }));
}

function sessionHasMeaningfulWork(session?: Session | null): boolean {
  if (!session || !Array.isArray(session.entries)) return false;
  return session.entries.some((entry) =>
    Array.isArray(entry.sets)
      ? entry.sets.some((set) => {
          const weight = Number(set?.weightKg ?? 0);
          const reps = Number(set?.reps ?? 0);
          const rpe = Number(set?.rpe ?? 0);
          return weight > 0 || reps > 0 || rpe > 0;
        })
      : false
  );
}

async function populateGuidedSessions({
  program,
  schedule,
  templates,
  exercises,
  settings,
}: {
  program: UserProgram;
  schedule: GuidedSetupScheduleDay[];
  templates: Template[];
  exercises: Exercise[];
  settings: Settings | null;
}) {
  try {
    const templateMap = new Map(templates.map((tpl) => [tpl.id, tpl]));
    const exerciseMap = new Map(exercises.map((ex) => [ex.id, ex]));
    const scheduleByIndex = new Map(schedule.map((day, idx) => [idx, day]));
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const dateISO = midnight.toISOString();

    for (let idx = 0; idx < program.weeklySplit.length; idx++) {
      const dayMeta = program.weeklySplit[idx];
      if (!dayMeta || dayMeta.type === "Rest" || !dayMeta.templateId) continue;
      const template = templateMap.get(dayMeta.templateId);
      if (!template) continue;
      const sessionId = `1-1-${idx}`;
      const existing = await db.get<Session>("sessions", sessionId);
      if (existing && sessionHasMeaningfulWork(existing)) continue;

      const planMap = new Map(
        (template.plan || []).map((p) => [p.exerciseId, p])
      );
      const rawOrder = template.exerciseIds?.length
        ? template.exerciseIds
        : (template.plan || []).map((p) => p.exerciseId);
      const orderedExerciseIds = Array.from(new Set(rawOrder));

      const entries: SessionEntry[] = orderedExerciseIds
        .map((exerciseId) => {
          const exercise = exerciseMap.get(exerciseId);
          const plan = planMap.get(exerciseId);
          const fallbackSets =
            settings?.defaultSetRows ?? exercise?.defaults?.sets ?? 3;
          const desiredSets = plan?.plannedSets ?? fallbackSets;
          const setCount = Math.max(
            1,
            Math.min(6, Math.round(Number(desiredSets) || 0))
          );
          if (!setCount || Number.isNaN(setCount)) return null;
          const sets: SetEntry[] = Array.from({ length: setCount }, (_, i) => ({
            setNumber: i + 1,
            weightKg: 0,
            reps: 0,
          }));
          if (!sets.length) return null;
          const entry: SessionEntry = {
            id: nanoid(),
            exerciseId,
            sets,
          };
          if (plan?.repRange) {
            entry.targetRepRange = plan.repRange;
          }
          return entry;
        })
        .filter(Boolean) as SessionEntry[];
      if (!entries.length) continue;

      const scheduleDay = scheduleByIndex.get(idx);
      const dayLabel =
        dayMeta.customLabel || scheduleDay?.label || dayMeta.type || `Day ${idx + 1}`;
      const nowISO = new Date().toISOString();

      if (existing) {
        const updated: Session = {
          ...existing,
          entries,
          templateId: template.id,
          autoImportedTemplateId: template.id,
          dayName: dayLabel,
          programId: program.id,
          updatedAt: nowISO,
        };
        await db.put("sessions", updated);
        continue;
      }

      const newSession: Session = {
        id: sessionId,
        dateISO,
        localDate,
        weekNumber: 1,
        phase: 1,
        phaseNumber: 1,
        templateId: template.id,
        autoImportedTemplateId: template.id,
        dayName: dayLabel,
        programId: program.id,
        entries,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      await db.put("sessions", newSession);
    }
  } catch (err) {
    console.warn("[guided-setup] session population skipped", err);
  }
}

function GuidanceCard({
  title,
  description,
  bullets,
}: {
  title: string;
  description?: string;
  bullets?: string[];
}) {
  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 px-4 py-4 text-xs text-white/70">
      <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
        Guidance
      </div>
      <h4 className="mt-1 text-sm font-semibold text-white">{title}</h4>
      {description && (
        <p className="mt-2 text-xs text-white/65">{description}</p>
      )}
      {bullets && bullets.length > 0 && (
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function OptionGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-3">{children}</div>;
}

function OptionCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-2xl border px-4 py-3 text-left transition",
        active
          ? "border-emerald-500 bg-emerald-500/20 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{description}</div>
    </button>
  );
}

function TagGrid({
  options,
  active,
  onToggle,
  accent,
}: {
  options: { value: string; label: string }[];
  active: Set<string>;
  onToggle: (value: string) => void;
  accent: "emerald" | "sky" | "slate";
}) {
  const accentClass = {
    emerald: "bg-emerald-500/80 text-slate-950",
    sky: "bg-sky-500/80 text-slate-950",
    slate: "bg-white/15 text-white",
  }[accent];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = active.has(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className={clsx(
              "rounded-xl px-3 py-2 text-sm transition",
              isActive
                ? accentClass
                : "bg-white/5 text-white/70 hover:bg-white/10"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
