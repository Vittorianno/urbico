import { describe, expect, it } from "vitest";

import { closestTo, distanceMeters, estimateLeaveAlert } from "../lib/leave-alert";

describe("alerta de saída Urbico", () => {
  it("identifica a parada mais próxima da localização atual", () => {
    const origin = { latitude: -23.55, longitude: -46.63 };
    const closest = closestTo(origin, [
      { id: "a", latitude: -23.57, longitude: -46.65 },
      { id: "b", latitude: -23.5502, longitude: -46.6301 },
    ]);
    expect(closest?.item.id).toBe("b");
    expect(closest?.distanceMeters).toBeLessThan(100);
  });

  it("solicita saída quando caminhada, veículo e margem ultrapassam o horário", () => {
    const result = estimateLeaveAlert({
      now: new Date("2026-08-27T10:00:00.000Z"),
      appointmentAt: new Date("2026-08-27T10:12:00.000Z"),
      walkingSeconds: 480,
      vehicleDistanceMeters: 1_000,
    });
    expect(result.shouldLeave).toBe(true);
    expect(result.confidence).toBe("estimada");
  });

  it("indica confiança limitada quando não há veículo disponível", () => {
    const result = estimateLeaveAlert({
      now: new Date("2026-08-27T10:00:00.000Z"),
      appointmentAt: new Date("2026-08-27T11:00:00.000Z"),
      walkingSeconds: 300,
      vehicleDistanceMeters: null,
    });
    expect(result.confidence).toBe("limitada");
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
  });
});
