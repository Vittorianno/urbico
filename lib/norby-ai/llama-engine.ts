import { Platform } from "react-native";
import { z } from "zod";

import { checkNorbyLocalModelCompatibility } from "./device-capability";
import { norbyIntentSchema, parseNorbyIntent, type NorbyIntent } from "./intents";
import { getModelFilePath, getModelState } from "./model-manager";

/**
 * Wrapper do llama.rn (binding React Native do llama.cpp). Documentação
 * consultada em setembro/2026 — API confirmada: initLlama({model, n_ctx,
 * n_gpu_layers, grammar}) -> context; context.completion(params,
 * onPartialToken) -> {text, timings}; context.stopCompletion();
 * context.release(). NÃO TESTADO CONTRA HARDWARE REAL AINDA — a API está
 * correta conforme a doc oficial, mas eu não tenho como compilar/rodar o
 * dev build daqui para confirmar na prática (RAM real, tokens/s, se o
 * modelo carrega). Isso só se confirma no seu teste em aparelho (seção 27
 * do briefing).
 *
 * IMPORTANTE: nunca importar 'llama.rn' de forma estática no topo do
 * arquivo. É módulo nativo — um import estático quebra a carga do bundle
 * inteiro em qualquer ambiente sem o binário nativo presente (Web, ou
 * Android antes do development build estar rodando), do mesmo jeito que
 * expo-speech-recognition e o MapLibre já quebravam o app inteiro no Expo
 * Go (bug real encontrado e documentado nesta mesma auditoria). Por isso
 * todo acesso ao módulo aqui é via import() dinâmico, dentro de try/catch.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LlamaContext = any; // Tipo real vem de 'llama.rn' (LlamaContext), só resolvível depois do import dinâmico.

let activeContext: LlamaContext | null = null;
let loadingPromise: Promise<LlamaContext | null> | null = null;

const SYSTEM_PROMPT =
  "Você é o Norby, assistente de mobilidade do Urbico. Seja breve, direto, amigável, sem gírias regionais. " +
  "Nunca invente horários de ônibus, distâncias ou endereços — essas informações vêm sempre de serviços reais do app, nunca de você.";

const STOP_WORDS = ["</s>", "<|eot_id|>", "<|end_of_text|>", "<|im_end|>", "<|end_of_turn|>", "<|endoftext|>"];

/**
 * Carrega o modelo local (se compatível e já baixado) e mantém em memória
 * para reuso. Nunca lança — toda falha vira retorno null, e quem chamou
 * decide cair para o Norby remoto (Ollama) ou baseado em regras, que já
 * existem e continuam funcionando exatamente como antes.
 */
export async function getNorbyLocalEngine(): Promise<LlamaContext | null> {
  if (activeContext) return activeContext;
  if (loadingPromise) return loadingPromise;
  if (Platform.OS === "web") return null;

  loadingPromise = (async () => {
    try {
      const compatibility = await checkNorbyLocalModelCompatibility();
      if (!compatibility.compatible) {
        console.warn("[urbico] Norby local: aparelho incompatível —", compatibility.reason);
        return null;
      }

      const modelState = await getModelState();
      if (modelState.status !== "ready") {
        console.warn("[urbico] Norby local: modelo ainda não baixado.");
        return null;
      }

      // Import dinâmico — só chega aqui em Android/iOS, depois de passar
      // pelas checagens acima.
      const { initLlama } = await import("llama.rn");
      const context = await initLlama({
        model: `file://${getModelFilePath()}`,
        n_ctx: 2048,
        n_gpu_layers: 0, // GPU offload (Metal/OpenCL) é otimização futura — desligado até medir se compensa em Android real (seção 27).
        use_mlock: true,
      });

      activeContext = context;
      return context;
    } catch (error) {
      console.warn("[urbico] Norby local: falha ao carregar o modelo —", error);
      return null;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Libera o modelo da memória (seção 14: não manter ativo permanentemente
 * se isso custar RAM/bateria desnecessárias). Chamar ao sair da tela do
 * Norby por um tempo longo, ou sob pressão de memória — a decisão de
 * quando chamar isto fica para quem integra ao chat (fase seguinte),
 * ainda não decidido aqui.
 */
export async function releaseNorbyLocalEngine(): Promise<void> {
  if (!activeContext) return;
  try {
    await activeContext.release();
  } catch (error) {
    console.warn("[urbico] Norby local: falha ao liberar o modelo —", error);
  } finally {
    activeContext = null;
  }
}

/**
 * Resposta conversacional (intent CHAT), com streaming token a token
 * (seção 18) via onToken. Retorna null se o motor local não estiver
 * disponível — quem chama cai para o Norby remoto/baseado em regras.
 */
export async function generateNorbyLocalReply(userMessage: string, onToken?: (token: string) => void): Promise<string | null> {
  const context = await getNorbyLocalEngine();
  if (!context) return null;

  try {
    const result = await context.completion(
      {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        n_predict: 256,
        stop: STOP_WORDS,
      },
      onToken ? (data: { token: string }) => onToken(data.token) : undefined,
    );
    return typeof result?.text === "string" ? result.text.trim() : null;
  } catch (error) {
    console.warn("[urbico] Norby local: falha na geração —", error);
    return null;
  }
}

// JSON Schema derivado do schema Zod de intents (zod v4 tem conversão
// nativa — z.toJSONSchema — sem precisar de dependência extra tipo
// zod-to-json-schema). Usado para restringir a saída do modelo via
// gramática GBNF, para que ele só consiga produzir uma das intents
// válidas (seção 20: nunca texto/ação livre nesta etapa).
const intentJsonSchema = z.toJSONSchema(norbyIntentSchema);

/**
 * Classifica a mensagem do usuário numa intent estruturada (ver
 * intents.ts), usando geração restrita por gramática (convertJsonSchemaToGrammar
 * do llama.rn) para o modelo só conseguir produzir uma das intents
 * válidas — nunca texto livre, nunca uma ação fora da lista (seção 20).
 * Retorna null se o motor local não estiver disponível OU se a saída não
 * validar contra o schema (nesse caso, quem chama cai para
 * classifyNorbyIntent baseado em regras, que já existe em
 * lib/urbico-logic.ts).
 */
export async function classifyNorbyIntentLocally(userMessage: string): Promise<NorbyIntent | null> {
  const context = await getNorbyLocalEngine();
  if (!context) return null;

  try {
    const { convertJsonSchemaToGrammar } = await import("llama.rn");
    const grammar = convertJsonSchemaToGrammar({ schema: intentJsonSchema });

    const result = await context.completion({
      messages: [
        {
          role: "system",
          content:
            "Classifique a mensagem do usuário em UMA das intents disponíveis do Urbico. " +
            "Responda APENAS com o objeto JSON da intent, nada além disso. " +
            "Se não reconhecer nenhuma ação específica, use {\"intent\": \"CHAT\"}.",
        },
        { role: "user", content: userMessage },
      ],
      grammar,
      n_predict: 200,
      stop: STOP_WORDS,
    });

    const raw = typeof result?.text === "string" ? JSON.parse(result.text) : null;
    return parseNorbyIntent(raw);
  } catch (error) {
    console.warn("[urbico] Norby local: falha ao classificar intent —", error);
    return null;
  }
}
