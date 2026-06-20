import { afterEach, describe, expect, it, vi } from "vitest";

function profileQuery(data: any, error: any = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, single };
}

async function loadProfile(query = profileQuery({
  id: "owner-a",
  themev2: { key: "midnight" },
  program: { id: "program-a", name: "Program A", mesoWeeks: 4, weeklySplit: [] },
  program_history: [{ id: "archived-a" }],
})) {
  vi.resetModules();
  vi.doMock("../lib/supabase", () => ({
    waitForSession: vi.fn().mockResolvedValue({
      user: { id: "owner-a", email: "a@example.com" },
    }),
    supabase: {
      from: query.from,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "owner-a", email: "a@example.com" } },
        }),
      },
    },
  }));
  vi.doMock("../lib/deviceSnapshot", () => ({
    readProgramSnapshot: vi.fn().mockResolvedValue(null),
    writeProgramSnapshot: vi.fn(),
  }));
  return { ...(await import("../lib/profile")), query };
}

describe("profile cache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("shares one profile request across concurrent profile consumers", async () => {
    const { fetchUserProfileStrict, query } = await loadProfile();

    const [a, b, c] = await Promise.all([
      fetchUserProfileStrict(),
      fetchUserProfileStrict(),
      fetchUserProfileStrict(),
    ]);

    expect(a?.program_history?.[0]?.id).toBe("archived-a");
    expect(b?.themeV2?.key).toBe("midnight");
    expect(c?.program?.id).toBe("program-a");
    expect(query.from).toHaveBeenCalledTimes(1);
  });

  it("serves getProfileProgram from the shared profile cache", async () => {
    const { fetchUserProfileStrict, getProfileProgram, query } = await loadProfile();

    await fetchUserProfileStrict();
    await expect(getProfileProgram()).resolves.toMatchObject({
      id: "program-a",
    });

    expect(query.from).toHaveBeenCalledTimes(1);
  });

  it("clears profile cache on auth changes", async () => {
    const query = profileQuery({
      id: "owner-a",
      program: { id: "program-a", name: "Program A", mesoWeeks: 4, weeklySplit: [] },
      program_history: [],
    });
    query.single
      .mockResolvedValueOnce({
        data: {
          id: "owner-a",
          program: { id: "program-a", name: "Program A", mesoWeeks: 4, weeklySplit: [] },
          program_history: [],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "owner-a",
          program: { id: "program-b", name: "Program B", mesoWeeks: 5, weeklySplit: [] },
          program_history: [],
        },
        error: null,
      });
    const { fetchUserProfileStrict } = await loadProfile(query);

    await expect(fetchUserProfileStrict()).resolves.toMatchObject({
      program: { id: "program-a" },
    });
    window.dispatchEvent(new CustomEvent("sb-auth"));
    await expect(fetchUserProfileStrict()).resolves.toMatchObject({
      program: { id: "program-b" },
    });

    expect(query.from).toHaveBeenCalledTimes(2);
  });
});
