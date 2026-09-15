import type { CrowdLevel } from "./urbico-context";
import type { NorbyIntent } from "./norby-intents";

export function getNorbyReply(text: string, transportContext?: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("casa") || normalized.includes("trabalho")) {
    return "Posso usar um local salvo como destino. Abra Rotas para confirmar o ponto de partida e comparar opções com os dados de transporte disponíveis.";
  }
  if (normalized.includes("lotado") || normalized.includes("lotação") || normalized.includes("lotacao")) {
    // FIX: antes mandava a pessoa pra uma tela dedicada de relato ("tela de
    // Viagem"), que foi removida — agora sou eu (Norby) quem pergunta sobre
    // a lotação durante a viagem, então a resposta reflete isso.
    return "Durante a viagem eu mesmo pergunto como está a lotação do ônibus — é só me responder por voz ou texto quando eu perguntar, e eu registro de forma anônima para ajudar outras pessoas.";
  }
  if (normalized.includes("chega") || normalized.includes("ônibus") || normalized.includes("onibus")) {
    return transportContext ? `Consultei o contexto de viagem disponível: ${transportContext}. Abra Mapa ou Próximos ônibus para confirmar a atualização mais recente.` : "Ainda não recebi uma previsão oficial para essa consulta. Abra Mapa ou Próximos ônibus para consultar a linha e a lotação disponíveis.";
  }
  return "Entendi. Posso ajudar a organizar sua rota; informe origem e destino na aba Rotas para preparar a consulta de transporte.";
}

export function createTripRecord(now: Date) {
  return {
    id: `trip-${now.getTime()}`,
    endedAt: now.toISOString(),
  };
}

// Reconhecimento local (sem depender do Ollama/LLM) da resposta da pessoa
// quando o Norby pergunta sobre a lotação do ônibus durante a viagem — ver
// app/(tabs)/norby.tsx. Cobre variações comuns de fala/texto em pt-BR;
// termos mais específicos ("muito cheio", "super lotado") são checados
// antes dos mais genéricos para não cair no nível errado.
const CROWD_TEXT_PATTERNS: { level: CrowdLevel; terms: string[] }[] = [
  { level: "Lotado", terms: ["lotado", "lotada", "superlotado", "super lotado", "muito lotado", "muito cheio", "sem espaço", "sem espaco", "não cabe mais", "nao cabe mais", "não cabe ninguém", "nao cabe ninguem"] },
  { level: "Alta", terms: ["cheio", "cheia", "bastante gente", "muita gente", "pouco espaço", "pouco espaco", "bem cheio"] },
  { level: "Normal", terms: ["normal", "ocupação normal", "ocupacao normal", "de boa", "razoável", "razoavel", "tá ok", "ta ok"] },
  { level: "Baixa", terms: ["pouca gente", "poucas pessoas", "quase vazio", "quase vazia", "bastante espaço", "bastante espaco", "tranquilo", "tranquila"] },
  { level: "Vazio", terms: ["vazio", "vazia", "deserto", "sem ninguém", "sem ninguem", "nenhuma pessoa", "bem vazio", "bem vazia"] },
];

export function parseCrowdLevelFromText(text: string): CrowdLevel | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  for (const entry of CROWD_TEXT_PATTERNS) {
    if (entry.terms.some((term) => normalized.includes(term))) return entry.level;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Classificação de intenção do Norby (analytics) — ver lib/norby-intents.ts
// para a lista de intenções e docs/analytics.md para o catálogo completo.
// Propositalmente baseada em palavras-chave (mesmo estilo do resto deste
// arquivo), sem IA/clustering: o objetivo aqui é telemetria estruturada, não
// decidir a resposta do Norby (isso continua em getNorbyReply/Ollama).
export type NorbyIntentClassification = {
  intent: NorbyIntent;
  subintent?: string;
  context?: "home" | "work" | "favorite";
};

const NORBY_INTENT_PATTERNS: { intent: NorbyIntent; terms: string[] }[] = [
  { intent: "next_bus", terms: ["próximo ônibus", "proximo onibus", "próximos ônibus", "proximos onibus", "quando chega", "que horas chega", "vai demorar quanto"] },
  { intent: "bus_schedule", terms: ["horário", "horario", "tabela de horários", "tabela de horarios", "que horas passa"] },
  { intent: "bus_location", terms: ["onde está o ônibus", "onde esta o onibus", "localização do ônibus", "localizacao do onibus", "onde ele está agora", "onde ele esta agora"] },
  { intent: "alerts", terms: ["me avise", "me avisa", "alerta de saída", "alerta de saida", "hora de sair"] },
  { intent: "calendar", terms: ["compromisso", "agenda", "reunião", "reuniao", "consulta médica", "consulta medica"] },
  { intent: "map", terms: ["mapa", "onde estou", "minha localização atual", "minha localizacao atual"] },
  { intent: "destination_search", terms: ["quero ir para", "quero ir pra", "como chego", "como vou", "me leva", "ir até", "ir ate"] },
  { intent: "route_search", terms: ["rota", "caminho", "trajeto", "melhor forma de chegar", "linha para", "ônibus para", "onibus para", "qual ônibus", "qual onibus"] },
  { intent: "general_question", terms: ["o que você faz", "o que voce faz", "quem é você", "quem e voce", "como funciona"] },
];

const NORBY_SUBINTENT_PATTERNS: { subintent: string; terms: string[] }[] = [
  { subintent: "fastest_route", terms: ["mais rápido", "mais rapido", "mais rápida", "mais rapida", "chegar mais rápido", "chegar mais rapido"] },
  { subintent: "alternative_route", terms: ["outra opção", "outra opcao", "alternativa", "outro caminho"] },
  // FIX: intenção real que aparece nas conversas mas que o Urbico ainda não
  // implementa (não existe notificação de "ônibus chegando"). Reconhecida
  // de propósito (não cai em "unknown"), pra virar sinal de nova demanda —
  // ver NORBY_UNSUPPORTED_INTENTS em lib/norby-intents.ts e
  // app/(tabs)/norby.tsx (onde isso vira status "unsupported").
  { subintent: "arrival_notification", terms: ["me avise quando o ônibus", "me avise quando o onibus", "avisa quando o ônibus estiver chegando", "avisa quando o onibus estiver chegando", "quando o ônibus estiver chegando", "quando o onibus estiver chegando"] },
];

export function classifyNorbyIntent(text: string): NorbyIntentClassification {
  const normalized = text.trim().toLowerCase();

  // Lotação tem prioridade e reaproveita o mesmo reconhecimento já usado
  // para as respostas do Norby durante a viagem, em vez de duplicar as
  // mesmas palavras-chave numa segunda lista.
  if (parseCrowdLevelFromText(normalized)) return { intent: "crowding" };

  let context: NorbyIntentClassification["context"];
  if (normalized.includes("trabalho")) context = "work";
  else if (normalized.includes("casa")) context = "home";
  else if (normalized.includes("favorito")) context = "favorite";

  for (const entry of NORBY_SUBINTENT_PATTERNS) {
    if (entry.terms.some((term) => normalized.includes(term))) {
      const intent = entry.subintent === "arrival_notification" ? "alerts" : "route_search";
      return { intent, subintent: entry.subintent, context };
    }
  }

  for (const entry of NORBY_INTENT_PATTERNS) {
    if (entry.terms.some((term) => normalized.includes(term))) return { intent: entry.intent, context };
  }

  if (context) return { intent: "destination_search", context };

  return { intent: "unknown", context };
}
