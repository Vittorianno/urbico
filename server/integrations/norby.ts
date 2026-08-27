import { getNorbyReply } from "../../lib/urbico-logic";

type OllamaPayload = { message?: { content?: string } };

export async function askNorby(message: string, transportContext?: string) {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim().replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!baseUrl || !model) return getNorbyReply(message, transportContext);
  try {
    const response = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: "Você é Norby, assistente de mobilidade urbana do Urbico para São Paulo. Responda em português brasileiro, com objetividade e acolhimento. Use apenas dados de mobilidade presentes no contexto e nunca invente chegada, lotação, localização, atraso ou rota." }, { role: "user", content: `${transportContext ? `Contexto confirmado: ${transportContext}\n\n` : ""}${message}` }] }) });
    if (!response.ok) return getNorbyReply(message, transportContext);
    const content = ((await response.json()) as OllamaPayload).message?.content?.trim();
    return content || getNorbyReply(message, transportContext);
  } catch {
    return getNorbyReply(message, transportContext);
  }
}
