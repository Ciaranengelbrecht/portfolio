import { Exercise, Measurement, Session, Settings, Template } from "./types";
import { supabase, forceRefreshSession, getOwnerIdFast } from "./supabase";
import { sbUpsert, sbDelete, sbList, sbGet } from "./sbData";

export interface DBSchema {
  exercises: Exercise;
  sessions: Session;
  measurements: Measurement;
  settings: Settings;
  templates: Template;
}

type StoreKey = keyof DBSchema;

type CacheRecord = {
  ts: number;
  data: any[];
};

const READ_CACHE = new Map<StoreKey, CacheRecord>();
const INFLIGHT_LIST = new Map<StoreKey, Promise<any[]>>();

const READ_TTL_MS: Record<StoreKey, number> = {
  exercises: 30_000,
  templates: 30_000,
  settings: 30_000,
  sessions: 25_000,
  measurements: 15_000,
};

function isFresh(store: StoreKey, ts: number) {
  return Date.now() - ts < READ_TTL_MS[store];
}

function copyList<T = any>(rows: T[]): T[] {
  return Array.isArray(rows) ? rows.slice() : [];
}

function invalidateStoreCache(store: StoreKey) {
  READ_CACHE.delete(store);
  INFLIGHT_LIST.delete(store);
}

function invalidateAllCache() {
  READ_CACHE.clear();
  INFLIGHT_LIST.clear();
}

function isTestEnv() {
  try {
    const node =
      typeof process !== "undefined" &&
      (process as any)?.env?.NODE_ENV === "test";
    const vite =
      typeof import.meta !== "undefined" &&
      (import.meta as any)?.env?.MODE === "test";
    return !!(node || vite);
  } catch (e) {
    return false;
  }
}

// Minimal in-memory store used only when running unit tests (no Supabase auth)
const MEM: { [K in keyof DBSchema]: Map<string, any> } = {
  exercises: new Map(),
  sessions: new Map(),
  measurements: new Map(),
  settings: new Map(),
  templates: new Map(),
};

async function getOwnerId(): Promise<string> {
  try {
    const id = await getOwnerIdFast({ timeoutMs: 1500 });
    return id;
  } catch (e) {
    if (isTestEnv()) return "test-owner";
    throw e;
  }
}

export function isUsingLocalStorageFallback() {
  return false;
}

export const db = {
  // No-op for cloud mode; realtime will notify pages to refresh
  async putFromSync<T extends any>(
    _store: keyof DBSchema,
    _value: any
  ): Promise<void> {
    return;
  },
  async deleteFromSync(_store: keyof DBSchema, _key: string) {
    return;
  },

  async getAll<T = any>(store: keyof DBSchema): Promise<T[]> {
    if (isTestEnv()) {
      return Array.from(MEM[store].values()) as any;
    }
    const cached = READ_CACHE.get(store);
    if (cached && isFresh(store, cached.ts)) {
      return copyList(cached.data) as T[];
    }

    const inflight = INFLIGHT_LIST.get(store);
    if (inflight) {
      return (await inflight).slice() as T[];
    }

    const attempt = async () => {
      const rows = await sbList(store as any);
      return rows.map((r: any) =>
        store === "settings" ? { ...r.data, id: "app" } : r.data
      );
    };

    const fetchPromise = (async () => {
      try {
        const result = await attempt();
        READ_CACHE.set(store, { ts: Date.now(), data: copyList(result) });
        return result;
      } catch (e: any) {
        const msg = String(e?.message || e);
        const status = (e && (e.status || e.code)) || "";
        if (
          /Not signed in|jwt|token|auth|401|permission/i.test(msg) ||
          String(status) === "401" ||
          /Failed to fetch|TypeError|NetworkError/i.test(msg)
        ) {
          await forceRefreshSession();
          await new Promise((r) => setTimeout(r, 500));
          const retry = await attempt();
          READ_CACHE.set(store, { ts: Date.now(), data: copyList(retry) });
          return retry;
        }
        throw e;
      } finally {
        INFLIGHT_LIST.delete(store);
      }
    })();

    INFLIGHT_LIST.set(store, fetchPromise);

    try {
      const result = await fetchPromise;
      return copyList(result) as T[];
    } catch (e) {
      invalidateStoreCache(store);
      throw e;
    }
  },
  async get<T = any>(
    store: keyof DBSchema,
    key: string
  ): Promise<T | undefined> {
    if (isTestEnv()) {
      return MEM[store].get(key);
    }
    const cached = READ_CACHE.get(store);
    if (cached && isFresh(store, cached.ts)) {
      const fromCache = cached.data.find((row: any) => row?.id === key);
      if (fromCache) return fromCache as T;
      if (store === "settings" && key === "app") {
        const settingsRow = cached.data.find((row: any) => row?.id === "app");
        if (settingsRow) return settingsRow as T;
      }
    }
    const attempt = async () => {
      const row = await sbGet(store as any, key);
      return row
        ? store === "settings"
          ? ({ ...row.data, id: "app" } as any)
          : row.data
        : undefined;
    };
    try {
      return await attempt();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const status = (e && (e.status || e.code)) || "";
      if (
        /Not signed in|jwt|token|auth|401|permission/i.test(msg) ||
        String(status) === "401" ||
        /Failed to fetch|TypeError|NetworkError/i.test(msg)
      ) {
        await forceRefreshSession();
        await new Promise((r) => setTimeout(r, 500));
        return await attempt();
      }
      throw e;
    }
  },
  async put<T extends any>(store: keyof DBSchema, value: any): Promise<void> {
    const id = value?.id ?? (store === "settings" ? "app" : undefined);
    if (!id) throw new Error("Missing id for put");
    invalidateStoreCache(store);
    if (isTestEnv()) {
      // Enforce exercise name uniqueness (case-insensitive) in test mode
      if (store === "exercises") {
        const norm = (s: string) =>
          String(s || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");
        for (const v of MEM.exercises.values()) {
          if (v.id !== id && norm(v.name) === norm(value.name)) {
            // Reuse existing by overwriting id to existing id
            MEM.exercises.set(v.id, { ...v, ...value, id: v.id });
            return;
          }
        }
      }
      MEM[store].set(id, value);
      return;
    }
    const attempt = async () => {
      const owner = await getOwnerId();
      let payload = value;
      if (store === "settings") {
        // Defensive merge: preserve unrelated preferences when a caller writes a partial settings object.
        const current = await sbGet("settings" as any, id);
        payload = { ...(current?.data || {}), ...(value || {}), id };
      }
      // Enforce exercise name uniqueness (case-insensitive) at app layer before upsert
      if (store === "exercises") {
        const existing = await sbList("exercises" as any);
        const norm = (s: string) =>
          String(s || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");
        const dup = existing.find(
          (r: any) =>
            r.data?.id !== id && norm(r.data?.name) === norm(value?.name)
        );
        if (dup) {
          // If attempting to create a duplicate, just return without creating another row
          return;
        }
      }
      await sbUpsert(store as any, owner, id, payload);
    };
    try {
      await attempt();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const status = (e && (e.status || e.code)) || "";
      if (
        /Not signed in|jwt|token|auth|401|permission/i.test(msg) ||
        String(status) === "401" ||
        /Failed to fetch|TypeError|NetworkError/i.test(msg)
      ) {
        await forceRefreshSession();
        await new Promise((r) => setTimeout(r, 500));
        await attempt();
        return;
      }
      throw e;
    }
  },
  async delete(store: keyof DBSchema, key: string) {
    invalidateStoreCache(store);
    if (isTestEnv()) {
      MEM[store].delete(key);
      return;
    }
    const attempt = async () => {
      const owner = await getOwnerId();
      await sbDelete(store as any, owner, key);
    };
    try {
      await attempt();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const status = (e && (e.status || e.code)) || "";
      if (
        /Not signed in|jwt|token|auth|401|permission/i.test(msg) ||
        String(status) === "401" ||
        /Failed to fetch|TypeError|NetworkError/i.test(msg)
      ) {
        await forceRefreshSession();
        await new Promise((r) => setTimeout(r, 500));
        await attempt();
        return;
      }
      throw e;
    }
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("sb-change", (e: any) => {
    const table = e?.detail?.table as StoreKey | undefined;
    if (
      table &&
      ["sessions", "exercises", "measurements", "settings", "templates"].includes(
        table
      )
    ) {
      invalidateStoreCache(table);
    }
  });
  window.addEventListener("sb-auth", () => invalidateAllCache());
}
