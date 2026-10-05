// Regras puras (sem banco, sem rede) de viagem e relato de lotação.
// Compartilhadas entre servidor e app; testadas em tests/trip-rules.test.ts.

export const TRIP_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

// Niveis de lotação: mantém os valores já gravados em crowd_reports (compatível
// com relatos antigos). `CROWD_LEVEL_CODES` expõe o código em inglês.
export const CROWD_LEVELS = ["Vazio", "Baixa", "Normal", "Alta", "Lotado"] as const;
export type CrowdLevel = (typeof CROWD_LEVELS)[number];
export const CROWD_LEVEL_CODES: Record<CrowdLevel, "EMPTY" | "LOW" | "NORMAL" | "CROWDED" | "FULL"> = {
  Vazio: "EMPTY",
  Baixa: "LOW",
  Normal: "NORMAL",
  Alta: "CROWDED",
  Lotado: "FULL",
};

// Uma viagem ACTIVE sem sinal de vida por tanto tempo vira EXPIRED.
export const TRIP_STALE_MS = 20 * 60 * 1000;
// Duração máxima absoluta de uma viagem, mesmo com sinais de vida.
export const TRIP_MAX_MS = 4 * 60 * 60 * 1000;
// Um CHECK_IN só conta como passageiro a bordo enquanto houver sinal recente.
export const CHECKIN_FRESH_MS = 10 * 60 * 1000;
// Pings mais frequentes que isto são ignorados (não geram escrita).
export const PING_MIN_INTERVAL_MS = 30 * 1000;

// Anti-spam de relatos.
export const REPORT_MIN_INTERVAL_MS = 60 * 1000;
export const REPORT_DEDUPE_MS = 10 * 60 * 1000;
export const REPORT_HOURLY_CAP = 20;
export const KEYLESS_REPORTS_PER_MINUTE_CAP = 20;

// Localização aproximada (~110 m): suficiente para contexto, sem rastrear
// o passageiro com precisão.
export function roundApprox(value: number): number {
  return Math.round(value * 1000) / 1000;
}

type TripTimes = { lastSeenAt: Date; startedAt: Date };

export function isTripStale(trip: TripTimes, now: Date): boolean {
  return now.getTime() - trip.lastSeenAt.getTime() > TRIP_STALE_MS || now.getTime() - trip.startedAt.getTime() > TRIP_MAX_MS;
}

export function isCheckInFresh(trip: { status: TripStatus; checkedInAt: Date | null; lastSeenAt: Date }, now: Date): boolean {
  return trip.status === "ACTIVE" && trip.checkedInAt !== null && now.getTime() - trip.lastSeenAt.getTime() <= CHECKIN_FRESH_MS;
}
