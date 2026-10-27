import { afterEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret, isEncryptedSecret } from "../server/_core/secret-box";
import { fetchWithTimeout } from "../server/_core/http";
import { askNorbyDetailed, getNorbyStatus } from "../server/integrations/norby";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("secret-box", () => {
  it("criptografa e descriptografa sem expor o valor original", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "chave-de-teste-bem-longa-e-aleatoria");
    const stored = encryptSecret("1//refresh-token-secreto");
    expect(isEncryptedSecret(stored)).toBe(true);
    expect(stored).not.toContain("refresh-token-secreto");
    expect(decryptSecret(stored)).toBe("1//refresh-token-secreto");
  });

  it("devolve valores legados em texto puro sem alterar", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(decryptSecret("1//legado")).toBe("1//legado");
  });

  it("falha ao ler com uma chave diferente", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "chave-A-bem-longa-para-teste");
    const stored = encryptSecret("segredo");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "chave-B-bem-longa-para-teste");
    expect(() => decryptSecret(stored)).toThrow();
  });

  it("em produção recusa gravar sem chave", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("segredo")).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });
});

describe("Norby: mecanismo llm/fallback", () => {
  it("usa fallback quando o Ollama não está configurado", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    vi.stubEnv("OLLAMA_MODEL", "");
    const reply = await askNorbyDetailed("Como você pode me ajudar em uma viagem?");
    expect(reply.engine).toBe("fallback");
    expect(reply.fallbackReason).toBe("ollama_not_configured");
    expect(reply.message.length).toBeGreaterThan(0);
  });

  it("usa o llm quando o Ollama responde", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama.local:11434");
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: { content: "Olá! Vamos?" } }))));
    const reply = await askNorbyDetailed("oi");
    expect(reply).toEqual({ message: "Olá! Vamos?", engine: "llm" });
  });

  it("cai para fallback quando o Ollama está indisponível", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama.local:11434");
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));
    const reply = await askNorbyDetailed("oi");
    expect(reply.engine).toBe("fallback");
    expect(reply.fallbackReason).toBe("ollama_unreachable");
  });

  it("status detecta o modelo instalado", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama.local:11434");
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ models: [{ name: "llama3.2:3b" }] }))));
    await expect(getNorbyStatus()).resolves.toEqual({ configured: true, reachable: true, model: "llama3.2:3b", modelInstalled: true });
  });
});

describe("fetchWithTimeout", () => {
  it("anexa um AbortSignal à requisição", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchWithTimeout("https://example.com", {}, 1_000);
    const init = (fetchMock.mock.calls[0] as unknown as [unknown, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
