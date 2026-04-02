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

type LocalSettingsCacheRecord = {
  data: any;
  updatedAt: number;
};

const READ_CACHE = new Map<StoreKey, CacheRecord>();
const INFLIGHT_LIST = new Map<StoreKey, Promise<any[]>>();
const SETTINGS_LOCAL_CACHE_KEY = "liftlog:settings-cache:v1";
let INFLIGHT_SETTINGS_SYNC: Promise<void> | null = null;

const READ_TTL_MS: Record<StoreKey, number> = {
  // Keep aligned with dataCache defaults to avoid double-cache churn.
  exercises: 60_000,
  templates: 60_000,
  settings: 60_000,
  sessions: 45_000,
  measurements: 20_000,
};
const RETRY_DELAYS_MS = [400, 800, 1600] as const;

function isFresh(store: StoreKey, ts: number) {
  return Date.now() - ts < READ_TTL_MS[store];
}

function isRecoverableAuthOrNetworkError(error: any) {
  const msg = String(error?.message || error);
  const status = (error && (error.status || error.code)) || "";
  return (
    /Not signed in|jwt|token|auth|401|permission/i.test(msg) ||
    String(status) === "401" ||
    /Failed to fetch|TypeError|NetworkError|timeout|temporarily|ECONN|fetch/i.test(
      msg
    )
  );
}

async function runWithSessionRefreshRetry<T>(
  fn: () => Promise<T>
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!isRecoverableAuthOrNetworkError(error)) {
        throw error;
      }
      if (attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
      await forceRefreshSession();
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt])
      );
    }
  }
  throw lastError;
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

function extractSettingsUpdatedAt(value: any): number {
  if (!value || typeof value !== "object") return 0;
  const raw =
    value.settingsUpdatedAt ||
    value.updatedAt ||
    value.lastUpdatedAt ||
    value.modifiedAt;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

function readLocalSettingsCache(): LocalSettingsCacheRecord | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(SETTINGS_LOCAL_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    // Backward compatibility with previous cache format that stored plain settings object.
    if (parsed.data && typeof parsed.data === "object") {
      return {
        data: parsed.data,
        updatedAt:
          typeof parsed.updatedAt === "number"
            ? parsed.updatedAt
            : extractSettingsUpdatedAt(parsed.data) || Date.now(),
      };
    }
    return {
      data: parsed,
      updatedAt: extractSettingsUpdatedAt(parsed) || Date.now(),
    };
  } catch {
    return undefined;
  }
}

function writeLocalSettingsCache(value: any) {
  if (typeof window === "undefined") return;
  try {
    if (!value || typeof value !== "object") return;
    const { id: _id, ...rest } = value;
    const updatedAt = extractSettingsUpdatedAt(rest) || Date.now();
    localStorage.setItem(
      SETTINGS_LOCAL_CACHE_KEY,
      JSON.stringify({ data: rest, updatedAt })
    );
  } catch {}
}

async function syncLocalSettingsToRemote() {
  if (INFLIGHT_SETTINGS_SYNC) return INFLIGHT_SETTINGS_SYNC;
  INFLIGHT_SETTINGS_SYNC = (async () => {
    try {
      const local = readLocalSettingsCache();
      if (!local?.data) return;
      const owner = await getOwnerIdFast({ timeoutMs: 1200 });
      const remote = await sbGet("settings", "app");
      const remoteData = remote?.data || {};
      const remoteTs = extractSettingsUpdatedAt(remoteData);
      if (local.updatedAt <= remoteTs) return;
      const payload = {
        ...remoteData,
        ...local.data,
        id: "app",
        settingsUpdatedAt:
          local.data.settingsUpdatedAt || new Date(local.updatedAt).toISOString(),
      };
      await sbUpsert("settings", owner, "app", payload);
    } catch {
      // Best effort: keep local cache and retry on future auth events or writes.
    }
  })().finally(() => {
    INFLIGHT_SETTINGS_SYNC = null;
  });
  return INFLIGHT_SETTINGS_SYNC;
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
      let mapped = rows.map((r: any) =>
        store === "settings" ? { ...r.data, id: "app" } : r.data
      );
      if (store === "settings") {
        const local = readLocalSettingsCache();
        const remote = mapped[0];
        if (!remote && local?.data) {
          mapped = [{ ...local.data, id: "app" }];
        } else if (remote && local?.data) {
          const remoteTs = extractSettingsUpdatedAt(remote);
          if (local.updatedAt > remoteTs) {
            mapped = [{ ...local.data, id: "app" }];
            void syncLocalSettingsToRemote();
          } else {
            writeLocalSettingsCache(remote);
          }
        } else if (remote) {
          writeLocalSettingsCache(remote);
        }
      }
      return mapped;
    };

    const fetchPromise = (async () => {
      try {
        const result = await runWithSessionRefreshRetry(attempt);
        READ_CACHE.set(store, { ts: Date.now(), data: copyList(result) });
        return result;
      } finally {
        INFLIGHT_LIST.delete(store);
      }
    })();

    INFLIGHT_LIST.set(store, fetchPromise);

    try {
      const result = await fetchPromise;
      return copyList(result) as T[];
    } catch (e) {
      if (store === "settings") {
        const local = readLocalSettingsCache();
        if (local?.data) {
          const fallback = [{ ...local.data, id: "app" }] as T[];
          READ_CACHE.set(store, {
            ts: Date.now(),
            data: copyList(fallback as any[]),
          });
          return fallback;
        }
      }
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
      let mapped = row
        ? store === "settings"
          ? ({ ...row.data, id: "app" } as any)
          : row.data
        : undefined;
      if (store === "settings" && key === "app") {
        const local = readLocalSettingsCache();
        if (!mapped && local?.data) {
          mapped = { ...local.data, id: "app" } as any;
        } else if (mapped && local?.data) {
          const remoteTs = extractSettingsUpdatedAt(mapped);
          if (local.updatedAt > remoteTs) {
            mapped = { ...local.data, id: "app" } as any;
            void syncLocalSettingsToRemote();
          } else {
            writeLocalSettingsCache(mapped as any);
          }
        } else if (mapped) {
          writeLocalSettingsCache(mapped as any);
        }
      }
      return mapped;
    };
    try {
      const found = await runWithSessionRefreshRetry(attempt);
      if (store === "settings" && key === "app") {
        if (found) return found;
        const local = readLocalSettingsCache();
        if (local?.data) return { ...local.data, id: "app" } as T;
      }
      return found;
    } catch (e: any) {
      if (store === "settings" && key === "app") {
        const local = readLocalSettingsCache();
        if (local?.data) return { ...local.data, id: "app" } as T;
      }
      throw e;
    }
  },
  async put<T extends any>(store: keyof DBSchema, value: any): Promise<void> {
    const id = value?.id ?? (store === "settings" ? "app" : undefined);
    if (!id) throw new Error("Missing id for put");
    let nextValue = value;
    if (store === "settings") {
      nextValue = {
        ...(value || {}),
        id,
        settingsUpdatedAt: value?.settingsUpdatedAt || new Date().toISOString(),
      };
      writeLocalSettingsCache(nextValue);
    }
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
      MEM[store].set(id, nextValue);
      return;
    }
    const attempt = async () => {
      const owner = await getOwnerId();
      let payload = nextValue;
      if (store === "settings") {
        // Defensive merge: preserve unrelated preferences when a caller writes a partial settings object.
        const current = await sbGet("settings" as any, id);
        payload = {
          ...(current?.data || {}),
          ...(nextValue || {}),
          id,
          settingsUpdatedAt:
            (nextValue as any)?.settingsUpdatedAt || new Date().toISOString(),
        };
        writeLocalSettingsCache(payload);
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
      await runWithSessionRefreshRetry(attempt);
    } catch (e: any) {
      if (store === "settings") {
        // Settings are cached locally for eventual consistency.
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
    await runWithSessionRefreshRetry(attempt);
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
  window.addEventListener("sb-auth", () => {
    void syncLocalSettingsToRemote();
  });
}
