export type TransitAvailability = "unavailable" | "available";

export type NearbyDeparture = {
  line: string;
  destination: string;
  estimatedMinutes: number | null;
  crowdLevel: "Vazio" | "Baixa" | "Normal" | "Alta" | "Lotado" | null;
  updatedAt: string | null;
};

export type TransitRouteRequest = {
  origin: string;
  destination: string;
};

export type TransitRoute = {
  id: string;
  walkingMinutes: number | null;
  totalMinutes: number | null;
  steps: string[];
};

export interface TransitRepository {
  getAvailability(): Promise<TransitAvailability>;
  getNearbyDepartures(): Promise<NearbyDeparture[]>;
  planRoute(request: TransitRouteRequest): Promise<TransitRoute[]>;
}

/**
 * Fonte segura por padrão: mantém a experiência honesta até que uma fonte
 * oficial seja configurada no backend. As telas nunca precisam conhecer a
 * API da cidade diretamente.
 */
export class UnavailableTransitRepository implements TransitRepository {
  async getAvailability(): Promise<TransitAvailability> {
    return "unavailable";
  }

  async getNearbyDepartures(): Promise<NearbyDeparture[]> {
    return [];
  }

  async planRoute(_: TransitRouteRequest): Promise<TransitRoute[]> {
    return [];
  }
}

export const transitEngine: TransitRepository = new UnavailableTransitRepository();
