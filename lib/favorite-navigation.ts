import type { Favorite } from "@/lib/urbico-context";

/**
 * Um favorito só está "pronto para navegação" quando já tem coordenadas
 * salvas. Enquanto isso não acontece (placeholder "Defina seu endereço"),
 * ele ainda está em configuração — ver REGRA 2 do brief de auditoria.
 */
export function isFavoriteConfigured(favorite: Pick<Favorite, "latitude" | "longitude">): boolean {
  return favorite.latitude != null && favorite.longitude != null;
}

/**
 * Parâmetros de navegação para "ir até este favorito" (REGRA 1). Usar sempre
 * que o toque principal num favorito configurado precisar abrir Rotas com o
 * destino pronto, em vez de duplicar esse objeto em cada tela.
 */
export function favoriteRouteParams(favorite: Favorite) {
  return {
    pathname: "/routes" as const,
    params: {
      destination: favorite.address,
      destinationName: favorite.label,
      destinationLat: String(favorite.latitude),
      destinationLng: String(favorite.longitude),
    },
  };
}
