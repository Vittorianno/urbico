/**
 * Catálogo de eventos de analytics do Urbico. Fonte única da verdade para
 * quais nomes de evento existem — usado tanto pelo rastreador no cliente
 * (lib/analytics.ts) quanto para validar o payload no servidor
 * (server/routers.ts). Ver docs/analytics.md para o formato de
 * `properties` esperado em cada um.
 *
 * Como adicionar um evento novo: acrescente o nome aqui, documente o
 * formato esperado em docs/analytics.md, e chame
 * `analytics.track("seu_evento", { ...propriedades })` no ponto do código
 * onde a ação acontece de verdade.
 */
export const ANALYTICS_EVENTS = [
  // Ciclo de vida do app / conta
  "app_opened",
  "user_registered",
  "user_login",
  "user_logout",
  // Rotas e mapa
  "route_search",
  "route_selected",
  "route_started",
  "map_opened",
  // Favoritos
  "favorite_added",
  "favorite_removed",
  "favorite_used",
  // Agenda e alertas de saída
  "calendar_opened",
  "calendar_event_created",
  "alert_created",
  "alert_triggered",
  // Lotação colaborativa
  "crowd_report_created",
  "crowd_report_viewed",
  // Norby — ver lib/norby-intents.ts para as intenções dentro de "properties"
  "norby_opened",
  "norby_command",
  // AdMob
  "ad_impression",
  "ad_clicked",
  // Urbico Navigation (viagem multimodal em /trip) — ver lib/trip-navigation.ts
  "navigation_started",
  "navigation_step_completed",
  "navigation_rerouted",
  "bus_boarding_detected",
  "bus_stop_reached",
  "bus_alighting_detected",
  "destination_reached",
  "navigation_cancelled",
  "norby_navigation_instruction",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
