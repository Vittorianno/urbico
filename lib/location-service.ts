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

export type UrbicoLiveLocation = UrbicoLocation & { heading: number | null; speed: number | null };
export type LocationWatchHandle = { remove: () => void };

// FIX (Urbico Navigation): antes só existia leitura única de localização
// (getCurrentUrbicoLocation) — nada no app acompanhava o deslocamento em
// tempo real. Usado pela navegação de viagem (lib/trip-navigation.ts) para
// atualizar posição, direção (heading) e velocidade (speed) continuamente
// enquanto a viagem estiver ativa. Sempre localização real do GPS — nunca
// simulada; se o serviço/permissão não estiver disponível, lança em vez de
// inventar uma posição.
export async function watchUrbicoLocation(onUpdate: (location: UrbicoLiveLocation) => void): Promise<LocationWatchHandle> {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error("Ative os serviços de localização para acompanhar a viagem.");
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("A localização não foi autorizada.");
  }
  if (Platform.OS === "android") {
    await Location.enableNetworkProviderAsync().catch(() => undefined);
  }
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 4000, distanceInterval: 8 },
    (location) => {
      onUpdate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        capturedAt: location.timestamp,
        heading: location.coords.heading,
        speed: location.coords.speed,
      });
    },
  );
  return { remove: () => subscription.remove() };
}
