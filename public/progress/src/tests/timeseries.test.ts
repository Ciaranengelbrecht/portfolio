import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '../lib/db'
import { getExerciseTimeSeries, getMeasurementTimeSeries } from '../lib/helpers'

describe('time-series helpers', () => {
  beforeAll(async () => {
    await db.put('exercises', { id: 'e1', name: 'Bench', muscleGroup: 'chest', defaults: { sets: 3, targetRepRange: '8-12' } } as any)
    await db.put('sessions', { id: 's1', dateISO: new Date().toISOString(), weekNumber: 1, entries: [ { id:'se1', exerciseId:'e1', sets: [ { setNumber:1, weightKg: 100, reps: 8 } ] } ] } as any)
    await db.put('measurements', { id: 'm1', dateISO: new Date().toISOString(), weightKg: 80, waist: 80 } as any)
  })
  it('exercise series returns points', async () => {
    const rows = await getExerciseTimeSeries('e1','all')
    expect(rows.length).toBeGreaterThan(0)
  })
  it('measurement series returns points', async () => {
    const rows = await getMeasurementTimeSeries('waist','all')
    expect(rows.length).toBeGreaterThan(0)
  })
})
