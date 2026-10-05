// Fachada única de geocodificação, busca de endereço e rota a pé.
// Consumers (routers.ts, leave-alert-monitor.ts) importam SOMENTE daqui.
//
// Seleção de provider:
//   GEO_PROVIDER=google | open   força um provider (opcional).
//   Sem GEO_PROVIDER: usa Google quando GOOGLE_MAPS_SERVER_API_KEY existe;
//   caso contrário, usa o provider aberto (Nominatim/OSRM/Pelias/Valhalla).
//
// Se o Google falhar (inclusive por teto diário de chamadas), cai para o
// provider aberto — o app nunca fica sem busca/rota por causa de custo.
// Quando a migração estiver validada em produção, remover open-geospatial.ts
// e este fallback.
import {
  geocodeViaGoogle,
  isGoogleGeospatialConfigured,
  planWalkingRouteViaGoogle,
  suggestAddressesViaGoogle,
} from "./google-geospatial";
import * as open from "./open-geospatial";

export type { Coordinates, GeocodedPlace, WalkingRoute } from "./open-geospatial";

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

export async function suggestAddresses(query: string): Promise<open.GeocodedPlace[]> {
  if (query.trim().length < 2) return [];
  if (activeGeospatialProvider() === "google") {
    try {
      return await suggestAddressesViaGoogle(query);
    } catch (error) {
      console.warn("[geospatial] Google indisponível para busca; usando provider aberto:", error instanceof Error ? error.message : error);
    }
  }
  return open.suggestAddresses(query);
}

export async function geocode(query: string) {
  if (activeGeospatialProvider() === "google") {
    try {
      return await geocodeViaGoogle(query);
    } catch (error) {
      console.warn("[geospatial] Google indisponível para geocodificação; usando provider aberto:", error instanceof Error ? error.message : error);
    }
  }
  return open.geocode(query);
}

export async function planWalkingRoute(origin: open.Coordinates, destination: open.Coordinates): Promise<open.WalkingRoute | null> {
  if (activeGeospatialProvider() === "google") {
    try {
      return await planWalkingRouteViaGoogle(origin, destination);
    } catch (error) {
      console.warn("[geospatial] Google indisponível para rota; usando provider aberto:", error instanceof Error ? error.message : error);
    }
  }
  return open.planWalkingRoute(origin, destination);
}
