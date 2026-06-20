import { afterEach, describe, expect, it } from "vitest";
import { openDB } from "idb";
import {
  clearDeviceSnapshots,
  DEVICE_SNAPSHOT_SCHEMA_VERSION,
  readProgramSnapshot,
  readStoreSnapshot,
  writeProgramSnapshot,
  writeStoreSnapshot,
} from "../lib/deviceSnapshot";

describe("deviceSnapshot", () => {
  afterEach(async () => {
    await clearDeviceSnapshots();
  });

  it("stores and reads owner-scoped table snapshots", async () => {
    await writeStoreSnapshot("owner-a", "sessions", {
      ts: 1000,
      data: [{ id: "s1" }],
      updatedAtIso: "2026-06-20T00:00:00.000Z",
      lastFullSyncTs: 1000,
    });

    await expect(readStoreSnapshot("owner-a", "sessions")).resolves.toMatchObject({
      ts: 1000,
      data: [{ id: "s1" }],
      updatedAtIso: "2026-06-20T00:00:00.000Z",
      lastFullSyncTs: 1000,
    });
    await expect(readStoreSnapshot("owner-b", "sessions")).resolves.toBeNull();
  });

  it("rejects corrupt table snapshots", async () => {
    const db = await openDB("liftlog-device-snapshot", 1, {
      upgrade(upgradeDb) {
        if (!upgradeDb.objectStoreNames.contains("stores")) {
          upgradeDb.createObjectStore("stores", { keyPath: "key" });
        }
        if (!upgradeDb.objectStoreNames.contains("programs")) {
          upgradeDb.createObjectStore("programs", { keyPath: "key" });
        }
      },
    });
    await db.put("stores", {
      key: `${DEVICE_SNAPSHOT_SCHEMA_VERSION}:owner-a:sessions`,
      ownerId: "owner-a",
      store: "sessions",
      schemaVersion: DEVICE_SNAPSHOT_SCHEMA_VERSION,
      ts: 1000,
      data: { not: "an array" },
    });

    await expect(readStoreSnapshot("owner-a", "sessions")).resolves.toBeNull();
  });

  it("stores and reads owner-scoped program snapshots", async () => {
    const program = {
      id: "program-a",
      name: "Program A",
      mesoWeeks: 4,
      weeklySplit: [],
    } as any;

    await writeProgramSnapshot("owner-a", program);

    await expect(readProgramSnapshot("owner-a")).resolves.toMatchObject({
      program,
    });
    await expect(readProgramSnapshot("owner-b")).resolves.toBeNull();
  });
});
