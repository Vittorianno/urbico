import { describe, expect, it } from "vitest";

import { createTripRecord, getNorbyReply } from "../lib/urbico-logic";
import { transitEngine } from "../lib/transit-engine";

describe("getNorbyReply", () => {
  it("orienta a consulta de rotas ao identificar um destino salvo", () => {
    expect(getNorbyReply("Quero ir para casa")).toContain("local salvo");
  });

  it("não inventa previsão ao receber uma pergunta sobre chegada", () => {
    expect(getNorbyReply("Quando o ônibus chega?")).toContain("não recebi uma previsão oficial");
  });

  it("explica o caráter anônimo do relato de lotação", () => {
    expect(getNorbyReply("Esse ônibus está lotado?")).toContain("sem exibir sua identidade");
  });
});

describe("createTripRecord", () => {
  it("cria um registro estável a partir do instante de encerramento", () => {
    const record = createTripRecord(new Date("2026-08-26T20:00:00.000Z"));
    expect(record).toEqual({ id: "trip-1787774400000", endedAt: "2026-08-26T20:00:00.000Z" });
  });
});

describe("camada de transporte", () => {
  it("não expõe dados inventados antes da integração oficial", async () => {
    await expect(transitEngine.getAvailability()).resolves.toBe("unavailable");
    await expect(transitEngine.getNearbyDepartures()).resolves.toEqual([]);
    await expect(transitEngine.planRoute({ origin: "A", destination: "B" })).resolves.toEqual([]);
  });
});
