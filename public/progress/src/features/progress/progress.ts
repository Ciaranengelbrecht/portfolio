import { Session } from "../../lib/types";

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
  opts?: { weeklyTargetDays?: number }
): {
  completedDays: number;
  totalDays: number;
  percent: number;
  dayMap: Record<DayId, boolean>;
} {
  const target = Math.max(3, Math.min(6, opts?.weeklyTargetDays ?? 6));
  const dayMap: Record<DayId, boolean> = {
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  };
  const inWeek = sessions.filter(
    (s) =>
      (s.phaseNumber ?? s.phase ?? 1) === phaseNumber &&
      s.weekNumber === (weekNumber as any)
  );
  for (let d = 0 as DayId; d <= 6; d = (d + 1) as DayId) {
    const idPrefix = `${phaseNumber}-${weekNumber}-${d}`;
    const session = inWeek.find((s) => s.id === idPrefix);
    dayMap[d] = getDayCompletion(session);
  }
  // Completed days are training slots only (0..5)
  const completedDays = [0, 1, 2, 3, 4, 5].reduce(
    (a, d) => a + (dayMap[d as DayId] ? 1 : 0),
    0
  );
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
