import { db } from './db';
import type { DBSchema } from './db';

type StoreKey = keyof DBSchema;
interface CacheEntry { ts: number; data: any[]; }
const cache = new Map<StoreKey, CacheEntry>();

// Differentiated TTL: static data gets longer cache, dynamic data shorter
const TTL_CONFIG: Record<StoreKey, number> = {
  exercises: 60000,   // 60s (mostly static)
  templates: 60000,   // 60s (mostly static)
  settings: 60000,    // 60s (rarely changes)
  sessions: 45000,    // 45s default; overridden dynamically when editing
  measurements: 20000 // 20s (moderately updated)
};

const PERSIST_PREFIX = 'pp_cache_';
const SCHEMA_VERSION = 1; // bump when underlying data shape changes
const SCHEMA_KEY = 'pp_cache_schema_version';

function fresh(entry: CacheEntry, store: StoreKey, ttlOverride?: number){ 
  const ttl = ttlOverride ?? TTL_CONFIG[store] ?? 10000;
  return Date.now() - entry.ts < ttl; 
}

// Load persisted cache (session scoped for safety; switch to localStorage if you want longer retention)
if(typeof window !== 'undefined'){
  try {
    const existingVersion = sessionStorage.getItem(SCHEMA_KEY);
    if(String(existingVersion) !== String(SCHEMA_VERSION)){
      // Purge old cache on version mismatch
      (['sessions','exercises','measurements','templates','settings'] as StoreKey[]).forEach(k=> sessionStorage.removeItem(PERSIST_PREFIX + k));
      sessionStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    }
    (['sessions','exercises','measurements','templates','settings'] as StoreKey[]).forEach(k=>{
      const raw = sessionStorage.getItem(PERSIST_PREFIX + k);
      if(!raw) return; const parsed = JSON.parse(raw) as CacheEntry; if(parsed?.data && Array.isArray(parsed.data)) cache.set(k, parsed);
    });
  } catch {}
}

function persist(store: StoreKey, entry: CacheEntry){
  try { sessionStorage.setItem(PERSIST_PREFIX + store, JSON.stringify(entry)); } catch {}
}

function emit(store: StoreKey, type: 'cache-set'|'cache-refresh'){
  if(typeof window!== 'undefined') window.dispatchEvent(new CustomEvent(type,{ detail:{ store } }));
}

type CacheOpts = { force?: boolean; swr?: boolean; ttlMs?: number };

export async function getAllCached<T=any>(store: StoreKey, opts?: CacheOpts): Promise<T[]> {
  const force = opts?.force;
  const swr = opts?.swr;
  const ttlMs = opts?.ttlMs;
  const existing = cache.get(store);
  const isFresh = existing ? fresh(existing, store, ttlMs) : false;
  if(!force && existing && isFresh) return existing.data as T[];
  if(swr && existing && !isFresh){
    // return stale and refresh in background
    refresh(store);
    return existing.data as T[];
  }
  if(swr && existing && !force && isFresh){
    // staleWhileRevalidate with not expired yet simply return
    return existing.data as T[];
  }
  const data = await db.getAll<T>(store);
  const entry = { ts: Date.now(), data };
  cache.set(store, entry); persist(store, entry); emit(store,'cache-set');
  return data;
}

export async function refresh(store: StoreKey){
  try {
    const data = await db.getAll(store);
    const entry = { ts: Date.now(), data };
    cache.set(store, entry); persist(store, entry); emit(store,'cache-refresh');
  } catch(e){ 
    if(import.meta.env.DEV) console.warn('[dataCache] refresh failed', store, e); 
  }
}

export function warmPreload(stores: StoreKey[], opts?: { swr?: boolean }){
  stores.forEach(s=> { getAllCached(s, { swr: opts?.swr }); });
}

export function invalidate(store?: StoreKey){
  if(store) { cache.delete(store); try { sessionStorage.removeItem(PERSIST_PREFIX+store); } catch {} }
  else { cache.clear(); try { (['sessions','exercises','measurements','templates','settings'] as StoreKey[]).forEach(k=> sessionStorage.removeItem(PERSIST_PREFIX+k)); } catch {} }
}

// Invalidate cache on realtime events
if(typeof window !== 'undefined') {
  window.addEventListener('sb-change', (e: any)=> {
    const tbl = e?.detail?.table as StoreKey | undefined;
    if(tbl && ['sessions','exercises','measurements','settings','templates'].includes(tbl)) invalidate(tbl as StoreKey);
  });
  window.addEventListener('sb-auth', ()=> invalidate());
}
