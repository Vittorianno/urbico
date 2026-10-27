import { fetchWithTimeout } from "../_core/http";

export type Coordinates = { latitude: number; longitude: number };
export type GeocodedPlace = Coordinates & { name: string; address: string };
export type WalkingRoute = { distanceMeters: number; durationSeconds: number; points: number[][]; instructions: Array<{ text: string; distanceMeters: number; durationSeconds: number }> };

function serviceUrl(variable: "PELIAS_BASE_URL" | "VALHALLA_BASE_URL") {
  const value = process.env[variable]?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

type PeliasFeature = { geometry?: { coordinates?: [number, number] }; properties?: { label?: string; name?: string; locality?: string; localadmin?: string; county?: string } };
type PeliasResponse = { features?: PeliasFeature[] };

// A SPTrans Olho Vivo cobre o município de São Paulo, não todo o Brasil.
// Este retângulo é uma barreira geográfica conservadora para a busca: impede
// resultados claramente fora da cidade; o geocoder também recebe filtros de
// cidade/área para reduzir falsos positivos nos limites municipais.
const SPTRANS_SEARCH_BOUNDS = {
  minLongitude: -46.826,
  maxLongitude: -46.365,
  minLatitude: -23.735,
  maxLatitude: -23.356,
};

function normalizeLocality(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function isWithinSptransSearchArea(place: GeocodedPlace): boolean {
  return place.longitude >= SPTRANS_SEARCH_BOUNDS.minLongitude
    && place.longitude <= SPTRANS_SEARCH_BOUNDS.maxLongitude
    && place.latitude >= SPTRANS_SEARCH_BOUNDS.minLatitude
    && place.latitude <= SPTRANS_SEARCH_BOUNDS.maxLatitude;
}

function mapPeliasFeature(feature: PeliasFeature, fallback: string): GeocodedPlace | null {
  const [longitude, latitude] = feature.geometry?.coordinates ?? [];
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  const label = feature.properties?.label ?? feature.properties?.name ?? fallback;
  return { name: feature.properties?.name ?? label, address: label, latitude, longitude };
}

async function suggestAddressesViaPelias(query: string): Promise<GeocodedPlace[]> {
  const baseUrl = serviceUrl("PELIAS_BASE_URL");
  if (!baseUrl) return [];
  const url = new URL(`${baseUrl}/v1/autocomplete`);
  url.searchParams.set("text", query);
  url.searchParams.set("lang", "pt-BR");
  url.searchParams.set("boundary.country", "BR");
  url.searchParams.set("boundary.rect.min_lon", String(SPTRANS_SEARCH_BOUNDS.minLongitude));
  url.searchParams.set("boundary.rect.max_lon", String(SPTRANS_SEARCH_BOUNDS.maxLongitude));
  url.searchParams.set("boundary.rect.min_lat", String(SPTRANS_SEARCH_BOUNDS.minLatitude));
  url.searchParams.set("boundary.rect.max_lat", String(SPTRANS_SEARCH_BOUNDS.maxLatitude));
  url.searchParams.set("focus.point.lat", "-23.5505");
  url.searchParams.set("focus.point.lon", "-46.6333");
  url.searchParams.set("size", "5");
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("A busca aberta de endereços não respondeu.");
  const payload = (await response.json()) as PeliasResponse;
  return (payload.features ?? [])
    .filter((feature) => {
      const locality = feature.properties?.locality ?? feature.properties?.county;
      const label = feature.properties?.label ?? feature.properties?.name ?? "";
      // Se o Pelias informar município/região, ela precisa ser São Paulo.
      // Sem metadado de localidade, exigimos que o rótulo confirme a cidade.
      return locality
        ? normalizeLocality(locality) === "sao paulo"
        : normalizeLocality(label).includes("sao paulo");
    })
    .map((feature) => mapPeliasFeature(feature, query))
    .filter((place): place is GeocodedPlace => place !== null && isWithinSptransSearchArea(place));
}

// O Nominatim público não é usado para autocomplete: a política do serviço
// não permite esse padrão de consultas conforme a pessoa digita. Sem Pelias,
// as sugestões automáticas ficam indisponíveis, mas o endereço ainda pode ser
// digitado manualmente. Uma busca pontual explícita (geocode) pode usar
// Nominatim com cache e fila de no máximo uma chamada por segundo por processo.
type NominatimResult = { display_name?: string; lat?: string; lon?: string; name?: string; address?: { city?: string; municipality?: string; town?: string; country_code?: string } };

const NOMINATIM_MIN_INTERVAL_MS = 1_100;
const nominatimCache = new Map<string, GeocodedPlace | null>();
let nominatimLastRequestAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

async function geocodeViaNominatim(query: string): Promise<GeocodedPlace | null> {
  const cacheKey = normalizeLocality(query);
  if (nominatimCache.has(cacheKey)) return nominatimCache.get(cacheKey) ?? null;

  const previous = nominatimQueue;
  let release!: () => void;
  const turn = new Promise<void>((resolve) => { release = resolve; });
  nominatimQueue = previous.then(() => turn);
  await previous;

  try {
    // Outra chamada idêntica pode ter preenchido o cache enquanto esta aguardava a fila.
    if (nominatimCache.has(cacheKey)) return nominatimCache.get(cacheKey) ?? null;
    const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - nominatimLastRequestAt));
    if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    nominatimLastRequestAt = Date.now();

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${query}, São Paulo, SP, Brasil`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("viewbox", `${SPTRANS_SEARCH_BOUNDS.minLongitude},${SPTRANS_SEARCH_BOUNDS.maxLatitude},${SPTRANS_SEARCH_BOUNDS.maxLongitude},${SPTRANS_SEARCH_BOUNDS.minLatitude}`);
    url.searchParams.set("bounded", "1");
    url.searchParams.set("accept-language", "pt-BR");
    url.searchParams.set("limit", "1");
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": "UrbicoApp/1.0 (projeto pessoal de mobilidade urbana)" } });
    if (!response.ok) throw new Error(`O Nominatim respondeu com status ${response.status}.`);
    const payload = (await response.json()) as NominatimResult[];
    const item = payload[0];
    let place: GeocodedPlace | null = null;
    if (item?.display_name) {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      const locality = item.address?.city ?? item.address?.municipality ?? item.address?.town;
      if (locality && normalizeLocality(locality) === "sao paulo"
        && (!item.address?.country_code || item.address.country_code.toLowerCase() === "br")
        && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const candidate = { name: item.name ?? item.display_name, address: item.display_name, latitude, longitude };
        if (isWithinSptransSearchArea(candidate)) place = candidate;
      }
    }
    nominatimCache.set(cacheKey, place);
    if (nominatimCache.size > 100) {
      const oldestKey = nominatimCache.keys().next().value;
      if (oldestKey !== undefined) nominatimCache.delete(oldestKey);
    }
    return place;
  } finally {
    release();
  }
}

export async function suggestAddresses(query: string): Promise<GeocodedPlace[]> {
  if (query.trim().length < 2) return [];
  if (!serviceUrl("PELIAS_BASE_URL")) return [];
  try {
    return await suggestAddressesViaPelias(query);
  } catch {
    // Sem Pelias saudável, não use o Nominatim público como autocomplete.
    return [];
  }
}

export async function geocode(query: string): Promise<GeocodedPlace | null> {
  if (query.trim().length < 2) return null;
  if (serviceUrl("PELIAS_BASE_URL")) {
    try {
      const places = await suggestAddressesViaPelias(query);
      if (places[0]) return places[0];
    } catch {
      // Busca pontual pode recorrer ao Nominatim com rate limit/cache.
    }
  }
  try {
    return await geocodeViaNominatim(query);
  } catch {
    return null;
  }
}

export function decodeValhallaShape(shape: string, precision = 6): number[][] {
  const factor = 10 ** precision;
  const points: number[][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < shape.length) {
    const decode = () => {
      let result = 0;
      let shift = 0;
      let byte: number;
      do { byte = shape.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index <= shape.length);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    latitude += decode();
    longitude += decode();
    points.push([longitude / factor, latitude / factor]);
  }
  return points;
}

type ValhallaRoute = { trip?: { summary?: { length?: number; time?: number }; legs?: Array<{ shape?: string; maneuvers?: Array<{ instruction?: string; length?: number; time?: number }> }> } };

async function planWalkingRouteViaValhalla(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute | null> {
  const baseUrl = serviceUrl("VALHALLA_BASE_URL");
  if (!baseUrl) return null;
  const url = new URL(`${baseUrl}/route`);
  url.searchParams.set("json", JSON.stringify({ locations: [{ lat: origin.latitude, lon: origin.longitude }, { lat: destination.latitude, lon: destination.longitude }], costing: "pedestrian", units: "kilometers", language: "pt-BR", shape_format: "polyline6" }));
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("O roteador aberto (Valhalla) não respondeu.");
  const payload = (await response.json()) as ValhallaRoute;
  const trip = payload.trip;
  if (!trip?.summary || typeof trip.summary.length !== "number" || typeof trip.summary.time !== "number") return null;
  const leg = trip.legs?.[0];
  return { distanceMeters: Math.round(trip.summary.length * 1000), durationSeconds: Math.round(trip.summary.time), points: leg?.shape ? decodeValhallaShape(leg.shape) : [], instructions: (leg?.maneuvers ?? []).map((maneuver) => ({ text: maneuver.instruction ?? "Continue pela rota", distanceMeters: Math.round((maneuver.length ?? 0) * 1000), durationSeconds: Math.round(maneuver.time ?? 0) })) };
}

// Não use o OSRM público como fallback de caminhada: uma resposta HTTP 200
// não comprova que o perfil pedestrian esteja habilitado. Sem Valhalla próprio
// configurado, a rota a pé fica indisponível em vez de mostrar dados de carro.
export async function planWalkingRoute(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute | null> {
  try {
    return await planWalkingRouteViaValhalla(origin, destination);
  } catch {
    return null;
  }
}