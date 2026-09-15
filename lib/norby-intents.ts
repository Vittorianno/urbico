/**
 * Intenções que o Norby consegue classificar a partir de uma mensagem (ver
 * classifyNorbyIntent em lib/urbico-logic.ts). Usadas só para
 * analytics/telemetria — nunca para decidir a resposta em si, que continua
 * vindo do fluxo normal do Norby (regra local ou Ollama, ver
 * server/integrations/norby.ts).
 *
 * "unknown": a mensagem não bateu com nenhum padrão reconhecido.
 * "unsupported": a intenção foi reconhecida, mas o Urbico ainda não tem essa
 * funcionalidade implementada (ex.: pedir para avisar quando o ônibus
 * estiver chegando — o Urbico não tem esse recurso hoje).
 *
 * Como adicionar uma intenção nova: acrescente aqui e em
 * NORBY_UNSUPPORTED_INTENTS (se ainda não for suportada) ou implemente a
 * funcionalidade correspondente e adicione as palavras-chave em
 * classifyNorbyIntent.
 */
export const NORBY_INTENTS = [
  "route_search",
  "next_bus",
  "bus_schedule",
  "bus_location",
  "destination_search",
  "favorite_destination",
  "home_destination",
  "work_destination",
  "crowding",
  "calendar",
  "alerts",
  "map",
  "location",
  "general_question",
  "unsupported",
  "unknown",
] as const;

export type NorbyIntent = (typeof NORBY_INTENTS)[number];

/**
 * Intenções que o Norby já sabe RECONHECER (por palavra-chave), mas para as
 * quais o Urbico ainda não tem uma funcionalidade real por trás — ex.:
 * "me avise quando o ônibus estiver chegando" (notificação de chegada).
 * Registrado com status "unsupported" em vez de "unknown", para diferenciar
 * "não entendi o que você quis dizer" de "entendi, mas ainda não faço
 * isso" (ver docs/analytics.md, seção Norby).
 */
export const NORBY_UNSUPPORTED_INTENTS: NorbyIntent[] = [];
