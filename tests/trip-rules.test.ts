import { describe, expect, it } from "vitest";

import { CHECKIN_FRESH_MS, CROWD_LEVEL_CODES, CROWD_LEVELS, TRIP_MAX_MS, TRIP_STALE_MS, isCheckInFresh, isTripStale, roundApprox } from "../lib/trip-rules";

const NOW = new Date("2026-10-05T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("regras de viagem", () => {
  it("arredonda a localização para ~110 m", () => {
    expect(roundApprox(-23.550523)).toBe(-23.551);
    expect(roundApprox(-46.633308)).toBe(-46.633);
  });

  it("viagem sem sinal de vida expira; com sinal recente não", () => {
    expect(isTripStale({ startedAt: ago(60_000), lastSeenAt: ago(60_000) }, NOW)).toBe(false);
    expect(isTripStale({ startedAt: ago(TRIP_STALE_MS + 1), lastSeenAt: ago(TRIP_STALE_MS + 1) }, NOW)).toBe(true);
  });

  it("viagem acima da duração máxima expira mesmo com sinal recente", () => {
    expect(isTripStale({ startedAt: ago(TRIP_MAX_MS + 1), lastSeenAt: ago(1_000) }, NOW)).toBe(true);
  });

  it("CHECK_IN só vale com viagem ACTIVE e sinal recente", () => {
    const base = { status: "ACTIVE" as const, checkedInAt: ago(5_000), lastSeenAt: ago(5_000) };
    expect(isCheckInFresh(base, NOW)).toBe(true);
    expect(isCheckInFresh({ ...base, lastSeenAt: ago(CHECKIN_FRESH_MS + 1) }, NOW)).toBe(false);
    expect(isCheckInFresh({ ...base, status: "COMPLETED" }, NOW)).toBe(false);
    expect(isCheckInFresh({ ...base, checkedInAt: null }, NOW)).toBe(false);
  });

  it("mapeia cada nível existente para um código em inglês", () => {
    expect(CROWD_LEVELS).toHaveLength(5);
    expect(CROWD_LEVEL_CODES.Vazio).toBe("EMPTY");
    expect(CROWD_LEVEL_CODES.Lotado).toBe("FULL");
  });
});
