/**
 * Preferências de notificação por categoria — lógica PURA (sem React Native),
 * para poder ser usada pelo contexto, pela tarefa em segundo plano e pelos
 * testes. Espelhada em server/routers.ts (notificationPreferencesSchema).
 *
 * Só existem categorias que têm um evento real hoje:
 * - departureAlerts: aviso "hora de sair" (calculado no servidor, entregue como
 *   notificação local pela tarefa em lib/departure-location-task.ts);
 * - tripUpdates: avisos durante a viagem (ex.: ônibus chegando ao ponto, ver
 *   lib/trip-navigation.ts).
 * Interrupções de linha, linhas/paradas favoritas e lembretes pessoais ainda não
 * têm fonte de eventos nem entrega push — não aparecem como opção.
 */

/** Chave do estado local persistido por lib/urbico-context.tsx (fonte única). */
export const LOCAL_STATE_STORAGE_KEY = "urbico.local-state.v1";

export type NotificationCategory = "departureAlerts" | "tripUpdates";
export type NotificationPreferences = Record<NotificationCategory, boolean>;

export type NotificationSettings = {
  /** Chave geral: desligada, nenhuma categoria notifica. */
  notificationsEnabled: boolean;
  preferences: NotificationPreferences;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  departureAlerts: true,
  tripUpdates: true,
};

export const NOTIFICATION_CATEGORIES: {
  id: NotificationCategory;
  title: string;
  description: string;
}[] = [
  {
    id: "departureAlerts",
    title: "Hora de sair",
    description: "Aviso do momento ideal de saída dos compromissos para os quais você ativou um alerta.",
  },
  {
    id: "tripUpdates",
    title: "Avisos durante a viagem",
    description: "Atualizações enquanto você acompanha uma viagem, como o ônibus chegando ao seu ponto.",
  },
];

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    departureAlerts: typeof source.departureAlerts === "boolean" ? source.departureAlerts : DEFAULT_NOTIFICATION_PREFERENCES.departureAlerts,
    tripUpdates: typeof source.tripUpdates === "boolean" ? source.tripUpdates : DEFAULT_NOTIFICATION_PREFERENCES.tripUpdates,
  };
}

export function shouldNotify(settings: NotificationSettings, category: NotificationCategory): boolean {
  return settings.notificationsEnabled && settings.preferences[category];
}

/** Lê as configurações de dentro do JSON salvo em LOCAL_STATE_STORAGE_KEY. */
export function parseStoredNotificationSettings(raw: string | null): NotificationSettings {
  const fallback: NotificationSettings = { notificationsEnabled: true, preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES } };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { notificationsEnabled?: unknown; notificationPreferences?: unknown } | null;
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      notificationsEnabled: typeof parsed.notificationsEnabled === "boolean" ? parsed.notificationsEnabled : true,
      preferences: normalizeNotificationPreferences(parsed.notificationPreferences),
    };
  } catch {
    return fallback;
  }
}
