import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!; // Keep only server-side

export const supabaseAdmin = (!url || !serviceKey)
  ? null
  : createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export function assertAdmin(){
  if(!supabaseAdmin) throw new Error('supabase_admin_not_configured');
  return supabaseAdmin;
}
