export async function askNorby(message: string, transportContext?: string) {
  const context = transportContext ? `\nContexto de mobilidade confirmado:\n${transportContext}` : "";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Serviço do Norby não configurado.");

  const model = "gemini-3-flash-preview";
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
  url.searchParams.set("key", apiKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: `Você é Norby, assistente de mobilidade urbana do Urbico para São Paulo. Responda em português brasileiro, de forma acolhedora e breve. Recomende uma próxima ação clara. Nunca invente chegadas, linhas, lotação, preço, localização, atraso ou rota. Quando dados oficiais não estiverem no contexto, explique isso e sugira consultar Mapa ou Rotas.${context}` }],
      },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 320, temperature: 0.35 },
    }),
  });
  if (!response.ok) throw new Error("Norby não está disponível no momento.");

  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!content) throw new Error("Norby não gerou uma resposta.");
  return content;
}
