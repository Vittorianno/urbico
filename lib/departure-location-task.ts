import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { getApiBaseUrl } from "@/constants/oauth";

const INSTALLATION_ID_KEY = "urbico.installation-id";
const ALERT_TASK_NAME = "urbico-departure-location";

type AlertConfiguration = { installationId: string; apiBaseUrl: string };

async function getConfiguration() {
  const raw = await SecureStore.getItemAsync("urbico.departure-alert-config");
  return raw ? JSON.parse(raw) as AlertConfiguration : null;
}

async function postLocation(latitude: number, longitude: number) {
  const configuration = await getConfiguration();
  if (!configuration?.apiBaseUrl) return;
  await fetch(`${configuration.apiBaseUrl}/api/trpc/departureAlerts.updateLocation?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 0: { json: { installationId: configuration.installationId, latitude, longitude } } }),
  }).catch(() => undefined);
}

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(ALERT_TASK_NAME)) {
  TaskManager.defineTask(ALERT_TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    const latest = locations.at(-1);
    if (latest) await postLocation(latest.coords.latitude, latest.coords.longitude);
  });
}

export async function getInstallationId() {
  const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (stored) return stored;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created);
  return created;
}

export async function startDepartureLocationUpdates(installationId: string) {
  if (Platform.OS === "web") throw new Error("O monitoramento em segundo plano exige o aplicativo Android ou iOS instalado.");
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") throw new Error("A localização em primeiro plano não foi autorizada.");
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") throw new Error("A localização em segundo plano não foi autorizada.");
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error("A URL segura do backend será incluída quando a versão publicada for instalada.");
  await SecureStore.setItemAsync("urbico.departure-alert-config", JSON.stringify({ installationId, apiBaseUrl }));
  if (!(await Location.hasStartedLocationUpdatesAsync(ALERT_TASK_NAME))) {
    await Location.startLocationUpdatesAsync(ALERT_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      distanceInterval: 50,
      foregroundService: { notificationTitle: "Urbico", notificationBody: "Avaliando seu alerta de saída autorizado." },
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
    });
  }
}

export async function stopDepartureLocationUpdates() {
  if (Platform.OS !== "web" && await Location.hasStartedLocationUpdatesAsync(ALERT_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(ALERT_TASK_NAME);
  }
  await SecureStore.deleteItemAsync("urbico.departure-alert-config");
}
