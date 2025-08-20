import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../public/progress/src/lib/supabase';
import { PRESET_PROGRAMS, resolvePreset } from '../../../../public/progress/src/lib/presets';
import { Exercise, Session, UserProgram } from '../../../../public/progress/src/lib/types';
import { computeStartingWeights } from '../../../../public/progress/src/lib/startingWeights';
import { ensureProgram } from '../../../../public/progress/src/lib/program';

async function getUser(){
  try { const { data:{ user } } = await supabase.auth.getUser(); return user; } catch { return null; }
}

export async function POST(req: NextRequest){
  try {
    const user = await getUser();
    if(!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
    const { presetId } = await req.json();
    const preset = PRESET_PROGRAMS.find(p=> p.id === presetId);
    if(!preset) return NextResponse.json({ error: 'preset_not_found' }, { status: 404 });
    // NOTE: Server environment here cannot access client IndexedDB; you would normally fetch exercises & sessions from Supabase.
    // Placeholder: return only program + templates; starting weights must be computed client-side using existing local data.
    const exercises: Exercise[] = []; const sessions: Session[] = [];
    const resolved = resolvePreset(preset, exercises);
    const newProgram: UserProgram = ensureProgram(resolved.program);
    const starting = computeStartingWeights(exercises, sessions); // will be empty now
    return NextResponse.json({ program: newProgram, templates: resolved.templates, starting });
  } catch(e:any){
    return NextResponse.json({ error: e.message || 'fail' }, { status: 500 });
  }
}
