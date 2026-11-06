import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as unknown as TrpcContext["res"] };
}

afterEach(() => vi.unstubAllGlobals());

describe("inteligência externa do Norby", () => {
  it("consulta condições atuais e previsão horária sem chave de API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      timezone: "America/Bahia",
      current: { time: "2026-11-06T10:00", temperature_2m: 28, relative_humidity_2m: 70, apparent_temperature: 31, precipitation: 0, rain: 0, wind_speed_10m: 12, cloud_cover: 40, weather_code: 2 },
      hourly: { time: ["2026-11-06T10:00", "2026-11-06T11:00"], temperature_2m: [28, 29], precipitation_probability: [10, 30], precipitation: [0, 0.1], weather_code: [2, 61] },
      daily: { time: ["2026-11-06"], temperature_2m_min: [24], temperature_2m_max: [30], precipitation_probability_max: [40], weather_code: [61] },
    }), { status: 200 })));
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.norby.weather({ latitude: -12.97, longitude: -38.50 });
    expect(result.current.temperatureC).toBe(28);
    expect(result.nextHours[1].precipitationProbability).toBe(30);
    expect(result.provider).toBe("Open-Meteo");
  });

  it("pesquisa notícias e ocorrências de mobilidade com recorte geográfico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      articles: [{ title: "Interdição de via em Salvador", url: "https://example.com/noticia", seendate: "20261106T120000Z", domain: "example.com" }],
    }), { status: 200 })));
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.norby.occurrences({ location: "Salvador, Bahia" });
    expect(result.location).toBe("Salvador, Bahia");
    expect(result.results[0]).toMatchObject({ category: "Interdição ou desvio", source: "example.com" });
  });

  it("pesquisa na web e devolve links citáveis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('<div><a class="result__a" href="https://example.com/page">Resultado de teste</a><div class="result__snippet">Resumo de teste</div></div>', { status: 200 })));
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.norby.search({ query: "mobilidade urbana" });
    expect(result.results[0]).toMatchObject({ title: "Resultado de teste", url: "https://example.com/page", source: "example.com" });
  });
});
