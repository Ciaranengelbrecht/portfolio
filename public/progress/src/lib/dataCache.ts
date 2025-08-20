import { db } from './db';
import type { DBSchema } from './db';

type StoreKey = keyof DBSchema;
interface CacheEntry { ts: number; data: any[]; }
const cache = new Map<StoreKey, CacheEntry>();
const TTL_MS = 10000; // 10s soft TTL

function fresh(entry: CacheEntry){ return (Date.now() - entry.ts) < TTL_MS; }

export async function getAllCached<T=any>(store: StoreKey, opts?: { force?: boolean }): Promise<T[]> {
  const force = opts?.force;
  const c = cache.get(store);
  if(!force && c && fresh(c)) return c.data as T[];
  const data = await db.getAll<T>(store);
  cache.set(store, { ts: Date.now(), data });
  return data;
}

export function invalidate(store?: StoreKey){
  if(store) cache.delete(store); else cache.clear();
}

// Invalidate cache on realtime events
if(typeof window !== 'undefined') {
  window.addEventListener('sb-change', (e: any)=> {
    const tbl = e?.detail?.table as StoreKey | undefined;
    if(tbl && ['sessions','exercises','measurements','settings','templates'].includes(tbl)) invalidate(tbl as StoreKey);
  });
  window.addEventListener('sb-auth', ()=> invalidate());
}
