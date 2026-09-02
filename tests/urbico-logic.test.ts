import { describe, expect, it } from "vitest";

import { createTripRecord, getNorbyReply } from "../lib/urbico-logic";
import { estimateLeaveAlert } from "../lib/leave-alert";
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

describe("alerta de saída", () => {
  it("mantém uma estimativa de caminhada quando a posição do ônibus não está disponível", () => {
    const result = estimateLeaveAlert({
      now: new Date("2026-09-02T08:06:00.000Z"),
      appointmentAt: new Date("2026-09-02T08:20:00.000Z"),
      walkingSeconds: 600,
      vehicleDistanceMeters: null,
    });

    expect(result.confidence).toBe("limitada");
    expect(result.estimatedTravelSeconds).toBe(900);
    expect(result.shouldLeave).toBe(true);
  });
});

describe("camada de transporte", () => {
  it("não expõe dados inventados antes da integração oficial", async () => {
    await expect(transitEngine.getAvailability()).resolves.toBe("unavailable");
    await expect(transitEngine.getNearbyDepartures()).resolves.toEqual([]);
    await expect(transitEngine.planRoute({ origin: "A", destination: "B" })).resolves.toEqual([]);
  });
});
