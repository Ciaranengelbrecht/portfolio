import { afterEach, describe, expect, it, vi } from "vitest";

const sessions = [
  {
    id: "s1",
    dateISO: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T01:00:00.000Z",
    weekNumber: 1,
    phaseNumber: 1,
    entries: [],
  },
];
const exercises = [
  {
    id: "e1",
    name: "Bench",
    muscleGroup: "chest",
    defaults: { sets: 3, targetRepRange: "8-12" },
  },
];
const measurements = [
  {
    id: "m1",
    dateISO: "2026-06-01T00:00:00.000Z",
    weightKg: 80,
  },
];

async function loadAggregates() {
  vi.resetModules();
  sessionStorage.clear();
  vi.doMock("../lib/dataCache", () => ({
    getAllCached: vi.fn((store: string) => {
      if (store === "sessions") return Promise.resolve(sessions);
      if (store === "exercises") return Promise.resolve(exercises);
      return Promise.resolve(measurements);
    }),
  }));

  class FakeWorker {
    static calls = 0;
    onmessage: ((event: { data: any }) => void) | null = null;

    constructor(_url: URL, _opts?: { type?: string }) {}

    postMessage() {
      FakeWorker.calls += 1;
      this.onmessage?.({
        data: {
          weeklyVolume: { "P1-W1": { chest: 3 } },
          exercisePRs: {},
          weeklyPRCounts: {},
          lastComputed: Date.now(),
          version: 3,
        },
      });
    }

    terminate() {}
  }

  vi.stubGlobal("Worker", FakeWorker);
  const mod = await import("../lib/aggregates");
  return { ...mod, FakeWorker };
}

describe("aggregates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    sessionStorage.clear();
    sessions[0].updatedAt = "2026-06-01T01:00:00.000Z";
  });

  it("builds signatures from row counts and latest row timestamps", async () => {
    const { buildAggregateInputSignature } = await loadAggregates();

    const first = buildAggregateInputSignature({
      sessions,
      exercises,
      measurements,
    });
    sessions[0].updatedAt = "2026-06-02T01:00:00.000Z";
    const changed = buildAggregateInputSignature({
      sessions,
      exercises,
      measurements,
    });

    expect(first).not.toEqual(changed);
  });

  it("reuses cached aggregate bundle when forced inputs are unchanged", async () => {
    const { computeAggregates, FakeWorker } = await loadAggregates();

    await computeAggregates(true);
    await computeAggregates(true);

    expect(FakeWorker.calls).toBe(1);
  });

  it("recomputes aggregate bundle when the input signature changes", async () => {
    const { computeAggregates, FakeWorker } = await loadAggregates();

    await computeAggregates(true);
    sessions[0].updatedAt = "2026-06-02T01:00:00.000Z";
    await computeAggregates(true);

    expect(FakeWorker.calls).toBe(2);
  });
});
