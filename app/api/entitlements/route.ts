import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../public/progress/src/lib/supabase';
import { assertAdmin } from '../../lib/supabaseAdmin';

async function getUser(){
  try { const { data:{ user } } = await supabase.auth.getUser(); return user; } catch { return null; }
}

export async function GET(_req: NextRequest){
  const user = await getUser();
  if(!user) return NextResponse.json({ unlockedAll:false, packs: [] });
  try {
    const admin = assertAdmin();
    const { data, error } = await admin.from('purchases').select('provider,status,pack_id').eq('user_id', user.id).eq('status','paid');
    if(error) throw error;
    const unlockedAll = !!data?.find(r=> r.provider === 'paypal');
    const packs = (data||[]).filter(r=> r.provider === 'stripe' && r.pack_id).map(r=> r.pack_id);
    return NextResponse.json({ unlockedAll, packs });
  } catch(e:any){
    return NextResponse.json({ unlockedAll:false, packs: [], error: e.message }, { status: 500 });
  }
}
