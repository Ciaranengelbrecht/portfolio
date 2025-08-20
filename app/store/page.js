"use client";
import { useState, useEffect } from 'react';

// Static preset IDs mapping to existing progress app presets (client will resolve after import)
const PRESETS = [
  { id: 'ul_basic', name: 'Upper/Lower 6-Day', blurb: 'Balanced 6-day upper/lower rotation with adaptive progression.' }
];

export default function StorePage(){
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState(null);
  const [creating,setCreating] = useState(false);
  const [unlockedAll,setUnlockedAll] = useState(false);
  const [paypalReady,setPaypalReady] = useState(false);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  async function loadEntitlement(){
    try {
      const r = await fetch('/api/entitlements').then(r=> r.ok? r.json(): { unlockedAll:false });
      setUnlockedAll(!!r.unlockedAll);
    } catch { setUnlockedAll(false); }
  }

  useEffect(()=> {
  loadEntitlement();
  }, []);

  // Dynamically load PayPal script when needed
  useEffect(()=> {
    if(unlockedAll || !paypalClientId) return;
    if(document.getElementById('paypal-sdk')) { setPaypalReady(true); return; }
    const s = document.createElement('script');
    s.id='paypal-sdk';
    s.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD&intent=capture&disable-funding=paylater&enable-funding=venmo,card`;
    s.onload = ()=> setPaypalReady(true);
    document.head.appendChild(s);
  }, [unlockedAll, paypalClientId]);

  useEffect(()=> {
    if(!paypalReady || unlockedAll || !(window).paypal) return;
    (window).paypal.Buttons({
      style:{ layout:'vertical', shape:'rect', height:46 },
      createOrder: (_, actions)=> actions.order.create({
        purchase_units:[{ reference_id:'all_programs', amount:{ value:'29.00', currency_code:'USD' } }]
      }),
      onApprove: async (_data, actions)=> {
        const order = await actions.order.capture();
        await fetch('/api/paypal/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: order.id }) });
        await loadEntitlement();
        setMessage('Unlocked all programs.');
      },
      onError: err=> { console.error('PayPal error', err); setMessage('Payment error'); }
    }).render('#paypal-button-container');
  }, [paypalReady, unlockedAll]);

  // Stripe checkout removed (PayPal unlock-all only).

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Program Store (Beta)</h1>
      {message && <div className="text-sm text-emerald-300">{message}</div>}
      {!unlockedAll && (
        <div className="rounded-xl border border-white/10 p-4 mb-4 bg-[var(--surface)]/60">
          <h2 className="font-medium mb-1">Unlock All Programs</h2>
          <p className="text-xs text-gray-400 mb-3">One-time payment (PayPal / cards via PayPal). Future program packs included.</p>
          <div id="paypal-button-container" />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {PRESETS.map(p=> {
          return (
            <div key={p.id} className="rounded-xl border border-white/10 p-4 bg-[var(--surface)]/60 backdrop-blur flex flex-col gap-2">
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-400">{p.blurb}</div>
              <div className="flex items-center gap-2 mt-auto pt-2">
                {unlockedAll ? (
                  <button disabled={creating} onClick={async ()=> {
                    setCreating(true);
                    try {
                      const res = await fetch('/api/program/import-preset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presetId: p.id }) });
                      const data = await res.json();
                      if(!res.ok) throw new Error(data.error || 'Import failed');
                      setMessage('Preset imported. Open training app to apply starting weights.');
                    } catch(e){ setMessage(e.message); } finally { setCreating(false); }
                  }} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold disabled:opacity-50">{creating? 'Importing…' : 'Import Preset'}</button>
                ) : <span className="text-xs text-gray-400">Unlock-all above to import</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">PayPal sandbox: configure NEXT_PUBLIC_PAYPAL_CLIENT_ID plus server PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.</p>
    </div>
  );
}
