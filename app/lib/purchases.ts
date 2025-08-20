// Helper utilities for querying purchase / entitlement state server-side
import { assertAdmin } from './supabaseAdmin';

export async function listUserPurchases(userId: string){
  const admin = assertAdmin();
  const { data, error } = await admin.from('purchases').select('*').eq('user_id', userId).eq('status','paid');
  if(error) throw error;
  return data || [];
}

export async function hasGlobalUnlock(userId: string){
  const purchases = await listUserPurchases(userId);
  return purchases.some(p=> p.provider === 'paypal');
}

export async function unlockedPacks(userId: string){
  const purchases = await listUserPurchases(userId);
  return purchases.filter(p=> p.provider === 'stripe' && p.pack_id).map(p=> p.pack_id as string);
}
