import { describe, it, expect } from 'vitest';
import { computeSessionPacing } from '../lib/pacing';
import type { Session } from '../lib/types';

const baseDate = new Date('2025-09-19T10:00:00Z');
function isoOffset(mins: number){ return new Date(baseDate.getTime()+mins*60000).toISOString(); }

describe('computeSessionPacing', () => {
  it('calculates intervals, average, median, longest', () => {
    const session: Session = {
      id: 's1', dateISO: baseDate.toISOString(), weekNumber:1, phase:1 as any, phaseNumber:1, entries:[
        { id:'e1', exerciseId:'exA', sets:[
          { setNumber:1, weightKg:50, reps:8, completedAt: isoOffset(0) },
          { setNumber:2, weightKg:50, reps:8, completedAt: isoOffset(2) },
          { setNumber:3, weightKg:50, reps:8, completedAt: isoOffset(5) },
        ]},
        { id:'e2', exerciseId:'exB', sets:[
          { setNumber:1, weightKg:80, reps:5, completedAt: isoOffset(1) },
          { setNumber:2, weightKg:80, reps:5, completedAt: isoOffset(4) },
        ]},
      ]
    } as any;
    const pacing = computeSessionPacing(session);
    const exA = pacing.exercises.find(e=> e.exerciseId==='exA')!;
    const exB = pacing.exercises.find(e=> e.exerciseId==='exB')!;
    expect(exA.intervals).toHaveLength(2); // 2→5 min intervals
    expect(exA.averageMs).toBe( (2*60*1000 + 3*60*1000)/2 );
    expect(exA.longestMs).toBe(3*60*1000);
    expect(exB.intervals[0]).toBe(3*60*1000);
    expect(pacing.overall.count).toBe(3);
  });
});
