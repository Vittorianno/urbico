import { getNorbyReply } from "../../lib/urbico-logic";

type OllamaPayload = { message?: { content?: string } };

// Variáveis (todas no backend):
//   OLLAMA_BASE_URL    ex.: http://127.0.0.1:11434
//   OLLAMA_MODEL       ex.: llama3.2:1b  (use um modelo que você já baixou)
//   OLLAMA_TIMEOUT_MS  opcional; padrão 30000 (a primeira resposta carrega o modelo
//                      na memória e pode demorar bem mais que as seguintes)
//   OLLAMA_API_KEY     opcional; só para Ollama hospedado atrás de autenticação
const DEFAULT_TIMEOUT_MS = 30_000;

// Sem Llama, o Norby responde por regras (lib/urbico-logic.ts). Isso não pode
// acontecer em silêncio: o motivo vai para o log, no máximo 1x por minuto.
let lastWarnAt = 0;
function warnFallback(reason: string) {
  const now = Date.now();
  if (now - lastWarnAt < 60_000) return;
  lastWarnAt = now;
  console.warn(`[norby] Respondendo por regras, sem o Llama: ${reason}`);
}

function timeoutMs() {
  const parsed = Number(process.env.OLLAMA_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export async function askNorby(message: string, transportContext?: string) {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim().replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!baseUrl || !model) {
    warnFallback("OLLAMA_BASE_URL e/ou OLLAMA_MODEL não estão definidos no .env.");
    return getNorbyReply(message, transportContext);
  }
  const limit = timeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), limit);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: "30m",
        options: { temperature: 0.3 },
        messages: [
          {
            role: "system",
            content:
              "Você é Norby, assistente de mobilidade urbana do Urbico para São Paulo. Responda em português brasileiro, com objetividade e acolhimento. Use apenas dados de mobilidade presentes no contexto e nunca invente chegada, lotação, localização, atraso ou rota. Se o contexto não trouxer a informação pedida, diga que não tem esse dado confirmado agora.",
          },
          { role: "user", content: `${transportContext ? `Contexto confirmado: ${transportContext}\n\n` : ""}${message}` },
        ],
      }),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      warnFallback(`o Ollama respondeu ${response.status} para o modelo "${model}". ${detail}`);
      return getNorbyReply(message, transportContext);
    }
    const content = ((await response.json()) as OllamaPayload).message?.content?.trim();
    if (!content) {
      warnFallback("o Ollama devolveu uma resposta vazia.");
      return getNorbyReply(message, transportContext);
    }
    return content;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    warnFallback(aborted ? `tempo esgotado após ${Math.round(limit / 1000)} s (aumente OLLAMA_TIMEOUT_MS).` : `não foi possível conectar em ${baseUrl} (${error instanceof Error ? error.message : "erro desconhecido"}).`);
    return getNorbyReply(message, transportContext);
  } finally {
    clearTimeout(timeout);
  }
}
