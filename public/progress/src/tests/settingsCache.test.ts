import { afterEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function loadHelpers(db: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> }) {
  vi.resetModules();
  vi.doMock("../lib/db", () => ({ db }));
  return import("../lib/helpers");
}

describe("settings cache helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("dedupes concurrent settings reads", async () => {
    const pending = deferred<any>();
    const db = {
      get: vi.fn().mockReturnValue(pending.promise),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const { getSettings } = await loadHelpers(db);

    const reads = Promise.all([getSettings(), getSettings(), getSettings()]);
    pending.resolve({ id: "app", unit: "kg" });
    const result = await reads;

    expect(db.get).toHaveBeenCalledTimes(1);
    expect(db.put).not.toHaveBeenCalled();
    expect(result.map((settings) => settings.unit)).toEqual(["kg", "kg", "kg"]);
  });

  it("normalizes missing defaults without writing during getSettings", async () => {
    const db = {
      get: vi.fn().mockResolvedValue({ id: "app", unit: "kg" }),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const { getSettings } = await loadHelpers(db);

    const settings = await getSettings();

    expect(settings.deloadDefaults).toBeTruthy();
    expect(settings.progress?.guidedSetup).toBeTruthy();
    expect(settings.theme).toBe("dark");
    expect(db.put).not.toHaveBeenCalled();
  });

  it("does not write unchanged settings again", async () => {
    const current = { id: "app", unit: "kg", theme: "dark" };
    const db = {
      get: vi.fn().mockResolvedValue(current),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const { getSettings, setSettings } = await loadHelpers(db);

    const settings = await getSettings();
    await setSettings(settings);

    expect(db.put).not.toHaveBeenCalled();
  });

  it("writes changed settings once", async () => {
    const db = {
      get: vi.fn().mockResolvedValue({ id: "app", unit: "kg", theme: "dark" }),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const { getSettings, setSettings } = await loadHelpers(db);

    await getSettings();
    await setSettings((settings) => ({ ...settings, unit: "lb" }));

    expect(db.put).toHaveBeenCalledTimes(1);
    expect(db.put).toHaveBeenCalledWith(
      "settings",
      expect.objectContaining({ id: "app", unit: "lb" })
    );
  });

  it("clears the memory cache on auth changes", async () => {
    const db = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ id: "app", unit: "kg", theme: "dark" })
        .mockResolvedValueOnce({ id: "app", unit: "lb", theme: "dark" }),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const { getSettings } = await loadHelpers(db);

    await expect(getSettings()).resolves.toMatchObject({ unit: "kg" });
    window.dispatchEvent(new CustomEvent("sb-auth"));
    await expect(getSettings()).resolves.toMatchObject({ unit: "lb" });

    expect(db.get).toHaveBeenCalledTimes(2);
  });
});
