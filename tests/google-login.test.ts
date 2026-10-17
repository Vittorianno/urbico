import { describe, expect, it } from "vitest";

import { appendQuery, createLoginCodeStore, isAllowedReturnTo, parseAllowedOrigins } from "../server/_core/google-login";

describe("parseAllowedOrigins", () => {
  it("normaliza, ignora lixo e só libera localhost fora de produção", () => {
    expect(parseAllowedOrigins("https://app.exemplo.com/, lixo, ftp://x.com", true)).toEqual(["https://app.exemplo.com"]);
    expect(parseAllowedOrigins(undefined, false)).toEqual(["http://localhost:8081"]);
    expect(parseAllowedOrigins(undefined, true)).toEqual([]);
  });
});

describe("isAllowedReturnTo", () => {
  const allowed = ["http://localhost:8081", "https://app.exemplo.com"];

  it("aceita o app nativo e origens web permitidas", () => {
    expect(isAllowedReturnTo("urbico://login", allowed)).toBe(true);
    expect(isAllowedReturnTo("urbico://login?x=1", allowed)).toBe(true);
    expect(isAllowedReturnTo("http://localhost:8081/login", allowed)).toBe(true);
    expect(isAllowedReturnTo("https://app.exemplo.com/login", allowed)).toBe(true);
  });

  it("rejeita open redirect e esquemas perigosos", () => {
    expect(isAllowedReturnTo("urbico://outra-coisa", allowed)).toBe(false);
    expect(isAllowedReturnTo("https://evil.com/login", allowed)).toBe(false);
    expect(isAllowedReturnTo("http://localhost:8081.evil.com/login", allowed)).toBe(false);
    expect(isAllowedReturnTo("http://localhost:8081@evil.com/", allowed)).toBe(false);
    expect(isAllowedReturnTo("javascript:alert(1)", allowed)).toBe(false);
    expect(isAllowedReturnTo("", allowed)).toBe(false);
    expect(isAllowedReturnTo("/login", allowed)).toBe(false);
  });
});

describe("appendQuery", () => {
  it("acrescenta parâmetros preservando os existentes", () => {
    expect(appendQuery("urbico://login", { login_code: "abc" })).toBe("urbico://login?login_code=abc");
    expect(appendQuery("http://localhost:8081/login?a=1", { login_code: "abc" })).toBe("http://localhost:8081/login?a=1&login_code=abc");
  });
});

describe("createLoginCodeStore", () => {
  it("o código vale uma única vez", () => {
    const store = createLoginCodeStore();
    const code = store.issue("google:123");
    expect(store.consume(code)).toEqual({ openId: "google:123" });
    expect(store.consume(code)).toBeNull();
  });

  it("o código expira", () => {
    let now = 1_000;
    const store = createLoginCodeStore({ ttlMs: 60_000, now: () => now });
    const code = store.issue("google:123");
    now += 60_001;
    expect(store.consume(code)).toBeNull();
  });

  it("rejeita código vazio ou desconhecido", () => {
    const store = createLoginCodeStore();
    expect(store.consume("")).toBeNull();
    expect(store.consume("nao-existe")).toBeNull();
  });
});
