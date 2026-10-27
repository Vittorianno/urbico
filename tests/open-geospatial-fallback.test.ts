import { afterEach, describe, expect, it, vi } from "vitest";

import { geocode, planWalkingRoute, suggestAddresses } from "../server/integrations/open-geospatial";

const originalPelias = process.env.PELIAS_BASE_URL;
const originalValhalla = process.env.VALHALLA_BASE_URL;

afterEach(() => {
  if (originalPelias === undefined) delete process.env.PELIAS_BASE_URL;
  else process.env.PELIAS_BASE_URL = originalPelias;
  if (originalValhalla === undefined) delete process.env.VALHALLA_BASE_URL;
  else process.env.VALHALLA_BASE_URL = originalValhalla;
  vi.unstubAllGlobals();
});

describe("open geospatial provider policy", () => {
  it("does not call public Nominatim for autocomplete when Pelias is absent", async () => {
    delete process.env.PELIAS_BASE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(suggestAddresses("Avenida Paulista")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fall back to Nominatim autocomplete when configured Pelias fails", async () => {
    process.env.PELIAS_BASE_URL = "https://pelias.example.test";
    const fetchMock = vi.fn(async (_input: string | URL) => ({ ok: false, status: 503, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(suggestAddresses("Avenida Paulista")).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("pelias.example.test");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/autocomplete");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("nominatim.openstreetmap.org");
  });

  it("uses Nominatim only for explicit one-shot geocoding and caches the result", async () => {
    delete process.env.PELIAS_BASE_URL;
    const fetchMock = vi.fn(async (_input: string | URL) => ({
      ok: true,
      json: async () => [{
        display_name: "Avenida Paulista, São Paulo - SP",
        lat: "-23.561",
        lon: "-46.656",
        name: "Avenida Paulista",
        address: { city: "São Paulo", country_code: "br" },
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const expected = {
      name: "Avenida Paulista",
      address: "Avenida Paulista, São Paulo - SP",
      latitude: -23.561,
      longitude: -46.656,
    };
    await expect(geocode("Avenida Paulista")).resolves.toEqual(expected);
    await expect(geocode("Avenida Paulista")).resolves.toEqual(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.hostname).toBe("nominatim.openstreetmap.org");
    expect(calledUrl.searchParams.get("limit")).toBe("1");
  });

  it("does not invent a walking route when Valhalla is not configured", async () => {
    delete process.env.VALHALLA_BASE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(planWalkingRoute(
      { latitude: -23.561, longitude: -46.656 },
      { latitude: -23.55, longitude: -46.633 },
    )).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the pedestrian costing profile from Valhalla", async () => {
    process.env.VALHALLA_BASE_URL = "https://valhalla.example.test";
    const fetchMock = vi.fn(async (_input: string | URL) => ({
      ok: true,
      json: async () => ({
        trip: {
          summary: { length: 0.85, time: 640 },
          legs: [{ shape: "", maneuvers: [{ instruction: "Siga em frente", length: 0.85, time: 640 }] }],
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(planWalkingRoute(
      { latitude: -23.561, longitude: -46.656 },
      { latitude: -23.55, longitude: -46.633 },
    )).resolves.toEqual({
      distanceMeters: 850,
      durationSeconds: 640,
      points: [],
      instructions: [{ text: "Siga em frente", distanceMeters: 850, durationSeconds: 640 }],
    });
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const request = JSON.parse(calledUrl.searchParams.get("json") ?? "{}");
    expect(request.costing).toBe("pedestrian");
  });
});