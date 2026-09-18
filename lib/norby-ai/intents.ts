import { z } from "zod";

/**
 * Camada de intenções do Norby AI Engine (arquitetura pedida: NORBY -> NORBY
 * AI ENGINE -> LLAMA LOCAL -> INTENT ROUTER -> FUNÇÕES DO URBICO).
 *
 * O modelo (local via llama.rn, ou o Ollama remoto já existente em
 * server/integrations/norby.ts) NUNCA executa nada diretamente — ele só
 * produz uma dessas estruturas, validada por schema. Quem executa é sempre
 * o código do Urbico, através de tool-registry.ts. Isso é o que a seção 20
 * do briefing pede: nada de "exec(...)" gerado pelo modelo.
 *
 * Lista inicial de intents — não precisa (nem deve) estar toda ligada a uma
 * função real desde já; novas entram aqui e em tool-registry.ts sem mexer
 * no roteador.
 */

export const NORBY_INTENT_NAMES = [
  "CHAT",
  "CLEAR_CHAT",
  "SEARCH_ADDRESS",
  "ROUTE_REQUEST",
  "ADD_CALENDAR_EVENT",
  "LIST_CALENDAR_EVENTS",
  "DELETE_CALENDAR_EVENT",
  "SEARCH_TRANSPORT",
  "SAVE_FAVORITE",
  "REMOVE_FAVORITE",
  "GET_CURRENT_LOCATION",
  "SET_HOME",
  "SET_WORK",
] as const;

export type NorbyIntentName = (typeof NORBY_INTENT_NAMES)[number];

// Cada schema descreve só o que o LLM tem permissão de preencher. Campos
// como coordenadas, horário de ônibus ou distância NUNCA aparecem aqui —
// esses vêm de Pelias/Valhalla/SPTrans de verdade (seção 7/23 do
// briefing), nunca do modelo.
export const norbyIntentSchemas = {
  CHAT: z.object({ intent: z.literal("CHAT") }),
  CLEAR_CHAT: z.object({ intent: z.literal("CLEAR_CHAT") }),
  SEARCH_ADDRESS: z.object({ intent: z.literal("SEARCH_ADDRESS"), query: z.string().min(1) }),
  ROUTE_REQUEST: z.object({
    intent: z.literal("ROUTE_REQUEST"),
    destination: z.string().min(1),
    transportMode: z.enum(["unknown", "bus", "walk"]).default("unknown"),
  }),
  ADD_CALENDAR_EVENT: z.object({
    intent: z.literal("ADD_CALENDAR_EVENT"),
    title: z.string().min(1),
    date: z.string().min(1), // linguagem natural ("amanhã", "2026-09-20") — resolvida pelo app, não pelo modelo
    time: z.string().optional(),
    address: z.string().optional(),
  }),
  LIST_CALENDAR_EVENTS: z.object({ intent: z.literal("LIST_CALENDAR_EVENTS"), date: z.string().optional() }),
  DELETE_CALENDAR_EVENT: z.object({ intent: z.literal("DELETE_CALENDAR_EVENT"), description: z.string().min(1) }),
  SEARCH_TRANSPORT: z.object({ intent: z.literal("SEARCH_TRANSPORT"), line: z.string().optional(), destination: z.string().optional() }),
  SAVE_FAVORITE: z.object({ intent: z.literal("SAVE_FAVORITE"), label: z.string().min(1), address: z.string().min(1) }),
  REMOVE_FAVORITE: z.object({ intent: z.literal("REMOVE_FAVORITE"), label: z.string().min(1) }),
  GET_CURRENT_LOCATION: z.object({ intent: z.literal("GET_CURRENT_LOCATION") }),
  SET_HOME: z.object({ intent: z.literal("SET_HOME"), address: z.string().min(1) }),
  SET_WORK: z.object({ intent: z.literal("SET_WORK"), address: z.string().min(1) }),
} satisfies Record<NorbyIntentName, z.ZodTypeAny>;

export const norbyIntentSchema = z.discriminatedUnion(
  "intent",
  Object.values(norbyIntentSchemas) as [z.ZodTypeAny, ...z.ZodTypeAny[]],
);

export type NorbyIntent = z.infer<typeof norbyIntentSchema>;

/**
 * Valida um objeto bruto (JSON que veio do modelo) contra o schema da
 * intent declarada. Nunca confia no "intent" sozinho — se os campos não
 * baterem com o schema daquela intent específica, rejeita.
 */
export function parseNorbyIntent(raw: unknown): NorbyIntent | null {
  const result = norbyIntentSchema.safeParse(raw);
  return result.success ? result.data : null;
}
