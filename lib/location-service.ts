import * as Location from "expo-location";
import { Platform } from "react-native";

export type UrbicoLocation = { latitude: number; longitude: number; accuracy: number | null; capturedAt: number };

export async function getCurrentUrbicoLocation(): Promise<UrbicoLocation> {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error("Ative os serviços de localização para centralizar o mapa.");
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("A localização não foi autorizada.");
  }
  if (Platform.OS === "android") {
    await Location.enableNetworkProviderAsync().catch(() => undefined);
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    capturedAt: location.timestamp,
  };
}
