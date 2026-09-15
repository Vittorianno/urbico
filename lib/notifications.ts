import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const TRAVEL_CHANNEL_ID = "urbico-travel";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// FIX: na web, esta função sempre devolvia `false` incondicionalmente, sem
// tentar nada — então na prática dava pra DESATIVAR o switch de
// notificações (que só chama setNotificationsEnabled(false) direto, sem
// passar por aqui), mas nunca REATIVAR, porque qualquer tentativa de
// reativar sempre "falhava". Agora usa a API de notificação do próprio
// navegador (Web Notifications), que existe justamente pra isso.
async function enableWebNotifications() {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return false;
  if (window.Notification.permission === "granted") return true;
  if (window.Notification.permission === "denied") {
    // O navegador já negou antes e não deixa pedir de novo por código — só
    // dá pra reverter isso nas configurações do próprio site no navegador
    // (mesma limitação existe no Android/iOS nativo depois de uma negação).
    return false;
  }
  const permission = await window.Notification.requestPermission();
  return permission === "granted";
}

export async function enableTravelNotifications() {
  if (Platform.OS === "web") return enableWebNotifications();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(TRAVEL_CHANNEL_ID, {
      name: "Atualizações de viagem",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180],
      lightColor: "#087DF5",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const result = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  return result.status === "granted";
}

export async function scheduleTravelNotice(title: string, body: string) {
  if (Platform.OS === "web") return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { url: "/trip" } },
    trigger: null,
  });
}
