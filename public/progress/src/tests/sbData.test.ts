import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSbData() {
  vi.resetModules();
  const deleteEq = vi.fn();
  const deleteChain: any = { error: null };
  deleteEq.mockReturnValue(deleteChain);
  deleteChain.eq = deleteEq;
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const deleteFn = vi.fn(() => deleteChain);
  const from = vi.fn(() => ({
    upsert,
    delete: deleteFn,
  }));
  vi.doMock("../lib/supabase", () => ({
    supabase: { from },
    getOwnerIdFast: vi.fn(),
  }));
  vi.doMock("../lib/monitoring", () => ({
    trackError: vi.fn(),
  }));
  const mod = await import("../lib/sbData");
  return { ...mod, from, upsert, deleteFn };
}

describe("sbData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("does not run legacy cleanup deletes for settings upserts", async () => {
    const { sbUpsert, upsert, deleteFn } = await loadSbData();

    await sbUpsert("settings", "owner-a", "app", { id: "app", unit: "kg" });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("keeps legacy cleanup for non-settings upserts", async () => {
    const { sbUpsert, deleteFn } = await loadSbData();

    await sbUpsert("sessions", "owner-a", "s1", { id: "s1" });

    expect(deleteFn).toHaveBeenCalledTimes(1);
  });
});
