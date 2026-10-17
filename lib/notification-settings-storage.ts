import AsyncStorage from "@react-native-async-storage/async-storage";

import { LOCAL_STATE_STORAGE_KEY, parseStoredNotificationSettings, type NotificationSettings } from "@/lib/notification-preferences";

/**
 * Lê as preferências de notificação direto do armazenamento local — usado onde
 * não há acesso ao estado do React (tarefa de localização em segundo plano).
 * Mesma fonte do UrbicoProvider; nada é duplicado.
 */
export async function readStoredNotificationSettings(): Promise<NotificationSettings> {
  try {
    return parseStoredNotificationSettings(await AsyncStorage.getItem(LOCAL_STATE_STORAGE_KEY));
  } catch {
    return parseStoredNotificationSettings(null);
  }
}
