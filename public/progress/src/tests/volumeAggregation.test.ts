import { describe, it, expect } from 'vitest';
import { volumeByMuscleGroup } from '../lib/helpers';
import type { Session, Exercise } from '../lib/types';

// Minimal mock db via dynamic import override would be complex; instead we directly call helper with deps.

describe('volumeByMuscleGroup aggregation', () => {
  it('adds arms (biceps+triceps+forearms) and legs (quads+hamstrings+calves) aggregates', async () => {
    const exercises: Exercise[] = [
      { id: 'ex1', name: 'Curl', muscleGroup: 'biceps', defaults: { sets: 0, targetRepRange: '8-12' } },
      { id: 'ex2', name: 'Pushdown', muscleGroup: 'triceps', defaults: { sets: 0, targetRepRange: '8-12' } },
      { id: 'ex3', name: 'Wrist Curl', muscleGroup: 'forearms', defaults: { sets: 0, targetRepRange: '12-20' } },
      { id: 'ex4', name: 'Leg Ext', muscleGroup: 'quads', defaults: { sets: 0, targetRepRange: '10-15' } },
      { id: 'ex5', name: 'Leg Curl', muscleGroup: 'hamstrings', defaults: { sets: 0, targetRepRange: '10-15' } },
      { id: 'ex6', name: 'Calf Raise', muscleGroup: 'calves', defaults: { sets: 0, targetRepRange: '10-15' } },
    ];
    const makeEntry = (exerciseId: string, weight: number, reps: number, sets: number) => ({
      id: exerciseId + '-entry',
      exerciseId,
      sets: Array.from({ length: sets }, (_, i) => ({ setNumber: i+1, weightKg: weight, reps }))
    });
    const session: Session = {
      id: 's1', weekNumber: 1, phase: 1 as any, phaseNumber: 1,
      dateISO: new Date().toISOString(), entries: [
        makeEntry('ex1', 20, 10, 2), // tonnage 400
        makeEntry('ex2', 30, 8, 2),  // tonnage 480
        makeEntry('ex3', 10, 15, 2), // tonnage 300
        makeEntry('ex4', 40, 10, 1), // 400
        makeEntry('ex5', 35, 8, 1),  // 280
        makeEntry('ex6', 50, 12, 1), // 600
      ]
    } as any;
    const result = await volumeByMuscleGroup(1, { sessions: [session], exercises });
    // Raw checks
    expect(result.biceps.tonnage).toBe(400);
    expect(result.triceps.tonnage).toBe(480);
    expect(result.forearms.tonnage).toBe(300);
    expect(result.quads.tonnage).toBe(400);
    expect(result.hamstrings.tonnage).toBe(280);
    expect(result.calves.tonnage).toBe(600);
    // Aggregates
    expect(result.arms.tonnage).toBe(400+480+300);
    expect(result.legs.tonnage).toBe(400+280+600);
    expect(result.arms.sets).toBe(2+2+2);
    expect(result.legs.sets).toBe(1+1+1);
  });
});
