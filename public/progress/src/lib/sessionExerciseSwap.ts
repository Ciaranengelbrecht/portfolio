import { nanoid } from "nanoid";

import { Exercise, Session, SessionEntry, SetEntry, Template, UserProgram } from "./types";

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const sessionHasLoggedWork = (session?: Session | null) =>
  !!session?.entries?.some((entry) =>
    entry.sets?.some((set) => (set.weightKg || 0) > 0 || (set.reps || 0) > 0)
  );

export const getSessionSwapLocation = (session: Session) => {
  const [phasePart, weekPart, dayPart] = (session.id || "").split("-");
  return {
    phase: toFiniteNumber(session.phaseNumber ?? session.phase ?? phasePart) ?? 1,
    week: toFiniteNumber(session.weekNumber ?? weekPart) ?? 1,
    day: toFiniteNumber(dayPart) ?? 0,
  };
};

const compareSessionLocation = (left: Session, right: Session) => {
  const a = getSessionSwapLocation(left);
  const b = getSessionSwapLocation(right);
  if (a.phase !== b.phase) return a.phase - b.phase;
  if (a.week !== b.week) return a.week - b.week;
  return a.day - b.day;
};

export const buildSwappedEntry = (
  entry: SessionEntry,
  nextExercise: Exercise
): SessionEntry => {
  const clearedSets: SetEntry[] = (entry.sets || []).map((set, index) => ({
    setNumber: index + 1,
    weightKg: null,
    reps: null,
    ...(set.rpe != null ? { rpe: set.rpe } : {}),
  }));

  return {
    ...entry,
    exerciseId: nextExercise.id,
    targetRepRange:
      nextExercise.defaults?.targetRepRange ?? entry.targetRepRange,
    sets: clearedSets,
  };
};

type ApplyExerciseSwapOptions = {
  sessions: Session[];
  currentSession: Session;
  currentEntryId: string;
  sourceExerciseId: string;
  nextExercise: Exercise;
  templateIdForFuture?: string;
};

export const applyExerciseSwapToCurrentAndFutureSessions = ({
  sessions,
  currentSession,
  currentEntryId,
  sourceExerciseId,
  nextExercise,
  templateIdForFuture,
}: ApplyExerciseSwapOptions) => {
  const updatedById = new Map<string, Session>();
  const skippedLoggedSessionIds: string[] = [];
  let futureSessionsChanged = 0;

  for (const session of sessions) {
    if (!session || session.deletedAt) continue;
    if (session.id === currentSession.id) continue;

    const sameProgram =
      !currentSession.programId ||
      !session.programId ||
      session.programId === currentSession.programId;
    if (!sameProgram) continue;

    const currentLoc = getSessionSwapLocation(currentSession);
    const candidateLoc = getSessionSwapLocation(session);
    if (candidateLoc.day !== currentLoc.day) continue;
    if (compareSessionLocation(session, currentSession) <= 0) continue;

    const matchingEntries = session.entries.filter(
      (entry) => entry.exerciseId === sourceExerciseId
    );
    if (!matchingEntries.length) continue;

    if (sessionHasLoggedWork(session)) {
      skippedLoggedSessionIds.push(session.id);
      continue;
    }

    const nextEntries = session.entries.map((entry) =>
      entry.exerciseId === sourceExerciseId
        ? buildSwappedEntry(entry, nextExercise)
        : entry
    );

    updatedById.set(session.id, {
      ...session,
      entries: nextEntries,
      ...(templateIdForFuture
        ? {
            templateId: templateIdForFuture,
            autoImportedTemplateId: templateIdForFuture,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    });
    futureSessionsChanged += 1;
  }

  const currentEntry = currentSession.entries.find(
    (entry) => entry.id === currentEntryId
  );
  if (!currentEntry) {
    return {
      updatedCurrentSession: currentSession,
      updatedSessions: [],
      futureSessionsChanged,
      skippedLoggedSessionIds,
    };
  }

  const updatedCurrentSession: Session = {
    ...currentSession,
    entries: currentSession.entries.map((entry) =>
      entry.id === currentEntryId ? buildSwappedEntry(entry, nextExercise) : entry
    ),
    ...(templateIdForFuture
      ? {
          templateId: templateIdForFuture,
          autoImportedTemplateId: templateIdForFuture,
        }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  return {
    updatedCurrentSession,
    updatedSessions: Array.from(updatedById.values()),
    futureSessionsChanged,
    skippedLoggedSessionIds,
  };
};

type PrepareFutureTemplateSwapOptions = {
  program: UserProgram | null;
  templates: Template[];
  dayIndex: number;
  sourceExerciseId: string;
  nextExercise: Exercise;
};

const replaceTemplateExercise = (
  template: Template,
  sourceExerciseId: string,
  nextExercise: Exercise
) => {
  let changed = false;

  const exerciseIds = template.exerciseIds.map((exerciseId) => {
    if (exerciseId !== sourceExerciseId) return exerciseId;
    changed = true;
    return nextExercise.id;
  });

  const plan = template.plan?.map((step) => {
    if (step.exerciseId !== sourceExerciseId) return step;
    changed = true;
    return {
      ...step,
      exerciseId: nextExercise.id,
      repRange: nextExercise.defaults?.targetRepRange ?? step.repRange,
    };
  });

  if (!changed) return null;

  return {
    ...template,
    exerciseIds,
    ...(plan ? { plan } : {}),
  };
};

export const prepareFutureTemplateSwap = ({
  program,
  templates,
  dayIndex,
  sourceExerciseId,
  nextExercise,
}: PrepareFutureTemplateSwapOptions) => {
  if (!program) {
    return {
      nextProgram: null,
      nextTemplates: templates,
      templateIdForFuture: undefined,
      templateChanged: false,
    };
  }

  const currentDay = program.weeklySplit[dayIndex];
  const currentTemplateId = currentDay?.templateId;
  if (!currentTemplateId) {
    return {
      nextProgram: program,
      nextTemplates: templates,
      templateIdForFuture: undefined,
      templateChanged: false,
    };
  }

  const template = templates.find((item) => item.id === currentTemplateId);
  if (!template) {
    return {
      nextProgram: program,
      nextTemplates: templates,
      templateIdForFuture: undefined,
      templateChanged: false,
    };
  }

  const swappedTemplate = replaceTemplateExercise(
    template,
    sourceExerciseId,
    nextExercise
  );
  if (!swappedTemplate) {
    return {
      nextProgram: program,
      nextTemplates: templates,
      templateIdForFuture: currentTemplateId,
      templateChanged: false,
    };
  }

  const sharedDayIndexes = program.weeklySplit.reduce<number[]>(
    (indexes, day, index) => {
      if (day.templateId === currentTemplateId) indexes.push(index);
      return indexes;
    },
    []
  );

  if (sharedDayIndexes.length <= 1) {
    return {
      nextProgram: {
        ...program,
        updatedAt: new Date().toISOString(),
      },
      nextTemplates: templates.map((item) =>
        item.id === currentTemplateId ? swappedTemplate : item
      ),
      templateIdForFuture: currentTemplateId,
      templateChanged: true,
    };
  }

  const clonedTemplateId = nanoid();
  const dayLabel =
    currentDay.customLabel ||
    currentDay.type ||
    `Day ${dayIndex + 1}`;

  const clonedTemplate: Template = {
    ...swappedTemplate,
    id: clonedTemplateId,
    name: `${template.name} (${dayLabel})`,
  };

  return {
    nextProgram: {
      ...program,
      weeklySplit: program.weeklySplit.map((day, index) =>
        index === dayIndex ? { ...day, templateId: clonedTemplateId } : day
      ),
      updatedAt: new Date().toISOString(),
    },
    nextTemplates: [...templates, clonedTemplate],
    templateIdForFuture: clonedTemplateId,
    templateChanged: true,
  };
};
