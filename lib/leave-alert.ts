export type Coordinate = { latitude: number; longitude: number };

export function distanceMeters(from: Coordinate, to: Coordinate) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function closestTo<T extends Coordinate>(origin: Coordinate, candidates: T[]) {
  return candidates.reduce<{ item: T; distanceMeters: number } | null>((closest, item) => {
    const candidate = { item, distanceMeters: distanceMeters(origin, item) };
    return !closest || candidate.distanceMeters < closest.distanceMeters ? candidate : closest;
  }, null);
}

export function estimateLeaveAlert(input: { now: Date; appointmentAt: Date; walkingSeconds: number; vehicleDistanceMeters: number | null; averageBusSpeedKmh?: number; transferBufferSeconds?: number }) {
  const averageBusSpeedKmh = input.averageBusSpeedKmh ?? 18;
  const transferBufferSeconds = input.transferBufferSeconds ?? 300;
  const vehicleSeconds = input.vehicleDistanceMeters === null ? 0 : Math.round((input.vehicleDistanceMeters / (averageBusSpeedKmh * 1000)) * 3600);
  const estimatedTravelSeconds = Math.max(0, input.walkingSeconds) + vehicleSeconds + transferBufferSeconds;
  const leaveBy = new Date(input.appointmentAt.getTime() - estimatedTravelSeconds * 1000);
  const secondsUntilLeave = Math.round((leaveBy.getTime() - input.now.getTime()) / 1000);
  return {
    shouldLeave: secondsUntilLeave <= 0,
    leaveBy,
    secondsUntilLeave,
    estimatedTravelSeconds,
    vehicleSeconds,
    confidence: input.vehicleDistanceMeters === null ? "limitada" as const : "estimada" as const,
  };
}
