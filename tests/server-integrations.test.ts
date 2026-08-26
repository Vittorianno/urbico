import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("rotas protegidas de integração", () => {
  const caller = appRouter.createCaller(createPublicContext());

  it("consulta uma linha da SPTrans pelo backend", async () => {
    const lines = await caller.transit.searchLines({ term: "875" });
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatchObject({ id: expect.any(Number), label: expect.any(String) });
  }, 30_000);

  it("geocodifica e calcula uma rota de caminhada pelo backend", async () => {
    const result = await caller.routing.planWalking({
      origin: "Avenida Paulista, São Paulo",
      destination: "Parque Ibirapuera, São Paulo",
    });
    expect(result?.origin).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number) });
    expect(result?.destination).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number) });
    expect(result?.route?.durationSeconds).toBeGreaterThan(0);
  }, 30_000);

  it("responde uma pergunta ao Norby pelo serviço de IA interno", async () => {
    const result = await caller.norby.chat({ message: "Como você pode me ajudar em uma viagem?" });
    expect(result.message.length).toBeGreaterThan(20);
  }, 30_000);
});
