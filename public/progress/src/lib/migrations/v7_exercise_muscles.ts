// Migration v7: Expand muscle groups (hamstrings, quads) and add secondaryMuscles field.
// Heuristic mapping of existing exercises; safe additive migration.
import { db } from '../db';
import { Exercise } from '../types';

const HAM_PAT = /(rdl|romanian|leg curl|hamstring|good morning|nordic)/i;
const QUAD_PAT = /(squat|leg press|leg extension|hack squat|front squat|lunge|split squat)/i;

export async function migrateToV7(){
  try {
    const all = await db.getAll<Exercise>('exercises');
    for(const ex of all){
      let changed=false;
      // If exercise previously tagged 'legs', attempt refine
      if(ex.muscleGroup === 'legs'){
        if(HAM_PAT.test(ex.name) && !QUAD_PAT.test(ex.name)) { ex.muscleGroup = 'hamstrings'; changed=true; }
        else if(QUAD_PAT.test(ex.name) && !HAM_PAT.test(ex.name)) { ex.muscleGroup = 'quads'; changed=true; }
        // mixed patterns leave as legs (user can refine manually)
      }
      // Ensure secondaryMuscles array exists (empty) for consistency
      if(!(ex as any).secondaryMuscles){ (ex as any).secondaryMuscles = []; changed=true; }
      if(changed){ await db.put('exercises', ex); }
    }
    console.log('[migrateToV7] Completed exercise muscle enrichment');
  } catch(e){ console.warn('[migrateToV7] error', e); }
}
