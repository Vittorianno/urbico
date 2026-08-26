import { describe, expect, it } from "vitest";

const SPTRANS_BASE_URL = "http://api.olhovivo.sptrans.com.br/v2.1";
const GRAPHOPPER_BASE_URL = "https://graphhopper.com/api/1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

describe("credenciais externas protegidas", () => {
  it("autentica o token rotacionado da SPTrans", async () => {
    const token = process.env.SPTRANS_TOKEN;
    expect(token, "SPTRANS_TOKEN deve estar configurado").toBeTruthy();

    const response = await fetch(`${SPTRANS_BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token ?? "")}`, {
      method: "POST",
    });
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toBe(true);
  }, 15_000);

  it("autoriza uma consulta leve de geocodificação no GraphHopper", async () => {
    const apiKey = process.env.GRAPHOPPER_API_KEY;
    expect(apiKey, "GRAPHOPPER_API_KEY deve estar configurado").toBeTruthy();

    const url = new URL(`${GRAPHOPPER_BASE_URL}/geocode`);
    url.searchParams.set("q", "São Paulo");
    url.searchParams.set("limit", "1");
    url.searchParams.set("key", apiKey ?? "");
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { hits?: unknown[] };
    expect(Array.isArray(payload.hits)).toBe(true);
  }, 15_000);

  it("autoriza a listagem de modelos Gemini para o Norby", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, "GEMINI_API_KEY deve estar configurado").toBeTruthy();

    const url = new URL(`${GEMINI_BASE_URL}/models`);
    url.searchParams.set("key", apiKey ?? "");
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { models?: unknown[] };
    expect(Array.isArray(payload.models)).toBe(true);
  }, 15_000);
});
