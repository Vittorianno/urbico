import { getNorbyReply } from "../../lib/urbico-logic";

type OllamaPayload = { message?: { content?: string } };

// Quando o modelo (Ollama) está configurado mas falha, o Norby cai para as
// respostas locais por regras — antes isso era totalmente silencioso, e parecia
// que a IA "não fazia diferença". Agora o motivo vai para o log do servidor
// (só texto curto, nunca URL completa nem dados do usuário).
function logFallback(reason: string) {
  console.warn(`[norby] Ollama indisponível, usando respostas locais: ${reason}`);
}

export async function askNorby(message: string, transportContext?: string) {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim().replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!baseUrl || !model) return getNorbyReply(message, transportContext);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: "Você é Norby, assistente de mobilidade urbana do Urbico para São Paulo. Responda em português brasileiro, com objetividade e acolhimento. Use apenas dados de mobilidade presentes no contexto e nunca invente chegada, lotação, localização, atraso ou rota." }, { role: "user", content: `${transportContext ? `Contexto confirmado: ${transportContext}\n\n` : ""}${message}` }] }) });
    if (!response.ok) {
      logFallback(`HTTP ${response.status}`);
      return getNorbyReply(message, transportContext);
    }
    const content = ((await response.json()) as OllamaPayload).message?.content?.trim();
    if (!content) logFallback("resposta vazia");
    return content || getNorbyReply(message, transportContext);
  } catch (error) {
    logFallback(error instanceof Error ? error.name : "erro desconhecido");
    return getNorbyReply(message, transportContext);
  } finally {
    clearTimeout(timeout);
  }
}
