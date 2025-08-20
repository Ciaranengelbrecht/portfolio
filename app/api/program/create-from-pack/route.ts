import { NextRequest, NextResponse } from 'next/server';
import { PROGRAM_PACKS } from '../../../lib/programPacks';
import { supabase } from '../../../../public/progress/src/lib/supabase';
import { assertAdmin } from '../../../lib/supabaseAdmin';

async function getUser(){
  try { const { data:{ user } } = await supabase.auth.getUser(); return user; } catch { return null; }
}

export async function POST(req: NextRequest){
  try {
    const body = await req.json();
    const { packId } = body;
    if(!packId || !PROGRAM_PACKS[packId]) return NextResponse.json({ error: 'Invalid pack id' }, { status: 400 });
    const user = await getUser();
    if(!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
    // Entitlement: either global unlock (paypal) or stripe purchase for this pack
    try {
      const admin = assertAdmin();
      const { data, error } = await admin.from('purchases')
        .select('provider, pack_id')
        .eq('user_id', user.id)
        .eq('status','paid');
      if(error) throw error;
      const hasGlobal = !!data?.find(r=> r.provider==='paypal');
      const hasPack = !!data?.find(r=> r.provider==='stripe' && r.pack_id===packId);
      if(!hasGlobal && !hasPack){
        return NextResponse.json({ error: 'entitlement_missing' }, { status: 403 });
      }
    } catch(e:any){
      return NextResponse.json({ error: 'entitlement_check_failed', detail: e.message }, { status: 500 });
    }
    const pack = PROGRAM_PACKS[packId];
    const { program } = pack;
    // Expand split shorthand to weeklySplit object array
    const mapChar = (c:string) => {
      if(c==='U') return { type: 'Upper' };
      if(c==='L') return { type: 'Lower' };
      if(c==='P') return { type: 'Push' };
      if(c==='Q') return { type: 'Pull' }; // Q not used; fallback example
      if(c==='G') return { type: 'Legs' };
      if(c==='F') return { type: 'Full Body' };
      if(c==='A') return { type: 'Arms' };
      if(c==='R') return { type: 'Rest' };
      return { type: 'Rest' };
    };
    const weeklySplit = program.split.split('').map(ch=> mapChar(ch));
    const payload = {
      name: pack.name,
      weekLengthDays: program.weekLengthDays,
      mesoWeeks: program.mesoWeeks,
      weeklySplit,
      deload: program.deload,
      version: pack.version
    };
    return NextResponse.json({ program: payload });
  } catch(e:any){
    return NextResponse.json({ error: e.message||'Failed' }, { status: 500 });
  }
}
