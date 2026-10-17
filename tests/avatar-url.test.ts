import { describe, expect, it } from "vitest";

import { MAX_AVATAR_URL_LENGTH, pickAvatarUrl, sanitizeAvatarUrl } from "../server/_core/avatar";

describe("sanitizeAvatarUrl", () => {
  it("aceita uma URL https devolvida pelo provedor", () => {
    const url = "https://lh3.googleusercontent.com/a/abc123=s96-c";
    expect(sanitizeAvatarUrl(url)).toBe(url);
  });

  it("remove espaços ao redor", () => {
    expect(sanitizeAvatarUrl("  https://example.com/foto.png  ")).toBe("https://example.com/foto.png");
  });

  it("rejeita esquemas que não sejam https", () => {
    expect(sanitizeAvatarUrl("http://example.com/foto.png")).toBeNull();
    expect(sanitizeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeAvatarUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(sanitizeAvatarUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejeita credenciais embutidas na URL", () => {
    expect(sanitizeAvatarUrl("https://usuario:senha@example.com/foto.png")).toBeNull();
  });

  it("rejeita valores que não são texto ou não são URL", () => {
    expect(sanitizeAvatarUrl(undefined)).toBeNull();
    expect(sanitizeAvatarUrl(null)).toBeNull();
    expect(sanitizeAvatarUrl(42)).toBeNull();
    expect(sanitizeAvatarUrl("")).toBeNull();
    expect(sanitizeAvatarUrl("não é uma url")).toBeNull();
  });

  it("rejeita URLs maiores que a coluna do banco", () => {
    const tooLong = `https://example.com/${"a".repeat(MAX_AVATAR_URL_LENGTH)}`;
    expect(sanitizeAvatarUrl(tooLong)).toBeNull();
  });
});

describe("pickAvatarUrl", () => {
  it("prefere avatar_url e cai para picture", () => {
    expect(pickAvatarUrl({ avatar_url: "https://example.com/a.png", picture: "https://example.com/b.png" })).toBe("https://example.com/a.png");
    expect(pickAvatarUrl({ picture: "https://example.com/b.png" })).toBe("https://example.com/b.png");
  });

  it("ignora avatar_url inválido e usa picture válido", () => {
    expect(pickAvatarUrl({ avatar_url: "http://inseguro.example.com/a.png", picture: "https://example.com/b.png" })).toBe("https://example.com/b.png");
  });

  it("devolve null quando o provedor não informa foto (ex.: e-mail e senha)", () => {
    expect(pickAvatarUrl({})).toBeNull();
    expect(pickAvatarUrl(undefined)).toBeNull();
    expect(pickAvatarUrl(null)).toBeNull();
  });
});
