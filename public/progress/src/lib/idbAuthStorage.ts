// IndexedDB-backed storage for Supabase auth to improve persistence in installed PWAs (esp. iOS)
// Falls back to localStorage if IDB is unavailable.
import { openDB, IDBPDatabase } from "idb";

type KV = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
};

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

async function getDB() {
  if (!dbPromise) {
    try {
      dbPromise = openDB("liftlog-auth", 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        },
      });
    } catch (e) {
      // If IDB open fails, keep null; callers will fallback to localStorage
      dbPromise = Promise.reject(e);
    }
  }
  return dbPromise;
}

function hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export const idbKV: KV = {
  async get(key: string) {
    try {
      const db = await getDB();
      const v = await db.get("kv", key);
      return typeof v === "string" ? v : v == null ? null : JSON.stringify(v);
    } catch {
      if (hasLocalStorage()) return localStorage.getItem(key);
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      const db = await getDB();
      await db.put("kv", value, key);
    } catch {
      if (hasLocalStorage())
        try {
          localStorage.setItem(key, value);
        } catch {}
    }
  },
  async del(key: string) {
    try {
      const db = await getDB();
      await db.delete("kv", key);
    } catch {
      if (hasLocalStorage())
        try {
          localStorage.removeItem(key);
        } catch {}
    }
  },
};

// Supabase storage adapter interface: getItem/setItem/removeItem
export const supabaseIDBStorage = {
  getItem: (key: string) => idbKV.get(key),
  setItem: (key: string, value: string) => idbKV.set(key, value),
  removeItem: (key: string) => idbKV.del(key),
};
