import { nanoid } from "nanoid";
import { db } from "./db";
import { setSettings } from "./helpers";
import { archiveCurrentProgram, saveProfileProgram } from "./profile";
import type {
  Exercise,
  GuidedSetupScheduleDay,
  GuidedTemplateDraft,
  Session,
  SessionEntry,
  SetEntry,
  Settings,
  Template,
  UserProgram,
} from "./types";
import type { GuidedSetupPlanResult } from "./guidedSetup";

export interface GuidedSetupApplyMeta {
  completed: boolean;
  skipped?: boolean;
  starterCreated?: boolean;
  mode?: "quick" | "advanced";
  lastCompletedStep?: number;
  clearDraft?: boolean;
}

export interface ApplyGuidedSetupPlanArgs {
  plan: GuidedSetupPlanResult;
  settings: Settings;
  exercises: Exercise[];
  meta: GuidedSetupApplyMeta;
}

export interface ApplyGuidedSetupPlanResult {
  program: UserProgram;
  settings: Settings;
}

export async function applyGuidedSetupPlan({
  plan,
  settings,
  exercises,
  meta,
}: ApplyGuidedSetupPlanArgs): Promise<ApplyGuidedSetupPlanResult> {
  const now = new Date().toISOString();
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

  const weeklySplitWithTemplates = plan.program.weeklySplit.map((day, idx) => {
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
  });

  const programToSave: UserProgram = {
    ...plan.program,
    weekLengthDays: schedule.length,
    weeklySplit: weeklySplitWithTemplates,
    updatedAt: now,
  };

  const prevGuided = settings.progress?.guidedSetup || {};
  const nextGuided: NonNullable<
    NonNullable<Settings["progress"]>["guidedSetup"]
  > = {
    ...prevGuided,
    completed: meta.completed,
    skipped: meta.skipped ?? prevGuided.skipped ?? false,
    starterCreated: meta.starterCreated ?? prevGuided.starterCreated ?? false,
    mode: meta.mode ?? prevGuided.mode ?? "advanced",
    lastCompletedStep:
      typeof meta.lastCompletedStep === "number"
        ? meta.lastCompletedStep
        : prevGuided.lastCompletedStep ?? 0,
    lastUpdatedAt: now,
  };

  if (meta.clearDraft) {
    nextGuided.draft = undefined;
  }

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
      guidedSetup: nextGuided,
    },
  };

  await populateGuidedSessions({
    program: programToSave,
    schedule,
    templates: templatesToSave,
    exercises,
    settings: nextSettings,
  });

  const archived = await archiveCurrentProgram(programToSave);
  if (!archived) {
    await saveProfileProgram(programToSave);
  }

  await setSettings(nextSettings);

  return {
    program: programToSave,
    settings: nextSettings,
  };
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
        dayMeta.customLabel ||
        scheduleDay?.label ||
        dayMeta.type ||
        `Day ${idx + 1}`;
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
