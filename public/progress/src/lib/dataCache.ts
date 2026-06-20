import { db } from './db';
import type { DBSchema } from './db';
import { trackMetric } from './monitoring';
import { ensureProgram } from './program';
import { primeUserProfile } from './profile';
import {
  sbAppSnapshot,
  type SbAppSnapshotStore,
  type Table as SnapshotTable,
} from './sbData';
import {
  DEVICE_SNAPSHOT_SCHEMA_VERSION,
  readStoreSnapshot,
  writeProgramSnapshot,
  writeStoreSnapshot,
} from './deviceSnapshot';
import type { UserProgram } from './types';

type StoreKey = keyof DBSchema;
interface CacheEntry {
  ts: number;
  data: any[];
  updatedAtIso?: string | null;
  lastFullSyncTs?: number;
}
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

const SCHEMA_VERSION = DEVICE_SNAPSHOT_SCHEMA_VERSION;
const OWNER_KEY = 'pp_cache_owner';
const FULL_RECONCILE_INTERVAL_MS = 10 * 60 * 1000;
const pendingEmitKeys = new Set<string>();
let pendingEmitTimer: number | null = null;
let currentOwnerId: string | null = null;

function fresh(entry: CacheEntry, store: StoreKey, ttlOverride?: number){ 
  const ttl = ttlOverride ?? TTL_CONFIG[store] ?? 10000;
  return Date.now() - entry.ts < ttl; 
}

function persist(store: StoreKey, entry: CacheEntry){
  if(!currentOwnerId) return;
  void writeStoreSnapshot(currentOwnerId, store, entry);
}

function primeDbCache(store: StoreKey, data: any[]) {
  try {
    (db as any).primeStoreCache?.(store, data);
  } catch {}
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
  currentOwnerId = ownerId;
  if(typeof window === 'undefined') return;
  try {
    const existingOwner = sessionStorage.getItem(OWNER_KEY);
    if(existingOwner && existingOwner !== ownerId){
      cache.clear();
      refreshInflight.clear();
    }
    sessionStorage.setItem(OWNER_KEY, ownerId);
  } catch {}
}

export function hasCachedData(stores: StoreKey[]): boolean {
  return stores.every((store) => cache.has(store));
}

export function getCacheOwner(): string | null {
  if(currentOwnerId) return currentOwnerId;
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

export async function hydratePersistentCache(
  ownerId: string,
  stores: StoreKey[] = CACHE_STORES
): Promise<{ hydratedStores: StoreKey[]; rowCount: number }> {
  const startedAt = cacheNow();
  currentOwnerId = ownerId;
  const hydratedStores: StoreKey[] = [];
  let rowCount = 0;
  await Promise.all(
    stores.map(async (store) => {
      const snapshot = await readStoreSnapshot(ownerId, store);
      if(!snapshot) return;
      const hydratedAt = Date.now();
      const entry: CacheEntry = {
        ts: hydratedAt,
        data: snapshot.data,
        updatedAtIso: snapshot.updatedAtIso,
        lastFullSyncTs: snapshot.lastFullSyncTs,
      };
      cache.set(store, entry);
      primeDbCache(store, entry.data);
      hydratedStores.push(store);
      rowCount += entry.data.length;
      emit(store, 'cache-set');
    })
  );
  trackMetric('device_snapshot_read_ms', Math.round(cacheNow() - startedAt), {
    stores: hydratedStores.join(','),
    rows: rowCount,
    schemaVersion: SCHEMA_VERSION,
  });
  return { hydratedStores, rowCount };
}

function mergeById(existing: any[], updates: any[]) {
  if(!updates.length) return existing.slice();
  const byId = new Map<string, any>();
  for(const item of existing) {
    const id = item?.id;
    if(id) byId.set(String(id), item);
  }
  for(const item of updates) {
    const id = item?.id;
    if(id) byId.set(String(id), item);
  }
  return Array.from(byId.values());
}

function nextFullEntry(data: any[], previous?: CacheEntry): CacheEntry {
  const now = Date.now();
  return {
    ts: now,
    data,
    updatedAtIso: previous?.updatedAtIso || null,
    lastFullSyncTs: now,
  };
}

function shouldFullReconcile(entry?: CacheEntry) {
  if(!entry?.updatedAtIso) return true;
  return Date.now() - (entry.lastFullSyncTs || 0) > FULL_RECONCILE_INTERVAL_MS;
}

function normalizeServerRowId(rowId: string) {
  return String(rowId || '').replace(/^[^:]+:/, '');
}

function rowData(row: { id?: string; data: any }) {
  if (!row?.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    return row?.data;
  }
  const id = row.data.id || normalizeServerRowId(String(row.id || ''));
  return id ? { ...row.data, id } : { ...row.data };
}

function changedRows(store: SbAppSnapshotStore) {
  return (store.rows || [])
    .map((row) => rowData(row))
    .filter((row) => row && typeof row === 'object');
}

function reconcileSnapshotRows(
  existing: any[] | undefined,
  updates: any[],
  serverIds: string[],
  incremental: boolean
) {
  if(!incremental) return updates.slice();
  const serverIdSet = new Set(serverIds.map(String));
  const base = (existing || []).filter((row) => {
    const id = row?.id;
    return id && serverIdSet.has(String(id));
  });
  return mergeById(base, updates);
}

function latestUpdatedAt(store: SbAppSnapshotStore, fallback?: string | null) {
  if(store.latestUpdatedAt) return store.latestUpdatedAt;
  return (store.rows || []).reduce<string | null>((latest, row) => {
    const value = row.updated_at;
    if(!value) return latest;
    if(!latest || value > latest) return value;
    return latest;
  }, fallback || null);
}

export type AppSnapshotSyncResult = {
  stores: StoreKey[];
  rows: number;
  program: UserProgram | null;
  full: boolean;
};

export async function syncAppSnapshot(opts?: {
  stores?: StoreKey[];
  forceFull?: boolean;
}): Promise<AppSnapshotSyncResult> {
  const startedAt = cacheNow();
  const stores = opts?.stores || CACHE_STORES;
  const since: Partial<Record<SnapshotTable, string | null>> = {};
  for(const store of stores) {
    const entry = cache.get(store);
    if(!opts?.forceFull && entry?.updatedAtIso) {
      since[store] = entry.updatedAtIso;
    }
  }
  const full = opts?.forceFull || Object.keys(since).length === 0;
  const snapshot = await sbAppSnapshot(since);
  let rows = 0;
  const syncedStores: StoreKey[] = [];
  for(const store of stores) {
    const storeSnapshot = snapshot.stores?.[store];
    if(!storeSnapshot) continue;
    const existing = cache.get(store);
    const updates = changedRows(storeSnapshot);
    const data = reconcileSnapshotRows(
      existing?.data,
      updates,
      storeSnapshot.ids || [],
      Boolean(since[store] && existing)
    );
    const now = Date.now();
    const entry: CacheEntry = {
      ts: now,
      data,
      updatedAtIso: latestUpdatedAt(storeSnapshot, existing?.updatedAtIso),
      lastFullSyncTs: now,
    };
    cache.set(store, entry);
    primeDbCache(store, entry.data);
    persist(store, entry);
    emit(store, 'cache-refresh');
    rows += data.length;
    syncedStores.push(store);
  }

  let program: UserProgram | null = null;
  const profileProgram = snapshot.profile?.program;
  if(snapshot.profile?.id) {
    primeUserProfile(snapshot.profile as any);
  }
  if(currentOwnerId && profileProgram) {
    program = ensureProgram(profileProgram);
    await writeProgramSnapshot(currentOwnerId, program);
  }

  trackMetric('app_snapshot_sync_ms', Math.round(cacheNow() - startedAt), {
    stores: syncedStores.join(','),
    rows,
    full,
  });
  return { stores: syncedStores, rows, program, full };
}

export async function getAllCached<T=any>(store: StoreKey, opts?: CacheOpts): Promise<T[]> {
  const startedAt = cacheNow();
  const force = opts?.force;
  const swr = opts?.swr;
  const ttlMs = opts?.ttlMs;
  let existing = cache.get(store);
  if(!existing && currentOwnerId) {
    await hydratePersistentCache(currentOwnerId, [store]);
    existing = cache.get(store);
  }
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
  const entry = nextFullEntry(data, existing);
  cache.set(store, entry); primeDbCache(store, entry.data); persist(store, entry); emit(store,'cache-set');
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
      const existing = cache.get(store);
      const getUpdatedSince = (db as any).getAllUpdatedSince as
        | undefined
        | (<T=any>(s: StoreKey, iso: string) => Promise<{ data: T[]; updatedAtIso: string | null }>);
      if(existing?.updatedAtIso && getUpdatedSince && !shouldFullReconcile(existing)) {
        const updated = await getUpdatedSince(store, existing.updatedAtIso);
        const data = mergeById(existing.data, updated.data);
        const entry: CacheEntry = {
          ts: Date.now(),
          data,
          updatedAtIso: updated.updatedAtIso || existing.updatedAtIso,
          lastFullSyncTs: existing.lastFullSyncTs || existing.ts,
        };
        cache.set(store, entry); primeDbCache(store, entry.data); persist(store, entry); emit(store,'cache-refresh');
        emitLoadMetric(store, startedAt, 'incremental-refresh', data.length, { force: true });
        return;
      }
      const data = await db.getAll(store);
      const entry = nextFullEntry(data, existing);
      cache.set(store, entry); primeDbCache(store, entry.data); persist(store, entry); emit(store,'cache-refresh');
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
  if(store) { cache.delete(store); refreshInflight.delete(store); }
  else {
    cache.clear();
    refreshInflight.clear();
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
