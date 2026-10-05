import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decodeEncodedPolyline,
  geocodeViaGoogle,
  planWalkingRouteViaGoogle,
  resetGoogleGeospatialStateForTests,
  suggestAddressesViaGoogle,
} from "../server/integrations/google-geospatial";
import { activeGeospatialProvider } from "../server/integrations/geospatial";

const originalKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
const originalLimit = process.env.GOOGLE_MAPS_DAILY_LIMIT;
const originalProvider = process.env.GEO_PROVIDER;

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

beforeEach(() => {
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "chave-de-teste";
  delete process.env.GOOGLE_MAPS_DAILY_LIMIT;
  delete process.env.GEO_PROVIDER;
  resetGoogleGeospatialStateForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  else process.env.GOOGLE_MAPS_SERVER_API_KEY = originalKey;
  if (originalLimit === undefined) delete process.env.GOOGLE_MAPS_DAILY_LIMIT;
  else process.env.GOOGLE_MAPS_DAILY_LIMIT = originalLimit;
  if (originalProvider === undefined) delete process.env.GEO_PROVIDER;
  else process.env.GEO_PROVIDER = originalProvider;
});

describe("provider Google de geoespacial", () => {
  it("decodifica polyline codificada (precisão 5) para [longitude, latitude]", () => {
    expect(decodeEncodedPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it("escolhe o provider conforme a chave e GEO_PROVIDER", () => {
    expect(activeGeospatialProvider()).toBe("google");
    process.env.GEO_PROVIDER = "open";
    expect(activeGeospatialProvider()).toBe("open");
    delete process.env.GEO_PROVIDER;
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    expect(activeGeospatialProvider()).toBe("open");
  });

  it("planeja rota a pé e reaproveita o cache para pontos praticamente iguais", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        routes: [
          {
            duration: "845s",
            distanceMeters: 1010,
            polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC" },
            legs: [{ steps: [{ distanceMeters: 1010, staticDuration: "845s", navigationInstruction: { instructions: "Siga em frente" } }] }],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const origin = { latitude: -23.55052, longitude: -46.63331 };
    const destination = { latitude: -23.56, longitude: -46.64 };
    const first = await planWalkingRouteViaGoogle(origin, destination);
    const second = await planWalkingRouteViaGoogle({ latitude: -23.550521, longitude: -46.633312 }, destination);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first?.distanceMeters).toBe(1010);
    expect(first?.durationSeconds).toBe(845);
    expect(first?.instructions[0]?.text).toBe("Siga em frente");
    expect(first?.points.length).toBe(2);
  });

  it("deduplica chamadas simultâneas idênticas", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: "OK", results: [{ formatted_address: "Av. Paulista, São Paulo", geometry: { location: { lat: -23.56, lng: -46.65 } } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([geocodeViaGoogle("Av Paulista"), geocodeViaGoogle("  av   paulista ")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a?.latitude).toBe(-23.56);
  });

  it("sugere locais pelo Places e usa cache na repetição", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ places: [{ displayName: { text: "MASP" }, formattedAddress: "Av. Paulista, 1578", location: { latitude: -23.5614, longitude: -46.6559 } }, { displayName: { text: "sem local" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const first = await suggestAddressesViaGoogle("masp");
    const second = await suggestAddressesViaGoogle("MASP");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toEqual([{ name: "MASP", address: "Av. Paulista, 1578", latitude: -23.5614, longitude: -46.6559 }]);
  });

  it("bloqueia novas chamadas ao atingir o teto diário", async () => {
    process.env.GOOGLE_MAPS_DAILY_LIMIT = "1";
    const fetchMock = vi.fn(async () => jsonResponse({ status: "ZERO_RESULTS", results: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await geocodeViaGoogle("endereço um");
    await expect(geocodeViaGoogle("endereço dois")).rejects.toThrow(/Teto diário/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
