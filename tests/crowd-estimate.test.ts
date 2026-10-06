import { describe, expect, it } from "vitest";

import { estimateCrowd, type EstimateReport } from "../lib/crowd-estimate";

const NOW = new Date("2026-10-05T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);

let counter = 0;
const report = (level: EstimateReport["level"], ageMinutes: number, overrides: Partial<EstimateReport> = {}): EstimateReport => ({
  level,
  createdAt: minutesAgo(ageMinutes),
  reporterKey: `r${counter++}`,
  tripId: null,
  direction: null,
  vehiclePrefix: null,
  ...overrides,
});

describe("estimateCrowd", () => {
  it("sem dados não inventa nível: level null e confiança NONE", () => {
    const result = estimateCrowd({ reports: [], now: NOW, activeCheckIns: 0 });
    expect(result.level).toBeNull();
    expect(result.code).toBeNull();
    expect(result.confidence).toBe("NONE");
    expect(result.reportCount).toBe(0);
  });

  it("CHECK_INS sozinhos não geram nível de lotação", () => {
    const result = estimateCrowd({ reports: [], now: NOW, activeCheckIns: 5 });
    expect(result.level).toBeNull();
    expect(result.activeCheckIns).toBe(5);
  });

  it("um único relato recente tem confiança baixa", () => {
    const result = estimateCrowd({ reports: [report("Alta", 1)], now: NOW, activeCheckIns: 0 });
    expect(result.level).toBe("Alta");
    expect(result.code).toBe("CROWDED");
    expect(result.confidence).toBe("LOW");
  });

  it("vários relatos concordantes e recentes dão confiança alta", () => {
    const result = estimateCrowd({ reports: [report("Lotado", 1), report("Lotado", 2), report("Lotado", 3), report("Lotado", 4)], now: NOW, activeCheckIns: 0 });
    expect(result.level).toBe("Lotado");
    expect(result.code).toBe("FULL");
    expect(result.confidence).toBe("HIGH");
    expect(result.reportCount).toBe(4);
  });

  it("relatos conflitantes caem para o meio com confiança baixa", () => {
    const result = estimateCrowd({ reports: [report("Vazio", 2), report("Lotado", 2)], now: NOW, activeCheckIns: 0 });
    expect(result.level).toBe("Normal");
    expect(result.confidence).toBe("LOW");
    expect(result.reasons).toContain("relatos divergentes");
  });

  it("relato antigo pesa menos que um recente", () => {
    const result = estimateCrowd({ reports: [report("Lotado", 40), report("Vazio", 1)], now: NOW, activeCheckIns: 0 });
    expect(result.level).toBe("Vazio");
  });

  it("relatos fora da janela são ignorados", () => {
    const result = estimateCrowd({ reports: [report("Lotado", 50)], now: NOW, activeCheckIns: 0 });
    expect(result.level).toBeNull();
    expect(result.confidence).toBe("NONE");
  });

  it("cada pessoa conta uma vez: vale o relato mais recente dela", () => {
    const result = estimateCrowd({
      reports: [report("Vazio", 20, { reporterKey: "mesma" }), report("Vazio", 10, { reporterKey: "mesma" }), report("Lotado", 1, { reporterKey: "mesma" })],
      now: NOW,
      activeCheckIns: 0,
    });
    expect(result.reportCount).toBe(1);
    expect(result.level).toBe("Lotado");
  });

  it("relatos de outro sentido são descartados", () => {
    const result = estimateCrowd({ reports: [report("Lotado", 1, { direction: 2 })], now: NOW, activeCheckIns: 0, direction: 1 });
    expect(result.level).toBeNull();
  });

  it("passageiros com CHECK_IN aumentam a confiança, não o nível", () => {
    const without = estimateCrowd({ reports: [report("Alta", 1)], now: NOW, activeCheckIns: 0 });
    const withCheckIns = estimateCrowd({ reports: [report("Alta", 1)], now: NOW, activeCheckIns: 4 });
    expect(withCheckIns.level).toBe(without.level);
    expect(without.confidence).toBe("LOW");
    expect(withCheckIns.confidence).toBe("MEDIUM");
  });

  it("veículo identificado e coincidente aumenta a confiança", () => {
    const result = estimateCrowd({ reports: [report("Alta", 1, { vehiclePrefix: "11111" })], now: NOW, activeCheckIns: 0, vehiclePrefix: "11111" });
    expect(result.confidence).toBe("MEDIUM");
    expect(result.reasons).toContain("veículo identificado");
  });

  it("relatos sem identificador (legado) contam, mas com menos peso", () => {
    const keyless = estimateCrowd({ reports: [report("Alta", 1, { reporterKey: null })], now: NOW, activeCheckIns: 0 });
    const keyed = estimateCrowd({ reports: [report("Alta", 1)], now: NOW, activeCheckIns: 0 });
    expect(keyless.level).toBe("Alta");
    expect(keyless.effectiveReports).toBeLessThan(keyed.effectiveReports);
  });
});
