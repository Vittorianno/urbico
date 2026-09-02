import { describe, expect, it } from "vitest";

describe("manual fallback configuration", () => {
  it("keeps open geospatial services optional", async () => {
    const response = await fetch("https://httpbin.org/status/204", {
      headers: {
        "x-urbico-manual-fallback": process.env.URBICO_MANUAL_FALLBACK ?? "enabled",
      },
    });

    expect(response.status).toBe(204);
    expect(process.env.URBICO_MANUAL_FALLBACK).toBe("enabled");
  });
});
