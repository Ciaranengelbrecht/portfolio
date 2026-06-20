import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSbData(opts?: { rpc?: ReturnType<typeof vi.fn> }) {
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
  const rpc = opts?.rpc || vi.fn().mockResolvedValue({ data: null, error: null });
  vi.doMock("../lib/supabase", () => ({
    supabase: { from, rpc },
    getOwnerIdFast: vi.fn(),
  }));
  vi.doMock("../lib/monitoring", () => ({
    trackError: vi.fn(),
  }));
  const mod = await import("../lib/sbData");
  return { ...mod, from, upsert, deleteFn, rpc };
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

  it("stops retrying the app snapshot RPC after Supabase reports it missing", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.get_liftlog_app_snapshot(since) in the schema cache",
      },
    });
    const { sbAppSnapshot } = await loadSbData({ rpc });

    await expect(sbAppSnapshot({})).rejects.toMatchObject({ code: "PGRST202" });
    await expect(sbAppSnapshot({})).rejects.toThrow("RPC unavailable");

    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
