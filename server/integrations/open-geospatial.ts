export type Coordinates = { latitude: number; longitude: number };
export type GeocodedPlace = Coordinates & { name: string; address: string };
export type WalkingRoute = { distanceMeters: number; durationSeconds: number; points: number[][]; instructions: Array<{ text: string; distanceMeters: number; durationSeconds: number }> };

function serviceUrl(variable: "PELIAS_BASE_URL" | "VALHALLA_BASE_URL") {
  const value = process.env[variable]?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

type PeliasFeature = { geometry?: { coordinates?: [number, number] }; properties?: { label?: string; name?: string } };
type PeliasResponse = { features?: PeliasFeature[] };

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
  url.searchParams.set("size", "5");
  const response = await fetch(url);
  if (!response.ok) throw new Error("A busca aberta de endereços não respondeu.");
  const payload = (await response.json()) as PeliasResponse;
  return (payload.features ?? []).map((feature) => mapPeliasFeature(feature, query)).filter((place): place is GeocodedPlace => Boolean(place));
}

// FIX: sem um PELIAS_BASE_URL configurado (o normal, já que rodar um Pelias
// exige infraestrutura própria com Elasticsearch), `suggestAddresses` sempre
// retornava `[]` — nenhuma sugestão de endereço aparecia nunca, o que
// impedia salvar favoritos com coordenadas reais. O Nominatim (OpenStreetMap)
// é um serviço público, gratuito e sem necessidade de chave de API, e serve
// como busca de endereço "de verdade" pronta para uso, sem exigir nenhuma
// infraestrutura própria. Ele exige apenas um User-Agent identificando o app
// (política de uso do Nominatim) e um limite de ~1 requisição por segundo.
type NominatimResult = { display_name?: string; lat?: string; lon?: string; name?: string };

async function suggestAddressesViaNominatim(query: string): Promise<GeocodedPlace[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("limit", "5");
  const response = await fetch(url, { headers: { "User-Agent": "UrbicoApp/1.0 (projeto pessoal de mobilidade urbana)" } });
  if (!response.ok) throw new Error("O Nominatim não respondeu.");
  const payload = (await response.json()) as NominatimResult[];
  return payload
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !item.display_name) return null;
      return { name: item.name ?? item.display_name, address: item.display_name, latitude, longitude };
    })
    .filter((place): place is GeocodedPlace => Boolean(place));
}

export async function suggestAddresses(query: string): Promise<GeocodedPlace[]> {
  if (query.trim().length < 2) return [];
  const baseUrl = serviceUrl("PELIAS_BASE_URL");
  if (baseUrl) {
    try {
      return await suggestAddressesViaPelias(query);
    } catch {
      // Pelias configurado mas fora do ar: cai para o Nominatim em vez de
      // deixar a pessoa sem nenhuma sugestão.
    }
  }
  return suggestAddressesViaNominatim(query);
}

export async function geocode(query: string) {
  const places = await suggestAddresses(query);
  return places[0] ?? null;
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

export async function planWalkingRoute(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute | null> {
  const baseUrl = serviceUrl("VALHALLA_BASE_URL");
  if (!baseUrl) return null;
  const url = new URL(`${baseUrl}/route`);
  url.searchParams.set("json", JSON.stringify({ locations: [{ lat: origin.latitude, lon: origin.longitude }, { lat: destination.latitude, lon: destination.longitude }], costing: "pedestrian", units: "kilometers", language: "pt-BR", shape_format: "polyline6" }));
  const response = await fetch(url);
  if (!response.ok) throw new Error("O roteador aberto não respondeu.");
  const payload = (await response.json()) as ValhallaRoute;
  const trip = payload.trip;
  if (!trip?.summary || typeof trip.summary.length !== "number" || typeof trip.summary.time !== "number") return null;
  const leg = trip.legs?.[0];
  return { distanceMeters: Math.round(trip.summary.length * 1000), durationSeconds: Math.round(trip.summary.time), points: leg?.shape ? decodeValhallaShape(leg.shape) : [], instructions: (leg?.maneuvers ?? []).map((maneuver) => ({ text: maneuver.instruction ?? "Continue pela rota", distanceMeters: Math.round((maneuver.length ?? 0) * 1000), durationSeconds: Math.round(maneuver.time ?? 0) })) };
}
