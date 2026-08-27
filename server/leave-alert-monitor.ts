import { closestTo, distanceMeters, estimateLeaveAlert } from "../lib/leave-alert";
import * as db from "./db";
import { planWalkingRoute } from "./integrations/graphhopper";
import { getLineStops, getLineVehicles } from "./integrations/sptrans";

const toNumber = (value: string | number | null) => value === null ? null : Number(value);

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
      const stops = await getLineStops(alert.lineId);
      const stop = closestTo(user, stops);
      if (!stop) {
        results.push({ id: alert.id, shouldLeave: false, reason: "sem parada para a linha" });
        continue;
      }
      const [walkingRoute, vehicles] = await Promise.all([
        planWalkingRoute(user, stop.item),
        getLineVehicles(alert.lineId),
      ]);
      const nearestVehicle = closestTo(stop.item, vehicles);
      const evaluation = estimateLeaveAlert({
        now,
        appointmentAt: alert.appointmentAt,
        walkingSeconds: walkingRoute?.durationSeconds ?? Math.round(stop.distanceMeters / 1.2),
        vehicleDistanceMeters: nearestVehicle ? distanceMeters(stop.item, nearestVehicle.item) : null,
      });
      if (evaluation.shouldLeave) await db.markDepartureAlertSent(alert.id);
      results.push({ id: alert.id, shouldLeave: evaluation.shouldLeave, reason: evaluation.confidence });
    } catch {
      results.push({ id: alert.id, shouldLeave: false, reason: "dados de mobilidade indisponíveis" });
    }
  }
  return results;
}
