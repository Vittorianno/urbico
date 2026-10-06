// Fachada única de geocodificação, busca de endereço e rota a pé.
// Consumers (routers.ts, leave-alert-monitor.ts) importam SOMENTE daqui.
//
// Seleção de provider:
//   GEO_PROVIDER=google | open   força um provider (opcional).
//   Sem GEO_PROVIDER: usa Google quando GOOGLE_MAPS_SERVER_API_KEY existe;
//   caso contrário, usa o provider aberto (Nominatim/OSRM/Pelias/Valhalla).
//
// Se o Google falhar (chave inválida, API desativada, teto diário, rede), cai
// para o provider aberto e NÃO tenta o Google de novo por GOOGLE_BLOCK_MS
// (disjuntor): evita uma chamada Google com falha a cada tecla digitada e
// evita encher o log. Quando a migração estiver validada em produção,
// remover open-geospatial.ts e este fallback.
import {
  geocodeViaGoogle,
  isGoogleGeospatialConfigured,
  planWalkingRouteViaGoogle,
  suggestAddressesViaGoogle,
} from "./google-geospatial";
import * as open from "./open-geospatial";

export type { Coordinates, GeocodedPlace, WalkingRoute } from "./open-geospatial";

const GOOGLE_BLOCK_MS = 2 * 60 * 1000;
let googleBlockedUntil = 0;

export function resetGeospatialCircuitForTests() {
  googleBlockedUntil = 0;
}

export function activeGeospatialProvider(): "google" | "open" {
  const forced = process.env.GEO_PROVIDER?.trim().toLowerCase();
  if (forced === "open") return "open";
  return isGoogleGeospatialConfigured() ? "google" : "open";
}

export function geospatialStatus() {
  const provider = activeGeospatialProvider();
  return {
    provider,
    geocodingAvailable: provider === "google" || Boolean(process.env.PELIAS_BASE_URL?.trim()),
    routingAvailable: provider === "google" || Boolean(process.env.VALHALLA_BASE_URL?.trim()),
  };
}

async function tryGoogle<T>(label: string, run: () => Promise<T>): Promise<{ used: true; value: T } | { used: false }> {
  if (activeGeospatialProvider() !== "google" || Date.now() < googleBlockedUntil) return { used: false };
  try {
    return { used: true, value: await run() };
  } catch (error) {
    googleBlockedUntil = Date.now() + GOOGLE_BLOCK_MS;
    console.warn(`[geospatial] Google indisponível para ${label}; usando provider aberto por 2 min:`, error instanceof Error ? error.message : error);
    return { used: false };
  }
}

export async function suggestAddresses(query: string): Promise<open.GeocodedPlace[]> {
  if (query.trim().length < 2) return [];
  const google = await tryGoogle("busca", () => suggestAddressesViaGoogle(query));
  if (google.used) return google.value;
  return open.suggestAddresses(query);
}

export async function geocode(query: string) {
  const google = await tryGoogle("geocodificação", () => geocodeViaGoogle(query));
  if (google.used) return google.value;
  return open.geocode(query);
}

export async function planWalkingRoute(origin: open.Coordinates, destination: open.Coordinates): Promise<open.WalkingRoute | null> {
  const google = await tryGoogle("rota", () => planWalkingRouteViaGoogle(origin, destination));
  if (google.used) return google.value;
  return open.planWalkingRoute(origin, destination);
}
