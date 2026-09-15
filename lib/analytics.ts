import { createTRPCClient as createVanillaTRPCClient, httpBatchLink } from "@trpc/client";
import Constants from "expo-constants";
import { Platform } from "react-native";
import superjson from "superjson";

import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import type { AnalyticsEventName } from "@/lib/analytics-events";
import { getInstallationId } from "@/lib/departure-location-task";
import type { AppRouter } from "@/server/routers";

/**
 * Módulo central de analytics — ver docs/analytics.md para o catálogo
 * completo de eventos e o formato esperado de cada um.
 *
 * Único ponto do app que chama analytics.track.mutate no servidor — não
 * espalhar chamadas de rede de telemetria por fora daqui. Usa um cliente
 * tRPC "puro" (fora do React Query) de propósito: analytics precisa poder
 * ser chamado de qualquer lugar do código, não só de dentro de componentes
 * React (onde hooks como useMutation exigiriam estar montado numa árvore
 * com <trpc.Provider>).
 */
const analyticsClient = createVanillaTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getApiBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        // Mesmo mecanismo de autenticação já usado pelo resto do app (ver
        // lib/trpc.ts) — quando a pessoa está logada, o servidor já
        // consegue identificar o evento pelo próprio token, sem precisar
        // de nenhum controle de identidade separado aqui no cliente.
        const token = await Auth.getSessionToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

// Uma sessão por carregamento do app — não persiste entre reaberturas de
// propósito. Permite agrupar eventos da mesma sessão de uso sem precisar
// de uma tabela de sessões à parte (ver drizzle/schema.ts, analyticsEvents,
// e docs/analytics.md).
const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const appVersion = Constants.expoConfig?.version ?? "unknown";

/**
 * Registra um evento de analytics. Sempre assíncrono e "melhor esforço":
 * nunca lança, nunca bloqueia quem chamou — uma falha em telemetria (sem
 * rede, banco fora do ar, etc.) não pode atrapalhar a ação real da pessoa.
 * Sem fila de retry de propósito — ver docs/analytics.md, seção Offline.
 */
function track(event: AnalyticsEventName, properties?: Record<string, unknown>) {
  void (async () => {
    try {
      const installationId = await getInstallationId();
      await analyticsClient.analytics.track.mutate({
        event,
        properties,
        installationId,
        sessionId,
        platform: Platform.OS,
        appVersion,
      });
    } catch {
      // Sem rede, backend fora do ar, etc. — silenciosamente ignorado.
    }
  })();
}

export const analytics = { track };
