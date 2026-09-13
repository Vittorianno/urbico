import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { type Appointment, type Favorite, useUrbico } from "@/lib/urbico-context";

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
 * UrbicoProvider. Fica de propósito fora de qualquer tela: a sincronização
 * não pertence a nenhuma área específica do app (nem Agenda, nem
 * Favoritos) — ela é transversal, e o único lugar onde a pessoa vê algo
 * relacionado a "estar logado" continua sendo exclusivamente o Perfil.
 */
export function CloudSync() {
  const { isAuthenticated } = useAuth({ autoFetch: true });
  const { favorites, appointments, notificationsEnabled, voiceEnabled, hydrateFromCloud } = useUrbico();
  const pullQuery = trpc.userData.pull.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const pushMutation = trpc.userData.push.useMutation();

  // FIX: sem este controle, o efeito de "enviar mudanças" dispararia assim
  // que `isAuthenticated` vira true — ou seja, ANTES do pull terminar —
  // enviando o estado local ainda "de fábrica" (favoritos placeholder, sem
  // nada) para o servidor e apagando por cima um backup real que já
  // existisse. Só libera o envio depois que a mesclagem inicial acontece.
  const [readyToPush, setReadyToPush] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setReadyToPush(false);
      hydratedRef.current = false;
      return;
    }
    if (!pullQuery.isFetched || pullQuery.isLoading || hydratedRef.current) return;

    const remote = pullQuery.data;
    if (remote) {
      hydrateFromCloud({
        favorites: mergeFavorites(favorites, remote.favorites as Favorite[]),
        appointments: mergeAppointments(appointments, remote.appointments as Appointment[]),
        notificationsEnabled: remote.notificationsEnabled,
        voiceEnabled: remote.voiceEnabled,
      });
    }
    hydratedRef.current = true;
    setReadyToPush(true);
    // Só deve rodar quando o pull muda de estado — não a cada mudança de
    // favorites/appointments (isso é o efeito de baixo, separado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, pullQuery.isFetched, pullQuery.isLoading, pullQuery.data]);

  useEffect(() => {
    if (!isAuthenticated || !readyToPush) return;
    const timeout = setTimeout(() => {
      pushMutation.mutate({ favorites, appointments, notificationsEnabled, voiceEnabled });
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, readyToPush, favorites, appointments, notificationsEnabled, voiceEnabled]);

  return null;
}
