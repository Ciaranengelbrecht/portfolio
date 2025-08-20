import { UserProgram, WeeklySplitDay, Template, Exercise } from './types';
import { nanoid } from 'nanoid';

/** Blueprint for a preset program before exercises are resolved to IDs */
export interface PresetTemplateBlueprint {
  name: string;
  exercises: string[]; // fuzzy name matching against exercise library
}

export interface PresetProgramDefinition {
  id: string; // stable preset id (not user's program id)
  name: string;
  headline: string; // short marketing style summary
  description: string; // longer description
  category: 'Upper/Lower' | 'PPL' | 'Full Body' | 'Specialization' | 'High Volume' | 'High Frequency';
  weeks: number;
  deload: 'last-week' | 'interval-5w' | 'none';
  weekLengthDays: number;
  weeklySplit: WeeklySplitDay[]; // day labels only (template IDs resolved dynamically)
  volumeTargets: Record<string, number>; // per-muscle suggested weekly hard sets
  templateBlueprints: PresetTemplateBlueprint[]; // one per unique day pattern
  variants?: string[]; // optional variant notes (e.g. 5 or 6 day options)
}

// Helper to make WeeklySplitDay array from labels
function split(labels: (WeeklySplitDay['type'] | string)[]): WeeklySplitDay[] {
  return labels.map(l => {
    const known: WeeklySplitDay['type'][] = ['Upper','Lower','Push','Pull','Legs','Full Body','Arms','Rest','Custom'];
    if ((known as string[]).includes(l)) return { type: l as WeeklySplitDay['type'] };
    return { type: 'Custom', customLabel: l };
  });
}

// Baseline volume presets (approx intermediate lifter). High Volume & High Frequency push total sets or distribution.
export const PRESET_PROGRAMS: PresetProgramDefinition[] = [
  {
    id: 'ul-6d-balanced',
    name: 'Upper / Lower 6-Day',
    headline: 'Classic balanced UL split · 6 days · Moderate volume',
    description: 'A repeatable Upper/Lower rotation (ULULUL Rest) providing ~12–14 sets for major muscle groups over the week with balanced press/pull and lower posterior/anterior chain work. Great for intermediates wanting consistent progression.',
    category: 'Upper/Lower',
    weeks: 9,
    deload: 'last-week',
    weekLengthDays: 7,
    weeklySplit: split(['Upper','Lower','Upper','Lower','Upper','Lower','Rest']),
    volumeTargets: { chest: 12, back: 14, quads: 12, hamstrings: 10, glutes: 10, shoulders: 10, biceps: 8, triceps: 8, calves: 6, core: 6 },
    templateBlueprints: [
      { name: 'Upper Balanced', exercises: [
        'Incline DB Press','Flat Barbell Bench','Chest Fly','Cable Row','Lat Pulldown','Rear Delt Fly','Lateral Raise','Triceps Pushdown','Overhead Extension','Bayesian Curl'
      ]},
      { name: 'Lower Balanced', exercises: [
        'Seated Leg Curl','RDL','Back Squat','Leg Press','Leg Extension','Calf Raise','Ab Wheel','Hanging Leg Raise'
      ]}
    ]
  },
  {
    id: 'ppl-6d',
    name: 'PPL 6-Day',
    headline: 'Push / Pull / Legs x2 · 6 days · Classic progression',
    description: 'Six-day Push Pull Legs providing moderate-high upper volume and robust leg coverage. Suitable for lifters wanting frequency 2 for most muscle groups with manageable recovery.',
    category: 'PPL',
    weeks: 8,
    deload: 'last-week',
    weekLengthDays: 7,
    weeklySplit: split(['Push','Pull','Legs','Push','Pull','Legs','Rest']),
    volumeTargets: { chest: 14, shoulders: 12, triceps: 10, back: 16, biceps: 10, quads: 12, hamstrings: 10, glutes: 10, calves: 6, core: 6 },
    templateBlueprints: [
      { name: 'Push Day', exercises: [
        'Incline DB Press','Flat Barbell Bench','Chest Fly','Overhead Press','Lateral Raise','Triceps Pushdown','Overhead Extension'
      ]},
      { name: 'Pull Day', exercises: [
        'Deadlift (optional)','Chest Supported Row','Lat Pulldown','Single Arm Row','Face Pull','Barbell Curl','Bayesian Curl'
      ]},
      { name: 'Leg Day', exercises: [
        'Back Squat','RDL','Leg Press','Leg Extension','Seated Leg Curl','Calf Raise','Hanging Leg Raise'
      ]}
    ]
  },
  {
    id: 'ppl-5d',
    name: 'PPL 5-Day (Hybrid)',
    headline: 'Push / Pull / Legs / Upper / Lower · 5 days · Recovery friendly',
    description: 'Five training days blending a PPL base plus two consolidated UL variants to maintain frequency while freeing a rest day mid-week. Ideal for busy intermediates.',
    category: 'PPL',
    weeks: 8,
    deload: 'last-week',
    weekLengthDays: 7,
    weeklySplit: split(['Push','Pull','Rest','Legs','Upper','Lower','Rest']),
    volumeTargets: { chest: 12, shoulders: 10, triceps: 9, back: 14, biceps: 9, quads: 10, hamstrings: 8, glutes: 8, calves: 6, core: 6 },
    templateBlueprints: [
      { name: 'Push (Condensed)', exercises: [
        'Incline DB Press','Flat Barbell Bench','Cable Fly','Overhead Press','Lateral Raise','Triceps Pushdown'
      ]},
      { name: 'Pull (Condensed)', exercises: [
        'Chest Supported Row','Lat Pulldown','Single Arm Row','Rear Delt Fly','Face Pull','Barbell Curl'
      ]},
      { name: 'Legs Primary', exercises: [
        'Back Squat','RDL','Leg Press','Leg Extension','Seated Leg Curl','Calf Raise'
      ]},
      { name: 'Upper (Accessory Focus)', exercises: [
        'Incline DB Press','Chest Fly','Cable Row','Lat Pulldown','Lateral Raise','Bayesian Curl','Triceps Pushdown'
      ]},
      { name: 'Lower (Accessory / Unilateral)', exercises: [
        'Romanian Deadlift','Walking Lunge','Hack Squat','Leg Curl','Leg Extension','Calf Raise','Hanging Leg Raise'
      ]}
    ]
  },
  {
    id: 'fullbody-3d',
    name: 'Full Body 3-Day',
    headline: 'Efficient full body · 3 days · Higher per-session demand',
    description: 'Three full-body sessions emphasizing compound lifts each day. Volume distributed so no muscle is neglected despite lower frequency. Great for constrained schedules.',
    category: 'Full Body',
    weeks: 10,
    deload: 'interval-5w',
    weekLengthDays: 7,
    weeklySplit: split(['Full Body','Rest','Full Body','Rest','Full Body','Rest','Rest']),
    volumeTargets: { chest: 9, back: 12, quads: 9, hamstrings: 7, glutes: 7, shoulders: 8, biceps: 6, triceps: 6, calves: 4, core: 6 },
    templateBlueprints: [
      { name: 'Full Body A', exercises: [
        'Back Squat','Flat Barbell Bench','Chest Supported Row','Lat Pulldown','RDL','Calf Raise','Hanging Leg Raise'
      ]},
      { name: 'Full Body B', exercises: [
        'Front Squat','Incline DB Press','Cable Row','Hip Thrust','Seated Leg Curl','Overhead Press','Ab Wheel'
      ]},
      { name: 'Full Body C', exercises: [
        'Deadlift','Chest Fly','Single Arm Row','Leg Press','Leg Extension','Lateral Raise','Plank'
      ]}
    ]
  },
  {
    id: 'fullbody-4d',
    name: 'Full Body 4-Day',
    headline: 'Balanced full body · 4 days · Moderate frequency',
    description: 'Four full-body sessions allowing slightly higher weekly volume and more specific accessory rotation while keeping session length reasonable.',
    category: 'Full Body',
    weeks: 9,
    deload: 'last-week',
    weekLengthDays: 7,
    weeklySplit: split(['Full Body','Rest','Full Body','Rest','Full Body','Full Body','Rest']),
    volumeTargets: { chest: 10, back: 14, quads: 10, hamstrings: 8, glutes: 8, shoulders: 9, biceps: 7, triceps: 7, calves: 5, core: 6 },
    templateBlueprints: [
      { name: 'Full Body 1', exercises: [ 'Back Squat','Incline DB Press','Cable Row','Leg Curl','Calf Raise','Plank' ]},
      { name: 'Full Body 2', exercises: [ 'Front Squat','Flat Barbell Bench','Lat Pulldown','RDL','Lateral Raise','Ab Wheel' ]},
      { name: 'Full Body 3', exercises: [ 'Hack Squat','Chest Supported Row','Chest Fly','Hip Thrust','Seated Leg Curl','Face Pull' ]},
      { name: 'Full Body 4', exercises: [ 'Leg Press','Overhead Press','Single Arm Row','Leg Extension','Bayesian Curl','Triceps Pushdown' ]}
    ]
  },
  {
    id: 'ul-arms-delts-spec',
    name: 'UL + Arms/Delts Specialization',
    headline: 'Targeted arm & shoulder growth · 5 days',
    description: 'Upper / Lower repeating core with a dedicated Arms & Delts specialization day increasing direct volume & frequency. Chest/back/lower maintained; arms and medial delts receive elevated weekly sets.',
    category: 'Specialization',
    weeks: 8,
    deload: 'last-week',
    weekLengthDays: 7,
    weeklySplit: split(['Upper','Lower','Arms','Upper','Lower','Arms','Rest']),
    volumeTargets: { chest: 12, back: 14, quads: 10, hamstrings: 8, glutes: 8, shoulders: 14, biceps: 14, triceps: 14, calves: 6, core: 6 },
    templateBlueprints: [
      { name: 'Upper (Base)', exercises: [ 'Incline DB Press','Flat Barbell Bench','Cable Row','Lat Pulldown','Rear Delt Fly','Triceps Pushdown','Barbell Curl','Lateral Raise' ]},
      { name: 'Lower (Base)', exercises: [ 'Back Squat','RDL','Leg Press','Seated Leg Curl','Leg Extension','Calf Raise','Hanging Leg Raise' ]},
      { name: 'Arms & Delts Focus', exercises: [ 'Overhead Press','Lateral Raise','Rear Delt Fly','Triceps Pushdown','Overhead Extension','Barbell Curl','Bayesian Curl','Hammer Curl' ]}
    ]
  },
  {
    id: 'high-volume-6d',
    name: 'High Volume Builder',
    headline: 'Advanced high set counts · 6 days',
    description: 'Aggressive weekly set targets for advanced trainees with solid recovery (sleep/nutrition). Includes higher isolation volume and strategic exercise rotation to manage joint stress.',
    category: 'High Volume',
    weeks: 10,
    deload: 'interval-5w',
    weekLengthDays: 7,
    weeklySplit: split(['Push','Pull','Legs','Upper','Lower','Full Body','Rest']),
    volumeTargets: { chest: 18, back: 20, quads: 16, hamstrings: 14, glutes: 14, shoulders: 16, biceps: 14, triceps: 14, calves: 10, core: 8 },
    templateBlueprints: [
      { name: 'Push HV', exercises: [ 'Incline DB Press','Flat Barbell Bench','Chest Fly','Overhead Press','Lateral Raise','Cable Fly','Triceps Pushdown','Overhead Extension' ]},
      { name: 'Pull HV', exercises: [ 'Chest Supported Row','Lat Pulldown','Single Arm Row','Face Pull','Rear Delt Fly','Barbell Curl','Bayesian Curl','Hammer Curl' ]},
      { name: 'Legs HV', exercises: [ 'Back Squat','RDL','Leg Press','Hack Squat','Seated Leg Curl','Leg Extension','Calf Raise' ]},
      { name: 'Upper Accessory', exercises: [ 'Incline DB Press','Cable Row','Lat Pulldown','Lateral Raise','Rear Delt Fly','Triceps Pushdown','Barbell Curl' ]},
      { name: 'Lower Accessory', exercises: [ 'Romanian Deadlift','Walking Lunge','Leg Press','Leg Curl','Leg Extension','Calf Raise','Ab Wheel' ]},
      { name: 'Full Body Pump', exercises: [ 'Front Squat','Chest Fly','Cable Row','Hip Thrust','Lateral Raise','Bayesian Curl','Triceps Pushdown','Hanging Leg Raise' ]}
    ]
  },
  {
    id: 'high-frequency-7d',
    name: 'High Frequency Daily',
    headline: 'Daily training emphasis · 7 day microcycle',
    description: 'Distributes smaller per-session doses across 7 consecutive training days (with one being very light) to raise frequency while moderating fatigue spikes. Intended for advanced lifters with excellent recovery discipline.',
    category: 'High Frequency',
    weeks: 8,
    deload: 'interval-5w',
    weekLengthDays: 7,
    weeklySplit: split(['Full Body','Full Body','Upper','Lower','Full Body','Arms','Active Recovery']),
    volumeTargets: { chest: 16, back: 18, quads: 14, hamstrings: 12, glutes: 12, shoulders: 14, biceps: 12, triceps: 12, calves: 8, core: 8 },
    templateBlueprints: [
      { name: 'Full Body Heavy', exercises: [ 'Back Squat','Flat Barbell Bench','Chest Supported Row','RDL','Lat Pulldown','Calf Raise' ]},
      { name: 'Full Body Power', exercises: [ 'Front Squat','Incline DB Press','Cable Row','Hip Thrust','Rear Delt Fly','Ab Wheel' ]},
      { name: 'Upper Micro', exercises: [ 'Incline DB Press','Cable Row','Lat Pulldown','Lateral Raise','Triceps Pushdown','Barbell Curl' ]},
      { name: 'Lower Micro', exercises: [ 'Hack Squat','Leg Press','Seated Leg Curl','Leg Extension','Calf Raise','Plank' ]},
      { name: 'Full Body Light', exercises: [ 'Leg Press','Overhead Press','Single Arm Row','Chest Fly','Leg Curl','Hanging Leg Raise' ]},
      { name: 'Arms Focus', exercises: [ 'Barbell Curl','Bayesian Curl','Hammer Curl','Triceps Pushdown','Overhead Extension','Lateral Raise' ]},
      { name: 'Active Recovery', exercises: [ 'Walking Lunge','Face Pull','Rear Delt Fly','Calf Raise','Plank' ]}
    ],
    variants: ['Can optionally insert rest after Day 4 for 6on/1off cadence']
  }
];

/** Resolve blueprint templates to concrete Template objects using fuzzy name matching. */
export function buildPresetTemplates(exercises: Exercise[]): Template[] {
  const lowerMap = new Map(exercises.map(e => [e.name.toLowerCase(), e]));
  const pick = (want: string): string | null => {
    const key = want.toLowerCase();
    // Exact match
    if (lowerMap.has(key)) return lowerMap.get(key)!.id;
    // Contains search (prefer shortest containing match)
    let candidate: Exercise | null = null;
    for (const e of exercises) {
      if (e.name.toLowerCase().includes(key)) {
        if (!candidate || e.name.length < candidate.name.length) candidate = e;
      }
    }
    return candidate?.id || null;
  };
  const templates: Template[] = [];
  for (const preset of PRESET_PROGRAMS) {
    for (const bp of preset.templateBlueprints) {
      const resolved: string[] = [];
      for (const exName of bp.exercises) {
        const id = pick(exName);
        if (id) resolved.push(id);
      }
      templates.push({ id: `preset_${preset.id}_${bp.name.replace(/\s+/g,'_').toLowerCase()}`, name: `${preset.name}: ${bp.name}`, exerciseIds: resolved });
    }
  }
  return templates;
}

export interface ResolvedPresetProgram {
  preset: PresetProgramDefinition;
  program: UserProgram; // generic program object (templateIds not embedded here)
  templates: Template[]; // resolved templates (namespaced)
}

/** Build full preset (program + generated template objects). Template IDs are not wired into weeklySplit automatically to keep user mapping flexible. */
export function resolvePreset(p: PresetProgramDefinition, exercises: Exercise[]): ResolvedPresetProgram {
  const templates = buildPresetTemplates(exercises).filter(t => t.name.startsWith(p.name + ':'));
  const program: UserProgram = {
    id: `preset_prog_${p.id}`,
    name: p.name,
    weekLengthDays: p.weekLengthDays,
    weeklySplit: p.weeklySplit.map(d => ({ ...d })),
    mesoWeeks: p.weeks,
    deload: p.deload === 'none' ? { mode: 'none' } : (p.deload === 'last-week' ? { mode: 'last-week' } : { mode: 'interval', everyNWeeks: 5 }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  return { preset: p, program, templates };
}
