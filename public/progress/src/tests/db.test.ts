import { describe, it, expect } from 'vitest'
import { db } from '../lib/db'

describe('db persistence', () => {
  it('put/get exercises roundtrip', async () => {
    const ex = { id: 'x1', name: 'Test', muscleGroup: 'other', defaults: { sets: 3, targetRepRange: '8-12' } }
    await db.put('exercises', ex as any)
    const got = await db.get('exercises', 'x1')
    expect((got as any)?.name).toBe('Test')
  })
})
