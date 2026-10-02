import { getNorbyReply } from "../../lib/urbico-logic";
import { fetchWithTimeout } from "../_core/http";

type OllamaPayload = { message?: { content?: string } };
type OllamaTagsPayload = { models?: Array<{ name?: string; model?: string }> };

export type NorbyEngine = "llm" | "fallback";
export type NorbyReply = { message: string; engine: NorbyEngine; fallbackReason?: string };

// Um modelo de 3B em hardware modesto pode demorar; depois disso o Norby cai
// para as respostas por regras em vez de deixar a pessoa esperando.
const OLLAMA_CHAT_TIMEOUT_MS = 30_000;
const OLLAMA_STATUS_TIMEOUT_MS = 3_000;

function ollamaConfig() {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim().replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL?.trim();
  return baseUrl && model ? { baseUrl, model } : null;
}

/**
 * Responde como o Norby e informa QUAL mecanismo respondeu: "llm" (Ollama) ou
 * "fallback" (regras locais de lib/urbico-logic.ts), com o motivo da queda.
 * O mecanismo também é registrado no log do servidor a cada resposta.
 */
export async function askNorbyDetailed(message: string, transportContext?: string): Promise<NorbyReply> {
  const fallback = (reason: string): NorbyReply => {
    console.info(`[norby] engine=fallback reason=${reason}`);
    return { message: getNorbyReply(message, transportContext), engine: "fallback", fallbackReason: reason };
  };

  const config = ollamaConfig();
  if (!config) return fallback("ollama_not_configured");

  try {
    const response = await fetchWithTimeout(
      `${config.baseUrl}/api/chat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          stream: false,
          messages: [
            { role: "system", content: "Você é Norby, assistente de mobilidade urbana do Urbico para São Paulo. Responda em português brasileiro, com objetividade e acolhimento. Use apenas dados de mobilidade presentes no contexto e nunca invente chegada, lotação, localização, atraso ou rota." },
            { role: "user", content: `${transportContext ? `Contexto confirmado: ${transportContext}\n\n` : ""}${message}` },
          ],
        }),
      },
      OLLAMA_CHAT_TIMEOUT_MS,
    );
    if (!response.ok) return fallback(`ollama_http_${response.status}`);
    const content = ((await response.json()) as OllamaPayload).message?.content?.trim();
    if (!content) return fallback("ollama_empty_response");
    console.info(`[norby] engine=llm model=${config.model}`);
    return { message: content, engine: "llm" };
  } catch (error) {
    return fallback(error instanceof Error && error.name === "TimeoutError" ? "ollama_timeout" : "ollama_unreachable");
  }
}

/** Mesma assinatura de sempre (só o texto), usada pelo router tRPC. */
export async function askNorby(message: string, transportContext?: string) {
  return (await askNorbyDetailed(message, transportContext)).message;
}

/**
 * Estado real do Ollama: configurado? alcançável (/api/tags)? o modelo
 * configurado está instalado? Não expõe a URL do Ollama.
 */
export async function getNorbyStatus() {
  const config = ollamaConfig();
  if (!config) return { configured: false, reachable: false, model: null as string | null, modelInstalled: false };

  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/api/tags`, {}, OLLAMA_STATUS_TIMEOUT_MS);
    if (!response.ok) return { configured: true, reachable: false, model: config.model, modelInstalled: false };
    const payload = (await response.json()) as OllamaTagsPayload;
    const names = (payload.models ?? []).flatMap((entry) => [entry.name, entry.model]).filter((name): name is string => typeof name === "string");
    const modelInstalled = names.some((name) => name === config.model || name === `${config.model}:latest`);
    return { configured: true, reachable: true, model: config.model, modelInstalled };
  } catch {
    return { configured: true, reachable: false, model: config.model, modelInstalled: false };
  }
}
