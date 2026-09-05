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

export function estimateLeaveAlert(input: {
  now: Date;
  appointmentAt: Date;
  /** Caminhada da localização atual até o ponto de embarque. */
  walkingSeconds: number;
  /** Distância entre o ponto de embarque e o veículo mais próximo da linha (tempo de espera pelo ônibus). */
  vehicleDistanceMeters: number | null;
  /**
   * Duração estimada do trecho dentro do ônibus, do ponto de embarque até o ponto de
   * desembarque mais próximo do destino. Sem essa informação o alerta ignoraria por
   * completo o tempo de viagem no veículo, o que faria o horário de saída calculado
   * ficar sistematicamente atrasado em relação ao compromisso real.
   */
  busRideSeconds?: number | null;
  /** Caminhada do ponto de desembarque até o endereço de destino do compromisso. */
  finalWalkingSeconds?: number | null;
  averageBusSpeedKmh?: number;
  transferBufferSeconds?: number;
}) {
  const averageBusSpeedKmh = input.averageBusSpeedKmh ?? 18;
  const transferBufferSeconds = input.transferBufferSeconds ?? 300;
  const waitForVehicleSeconds = input.vehicleDistanceMeters === null ? 0 : Math.round((input.vehicleDistanceMeters / (averageBusSpeedKmh * 1000)) * 3600);
  const busRideSeconds = Math.max(0, input.busRideSeconds ?? 0);
  const finalWalkingSeconds = Math.max(0, input.finalWalkingSeconds ?? 0);
  const estimatedTravelSeconds =
    Math.max(0, input.walkingSeconds) + waitForVehicleSeconds + busRideSeconds + finalWalkingSeconds + transferBufferSeconds;
  const leaveBy = new Date(input.appointmentAt.getTime() - estimatedTravelSeconds * 1000);
  const secondsUntilLeave = Math.round((leaveBy.getTime() - input.now.getTime()) / 1000);
  // FIX: a confiança reflete se há um veículo real localizado (sinal de tempo real da
  // SPTrans) — a mesma regra de antes desta rodada de correções. Passar também
  // busRideSeconds/finalWalkingSeconds refina o TEMPO estimado (o bug real: o
  // trecho de ônibus e a caminhada final eram ignorados por completo), mas não deve
  // mudar o rótulo de confiança, que outras partes do código (e os testes) já tratam
  // como "há veículo em tempo real vs. não há".
  const confidence = input.vehicleDistanceMeters === null ? ("limitada" as const) : ("estimada" as const);
  return {
    shouldLeave: secondsUntilLeave <= 0,
    leaveBy,
    secondsUntilLeave,
    estimatedTravelSeconds,
    vehicleSeconds: waitForVehicleSeconds,
    busRideSeconds,
    finalWalkingSeconds,
    confidence,
  };
}
