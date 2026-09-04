import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { getApiBaseUrl } from "@/constants/oauth";
import { scheduleTravelNotice } from "@/lib/notifications";

const INSTALLATION_ID_KEY = "urbico.installation-id";
const ALERT_TASK_NAME = "urbico-departure-location";
// FIX: guarda o `alertedAt` já notificado localmente, para nunca disparar a
// mesma notificação duas vezes (o servidor pode continuar respondendo o mesmo
// alertedAt em requisições posteriores até o alerta ser revogado/rearmado).
const LAST_NOTIFIED_KEY = "urbico.last-notified-alert";

type AlertConfiguration = { installationId: string; apiBaseUrl: string };
type UpdateLocationResult = { updated: boolean; alertedAt: string | null; appointmentLabel: string | null };

async function getConfiguration() {
  const raw = await SecureStore.getItemAsync("urbico.departure-alert-config");
  return raw ? JSON.parse(raw) as AlertConfiguration : null;
}

// FIX: esta função só enviava a localização e descartava a resposta do
// servidor. Era o único ponto do app chamado periodicamente enquanto o alerta
// está armado, mas nunca verificava se o servidor tinha decidido "hora de
// sair" — então o alerta nunca chegava a notificar ninguém. Agora ela lê a
// resposta, dispara uma notificação local na primeira vez que vir um
// `alertedAt` novo, e encerra o monitoramento (o alerta já cumpriu seu papel).
async function postLocation(latitude: number, longitude: number) {
  const configuration = await getConfiguration();
  if (!configuration?.apiBaseUrl) return;
  try {
    const response = await fetch(`${configuration.apiBaseUrl}/api/trpc/departureAlerts.updateLocation?batch=1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 0: { json: { installationId: configuration.installationId, latitude, longitude } } }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as Array<{ result?: { data?: { json?: UpdateLocationResult } } }>;
    const result = payload[0]?.result?.data?.json;
    if (!result?.alertedAt) return;

    const lastNotified = await SecureStore.getItemAsync(LAST_NOTIFIED_KEY);
    if (lastNotified === result.alertedAt) return;

    await scheduleTravelNotice(
      "Hora de sair! 🚌",
      result.appointmentLabel ? `Saia agora para chegar a tempo em: ${result.appointmentLabel}.` : "Saia agora para chegar a tempo no seu compromisso.",
    );
    await SecureStore.setItemAsync(LAST_NOTIFIED_KEY, result.alertedAt);
    // O alerta já disparou; não há motivo para continuar consumindo bateria com
    // localização em segundo plano até o usuário armar um novo alerta.
    await stopDepartureLocationUpdates();
  } catch {
    // Falha de rede pontual: a próxima atualização de localização tenta de novo.
  }
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
  // FIX: um alerta rearmado herdava o `alertedAt` notificado do alerta anterior
  // (mesma installationId), o que faria a próxima notificação real ser
  // silenciosamente ignorada por já "parecer" notificada. Limpa o marcador ao
  // (re)iniciar o monitoramento.
  await SecureStore.deleteItemAsync(LAST_NOTIFIED_KEY);
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
