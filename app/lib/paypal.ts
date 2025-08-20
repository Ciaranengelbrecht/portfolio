export async function getPayPalAccessToken(){
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const base = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com';
  if(!id || !secret) throw new Error('paypal_env_missing');
  const res = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if(!res.ok) throw new Error('paypal_token_failed');
  const data = await res.json();
  return data.access_token as string;
}

export async function fetchPayPalOrder(orderId: string){
  const base = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com';
  const token = await getPayPalAccessToken();
  const res = await fetch(`${base}/v2/checkout/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
  if(!res.ok) throw new Error('paypal_order_fetch_failed');
  return res.json();
}
