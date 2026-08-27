export function getNorbyReply(text: string, transportContext?: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("casa") || normalized.includes("trabalho")) {
    return "Posso usar um local salvo como destino. Abra Rotas para confirmar o ponto de partida e comparar opções com os dados de transporte disponíveis.";
  }
  if (normalized.includes("lotado") || normalized.includes("lotação") || normalized.includes("lotacao")) {
    return "Você pode registrar a lotação na tela de Viagem. Os relatos são agregados sem exibir sua identidade.";
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
