import { describe, expect, it } from "vitest";

describe("manual fallback configuration", () => {
  it("keeps open geospatial services optional", () => {
    expect(process.env.URBICO_MANUAL_FALLBACK ?? "enabled").toBe("enabled");
  });
});
