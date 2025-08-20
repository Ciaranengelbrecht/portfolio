import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { assertAdmin } from '../../../lib/supabaseAdmin';

export const config = { api: { bodyParser: false } } as any; // ensure raw body (Next API routes config legacy)

function buffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return new Response(stream).arrayBuffer().then(b=> Buffer.from(b));
}

export async function POST(req: NextRequest){
  const sig = req.headers.get('stripe-signature');
  if(!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET){
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  try {
    const bodyBuf = await buffer(req.body!);
    const evt = stripe.webhooks.constructEvent(bodyBuf, sig || '', process.env.STRIPE_WEBHOOK_SECRET);
    if(evt.type === 'checkout.session.completed'){
      const sess = evt.data.object as Stripe.Checkout.Session;
      const packId = sess.metadata?.packId || null;
      // We require the app to have already created a user session; session metadata could include user id later.
      // For now we attempt to look up by email (NOT ideal). Prefer passing user id in metadata when initiating checkout.
      const email = sess.customer_email || undefined;
      if(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && email && packId){
        try {
          const admin = assertAdmin();
          // Attempt fetch the user id via auth.users (requires service role) by email
          // NOTE: '@supabase/supabase-js' admin client currently lacks direct listUsers unless using GoTrue admin API.
          // As a minimal placeholder, store row with null user_id; a separate reconciliation job can attach user later.
          await admin.from('purchases').upsert({
            user_id: null,
            provider: 'stripe',
            external_id: sess.id,
            status: 'paid',
            amount_cents: sess.amount_total || null,
            currency: (sess.currency || '').toLowerCase() || null,
            pack_id: packId
          }, { onConflict: 'provider,external_id' });
          console.log('[stripe:webhook] purchase recorded', sess.id, packId);
        } catch(e:any){
          console.error('[stripe:webhook] upsert failed', e.message);
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch(e:any){
    console.error('Webhook error', e.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
