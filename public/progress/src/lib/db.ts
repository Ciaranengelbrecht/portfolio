import { Exercise, Measurement, Session, Settings, Template } from "./types";
import { supabase, forceRefreshSession, getOwnerIdFast } from "./supabase";
import { sbUpsert, sbDelete, sbList, sbGet, sbListUpdatedSince } from "./sbData";
import { writeStoreSnapshot } from "./deviceSnapshot";

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
  cachedAt: number;
  dirty?: boolean;
};

const READ_CACHE = new Map<StoreKey, CacheRecord>();
const INFLIGHT_LIST = new Map<StoreKey, Promise<any[]>>();
const SETTINGS_LOCAL_CACHE_PREFIX = "liftlog:settings-cache:v2";
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

function settingsCacheKey(ownerId: string) {
  return `${SETTINGS_LOCAL_CACHE_PREFIX}:${ownerId}`;
}

function comparableSettings(value: any): string {
  if (!value || typeof value !== "object") return "";
  const { id: _id, settingsUpdatedAt: _settingsUpdatedAt, ...rest } = value;
  return JSON.stringify(rest);
}

function settingsFromReadCache(): any | undefined {
  const cached = READ_CACHE.get("settings");
  return cached?.data?.find((row: any) => row?.id === "app");
}

function setSettingsReadCache(value: any) {
  READ_CACHE.set("settings", {
    ts: Date.now(),
    data: [{ ...(value || {}), id: "app" }],
  });
  INFLIGHT_LIST.delete("settings");
}

function updateLoadedStoreSnapshot(
  owner: string,
  store: StoreKey,
  updater: (data: any[]) => any[]
) {
  const cached = READ_CACHE.get(store);
  if (!cached) return;
  const next = updater(copyList(cached.data));
  READ_CACHE.set(store, { ts: Date.now(), data: next });
  void writeStoreSnapshot(owner, store, {
    ts: Date.now(),
    data: next,
    updatedAtIso: new Date().toISOString(),
    lastFullSyncTs: cached.ts,
  });
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

function readLocalSettingsCache(
  ownerId?: string | null
): LocalSettingsCacheRecord | undefined {
  if (typeof window === "undefined" || !ownerId) return undefined;
  try {
    const raw = localStorage.getItem(settingsCacheKey(ownerId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    if (parsed.data && typeof parsed.data === "object") {
      return {
        data: parsed.data,
        updatedAt:
          typeof parsed.updatedAt === "number"
            ? parsed.updatedAt
            : extractSettingsUpdatedAt(parsed.data) || Date.now(),
        cachedAt:
          typeof parsed.cachedAt === "number" ? parsed.cachedAt : Date.now(),
        dirty: Boolean(parsed.dirty),
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeLocalSettingsCache(
  value: any,
  ownerId?: string | null,
  opts?: { dirty?: boolean }
) {
  if (typeof window === "undefined" || !ownerId) return;
  try {
    if (!value || typeof value !== "object") return;
    const { id: _id, ...rest } = value;
    const updatedAt = extractSettingsUpdatedAt(rest) || Date.now();
    localStorage.setItem(
      settingsCacheKey(ownerId),
      JSON.stringify({
        data: rest,
        updatedAt,
        cachedAt: Date.now(),
        dirty: Boolean(opts?.dirty),
      })
    );
  } catch {}
}

async function syncLocalSettingsToRemote() {
  if (INFLIGHT_SETTINGS_SYNC) return INFLIGHT_SETTINGS_SYNC;
  INFLIGHT_SETTINGS_SYNC = (async () => {
    try {
      const owner = await getOwnerIdFast({ timeoutMs: 1200 });
      const local = readLocalSettingsCache(owner);
      if (!local?.data || !local.dirty) return;
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
      writeLocalSettingsCache(payload, owner, { dirty: false });
      setSettingsReadCache(payload);
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
  primeStoreCache<T = any>(store: keyof DBSchema, data: T[]): void {
    READ_CACHE.set(store, { ts: Date.now(), data: copyList(data as any[]) });
    INFLIGHT_LIST.delete(store);
  },

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

    let settingsOwner: string | null = null;
    if (store === "settings") {
      try {
        settingsOwner = await getOwnerId();
        const local = readLocalSettingsCache(settingsOwner);
        if (
          local?.data &&
          Date.now() - local.cachedAt < READ_TTL_MS.settings
        ) {
          const fallback = [{ ...local.data, id: "app" }] as T[];
          READ_CACHE.set("settings", {
            ts: Date.now(),
            data: copyList(fallback as any[]),
          });
          return fallback;
        }
      } catch {}
    }

    const attempt = async () => {
      const rows = await sbList(store as any);
      let mapped = rows.map((r: any) =>
        store === "settings" ? { ...r.data, id: "app" } : r.data
      );
      if (store === "settings") {
        const owner = settingsOwner || (await getOwnerId().catch(() => null));
        const local = readLocalSettingsCache(owner);
        const remote = mapped[0];
        if (!remote && local?.data) {
          mapped = [{ ...local.data, id: "app" }];
        } else if (remote && local?.data) {
          const remoteTs = extractSettingsUpdatedAt(remote);
          if (local.updatedAt > remoteTs) {
            mapped = [{ ...local.data, id: "app" }];
            void syncLocalSettingsToRemote();
          } else {
            writeLocalSettingsCache(remote, owner, { dirty: false });
          }
        } else if (remote) {
          writeLocalSettingsCache(remote, owner, { dirty: false });
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
        const owner = settingsOwner || (await getOwnerId().catch(() => null));
        const local = readLocalSettingsCache(owner);
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
  async getAllUpdatedSince<T = any>(
    store: keyof DBSchema,
    updatedAfterISO: string
  ): Promise<{ data: T[]; updatedAtIso: string | null }> {
    if (isTestEnv()) {
      return {
        data: Array.from(MEM[store].values()) as any,
        updatedAtIso: null,
      };
    }
    const rows = await sbListUpdatedSince(store as any, updatedAfterISO);
    let latest = updatedAfterISO || "";
    const mapped = rows.map((r: any) => {
      if (r.updated_at && (!latest || r.updated_at > latest)) latest = r.updated_at;
      return store === "settings" ? { ...r.data, id: "app" } : r.data;
    });
    if (mapped.length) {
      const cached = READ_CACHE.get(store);
      if (cached) {
        const byId = new Map<string, any>(
          cached.data.map((item: any) => [String(item?.id || ""), item])
        );
        for (const item of mapped) {
          if (item?.id) byId.set(String(item.id), item);
        }
        READ_CACHE.set(store, {
          ts: Date.now(),
          data: Array.from(byId.values()),
        });
      }
    }
    return { data: mapped as T[], updatedAtIso: latest || null };
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
    let settingsOwner: string | null = null;
    if (store === "settings" && key === "app") {
      try {
        settingsOwner = await getOwnerId();
        const local = readLocalSettingsCache(settingsOwner);
        if (
          local?.data &&
          Date.now() - local.cachedAt < READ_TTL_MS.settings
        ) {
          const fallback = { ...local.data, id: "app" } as T;
          setSettingsReadCache(fallback);
          return fallback;
        }
      } catch {}
    }
    const attempt = async () => {
      const row = await sbGet(store as any, key);
      let mapped = row
        ? store === "settings"
          ? ({ ...row.data, id: "app" } as any)
          : row.data
        : undefined;
      if (store === "settings" && key === "app") {
        const owner = settingsOwner || (await getOwnerId().catch(() => null));
        const local = readLocalSettingsCache(owner);
        if (!mapped && local?.data) {
          mapped = { ...local.data, id: "app" } as any;
        } else if (mapped && local?.data) {
          const remoteTs = extractSettingsUpdatedAt(mapped);
          if (local.updatedAt > remoteTs) {
            mapped = { ...local.data, id: "app" } as any;
            void syncLocalSettingsToRemote();
          } else {
            writeLocalSettingsCache(mapped as any, owner, { dirty: false });
          }
        } else if (mapped) {
          writeLocalSettingsCache(mapped as any, owner, { dirty: false });
        }
      }
      return mapped;
    };
    try {
      const found = await runWithSessionRefreshRetry(attempt);
      if (store === "settings" && key === "app") {
        if (found) {
          setSettingsReadCache(found);
          return found;
        }
        const owner = settingsOwner || (await getOwnerId().catch(() => null));
        const local = readLocalSettingsCache(owner);
        if (local?.data) return { ...local.data, id: "app" } as T;
      }
      return found;
    } catch (e: any) {
      if (store === "settings" && key === "app") {
        const owner = settingsOwner || (await getOwnerId().catch(() => null));
        const local = readLocalSettingsCache(owner);
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
    }
    if (store !== "settings") {
      invalidateStoreCache(store);
    }
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
        const cachedSettings =
          settingsFromReadCache() || readLocalSettingsCache(owner)?.data || {};
        payload = {
          ...(cachedSettings || {}),
          ...(nextValue || {}),
          id,
          settingsUpdatedAt:
            (nextValue as any)?.settingsUpdatedAt || new Date().toISOString(),
        };
        if (
          cachedSettings &&
          comparableSettings(cachedSettings) === comparableSettings(payload)
        ) {
          setSettingsReadCache(payload);
          writeLocalSettingsCache(payload, owner, { dirty: false });
          return;
        }
        setSettingsReadCache(payload);
        writeLocalSettingsCache(payload, owner, { dirty: true });
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
      if (store === "settings") {
        writeLocalSettingsCache(payload, owner, { dirty: false });
      }
      updateLoadedStoreSnapshot(owner, store, (rows) => {
        const index = rows.findIndex((row: any) => row?.id === id);
        if (index < 0) return [...rows, payload];
        return rows.map((row: any, rowIndex: number) =>
          rowIndex === index ? payload : row
        );
      });
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
      updateLoadedStoreSnapshot(owner, store, (rows) =>
        rows.filter((row: any) => row?.id !== key)
      );
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
