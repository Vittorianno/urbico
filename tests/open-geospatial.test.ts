import { describe, expect, it } from "vitest";

import { decodeValhallaShape } from "../server/integrations/open-geospatial";

describe("geometria do roteador aberto", () => {
  it("decodifica a geometria polyline do Valhalla para longitude e latitude", () => {
    expect(decodeValhallaShape("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5)).toEqual([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
  });
});
