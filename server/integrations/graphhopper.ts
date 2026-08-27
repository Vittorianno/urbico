const GRAPHOPPER_BASE_URL = "https://graphhopper.com/api/1";

export type Coordinates = { latitude: number; longitude: number };
export type GeocodedPlace = Coordinates & { name: string; address: string };
export type WalkingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  points: number[][];
  instructions: Array<{ text: string; distanceMeters: number; durationSeconds: number }>;
};

function getApiKey() {
  const key = process.env.GRAPHOPPER_API_KEY;
  if (!key) throw new Error("Serviço de rotas não configurado.");
  return key;
}

async function graphhopperRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(`${GRAPHOPPER_BASE_URL}${path}`);
  url.searchParams.set("key", getApiKey());
  const response = await fetch(url, init);
  if (!response.ok) throw new Error("O serviço de rotas não respondeu à consulta.");
  return (await response.json()) as T;
}

type GeocodeHit = { name?: string; point?: { lat?: number; lng?: number }; country?: string; city?: string; street?: string; housenumber?: string };
type GeocodeResponse = { hits?: GeocodeHit[] };

function mapGeocodeHit(hit: GeocodeHit, fallback: string): GeocodedPlace | null {
  if (!hit.point || typeof hit.point.lat !== "number" || typeof hit.point.lng !== "number") return null;
  const address = [hit.street, hit.housenumber, hit.city, hit.country].filter(Boolean).join(", ");
  return { name: hit.name ?? fallback, address: address || fallback, latitude: hit.point.lat, longitude: hit.point.lng };
}

export async function suggestAddresses(query: string): Promise<GeocodedPlace[]> {
  const data = await graphhopperRequest<GeocodeResponse>(`/geocode?q=${encodeURIComponent(query)}&limit=5&locale=pt_BR`);
  return (data.hits ?? []).map((hit) => mapGeocodeHit(hit, query)).filter((place): place is GeocodedPlace => Boolean(place));
}

export async function geocode(query: string): Promise<GeocodedPlace | null> {
  const results = await suggestAddresses(query);
  return results[0] ?? null;
}

export async function planWalkingRoute(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute | null> {
  type RouteResponse = { paths?: Array<{ distance?: number; time?: number; points?: { coordinates?: number[][] }; instructions?: Array<{ text?: string; distance?: number; time?: number }> }> };
  const data = await graphhopperRequest<RouteResponse>("/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profile: "foot",
      points: [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]],
      locale: "pt_BR",
      instructions: true,
      points_encoded: false,
    }),
  });
  const path = data.paths?.[0];
  if (!path || typeof path.distance !== "number" || typeof path.time !== "number") return null;
  return {
    distanceMeters: path.distance,
    durationSeconds: Math.round(path.time / 1000),
    points: path.points?.coordinates ?? [],
    instructions: (path.instructions ?? []).map((instruction) => ({
      text: instruction.text ?? "Continue pela rota",
      distanceMeters: instruction.distance ?? 0,
      durationSeconds: Math.round((instruction.time ?? 0) / 1000),
    })),
  };
}
