import { afterEach, describe, expect, it } from "vitest";

import { planWalkingRoute, suggestAddresses } from "../server/integrations/open-geospatial";

const originalPelias = process.env.PELIAS_BASE_URL;
const originalValhalla = process.env.VALHALLA_BASE_URL;

afterEach(() => {
  if (originalPelias === undefined) delete process.env.PELIAS_BASE_URL;
  else process.env.PELIAS_BASE_URL = originalPelias;
  if (originalValhalla === undefined) delete process.env.VALHALLA_BASE_URL;
  else process.env.VALHALLA_BASE_URL = originalValhalla;
});

describe("open geospatial fallback", () => {
  it("returns no address suggestions without Pelias", async () => {
    delete process.env.PELIAS_BASE_URL;
    await expect(suggestAddresses("Avenida Paulista")).resolves.toEqual([]);
  });

  it("returns no route without Valhalla", async () => {
    delete process.env.VALHALLA_BASE_URL;
    await expect(
      planWalkingRoute(
        { latitude: -23.561, longitude: -46.656 },
        { latitude: -23.550, longitude: -46.633 },
      ),
    ).resolves.toBeNull();
  });
});
