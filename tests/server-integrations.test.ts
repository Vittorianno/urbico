import { afterEach, describe, expect, it, vi } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function createPublicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as unknown as TrpcContext["res"] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PELIAS_BASE_URL;
  delete process.env.VALHALLA_BASE_URL;
});

describe("rotas protegidas de integração", () => {
  it("consulta uma linha da SPTrans pelo backend", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const lines = await caller.transit.searchLines({ term: "875" });
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatchObject({ id: expect.any(Number), label: expect.any(String) });
  }, 30_000);

  it("geocodifica e calcula a rota pelo contrato aberto de Pelias e Valhalla", async () => {
    process.env.PELIAS_BASE_URL = "https://pelias.local";
    process.env.VALHALLA_BASE_URL = "https://valhalla.local";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [{ properties: { name: "Avenida Paulista", label: "Avenida Paulista, São Paulo" }, geometry: { coordinates: [-46.65, -23.56] } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [{ properties: { name: "Parque Ibirapuera", label: "Parque Ibirapuera, São Paulo" }, geometry: { coordinates: [-46.66, -23.59] } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ trip: { summary: { length: 3.1, time: 2160 }, legs: [{ shape: "_p~iF~ps|U_ulLnnqC_mqNvxq`@", maneuvers: [{ instruction: "Siga em frente", length: 0.4, time: 320 }] }] } })));
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.routing.planWalking({ origin: "Avenida Paulista, São Paulo", destination: "Parque Ibirapuera, São Paulo" });
    expect(result?.origin).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number) });
    expect(result?.destination).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number) });
    expect(result?.route).toMatchObject({ durationSeconds: 2160, distanceMeters: 3100 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("responde uma pergunta ao Norby sem depender de um provedor de IA hospedado", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.norby.chat({ message: "Como você pode me ajudar em uma viagem?" });
    expect(result.message.length).toBeGreaterThan(20);
  });
});
