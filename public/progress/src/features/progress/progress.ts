import { Session, UserProgram } from "../../lib/types";

// Days: 0..5 are training slots; 6 is Rest (ignored for completion)
export type DayId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function getDayCompletion(session: Session | undefined): boolean {
  if (!session) return false;
  for (const e of session.entries || []) {
    if (e.sets && e.sets.some((s) => (s.reps || 0) > 0)) return true;
  }
  return false;
}

export function getWeekCompletion(
  phaseNumber: number,
  weekNumber: number,
  sessions: Session[],
  opts?: { weeklyTargetDays?: number; program?: Pick<UserProgram, 'weekLengthDays' | 'weeklySplit'> }
): {
  completedDays: number;
  totalDays: number;
  percent: number;
  dayMap: Record<number, boolean>;
} {
  const progLen = opts?.program?.weekLengthDays || 7; // support >7 (up to 10) from program
  const target = Math.max(3, Math.min(progLen-1, opts?.weeklyTargetDays ?? Math.min(6, progLen-1)));
  const dayMap: Record<number, boolean> = {};
  const inWeek = sessions.filter(
    (s) => (s.phaseNumber ?? s.phase ?? 1) === phaseNumber && s.weekNumber === (weekNumber as any)
  );
  for (let d = 0; d < progLen; d++) {
    const idPrefix = `${phaseNumber}-${weekNumber}-${d}`;
    const session = inWeek.find((s) => s.id === idPrefix);
    dayMap[d] = getDayCompletion(session);
  }
  // Completed days are all non-Rest days if program provided; else legacy first 6 slots
  let completedDays = 0;
  if (opts?.program) {
    opts.program.weeklySplit.forEach((day, idx) => {
      if (day.type !== 'Rest' && dayMap[idx]) completedDays++;
    });
  } else {
    completedDays = [0,1,2,3,4,5].reduce((a,d)=> a + (dayMap[d]?1:0),0);
  }
  const totalDays = target;
  const percent = Math.min(100, Math.round((completedDays / totalDays) * 100));
  return { completedDays, totalDays, percent, dayMap };
}

export function getPhaseCompletion(
  phaseNumber: number,
  sessions: Session[],
  opts?: { weeklyTargetDays?: number }
): { weekPercents: number[]; percent: number } {
  const weekPercents: number[] = [];
  for (
    let w = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    w <= 9;
    w = (w + 1) as any
  ) {
    const { percent } = getWeekCompletion(phaseNumber, w, sessions, opts);
    weekPercents.push(percent);
  }
  const percent = Math.round(weekPercents.reduce((a, b) => a + b, 0) / 9);
  return { weekPercents, percent };
}

export function isMidBlockDeload(weekNumber: number): boolean {
  // exposed for future mid-block logic; currently none mid-block
  return false;
}

export function isPhaseEnd(weekNumber: number): boolean {
  return weekNumber === 9;
}
