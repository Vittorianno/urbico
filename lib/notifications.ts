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

// FIX (auditoria — botão "não se move"): esta função podia REJEITAR (throw)
// em vez de resolver, se setNotificationChannelAsync ou
// getPermissionsAsync/requestPermissionsAsync falhassem no Android (módulo
// nativo indisponível, erro pontual do sistema, etc). Quem chama esta
// função (app/settings.tsx e app/(tabs)/profile.tsx) faz
// `setNotificationsEnabled(await enableTravelNotifications())` — uma
// rejeição não tratada pulava essa linha inteira, então o estado nunca era
// atualizado e o Switch (controlado por esse estado) ficava visualmente
// parado na posição antiga, não importa quantas vezes a pessoa tocasse.
// Agora qualquer falha aqui dentro é capturada e a função sempre RESOLVE
// com true ou false — nunca rejeita.
export async function enableTravelNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return await enableWebNotifications();

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
  } catch (error) {
    console.warn("[urbico] enableTravelNotifications falhou:", error);
    return false;
  }
}

export async function scheduleTravelNotice(title: string, body: string) {
  if (Platform.OS === "web") return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { url: "/trip" } },
    trigger: null,
  });
}
