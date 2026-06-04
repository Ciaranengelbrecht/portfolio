import { describe, expect, it } from "vitest";

import { getBootstrapCriticalStores } from "../state/bootstrap";

describe("bootstrap critical stores", () => {
  it("loads session-critical stores for the session route and default route", () => {
    expect(getBootstrapCriticalStores("/sessions")).toEqual([
      "settings",
      "exercises",
      "templates",
      "sessions",
    ]);
    expect(getBootstrapCriticalStores("/")).toEqual([
      "settings",
      "exercises",
      "templates",
      "sessions",
    ]);
  });

  it("does not block measurements pages on unrelated session/template data", () => {
    expect(getBootstrapCriticalStores("/measurements")).toEqual([
      "settings",
      "measurements",
    ]);
  });

  it("keeps dashboard startup focused on summary data", () => {
    expect(getBootstrapCriticalStores("/dashboard")).toEqual([
      "settings",
      "sessions",
      "exercises",
    ]);
  });
});
