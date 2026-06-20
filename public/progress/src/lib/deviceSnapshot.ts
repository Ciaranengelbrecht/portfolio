import { openDB, type IDBPDatabase } from "idb";
import type { DBSchema } from "./db";
import type { UserProgram } from "./types";

export type SnapshotStoreKey = keyof DBSchema;

export const DEVICE_SNAPSHOT_SCHEMA_VERSION = 4;

type StoreSnapshot = {
  key: string;
  ownerId: string;
  store: SnapshotStoreKey;
  schemaVersion: number;
  ts: number;
  updatedAtIso?: string | null;
  lastFullSyncTs?: number;
  data: any[];
};

type ProgramSnapshot = {
  key: string;
  ownerId: string;
  schemaVersion: number;
  ts: number;
  program: UserProgram;
};

type SnapshotDB = {
  stores: {
    key: string;
    value: StoreSnapshot;
  };
  programs: {
    key: string;
    value: ProgramSnapshot;
  };
};

let dbPromise: Promise<IDBPDatabase<SnapshotDB>> | null = null;

function storeSnapshotKey(ownerId: string, store: SnapshotStoreKey) {
  return `${DEVICE_SNAPSHOT_SCHEMA_VERSION}:${ownerId}:${store}`;
}

function programSnapshotKey(ownerId: string) {
  return `${DEVICE_SNAPSHOT_SCHEMA_VERSION}:${ownerId}:program`;
}

function cloneArray<T>(value: T[]): T[] {
  return Array.isArray(value) ? value.slice() : [];
}

async function getSnapshotDB() {
  if (!dbPromise) {
    dbPromise = openDB<SnapshotDB>("liftlog-device-snapshot", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("stores")) {
          db.createObjectStore("stores", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("programs")) {
          db.createObjectStore("programs", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function readStoreSnapshot<T = any>(
  ownerId: string,
  store: SnapshotStoreKey
) {
  try {
    const db = await getSnapshotDB();
    const row = await db.get("stores", storeSnapshotKey(ownerId, store));
    if (
      !row ||
      row.ownerId !== ownerId ||
      row.store !== store ||
      row.schemaVersion !== DEVICE_SNAPSHOT_SCHEMA_VERSION ||
      !Array.isArray(row.data)
    ) {
      return null;
    }
    return {
      ts: row.ts,
      updatedAtIso: row.updatedAtIso || null,
      lastFullSyncTs: row.lastFullSyncTs || row.ts,
      data: cloneArray(row.data) as T[],
    };
  } catch {
    return null;
  }
}

export async function writeStoreSnapshot(
  ownerId: string,
  store: SnapshotStoreKey,
  entry: {
    ts: number;
    data: any[];
    updatedAtIso?: string | null;
    lastFullSyncTs?: number;
  }
) {
  try {
    const db = await getSnapshotDB();
    const row: StoreSnapshot = {
      key: storeSnapshotKey(ownerId, store),
      ownerId,
      store,
      schemaVersion: DEVICE_SNAPSHOT_SCHEMA_VERSION,
      ts: entry.ts,
      updatedAtIso: entry.updatedAtIso || null,
      lastFullSyncTs: entry.lastFullSyncTs || entry.ts,
      data: cloneArray(entry.data),
    };
    await db.put("stores", row);
  } catch {}
}

export async function readProgramSnapshot(ownerId: string) {
  try {
    const db = await getSnapshotDB();
    const row = await db.get("programs", programSnapshotKey(ownerId));
    if (
      !row ||
      row.ownerId !== ownerId ||
      row.schemaVersion !== DEVICE_SNAPSHOT_SCHEMA_VERSION ||
      !row.program
    ) {
      return null;
    }
    return { ts: row.ts, program: row.program };
  } catch {
    return null;
  }
}

export async function writeProgramSnapshot(
  ownerId: string,
  program: UserProgram
) {
  try {
    const db = await getSnapshotDB();
    const row: ProgramSnapshot = {
      key: programSnapshotKey(ownerId),
      ownerId,
      schemaVersion: DEVICE_SNAPSHOT_SCHEMA_VERSION,
      ts: Date.now(),
      program,
    };
    await db.put("programs", row);
  } catch {}
}

export async function clearDeviceSnapshots(ownerId?: string) {
  try {
    const db = await getSnapshotDB();
    if (!ownerId) {
      await Promise.all([db.clear("stores"), db.clear("programs")]);
      return;
    }
    const storeKeys = await db.getAllKeys("stores");
    const programKeys = await db.getAllKeys("programs");
    await Promise.all([
      ...storeKeys
        .filter((key) => String(key).includes(`:${ownerId}:`))
        .map((key) => db.delete("stores", key)),
      ...programKeys
        .filter((key) => String(key).includes(`:${ownerId}:`))
        .map((key) => db.delete("programs", key)),
    ]);
  } catch {}
}
