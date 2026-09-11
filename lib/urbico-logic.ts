import type { CrowdLevel } from "./urbico-context";

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
