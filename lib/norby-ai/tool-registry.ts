import type { NorbyIntent, NorbyIntentName } from "./intents";
import { NORBY_INTENT_NAMES } from "./intents";

/**
 * AVAILABLE_TOOLS (seção 20 do briefing): descrição de cada ferramenta que
 * o modelo pode "pedir" — usada para montar o prompt/grammar de function
 * calling do Llama local (ou dos ferramentas do Ollama remoto). Isso é
 * metadado para o LLM, não execução; a execução real é NorbyRuntime +
 * executeIntent, abaixo.
 */
export const AVAILABLE_TOOLS: Record<NorbyIntentName, { description: string; requiresNetwork: boolean }> = {
  CHAT: { description: "Conversa livre, sem ação — resposta apenas em texto.", requiresNetwork: false },
  CLEAR_CHAT: { description: "Limpa as mensagens da conversa atual com o Norby.", requiresNetwork: false },
  SEARCH_ADDRESS: { description: "Busca um endereço por texto (geocodificação via Pelias).", requiresNetwork: true },
  ROUTE_REQUEST: { description: "Planeja uma rota até um destino (Pelias + Valhalla).", requiresNetwork: true },
  ADD_CALENDAR_EVENT: { description: "Cria um compromisso na agenda do usuário.", requiresNetwork: false },
  LIST_CALENDAR_EVENTS: { description: "Lista compromissos da agenda do usuário.", requiresNetwork: false },
  DELETE_CALENDAR_EVENT: { description: "Remove um compromisso da agenda do usuário.", requiresNetwork: false },
  SEARCH_TRANSPORT: { description: "Consulta linhas/horários de ônibus (SPTrans).", requiresNetwork: true },
  SAVE_FAVORITE: { description: "Salva um local como favorito.", requiresNetwork: false },
  REMOVE_FAVORITE: { description: "Remove um local favorito salvo.", requiresNetwork: false },
  GET_CURRENT_LOCATION: { description: "Obtém a localização atual do usuário (GPS).", requiresNetwork: false },
  SET_HOME: { description: "Define o endereço de Casa do usuário.", requiresNetwork: false },
  SET_WORK: { description: "Define o endereço de Trabalho do usuário.", requiresNetwork: false },
};

/**
 * Tudo que uma intent pode precisar fazer no app — implementado pela tela
 * que efetivamente tem acesso ao useUrbico(), ao router e às mutations
 * tRPC (hoje só app/(tabs)/norby.tsx; nenhuma outra parte do código
 * conhece este arquivo por enquanto). Deixar como interface, em vez de
 * chamar os hooks direto daqui, é o que permite testar o roteamento sem
 * precisar montar uma árvore de componentes React — e é a mesma razão de
 * cada método devolver algo serializável (nunca lançar por conta própria).
 *
 * Ainda NÃO conectado ao chat de verdade — próxima fase. Métodos não
 * implementados aqui simplesmente não entram no NORBY_UNSUPPORTED_INTENTS
 * override; o dispatcher abaixo já sabe responder "não consigo fazer isso
 * ainda" para qualquer método ausente.
 */
export interface NorbyRuntime {
  clearChat?: () => void;
  searchAddress?: (query: string) => Promise<{ label: string; latitude: number; longitude: number }[]>;
  requestRoute?: (destination: string, transportMode: "unknown" | "bus" | "walk") => Promise<{ ok: boolean; summary?: string }>;
  addCalendarEvent?: (input: { title: string; date: string; time?: string; address?: string }) => Promise<{ ok: boolean; reason?: string }>;
  listCalendarEvents?: (date?: string) => Promise<{ title: string; date: string; time?: string }[]>;
  deleteCalendarEvent?: (description: string) => Promise<{ ok: boolean; reason?: string }>;
  searchTransport?: (input: { line?: string; destination?: string }) => Promise<{ ok: boolean; summary?: string }>;
  saveFavorite?: (label: string, address: string) => Promise<{ ok: boolean; reason?: string }>;
  removeFavorite?: (label: string) => Promise<{ ok: boolean; reason?: string }>;
  getCurrentLocation?: () => Promise<{ latitude: number; longitude: number } | null>;
  setHome?: (address: string) => Promise<{ ok: boolean; reason?: string }>;
  setWork?: (address: string) => Promise<{ ok: boolean; reason?: string }>;
}

export type NorbyToolResult =
  | { status: "success"; message: string }
  | { status: "failure"; message: string }
  | { status: "unsupported"; message: string };

const UNSUPPORTED: NorbyToolResult = { status: "unsupported", message: "Ainda não tenho essa funcionalidade, mas guardei esse pedido — pode virar algo futuro." };

/**
 * Roteador final: recebe uma intent já validada (ver intents.ts) e o
 * runtime disponível, e decide o que fazer. Nunca recebe texto livre do
 * modelo — só a estrutura tipada. Isto substitui, para as intents que já
 * tiverem um método no runtime, o classifyNorbyIntent baseado em regras de
 * lib/urbico-logic.ts; onde o runtime não implementa o método (fase
 * atual), cai em "unsupported" da mesma forma que NORBY_UNSUPPORTED_INTENTS
 * já fazia.
 */
export async function executeIntent(intent: NorbyIntent, runtime: NorbyRuntime): Promise<NorbyToolResult> {
  try {
    switch (intent.intent) {
      case "CHAT":
        // CHAT não executa ferramenta nenhuma — quem chama decide a
        // resposta (motor local, Ollama remoto ou regras).
        return { status: "success", message: "" };

      case "CLEAR_CHAT":
        if (!runtime.clearChat) return UNSUPPORTED;
        runtime.clearChat();
        return { status: "success", message: "Conversa limpa." };

      case "SEARCH_ADDRESS": {
        if (!runtime.searchAddress) return UNSUPPORTED;
        const results = await runtime.searchAddress(intent.query);
        if (results.length === 0) return { status: "failure", message: `Não encontrei nenhum endereço para "${intent.query}".` };
        return { status: "success", message: results.map((r) => r.label).slice(0, 3).join("; ") };
      }

      case "ROUTE_REQUEST": {
        if (!runtime.requestRoute) return UNSUPPORTED;
        const result = await runtime.requestRoute(intent.destination, intent.transportMode);
        return result.ok ? { status: "success", message: result.summary ?? "Rota calculada." } : { status: "failure", message: "Não consegui calcular essa rota agora." };
      }

      case "ADD_CALENDAR_EVENT": {
        if (!runtime.addCalendarEvent) return UNSUPPORTED;
        const result = await runtime.addCalendarEvent(intent);
        return result.ok ? { status: "success", message: "Compromisso adicionado." } : { status: "failure", message: result.reason ?? "Não consegui adicionar o compromisso." };
      }

      case "LIST_CALENDAR_EVENTS": {
        if (!runtime.listCalendarEvents) return UNSUPPORTED;
        const events = await runtime.listCalendarEvents(intent.date);
        if (events.length === 0) return { status: "success", message: "Você não tem compromissos nesse período." };
        return { status: "success", message: events.map((event) => `${event.title} (${event.date}${event.time ? ` às ${event.time}` : ""})`).join("; ") };
      }

      case "DELETE_CALENDAR_EVENT": {
        if (!runtime.deleteCalendarEvent) return UNSUPPORTED;
        const result = await runtime.deleteCalendarEvent(intent.description);
        return result.ok ? { status: "success", message: "Compromisso removido." } : { status: "failure", message: result.reason ?? "Não encontrei esse compromisso." };
      }

      case "SEARCH_TRANSPORT": {
        if (!runtime.searchTransport) return UNSUPPORTED;
        const result = await runtime.searchTransport(intent);
        return result.ok ? { status: "success", message: result.summary ?? "" } : { status: "failure", message: "Não consegui consultar o transporte agora." };
      }

      case "SAVE_FAVORITE": {
        if (!runtime.saveFavorite) return UNSUPPORTED;
        const result = await runtime.saveFavorite(intent.label, intent.address);
        return result.ok ? { status: "success", message: `${intent.label} salvo como favorito.` } : { status: "failure", message: result.reason ?? "Não consegui salvar o favorito." };
      }

      case "REMOVE_FAVORITE": {
        if (!runtime.removeFavorite) return UNSUPPORTED;
        const result = await runtime.removeFavorite(intent.label);
        return result.ok ? { status: "success", message: "Favorito removido." } : { status: "failure", message: result.reason ?? "Não encontrei esse favorito." };
      }

      case "GET_CURRENT_LOCATION": {
        if (!runtime.getCurrentLocation) return UNSUPPORTED;
        const location = await runtime.getCurrentLocation();
        return location ? { status: "success", message: `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` } : { status: "failure", message: "Não consegui obter sua localização agora." };
      }

      case "SET_HOME": {
        if (!runtime.setHome) return UNSUPPORTED;
        const result = await runtime.setHome(intent.address);
        return result.ok ? { status: "success", message: "Casa definida." } : { status: "failure", message: result.reason ?? "Não consegui definir esse endereço." };
      }

      case "SET_WORK": {
        if (!runtime.setWork) return UNSUPPORTED;
        const result = await runtime.setWork(intent.address);
        return result.ok ? { status: "success", message: "Trabalho definido." } : { status: "failure", message: result.reason ?? "Não consegui definir esse endereço." };
      }

      default: {
        // Exaustividade: se um novo NorbyIntentName for adicionado a
        // intents.ts sem um case aqui, isto quebra a checagem de tipos em
        // build (não em runtime) — obriga a lembrar de cobrir a nova
        // intent no roteador.
        const _exhaustive: never = intent;
        return UNSUPPORTED;
      }
    }
  } catch (error) {
    console.warn(`[urbico] executeIntent(${intent.intent}) falhou:`, error);
    return { status: "failure", message: "Algo deu errado ao executar essa ação. Tente novamente." };
  }
}

// Sanity check em tempo de import: todo NorbyIntentName precisa ter uma
// entrada em AVAILABLE_TOOLS (o inverso já é garantido pelo tipo Record
// acima). Ajuda a pegar drift entre intents.ts e este arquivo cedo.
for (const name of NORBY_INTENT_NAMES) {
  if (!(name in AVAILABLE_TOOLS)) {
    console.warn(`[urbico] Intent "${name}" não tem descrição em AVAILABLE_TOOLS.`);
  }
}
