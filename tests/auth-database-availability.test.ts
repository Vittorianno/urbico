import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseUnavailableError } from "../server/db";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";

afterEach(() => {
  vi.restoreAllMocks();
});

async function withApiServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  registerOAuthRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

describe("auth reports database outage distinctly from invalid credentials", () => {
  it("returns 503 when session creation cannot persist the user", async () => {
    vi.spyOn(sdk, "createSessionFromSupabaseToken").mockRejectedValue(new DatabaseUnavailableError());
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/session`, {
        method: "POST",
        headers: { authorization: "Bearer test-supabase-access-token" },
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    });
  });

  it("returns 503 when the authenticated-user lookup cannot reach MySQL", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(new DatabaseUnavailableError());
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        code: "DATABASE_UNAVAILABLE",
        user: null,
      });
    });
  });
});
