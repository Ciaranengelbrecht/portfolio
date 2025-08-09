import { describe, it, expect } from 'vitest'
import { clampPhase } from '../lib/sessionOps'

describe('clampPhase', () => {
  it('clamps to 1..50', () => {
    expect(clampPhase(0)).toBe(1)
    expect(clampPhase(1)).toBe(1)
    expect(clampPhase(25)).toBe(25)
    expect(clampPhase(51)).toBe(50)
  })
})
