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

export async function enableTravelNotifications() {
  if (Platform.OS === "web") return false;

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
