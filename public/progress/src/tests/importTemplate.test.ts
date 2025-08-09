import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '../lib/db'
import { importFromTemplate } from '../lib/sessionOps'
import { Exercise, Session, Template } from '../lib/types'

describe('importFromTemplate', () => {
  let ex: Exercise[]
  let t: Template
  let s: Session
  beforeAll(async () => {
    ex = [
      { id: 'e1', name: 'Incline DB Press', muscleGroup: 'chest', defaults: { sets: 3, targetRepRange: '8-12' } },
      { id: 'e2', name: 'Pec Deck', muscleGroup: 'chest', defaults: { sets: 3, targetRepRange: '10-15' } },
    ]
    for (const e of ex) await db.put('exercises', e)
    t = { id: 't1', name: 'Upper A', exerciseIds: ex.map(e=>e.id) }
    await db.put('templates', t)
    s = { id: '1-1-0', dateISO: new Date().toISOString(), weekNumber: 1, phaseNumber: 1, entries: [] }
    await db.put('sessions', s)
  })

  it('appends when append=true', async () => {
    const updated = await importFromTemplate(s, t, ex, { append: true, weekNumber: 1 })
    expect(updated.entries.length).toBe(2)
  })

  it('replaces when append=false', async () => {
    const existing: Session = { ...s, entries: [ { id:'se0', exerciseId:'e1', sets: [] } ] }
    const updated = await importFromTemplate(existing, t, ex, { append: false, weekNumber: 1 })
    expect(updated.entries.length).toBe(2)
  })
})
