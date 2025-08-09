import { describe, it, expect } from 'vitest'
import { db } from '../lib/db'
import { Settings } from '../lib/types'

// This test is a smoke check that stores are writable after upgrade
// and settings can be read/written; detailed migration checks require
// simulating pre-v2 which is out-of-scope for unit env here.

describe('migration v2', () => {
  it('keeps settings readable/writable post-upgrade', async () => {
    await db.put('settings', { id: 'app', unit: 'kg', deloadDefaults: { loadPct: 0.55, setPct: 0.5 }, theme: 'dark' } as any)
    const s = await db.get<Settings>('settings','app')
    expect(s?.unit).toBe('kg')
  })
})
