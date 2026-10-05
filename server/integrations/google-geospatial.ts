// Provider Google para busca de endereço, geocodificação e rota a pé.
//
// Variáveis de ambiente (somente backend — NUNCA EXPO_PUBLIC_*):
//   GOOGLE_MAPS_SERVER_API_KEY   chave com restrição de API (Places API (New),
//                                Geocoding API, Routes API) e, se possível, de IP.
//   GOOGLE_MAPS_DAILY_LIMIT      limite diário de chamadas POR API (padrão 1500).
//                                Ao atingir, o provider lança erro e a fachada
//                                (geospatial.ts) cai para o provider aberto.
//
// Regra de custo: este módulo NUNCA é chamado a cada atualização de GPS. Só é
// acionado por ação explícita (busca, geocode, planejar rota) ou pelo monitor
// de alertas de saída, e mesmo assim passa por cache em memória, deduplicação
// de chamadas simultâneas e teto diário.
import type { Coordinates, GeocodedPlace, WalkingRoute } from "./open-geospatial";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// TTLs curtos de propósito: os termos de uso do Google Maps Platform limitam
// o cache de conteúdo; isto é só proteção contra chamadas repetidas.
const SUGGEST_TTL_MS = 60 * 60 * 1000;
const GEOCODE_TTL_MS = 6 * 60 * 60 * 1000;
const ROUTE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

function apiKey() {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() || null;
}

export function isGoogleGeospatialConfigured() {
  return apiKey() !== null;
}

class TtlCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key: string, value: T, ttlMs: number) {
    if (this.entries.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  clear() {
    this.entries.clear();
  }
}

const suggestCache = new TtlCache<GeocodedPlace[]>();
const geocodeCache = new TtlCache<GeocodedPlace | null>();
const routeCache = new TtlCache<WalkingRoute | null>();
const inflight = new Map<string, Promise<unknown>>();
const usage = new Map<string, { day: string; count: number }>();

function dailyLimit() {
  const parsed = Number(process.env.GOOGLE_MAPS_DAILY_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1500;
}

// Conta uma chamada real ao Google; lança se o teto diário da API foi atingido.
function consumeQuota(api: "places" | "geocoding" | "routes") {
  const today = new Date().toISOString().slice(0, 10);
  const current = usage.get(api);
  const count = current && current.day === today ? current.count : 0;
  if (count >= dailyLimit()) throw new Error(`Teto diário de chamadas Google (${api}) atingido.`);
  usage.set(api, { day: today, count: count + 1 });
}

async function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

const normalizeText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
// 4 casas decimais ≈ 11 m: pontos praticamente iguais compartilham a mesma rota.
const roundCoordinate = (value: number) => value.toFixed(4);
const pointKey = (point: Coordinates) => `${roundCoordinate(point.latitude)},${roundCoordinate(point.longitude)}`;

export function decodeEncodedPolyline(encoded: string, precision = 5): number[][] {
  const factor = 10 ** precision;
  const points: number[][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    const decode = () => {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index <= encoded.length);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    latitude += decode();
    longitude += decode();
    points.push([longitude / factor, latitude / factor]);
  }
  return points;
}

type PlacesResponse = {
  places?: Array<{ displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }>;
};

export async function suggestAddressesViaGoogle(query: string): Promise<GeocodedPlace[]> {
  const key = apiKey();
  if (!key) throw new Error("GOOGLE_MAPS_SERVER_API_KEY não configurada.");
  const cacheKey = normalizeText(query);
  const cached = suggestCache.get(cacheKey);
  if (cached) return cached;
  return dedupe(`suggest:${cacheKey}`, async () => {
    consumeQuota("places");
    const response = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "pt-BR", regionCode: "BR", maxResultCount: 5 }),
    });
    if (!response.ok) throw new Error(`A busca de locais do Google respondeu com status ${response.status}.`);
    const payload = (await response.json()) as PlacesResponse;
    const places = (payload.places ?? [])
      .map((place) => {
        const latitude = place.location?.latitude;
        const longitude = place.location?.longitude;
        if (typeof latitude !== "number" || typeof longitude !== "number") return null;
        const address = place.formattedAddress ?? place.displayName?.text ?? query;
        return { name: place.displayName?.text ?? address, address, latitude, longitude };
      })
      .filter((place): place is GeocodedPlace => Boolean(place));
    suggestCache.set(cacheKey, places, SUGGEST_TTL_MS);
    return places;
  });
}

type GeocodingResponse = {
  status?: string;
  results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }>;
};

export async function geocodeViaGoogle(query: string): Promise<GeocodedPlace | null> {
  const key = apiKey();
  if (!key) throw new Error("GOOGLE_MAPS_SERVER_API_KEY não configurada.");
  const cacheKey = normalizeText(query);
  const cached = geocodeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  return dedupe(`geocode:${cacheKey}`, async () => {
    consumeQuota("geocoding");
    const url = new URL(GEOCODING_URL);
    url.searchParams.set("address", query);
    url.searchParams.set("region", "br");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("key", key);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`A geocodificação do Google respondeu com status ${response.status}.`);
    const payload = (await response.json()) as GeocodingResponse;
    if (payload.status === "ZERO_RESULTS") {
      geocodeCache.set(cacheKey, null, GEOCODE_TTL_MS);
      return null;
    }
    if (payload.status !== "OK") throw new Error(`A geocodificação do Google retornou ${payload.status ?? "erro"}.`);
    const first = payload.results?.[0];
    const latitude = first?.geometry?.location?.lat;
    const longitude = first?.geometry?.location?.lng;
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;
    const address = first?.formatted_address ?? query;
    const place = { name: address, address, latitude, longitude };
    geocodeCache.set(cacheKey, place, GEOCODE_TTL_MS);
    return place;
  });
}

type RoutesResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
    legs?: Array<{ steps?: Array<{ distanceMeters?: number; staticDuration?: string; navigationInstruction?: { instructions?: string } }> }>;
  }>;
};

const parseSeconds = (duration?: string) => {
  const seconds = Number.parseFloat((duration ?? "").replace("s", ""));
  return Number.isFinite(seconds) ? Math.round(seconds) : 0;
};

export async function planWalkingRouteViaGoogle(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute | null> {
  const key = apiKey();
  if (!key) throw new Error("GOOGLE_MAPS_SERVER_API_KEY não configurada.");
  const cacheKey = `${pointKey(origin)}>${pointKey(destination)}`;
  const cached = routeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  return dedupe(`route:${cacheKey}`, async () => {
    consumeQuota("routes");
    const response = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction.instructions",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
        destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
        travelMode: "WALK",
        languageCode: "pt-BR",
        units: "METRIC",
      }),
    });
    if (!response.ok) throw new Error(`O Google Routes respondeu com status ${response.status}.`);
    const payload = (await response.json()) as RoutesResponse;
    const route = payload.routes?.[0];
    if (!route || typeof route.distanceMeters !== "number") {
      routeCache.set(cacheKey, null, ROUTE_TTL_MS);
      return null;
    }
    const result: WalkingRoute = {
      distanceMeters: Math.round(route.distanceMeters),
      durationSeconds: parseSeconds(route.duration),
      points: route.polyline?.encodedPolyline ? decodeEncodedPolyline(route.polyline.encodedPolyline) : [],
      instructions: (route.legs?.[0]?.steps ?? []).map((step) => ({
        text: step.navigationInstruction?.instructions ?? "Continue pela rota",
        distanceMeters: Math.round(step.distanceMeters ?? 0),
        durationSeconds: parseSeconds(step.staticDuration),
      })),
    };
    routeCache.set(cacheKey, result, ROUTE_TTL_MS);
    return result;
  });
}

export function resetGoogleGeospatialStateForTests() {
  suggestCache.clear();
  geocodeCache.clear();
  routeCache.clear();
  inflight.clear();
  usage.clear();
}
