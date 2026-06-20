import { afterEach, describe, expect, it, vi } from "vitest";

async function loadDataCache(getAll: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  sessionStorage.clear();
  vi.doMock("../lib/db", () => ({
    db: { getAll },
  }));
  vi.doMock("../lib/sbData", () => ({
    sbAppSnapshot: vi.fn(),
  }));
  vi.doMock("../lib/profile", () => ({
    primeUserProfile: vi.fn(),
  }));
  vi.doMock("../lib/monitoring", () => ({
    trackMetric: vi.fn(),
  }));
  return import("../lib/dataCache");
}

async function loadDataCacheWithSnapshot(
  getAll: ReturnType<typeof vi.fn>,
  sbAppSnapshot: ReturnType<typeof vi.fn>
) {
  vi.resetModules();
  sessionStorage.clear();
  vi.doMock("../lib/db", () => ({
    db: { getAll, primeStoreCache: vi.fn() },
  }));
  vi.doMock("../lib/sbData", () => ({
    sbAppSnapshot,
  }));
  vi.doMock("../lib/profile", () => ({
    primeUserProfile: vi.fn(),
  }));
  vi.doMock("../lib/monitoring", () => ({
    trackMetric: vi.fn(),
  }));
  return import("../lib/dataCache");
}

const emptySnapshotStores = () => ({
  settings: { rows: [], ids: [], latestUpdatedAt: null },
  exercises: { rows: [], ids: [], latestUpdatedAt: null },
  templates: { rows: [], ids: [], latestUpdatedAt: null },
  sessions: { rows: [], ids: [], latestUpdatedAt: null },
  measurements: { rows: [], ids: [], latestUpdatedAt: null },
});

describe("dataCache", () => {
  afterEach(async () => {
    const { clearDeviceSnapshots } = await import("../lib/deviceSnapshot");
    await clearDeviceSnapshots();
    vi.restoreAllMocks();
    vi.resetModules();
    sessionStorage.clear();
  });

  it("serves fresh memory cache without another store read", async () => {
    const getAll = vi.fn().mockResolvedValue([{ id: "s1" }]);
    const { getAllCached } = await loadDataCache(getAll);

    await expect(getAllCached("sessions")).resolves.toEqual([{ id: "s1" }]);
    await expect(getAllCached("sessions")).resolves.toEqual([{ id: "s1" }]);

    expect(getAll).toHaveBeenCalledTimes(1);
  });

  it("force refresh bypasses the existing cache", async () => {
    const getAll = vi
      .fn()
      .mockResolvedValueOnce([{ id: "old" }])
      .mockResolvedValueOnce([{ id: "new" }]);
    const { getAllCached } = await loadDataCache(getAll);

    await expect(getAllCached("sessions")).resolves.toEqual([{ id: "old" }]);
    await expect(getAllCached("sessions", { force: true })).resolves.toEqual([
      { id: "new" },
    ]);

    expect(getAll).toHaveBeenCalledTimes(2);
  });

  it("dedupes stale-while-revalidate background refreshes", async () => {
    let resolveRefresh: (value: any[]) => void = () => {};
    const refreshPromise = new Promise<any[]>((resolve) => {
      resolveRefresh = resolve;
    });
    const getAll = vi
      .fn()
      .mockResolvedValueOnce([{ id: "old" }])
      .mockReturnValueOnce(refreshPromise);
    const { getAllCached } = await loadDataCache(getAll);

    await expect(getAllCached("sessions")).resolves.toEqual([{ id: "old" }]);
    const staleA = getAllCached("sessions", { swr: true, ttlMs: 0 });
    const staleB = getAllCached("sessions", { swr: true, ttlMs: 0 });

    await expect(staleA).resolves.toEqual([{ id: "old" }]);
    await expect(staleB).resolves.toEqual([{ id: "old" }]);
    expect(getAll).toHaveBeenCalledTimes(2);

    resolveRefresh([{ id: "new" }]);
    await vi.waitFor(() => expect(getAll).toHaveBeenCalledTimes(2));
  });

  it("persists cached rows for the same owner across module reloads", async () => {
    const getAll = vi.fn().mockResolvedValue([{ id: "s1" }]);
    const first = await loadDataCache(getAll);
    first.setCacheOwner("owner-a");

    await expect(first.getAllCached("sessions")).resolves.toEqual([{ id: "s1" }]);
    expect(getAll).toHaveBeenCalledTimes(1);
    const { readStoreSnapshot } = await import("../lib/deviceSnapshot");
    await vi.waitFor(async () => {
      await expect(readStoreSnapshot("owner-a", "sessions")).resolves.toBeTruthy();
    });

    const getAllAfterReload = vi.fn().mockResolvedValue([{ id: "remote" }]);
    const second = await loadDataCache(getAllAfterReload);
    second.setCacheOwner("owner-a");

    await expect(second.getAllCached("sessions")).resolves.toEqual([{ id: "s1" }]);
    expect(getAllAfterReload).not.toHaveBeenCalled();
  });

  it("does not reuse a persistent snapshot for a different owner", async () => {
    const getAll = vi.fn().mockResolvedValue([{ id: "owner-a-session" }]);
    const first = await loadDataCache(getAll);
    first.setCacheOwner("owner-a");
    await first.getAllCached("sessions");
    const { readStoreSnapshot } = await import("../lib/deviceSnapshot");
    await vi.waitFor(async () => {
      await expect(readStoreSnapshot("owner-a", "sessions")).resolves.toBeTruthy();
    });

    const getAllForOwnerB = vi.fn().mockResolvedValue([{ id: "owner-b-session" }]);
    const second = await loadDataCache(getAllForOwnerB);
    second.setCacheOwner("owner-b");

    await expect(second.getAllCached("sessions")).resolves.toEqual([
      { id: "owner-b-session" },
    ]);
    expect(getAllForOwnerB).toHaveBeenCalledTimes(1);
  });

  it("syncs a full app snapshot into cache and stores the profile program", async () => {
    const getAll = vi.fn().mockResolvedValue([]);
    const sbAppSnapshot = vi.fn().mockResolvedValue({
      profile: {
        id: "owner-a",
        program: {
          id: "program-a",
          name: "Program A",
          mesoWeeks: 4,
          weeklySplit: [],
        },
      },
      stores: {
        ...emptySnapshotStores(),
        sessions: {
          rows: [
            {
              id: "owner-a:s1",
              data: { id: "s1", name: "Session 1" },
              updated_at: "2026-06-20T00:00:00.000Z",
            },
          ],
          ids: ["s1"],
          latestUpdatedAt: "2026-06-20T00:00:00.000Z",
        },
      },
    });
    const cache = await loadDataCacheWithSnapshot(getAll, sbAppSnapshot);
    cache.setCacheOwner("owner-a");

    await expect(
      cache.syncAppSnapshot({ stores: ["sessions"], forceFull: true })
    ).resolves.toMatchObject({
      stores: ["sessions"],
      rows: 1,
      full: true,
    });
    await expect(cache.getAllCached("sessions")).resolves.toEqual([
      { id: "s1", name: "Session 1" },
    ]);
    const { readProgramSnapshot } = await import("../lib/deviceSnapshot");
    await expect(readProgramSnapshot("owner-a")).resolves.toMatchObject({
      program: { id: "program-a", name: "Program A" },
    });
    expect(getAll).not.toHaveBeenCalled();
  });

  it("merges incremental snapshot rows and removes deleted server ids", async () => {
    const getAll = vi.fn().mockResolvedValue([]);
    const sbAppSnapshot = vi
      .fn()
      .mockResolvedValueOnce({
        profile: null,
        stores: {
          ...emptySnapshotStores(),
          sessions: {
            rows: [
              {
                id: "owner-a:s1",
                data: { id: "s1", name: "Old" },
                updated_at: "2026-06-20T00:00:00.000Z",
              },
              {
                id: "owner-a:s2",
                data: { id: "s2", name: "Keep" },
                updated_at: "2026-06-20T00:00:00.000Z",
              },
            ],
            ids: ["s1", "s2"],
            latestUpdatedAt: "2026-06-20T00:00:00.000Z",
          },
        },
      })
      .mockResolvedValueOnce({
        profile: null,
        stores: {
          ...emptySnapshotStores(),
          sessions: {
            rows: [
              {
                id: "owner-a:s2",
                data: { id: "s2", name: "Updated" },
                updated_at: "2026-06-20T00:05:00.000Z",
              },
            ],
            ids: ["s2"],
            latestUpdatedAt: "2026-06-20T00:05:00.000Z",
          },
        },
      });
    const cache = await loadDataCacheWithSnapshot(getAll, sbAppSnapshot);
    cache.setCacheOwner("owner-a");

    await cache.syncAppSnapshot({ stores: ["sessions"], forceFull: true });
    await cache.syncAppSnapshot({ stores: ["sessions"] });

    await expect(cache.getAllCached("sessions")).resolves.toEqual([
      { id: "s2", name: "Updated" },
    ]);
    expect(sbAppSnapshot).toHaveBeenLastCalledWith({
      sessions: "2026-06-20T00:00:00.000Z",
    });
  });
});
