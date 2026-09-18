import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

/**
 * Model Manager (seção 12 do briefing). Modelo NÃO vai embutido no APK —
 * baixado no primeiro uso, sob consentimento explícito do usuário (seção
 * 12: "Não baixar o modelo silenciosamente"). Guarda estado (versão,
 * tamanho esperado, se terminou de baixar) em AsyncStorage; o arquivo em
 * si fica em FileSystem.documentDirectory, que sobrevive a updates do app
 * mas some se o app for desinstalado (comportamento correto — não é dado
 * do usuário, é um asset baixável de novo).
 *
 * Escolha de modelo (decisão registrada em conversa): Llama 3.2 3B
 * Instruct, quantização Q4_K_M — melhor qualidade nas respostas do Norby,
 * ao custo de mais RAM/armazenamento (ver device-capability.ts). GGUF
 * hospedado no Hugging Face; troque MODEL_URL pela URL real do arquivo
 * .gguf escolhido antes de usar isto de verdade — deixei como
 * placeholder porque baixar ~2 GB de um link não verificado por mim não é
 * algo que eu deva decidir sozinho.
 */

const MODEL_STORAGE_KEY = "norby-local-model-state";
const MODEL_FILENAME = "llama-3.2-3b-instruct-q4_k_m.gguf";
export const MODEL_URL = ""; // TODO: preencher com a URL do GGUF escolhido (ex.: Hugging Face) antes do primeiro uso real.
export const MODEL_EXPECTED_BYTES = 2_020_000_000; // ~2.02 GB — tamanho típico de Llama 3.2 3B Instruct Q4_K_M; confirmar contra o arquivo real escolhido.

export type ModelDownloadState =
  | { status: "not_downloaded" }
  | { status: "downloading"; progress: number } // 0–1
  | { status: "ready"; sizeBytes: number }
  | { status: "error"; message: string };

function modelFilePath(): string {
  return `${FileSystem.documentDirectory}${MODEL_FILENAME}`;
}

export async function getModelState(): Promise<ModelDownloadState> {
  try {
    const info = await FileSystem.getInfoAsync(modelFilePath());
    if (info.exists && !info.isDirectory) {
      return { status: "ready", sizeBytes: info.size ?? 0 };
    }
  } catch (error) {
    console.warn("[urbico] getModelState falhou ao checar arquivo:", error);
  }
  return { status: "not_downloaded" };
}

/**
 * Baixa o modelo com progresso. onProgress recebe um valor 0–1. Sempre
 * apaga um download incompleto antes de recomeçar — nunca deixa um
 * arquivo parcial passar por "pronto" (seção 12: verificação de
 * integridade). Chamador decide quando chamar isto (nunca automático —
 * ver checkNorbyLocalModelCompatibility em device-capability.ts, que deve
 * rodar antes e o usuário deve ter confirmado explicitamente).
 */
export async function downloadModel(onProgress?: (progress: number) => void): Promise<ModelDownloadState> {
  if (!MODEL_URL) {
    return { status: "error", message: "URL do modelo não configurada (MODEL_URL em lib/norby-ai/model-manager.ts)." };
  }

  const path = modelFilePath();
  try {
    // Remove qualquer resquício de tentativa anterior antes de começar.
    const existing = await FileSystem.getInfoAsync(path);
    if (existing.exists) await FileSystem.deleteAsync(path, { idempotent: true });

    const downloadResumable = FileSystem.createDownloadResumable(MODEL_URL, path, {}, (downloadProgress) => {
      const progress = downloadProgress.totalBytesExpectedToWrite > 0 ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite : 0;
      onProgress?.(progress);
    });

    const result = await downloadResumable.downloadAsync();
    if (!result) return { status: "error", message: "Download não retornou resultado." };

    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || (info.size ?? 0) < MODEL_EXPECTED_BYTES * 0.9) {
      // Arquivo claramente incompleto/corrompido — não deixa passar como pronto.
      await FileSystem.deleteAsync(path, { idempotent: true });
      return { status: "error", message: "O arquivo baixado ficou menor do que o esperado — pode ter havido falha na conexão. Tente novamente." };
    }

    await AsyncStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify({ downloadedAt: Date.now(), sizeBytes: info.size }));
    return { status: "ready", sizeBytes: info.size ?? 0 };
  } catch (error) {
    console.warn("[urbico] downloadModel falhou:", error);
    // Limpa arquivo parcial em caso de erro (rede caiu no meio, sem espaço, etc).
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    return { status: "error", message: error instanceof Error ? error.message : "Falha desconhecida ao baixar o modelo." };
  }
}

export async function deleteModel(): Promise<void> {
  try {
    await FileSystem.deleteAsync(modelFilePath(), { idempotent: true });
  } finally {
    await AsyncStorage.removeItem(MODEL_STORAGE_KEY).catch(() => undefined);
  }
}

export function getModelFilePath(): string {
  return modelFilePath();
}
