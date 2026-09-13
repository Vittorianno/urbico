import { afterEach, describe, expect, it, vi } from "vitest";

import { planWalkingRoute, suggestAddresses } from "../server/integrations/open-geospatial";

const originalPelias = process.env.PELIAS_BASE_URL;
const originalValhalla = process.env.VALHALLA_BASE_URL;

afterEach(() => {
  if (originalPelias === undefined) delete process.env.PELIAS_BASE_URL;
  else process.env.PELIAS_BASE_URL = originalPelias;
  if (originalValhalla === undefined) delete process.env.VALHALLA_BASE_URL;
  else process.env.VALHALLA_BASE_URL = originalValhalla;
  vi.unstubAllGlobals();
});

describe("open geospatial fallback", () => {
  // FIX: sem Pelias, o comportamento deixou de ser "retorna vazio" — agora
  // cai para o Nominatim (serviço público, sem necessidade de servidor
  // próprio) para que a busca de endereço continue funcionando de verdade.
  // O teste passa a verificar essa chamada de fallback, com fetch mockado
  // (não bate na rede real durante os testes).
  it("falls back to Nominatim without Pelias", async () => {
    delete process.env.PELIAS_BASE_URL;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ display_name: "Avenida Paulista, São Paulo - SP", lat: "-23.561", lon: "-46.656", name: "Avenida Paulista" }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(suggestAddresses("Avenida Paulista")).resolves.toEqual([
      { name: "Avenida Paulista", address: "Avenida Paulista, São Paulo - SP", latitude: -23.561, longitude: -46.656 },
    ]);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("nominatim.openstreetmap.org");
  });

  // FIX: mesma lógica para a rota a pé — sem Valhalla agora cai para o
  // servidor público do OSRM em vez de retornar null.
  it("falls back to OSRM without Valhalla", async () => {
    delete process.env.VALHALLA_BASE_URL;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 850,
            duration: 640,
            geometry: { coordinates: [[-46.656, -23.561], [-46.633, -23.55]] },
            legs: [{ steps: [{ distance: 850, duration: 640, name: "Rua Exemplo", maneuver: { type: "depart" } }] }],
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const route = await planWalkingRoute({ latitude: -23.561, longitude: -46.656 }, { latitude: -23.55, longitude: -46.633 });
    expect(route).toEqual({
      distanceMeters: 850,
      durationSeconds: 640,
      points: [[-46.656, -23.561], [-46.633, -23.55]],
      instructions: [{ text: "Siga em Rua Exemplo", distanceMeters: 850, durationSeconds: 640 }],
    });
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("router.project-osrm.org");
  });
});
