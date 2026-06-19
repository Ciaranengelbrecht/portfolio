import { afterEach, describe, expect, it, vi } from "vitest";

async function loadDataCache(getAll: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  sessionStorage.clear();
  vi.doMock("../lib/db", () => ({
    db: { getAll },
  }));
  vi.doMock("../lib/monitoring", () => ({
    trackMetric: vi.fn(),
  }));
  return import("../lib/dataCache");
}

describe("dataCache", () => {
  afterEach(() => {
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
});
