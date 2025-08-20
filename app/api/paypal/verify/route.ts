import { NextRequest, NextResponse } from 'next/server';
import { fetchPayPalOrder } from '../../../lib/paypal';
import { supabase } from '../../../../public/progress/src/lib/supabase';
import { assertAdmin } from '../../../lib/supabaseAdmin';

async function getUser(){
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch { return null; }
}

export async function POST(req: NextRequest){
  try {
    const user = await getUser();
    if(!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
    const { orderId } = await req.json();
    if(!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });
    const order = await fetchPayPalOrder(orderId);
    if(order.status !== 'COMPLETED') return NextResponse.json({ error: 'not_completed' }, { status: 400 });
    const unit = order.purchase_units?.[0];
    const amount = unit?.amount; // { value:'29.00', currency_code:'USD' }
    // Basic validation (optional tighten):
    if(amount?.currency_code !== 'USD') return NextResponse.json({ error: 'currency_mismatch' }, { status: 400 });
    // Idempotent upsert (unique provider+external_id ensures single row)
    try {
      const admin = assertAdmin();
      await admin.from('purchases').upsert({
        user_id: user.id,
        provider: 'paypal',
        external_id: order.id,
        status: 'paid',
        amount_cents: amount ? Math.round(parseFloat(amount.value) * 100) : null,
        currency: amount?.currency_code?.toLowerCase(),
        pack_id: null
      }, { onConflict: 'provider,external_id' });
    } catch(e:any){
      return NextResponse.json({ error: 'db_error', detail: e.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, orderId: order.id });
  } catch(e:any){
    return NextResponse.json({ error: e.message || 'fail' }, { status: 500 });
  }
}
