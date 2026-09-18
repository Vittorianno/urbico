import * as Device from "expo-device";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

/**
 * Seção 13 do briefing: detectar se o aparelho aguenta rodar o modelo
 * antes de tentar, com fallback (seção 13/21) em vez de travar o app.
 *
 * Limiares iniciais para Llama 3.2 3B Instruct em GGUF quantizado
 * (Q4_K_M, ~2 GB de arquivo): regra prática é RAM total >= ~2x o tamanho
 * do arquivo do modelo para caber o modelo carregado + contexto + o resto
 * do sistema/app rodando ao mesmo tempo. Estes números são um ponto de
 * partida conservador — ajustar depois de medir em aparelho real (seção
 * 27); não são um valor que eu tenha benchmarkado eu mesmo.
 */
export const MODEL_MIN_RAM_BYTES = 6 * 1024 * 1024 * 1024; // 6 GB
export const MODEL_MIN_FREE_STORAGE_BYTES = 3 * 1024 * 1024 * 1024; // 2 GB do modelo + folga

export type DeviceCapability =
  | { compatible: true }
  | { compatible: false; reason: string };

/**
 * Só tem sentido chamar no Android nativo — llama.rn não roda na Web, e o
 * app já cai para o motor remoto (Ollama) ou baseado em regras nesses
 * casos de qualquer forma (ver server/integrations/norby.ts).
 */
export async function checkNorbyLocalModelCompatibility(): Promise<DeviceCapability> {
  if (Platform.OS === "web") {
    return { compatible: false, reason: "Modelo local não roda no navegador." };
  }

  const totalMemory = Device.totalMemory;
  if (totalMemory != null && totalMemory < MODEL_MIN_RAM_BYTES) {
    return { compatible: false, reason: `RAM insuficiente (${(totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB disponível, ${MODEL_MIN_RAM_BYTES / 1024 / 1024 / 1024} GB recomendado).` };
  }

  try {
    const freeStorage = await FileSystem.getFreeDiskStorageAsync();
    if (freeStorage < MODEL_MIN_FREE_STORAGE_BYTES) {
      return { compatible: false, reason: `Armazenamento insuficiente para baixar o modelo (${(freeStorage / 1024 / 1024 / 1024).toFixed(1)} GB livres).` };
    }
  } catch (error) {
    // Sem informação de armazenamento, seguimos sem bloquear por essa
    // checagem específica — o download em si vai falhar de forma tratada
    // (ver model-manager.ts) se realmente não houver espaço.
    console.warn("[urbico] getFreeDiskStorageAsync falhou:", error);
  }

  return { compatible: true };
}
