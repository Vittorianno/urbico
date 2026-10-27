import { describe, expect, it, vi } from "vitest";

import { createCorsMiddleware, createRateLimiter, parseAllowedOrigins } from "../server/_core/security";

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    header(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    sendStatus(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("CORS", () => {
  it("interpreta a lista de origens permitidas", () => {
    expect(parseAllowedOrigins("https://a.com/, https://b.com ,,")).toEqual(["https://a.com", "https://b.com"]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it("em produção bloqueia origem fora da lista e libera a permitida", () => {
    const cors = createCorsMiddleware({ isProduction: true, allowedOrigins: ["https://urbico.app"] });

    const blockedRes = fakeRes();
    const blockedNext = vi.fn();
    cors({ headers: { origin: "https://evil.example", host: "api.urbico.app" }, method: "POST" } as never, blockedRes as never, blockedNext);
    expect(blockedRes.statusCode).toBe(403);
    expect(blockedNext).not.toHaveBeenCalled();

    const okRes = fakeRes();
    const okNext = vi.fn();
    cors({ headers: { origin: "https://urbico.app", host: "api.urbico.app" }, method: "POST" } as never, okRes as never, okNext);
    expect(okRes.headers["Access-Control-Allow-Origin"]).toBe("https://urbico.app");
    expect(okNext).toHaveBeenCalledTimes(1);
  });

  it("não interfere em requisições sem Origin (app nativo)", () => {
    const cors = createCorsMiddleware({ isProduction: true, allowedOrigins: [] });
    const res = fakeRes();
    const next = vi.fn();
    cors({ headers: {}, method: "POST" } as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("rate limit", () => {
  it("responde 429 depois de exceder o limite da janela", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const req = { ip: "203.0.113.9", socket: { remoteAddress: "203.0.113.9" } } as never;
    const next = vi.fn();

    limiter(req, fakeRes() as never, next);
    limiter(req, fakeRes() as never, next);
    expect(next).toHaveBeenCalledTimes(2);

    const blocked = fakeRes();
    limiter(req, blocked as never, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["Retry-After"]).toBeDefined();
  });

  it("conta cada IP separadamente", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = vi.fn();
    limiter({ ip: "198.51.100.1", socket: {} } as never, fakeRes() as never, next);
    limiter({ ip: "198.51.100.2", socket: {} } as never, fakeRes() as never, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
