import { closestTo, distanceMeters, estimateLeaveAlert } from "../lib/leave-alert";
import * as db from "./db";
import { planWalkingRoute } from "./integrations/open-geospatial";
import { getLineStops, getLineVehicles } from "./integrations/sptrans";

const toNumber = (value: string | number | null) => (value === null ? null : Number(value));

// Sem dado de trajeto oficial do trecho em ônibus, esta é uma estimativa por
// velocidade média — mais realista do que ignorar completamente o tempo dentro do
// veículo, que era o comportamento anterior.
const AVERAGE_BUS_SPEED_KMH = 18;

export async function evaluateDepartureAlerts(now = new Date()) {
  const alerts = await db.listEligibleDepartureAlerts(now);
  const results: Array<{ id: number; shouldLeave: boolean; reason: string }> = [];
  for (const alert of alerts) {
    const latitude = toNumber(alert.latestLatitude);
    const longitude = toNumber(alert.latestLongitude);
    if (latitude === null || longitude === null) {
      results.push({ id: alert.id, shouldLeave: false, reason: "localização ainda não recebida" });
      continue;
    }
    try {
      const user = { latitude, longitude };
      const destination = { latitude: Number(alert.destinationLatitude), longitude: Number(alert.destinationLongitude) };
      const stops = await getLineStops(alert.lineId);
      const boardingStop = closestTo(user, stops);
      if (!boardingStop) {
        results.push({ id: alert.id, shouldLeave: false, reason: "sem parada para a linha" });
        continue;
      }
      // Parada de desembarque: a parada da própria linha mais próxima do destino do compromisso.
      const alightingStop = closestTo(destination, stops);

      const [walkingRoute, vehicles, finalWalkingRoute] = await Promise.all([
        planWalkingRoute(user, boardingStop.item),
        getLineVehicles(alert.lineId),
        alightingStop ? planWalkingRoute(alightingStop.item, destination) : Promise.resolve(null),
      ]);

      const nearestVehicle = closestTo(boardingStop.item, vehicles);
      const busRideMeters = alightingStop ? distanceMeters(boardingStop.item, alightingStop.item) : null;
      const busRideSeconds = busRideMeters === null ? null : Math.round((busRideMeters / (AVERAGE_BUS_SPEED_KMH * 1000)) * 3600);
      const finalWalkingSeconds =
        finalWalkingRoute?.durationSeconds ?? (alightingStop ? Math.round(distanceMeters(alightingStop.item, destination) / 1.2) : null);

      const evaluation = estimateLeaveAlert({
        now,
        appointmentAt: alert.appointmentAt,
        walkingSeconds: walkingRoute?.durationSeconds ?? Math.round(boardingStop.distanceMeters / 1.2),
        vehicleDistanceMeters: nearestVehicle ? distanceMeters(boardingStop.item, nearestVehicle.item) : null,
        busRideSeconds,
        finalWalkingSeconds,
      });
      if (evaluation.shouldLeave) await db.markDepartureAlertSent(alert.id);
      results.push({ id: alert.id, shouldLeave: evaluation.shouldLeave, reason: evaluation.confidence });
    } catch {
      results.push({ id: alert.id, shouldLeave: false, reason: "dados de mobilidade indisponíveis" });
    }
  }
  return results;
}
