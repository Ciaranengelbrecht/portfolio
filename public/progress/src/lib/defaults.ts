import { Exercise, Settings, Template } from './types'
import { nanoid } from 'nanoid'

export const defaultSettings: Settings = {
  unit: 'kg',
  theme: 'dark',
  deloadDefaults: { loadPct: 0.55, setPct: 0.5 }, // default per requirement
  currentPhase: 1,
  accentColor: '#22c55e',
  cardStyle: 'glass',
  autoAdvanceSession: false,
  defaultSetRows: 3,
  measurementUnits: 'metric',
  privacyUnlockMode: 'everyLaunch',
  dashboardPrefs: { range: '8w', openToLast: true, startPage: 'last' }
}

export const defaultExercises: Exercise[] = [
  { id: nanoid(), name: 'Incline DB Press', muscleGroup: 'chest', defaults: { sets: 3, targetRepRange: '8-12' } },
  { id: nanoid(), name: 'Pec Deck', muscleGroup: 'chest', defaults: { sets: 3, targetRepRange: '10-15' } },
  { id: nanoid(), name: 'Cable Row', muscleGroup: 'back', defaults: { sets: 3, targetRepRange: '8-12' } },
  { id: nanoid(), name: 'Lat Pulldown/Pull-ups', muscleGroup: 'back', defaults: { sets: 3, targetRepRange: '8-12' } },
  { id: nanoid(), name: 'Triceps Pushdown', muscleGroup: 'triceps', defaults: { sets: 3, targetRepRange: '10-15' } },
  { id: nanoid(), name: 'Overhead Extension', muscleGroup: 'triceps', defaults: { sets: 3, targetRepRange: '10-15' } },
  { id: nanoid(), name: 'Bayesian Curl', muscleGroup: 'biceps', defaults: { sets: 3, targetRepRange: '10-15' } },
  { id: nanoid(), name: 'Lateral Raise/Upright Row', muscleGroup: 'shoulders', defaults: { sets: 3, targetRepRange: '12-20' } },
  { id: nanoid(), name: 'Seated Leg Curl', muscleGroup: 'legs', defaults: { sets: 3, targetRepRange: '10-15' } },
  { id: nanoid(), name: 'Leg Press/Hack Squat', muscleGroup: 'legs', defaults: { sets: 3, targetRepRange: '8-12' } },
  { id: nanoid(), name: 'Leg Press Calf Raise', muscleGroup: 'calves', defaults: { sets: 3, targetRepRange: '10-15' } },
  { id: nanoid(), name: 'Leg Extension', muscleGroup: 'legs', defaults: { sets: 3, targetRepRange: '12-15' } },
  { id: nanoid(), name: 'Abs (Cable Crunch or Leg Raises)', muscleGroup: 'core', defaults: { sets: 3, targetRepRange: '10-15' } },
]

export const defaultTemplates: Template[] = (() => {
  const ids = Object.fromEntries(defaultExercises.map(e => [e.name, e.id])) as Record<string,string>
  const make = (name: string, ex: string[]) => ({ id: nanoid(), name, exerciseIds: ex.map(x => ids[x]) })
  return [
    make('Upper A', [
  'Incline DB Press','Pec Deck','Cable Row','Lat Pulldown/Pull-ups','Triceps Pushdown','Overhead Extension','Bayesian Curl','Lateral Raise/Upright Row'
    ]),
    make('Lower A', [
      'Seated Leg Curl','Leg Press/Hack Squat','Leg Press Calf Raise','Leg Extension','Abs (Cable Crunch or Leg Raises)'
    ]),
    make('Upper B', [
  'Incline DB Press','Pec Deck','Cable Row','Lat Pulldown/Pull-ups','Triceps Pushdown','Overhead Extension','Bayesian Curl','Lateral Raise/Upright Row'
    ]),
    make('Lower B', [
      'Seated Leg Curl','Leg Press/Hack Squat','Leg Press Calf Raise','Leg Extension','Abs (Cable Crunch or Leg Raises)'
    ]),
    make('Upper C', [
  'Incline DB Press','Pec Deck','Cable Row','Lat Pulldown/Pull-ups','Triceps Pushdown','Overhead Extension','Bayesian Curl','Lateral Raise/Upright Row'
    ]),
    make('Lower C', [
  'Seated Leg Curl','Leg Press/Hack Squat','Leg Press Calf Raise','Leg Extension','Abs (Cable Crunch or Leg Raises)'
    ]),
  ]
})()

export const catalogNames = [
  'Incline DB Press','Pec Deck','Cable Row','Lat Pulldown/Pull-ups','Triceps Pushdown','Overhead Extension','Bayesian Curl','Lateral Raise/Upright Row',
  'Seated Leg Curl','Leg Press/Hack Squat','Leg Press Calf Raise','Leg Extension','Abs (Cable Crunch or Leg Raises)'
]

export async function ensureSeedTemplates(db: any) {
  const existing = await db.getAll('templates')
  const names = new Set(existing.map((t: any)=>t.name))
  for (const t of defaultTemplates) {
    if (!names.has(t.name)) await db.put('templates', t)
  }
}
