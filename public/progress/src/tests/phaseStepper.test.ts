import { describe, it, expect } from 'vitest'
import { clampPhase } from '../lib/sessionOps'

describe('clampPhase', () => {
  it('enforces lower bound only', () => {
    expect(clampPhase(0)).toBe(1)
    expect(clampPhase(1)).toBe(1)
    expect(clampPhase(25)).toBe(25)
    expect(clampPhase(9999)).toBe(9999)
  })
})
