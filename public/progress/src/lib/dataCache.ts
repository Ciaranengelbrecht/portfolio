import { db } from './db';
import type { DBSchema } from './db';
import { trackMetric } from './monitoring';

type StoreKey = keyof DBSchema;
interface CacheEntry { ts: number; data: any[]; }
const cache = new Map<StoreKey, CacheEntry>();
const refreshInflight = new Map<StoreKey, Promise<void>>();
const CACHE_STORES: StoreKey[] = ['sessions','exercises','measurements','templates','settings'];

// Differentiated TTL: static data gets longer cache, dynamic data shorter
const TTL_CONFIG: Record<StoreKey, number> = {
  exercises: 60000,   // 60s (mostly static)
  templates: 60000,   // 60s (mostly static)
  settings: 60000,    // 60s (rarely changes)
  sessions: 45000,    // 45s default; overridden dynamically when editing
  measurements: 20000 // 20s (moderately updated)
};

const PERSIST_PREFIX = 'pp_cache_';
const SCHEMA_VERSION = 2; // bump when underlying data shape changes
const SCHEMA_KEY = 'pp_cache_schema_version';
const OWNER_KEY = 'pp_cache_owner';
const pendingEmitKeys = new Set<string>();
let pendingEmitTimer: number | null = null;

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
      CACHE_STORES.forEach(k=> sessionStorage.removeItem(PERSIST_PREFIX + k));
      sessionStorage.removeItem(OWNER_KEY);
      sessionStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    }
    CACHE_STORES.forEach(k=>{
      const raw = sessionStorage.getItem(PERSIST_PREFIX + k);
      if(!raw) return; const parsed = JSON.parse(raw) as CacheEntry; if(parsed?.data && Array.isArray(parsed.data)) cache.set(k, parsed);
    });
  } catch {}
}

function persist(store: StoreKey, entry: CacheEntry){
  try { sessionStorage.setItem(PERSIST_PREFIX + store, JSON.stringify(entry)); } catch {}
}

function flushEmits(){
  if(typeof window=== 'undefined') return;
  const keys = Array.from(pendingEmitKeys);
  pendingEmitKeys.clear();
  pendingEmitTimer = null;
  for(const key of keys){
    const [type, store] = key.split(':') as ['cache-set'|'cache-refresh', StoreKey];
    window.dispatchEvent(new CustomEvent(type,{ detail:{ store } }));
  }
}

function emit(store: StoreKey, type: 'cache-set'|'cache-refresh'){
  if(typeof window=== 'undefined') return;
  pendingEmitKeys.add(`${type}:${store}`);
  if(pendingEmitTimer != null) return;
  pendingEmitTimer = window.setTimeout(flushEmits, 16);
}

type CacheOpts = { force?: boolean; swr?: boolean; ttlMs?: number };

function cacheNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function emitLoadMetric(
  store: StoreKey,
  startedAt: number,
  source: string,
  rows: number,
  opts?: CacheOpts & { stale?: boolean }
) {
  trackMetric('data_cache_read_ms', Math.round(cacheNow() - startedAt), {
    store,
    source,
    rows,
    force: Boolean(opts?.force),
    swr: Boolean(opts?.swr),
    stale: Boolean(opts?.stale),
  });
}

export function setCacheOwner(ownerId: string){
  if(typeof window === 'undefined') return;
  try {
    const existingOwner = sessionStorage.getItem(OWNER_KEY);
    if(existingOwner && existingOwner !== ownerId){
      invalidate();
    }
    sessionStorage.setItem(OWNER_KEY, ownerId);
  } catch {}
}

export function hasCachedData(stores: StoreKey[]): boolean {
  return stores.every((store) => cache.has(store));
}

export function getCacheOwner(): string | null {
  if(typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function peekCached<T=any>(store: StoreKey, ownerId?: string | null): T[] | null {
  if(ownerId && getCacheOwner() !== ownerId) return null;
  const existing = cache.get(store);
  return existing ? (existing.data as T[]) : null;
}

export async function getAllCached<T=any>(store: StoreKey, opts?: CacheOpts): Promise<T[]> {
  const startedAt = cacheNow();
  const force = opts?.force;
  const swr = opts?.swr;
  const ttlMs = opts?.ttlMs;
  const existing = cache.get(store);
  const isFresh = existing ? fresh(existing, store, ttlMs) : false;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if(offline){
    if(existing) {
      emitLoadMetric(store, startedAt, 'offline-cache', existing.data.length, opts);
      return existing.data as T[];
    }
    throw new Error(`Offline with no cached data for ${store}`);
  }
  if(!force && existing && isFresh) {
    emitLoadMetric(store, startedAt, 'memory', existing.data.length, opts);
    return existing.data as T[];
  }
  if(swr && existing && !isFresh){
    // return stale and refresh in background
    refresh(store);
    emitLoadMetric(store, startedAt, 'stale-memory', existing.data.length, { ...opts, stale: true });
    return existing.data as T[];
  }
  if(swr && existing && !force && isFresh){
    // staleWhileRevalidate with not expired yet simply return
    emitLoadMetric(store, startedAt, 'memory', existing.data.length, opts);
    return existing.data as T[];
  }
  const data = await db.getAll<T>(store);
  const entry = { ts: Date.now(), data };
  cache.set(store, entry); persist(store, entry); emit(store,'cache-set');
  emitLoadMetric(store, startedAt, 'remote', data.length, opts);
  return data;
}

export async function refresh(store: StoreKey){
  const inflight = refreshInflight.get(store);
  if(inflight) return inflight;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if(offline) return;
  const startedAt = cacheNow();
  const promise = (async () => {
    try {
      const data = await db.getAll(store);
      const entry = { ts: Date.now(), data };
      cache.set(store, entry); persist(store, entry); emit(store,'cache-refresh');
      emitLoadMetric(store, startedAt, 'refresh', data.length, { force: true });
    } catch(e){
      if(import.meta.env.DEV) console.warn('[dataCache] refresh failed', store, e);
    } finally {
      refreshInflight.delete(store);
    }
  })();
  refreshInflight.set(store, promise);
  return promise;
}

export function warmPreload(stores: StoreKey[], opts?: { swr?: boolean }){
  stores.forEach((s) => {
    void getAllCached(s, { swr: opts?.swr }).catch(() => {});
  });
}

export function invalidate(store?: StoreKey){
  if(store) { cache.delete(store); refreshInflight.delete(store); try { sessionStorage.removeItem(PERSIST_PREFIX+store); } catch {} }
  else {
    cache.clear();
    refreshInflight.clear();
    try {
      CACHE_STORES.forEach(k=> sessionStorage.removeItem(PERSIST_PREFIX+k));
    } catch {}
  }
}

// Invalidate cache on realtime events
if(typeof window !== 'undefined') {
  window.addEventListener('sb-change', (e: any)=> {
    const tbl = e?.detail?.table as StoreKey | undefined;
    if(tbl && ['sessions','exercises','measurements','settings','templates'].includes(tbl)) invalidate(tbl as StoreKey);
  });
  window.addEventListener('sb-auth', ()=> invalidate());
}
