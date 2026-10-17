import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { normalizeNotificationPreferences } from "@/lib/notification-preferences";
import { onSessionCleared } from "@/lib/session-events";
import { setSyncStatus } from "@/lib/sync-status";
import { trpc } from "@/lib/trpc";
import { type Appointment, type Favorite, useUrbico } from "@/lib/urbico-context";

// Dono (openId) dos dados pessoais guardados neste aparelho. Se outra conta
// entrar sem logout prévio (sessão expirada, app reaberto), os dados da conta
// anterior são limpos antes de qualquer mesclagem/envio — nunca vão parar na
// conta nova. Instalações antigas não têm dono gravado: nesse caso os dados
// locais são adotados pela primeira conta que entrar (mesmo comportamento de
// um visitante que cria favoritos e depois faz login).
const LOCAL_OWNER_KEY = "urbico.local-data-owner";

/**
 * Mescla o backup do servidor com o que já existe localmente, sem perder
 * dados: itens do servidor sempre vencem em caso de mesmo id (o backend é a
 * fonte de verdade quando há dado remoto — mesmo princípio já usado para
 * lotação), mas qualquer item só local (criado offline, ainda não
 * sincronizado) é preservado, não descartado.
 *
 * Exceção: os dois favoritos-placeholder padrão ("Casa"/"Trabalho" sem
 * endereço) que todo app novo começa com — esses nunca entram na mesclagem
 * como "só local", senão toda vez que alguém logasse num aparelho novo (que
 * já vem com esses placeholders) ganharia um "Casa" fantasma duplicado ao
 * lado do "Casa" de verdade vindo do servidor.
 */
function mergeFavorites(local: Favorite[], remote: Favorite[]): Favorite[] {
  const remoteIds = new Set(remote.map((item) => item.id));
  const localOnly = local.filter((item) => {
    if (remoteIds.has(item.id)) return false;
    const isDefaultPlaceholder = (item.id === "home" || item.id === "work") && item.latitude == null && item.longitude == null;
    return !isDefaultPlaceholder;
  });
  return [...remote, ...localOnly];
}

function mergeAppointments(local: Appointment[], remote: Appointment[]): Appointment[] {
  const remoteIds = new Set(remote.map((item) => item.id));
  const localOnly = local.filter((item) => !remoteIds.has(item.id));
  return [...remote, ...localOnly];
}

/**
 * Sincroniza favoritos, agenda e preferências com o backup na nuvem (ver
 * server/routers.ts → userData, e drizzle/schema.ts → userDataSync).
 * Não renderiza nada — é montado uma vez em app/_layout.tsx, dentro do
 * UrbicoProvider.
 *
 * Dois papéis:
 * 1. (aqui) ao terminar a sessão de propósito (logout), limpa os dados pessoais
 *    locais; erro de rede ou sessão expirada NÃO limpam nada;
 * 2. (CloudSyncSession) enquanto há conta, mescla/envia os dados. A sessão é
 *    remontada por openId (key), então nenhum estado de uma conta atravessa
 *    para a outra.
 */
export function CloudSync() {
  const { user, isAuthenticated } = useAuth();
  const { resetPrivateData } = useUrbico();
  const resetRef = useRef(resetPrivateData);
  resetRef.current = resetPrivateData;

  useEffect(
    () =>
      onSessionCleared(() => {
        resetRef.current();
        AsyncStorage.removeItem(LOCAL_OWNER_KEY).catch(() => undefined);
        setSyncStatus("idle");
      }),
    [],
  );

  if (!isAuthenticated || !user) return null;
  return <CloudSyncSession key={user.openId} openId={user.openId} />;
}

function CloudSyncSession({ openId }: { openId: string }) {
  const { favorites, appointments, notificationsEnabled, voiceEnabled, notificationPreferences, hydrateFromCloud, resetPrivateData, isReady } = useUrbico();
  // gcTime 0 + dataUpdatedAt >= mountedAt: nunca aceita resultado em cache de
  // outra conta (ou de uma montagem anterior) como se fosse desta.
  const mountedAtRef = useRef(Date.now());
  const pullQuery = trpc.userData.pull.useQuery(undefined, { retry: false, gcTime: 0, refetchOnMount: "always" });
  const pushMutation = trpc.userData.push.useMutation({
    onSuccess: () => setSyncStatus("saved"),
    onError: () => setSyncStatus("error"),
  });

  const [ownerReady, setOwnerReady] = useState(false);
  const [readyToPush, setReadyToPush] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => () => setSyncStatus("idle"), []);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LOCAL_OWNER_KEY);
        if (stored && stored !== openId) resetPrivateData();
        await AsyncStorage.setItem(LOCAL_OWNER_KEY, openId);
      } catch {
        // Sem acesso ao armazenamento: segue sem limpar (não há como saber o dono).
      }
      if (!cancelled) setOwnerReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, openId]);

  useEffect(() => {
    if (!ownerReady || hydratedRef.current) return;
    if (pullQuery.isError) {
      // Não envia nada por cima do backup se não conseguimos lê-lo.
      setSyncStatus("error");
      return;
    }
    if (!pullQuery.isSuccess || pullQuery.dataUpdatedAt < mountedAtRef.current) return;

    const remote = pullQuery.data;
    if (remote) {
      hydrateFromCloud({
        favorites: mergeFavorites(favorites, remote.favorites as Favorite[]),
        appointments: mergeAppointments(appointments, remote.appointments as Appointment[]),
        notificationsEnabled: remote.notificationsEnabled,
        voiceEnabled: remote.voiceEnabled,
        notificationPreferences: remote.notificationPreferences ? normalizeNotificationPreferences(remote.notificationPreferences) : notificationPreferences,
      });
    }
    hydratedRef.current = true;
    setReadyToPush(true);
    // Só deve rodar quando o pull muda de estado — não a cada mudança local
    // (isso é o efeito de baixo, separado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerReady, pullQuery.isError, pullQuery.isSuccess, pullQuery.dataUpdatedAt, pullQuery.data]);

  useEffect(() => {
    if (!readyToPush) return;
    setSyncStatus("saving");
    const timeout = setTimeout(() => {
      pushMutation.mutate({ favorites, appointments, notificationsEnabled, voiceEnabled, notificationPreferences });
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToPush, favorites, appointments, notificationsEnabled, voiceEnabled, notificationPreferences]);

  return null;
}
