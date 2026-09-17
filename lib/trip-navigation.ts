import { useEffect, useMemo, useRef, useState } from "react";

import { analytics } from "@/lib/analytics";
import { closestTo, distanceMeters } from "@/lib/leave-alert";
import { speakNorby } from "@/lib/norby-voice";
import { scheduleTravelNotice } from "@/lib/notifications";
import { watchUrbicoLocation, type LocationWatchHandle } from "@/lib/location-service";
import { trpc } from "@/lib/trpc";
import { useUrbico } from "@/lib/urbico-context";

/**
 * Motor da "Urbico Navigation" — acompanha a viagem de ponta a ponta:
 * caminhada até o ponto → espera/embarque → dentro do ônibus →
 * desembarque → caminhada final → chegada. Ver docs/analytics.md para os
 * eventos disparados e o critério de detecção de cada etapa.
 *
 * IMPORTANTE (regra "não simular" do briefing): toda leitura de posição
 * vem de GPS real (watchUrbicoLocation). Não há nenhuma posição, ETA ou
 * instrução fabricada — quando um dado real não está disponível (sem
 * veículo posicionado, sem parada encontrada, sem previsão da SPTrans), o
 * estado correspondente fica `null`/indisponível em vez de inventado.
 *
 * Detecção de embarque/desembarque é uma HEURÍSTICA sobre dados reais
 * (proximidade real ao veículo real + velocidade real do GPS) — não uma
 * simulação, mas também não uma certeza (não há um sinal direto "a pessoa
 * está dentro do ônibus X" disponível de nenhuma fonte gratuita). Por
 * isso o hook expõe confirmBoarding()/confirmAlighting() como reforço
 * manual honesto, em vez de fingir 100% de certeza automática.
 */
export type NavigationPhase = "walking_to_stop" | "waiting_at_stop" | "on_bus" | "walking_to_destination" | "arrived";

const ARRIVAL_RADIUS_METERS = 30;
const APPROACHING_RADIUS_METERS = 150;
// FIX: "avise quando o ônibus estiver chegando" era uma intenção que o Norby
// já reconhecia (ver NORBY_SUBINTENT_PATTERNS em lib/urbico-logic.ts) mas
// respondia "ainda não tenho isso" (ver NORBY_UNSUPPORTED_INTENTS). O dado
// real pra isso já existia — posição real do veículo rastreado
// (trackedVehicle, via SPTrans) — só faltava usar. Raio maior que
// ARRIVAL_RADIUS_METERS porque aqui o ônibus é que está se aproximando do
// ponto, não a pessoa a pé (o sinal fica útil um pouco mais cedo).
const BUS_APPROACHING_METERS = 300;
const OFF_ROUTE_THRESHOLD_METERS = 70;
const OFF_ROUTE_CONFIRM_READINGS = 2;
// ~12,6 km/h — acima de caminhada normal (até ~6 km/h), sinal real de que a
// pessoa está se deslocando rápido demais para estar a pé.
const BUS_SPEED_THRESHOLD_MS = 3.5;
const NEAR_VEHICLE_METERS = 40;

export function useTripNavigation() {
  const { activeRoute, currentLocation, setCurrentLocation, addNorbyMessage, voiceEnabled, notificationsEnabled } = useUrbico();
  const line = activeRoute?.line ?? null;

  const [phase, setPhase] = useState<NavigationPhase>("walking_to_stop");
  const [watchError, setWatchError] = useState<string | null>(null);
  const [offRouteReadings, setOffRouteReadings] = useState(0);
  const [reroutedPoints, setReroutedPoints] = useState<number[][] | null>(null);
  const phaseRef = useRef<NavigationPhase>("walking_to_stop");
  const announcedRef = useRef<Set<string>>(new Set());

  const stopsQuery = trpc.transit.lineStops.useQuery({ lineId: line?.id ?? 0 }, { enabled: Boolean(line) });
  const vehiclesQuery = trpc.transit.lineVehicles.useQuery({ lineId: line?.id ?? 0 }, { enabled: Boolean(line), refetchInterval: 15_000 });
  const routeMutation = trpc.routing.planWalking.useMutation();

  const boardingStop = useMemo(() => {
    if (!activeRoute || !stopsQuery.data?.length) return null;
    return closestTo(activeRoute.origin, stopsQuery.data)?.item ?? null;
  }, [activeRoute, stopsQuery.data]);

  const alightingStop = useMemo(() => {
    if (!activeRoute || !stopsQuery.data?.length) return null;
    return closestTo(activeRoute.destination, stopsQuery.data)?.item ?? null;
  }, [activeRoute, stopsQuery.data]);

  const trackedVehicle = useMemo(() => {
    if (!boardingStop || !vehiclesQuery.data?.length) return null;
    return closestTo(boardingStop, vehiclesQuery.data)?.item ?? null;
  }, [boardingStop, vehiclesQuery.data]);

  // FIX: getStopPredictions devolve UM objeto (a parada + todas as linhas
  // que passam nela), não uma lista de previsões — usar isso como array
  // vazio por padrão estava errado de tipo. Filtramos aqui só a linha da
  // viagem ativa, que é o único dado real relevante para a navegação.
  const predictionsQuery = trpc.transit.stopPredictions.useQuery({ stopId: boardingStop?.id ?? 0 }, { enabled: Boolean(boardingStop), refetchInterval: 20_000 });
  const linePrediction = useMemo(() => {
    if (!line) return null;
    return predictionsQuery.data?.lines.find((entry) => entry.line.id === line.id) ?? null;
  }, [predictionsQuery.data, line]);

  const announce = (key: string, text: string, options: { notify?: boolean } = {}) => {
    if (announcedRef.current.has(key)) return;
    announcedRef.current.add(key);
    addNorbyMessage(text);
    analytics.track("norby_navigation_instruction", { key, lineId: line?.id });
    if (voiceEnabled) void speakNorby(text);
    // FIX: enquanto a pessoa espera no ponto, a tela pode estar bloqueada ou
    // o app em segundo plano — mensagem no chat sozinha não chega até ela
    // nesse caso. Mesmo canal já usado pelo alerta de saída (scheduleTravelNotice),
    // respeitando a preferência de notificações de viagem.
    if (options.notify && notificationsEnabled) void scheduleTravelNotice("Norby", text);
  };

  const setPhaseTracked = (next: NavigationPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const confirmBoarding = () => {
    if (phaseRef.current !== "waiting_at_stop") return;
    setPhaseTracked("on_bus");
    announce("boarded_manual", `Embarque confirmado${line ? ` na linha ${line.label}` : ""}.`);
    analytics.track("bus_boarding_detected", { lineId: line?.id, method: "manual" });
  };

  const confirmAlighting = () => {
    if (phaseRef.current !== "on_bus") return;
    setPhaseTracked("walking_to_destination");
    announce("alighted_manual", "Desembarque confirmado. Agora é caminhada até o destino.");
    analytics.track("bus_alighting_detected", { lineId: line?.id, method: "manual" });
  };

  // Acompanhamento por GPS real: atualiza posição, decide a etapa atual e
  // detecta desvio de rota. Um único watch por viagem ativa (destino),
  // reiniciado se a rota mudar.
  useEffect(() => {
    if (!activeRoute) return;
    let handle: LocationWatchHandle | null = null;
    let cancelled = false;
    setPhaseTracked("walking_to_stop");
    announcedRef.current = new Set();
    analytics.track("navigation_started", { hasLine: Boolean(line) });

    (async () => {
      try {
        handle = await watchUrbicoLocation((location) => {
          if (cancelled) return;
          setCurrentLocation(location);
          const currentPhase = phaseRef.current;

          if (currentPhase === "walking_to_stop") {
            if (boardingStop) {
              const distance = distanceMeters(location, boardingStop);
              if (distance <= ARRIVAL_RADIUS_METERS) {
                setPhaseTracked("waiting_at_stop");
                announce("arrived_stop", "Você chegou ao ponto.");
                analytics.track("bus_stop_reached", { lineId: line?.id });
                setOffRouteReadings(0);
                return;
              }
            }
            if (activeRoute.points.length > 0) {
              const nearest = closestTo(location, activeRoute.points.map(([lon, lat]) => ({ latitude: lat, longitude: lon })));
              if (nearest && nearest.distanceMeters > OFF_ROUTE_THRESHOLD_METERS) setOffRouteReadings((count) => count + 1);
              else setOffRouteReadings(0);
            }
          } else if (currentPhase === "waiting_at_stop" && trackedVehicle) {
            const speed = location.speed ?? 0;
            const nearVehicle = distanceMeters(location, trackedVehicle) < NEAR_VEHICLE_METERS;
            if (speed > BUS_SPEED_THRESHOLD_MS && nearVehicle) {
              setPhaseTracked("on_bus");
              announce("boarded", `O ônibus chegou. Você está a bordo${line ? ` da linha ${line.label}` : ""}.`);
              analytics.track("bus_boarding_detected", { lineId: line?.id, method: "heuristic" });
            }
          } else if (currentPhase === "on_bus" && alightingStop) {
            const distance = distanceMeters(location, alightingStop);
            if (distance <= ARRIVAL_RADIUS_METERS) {
              setPhaseTracked("walking_to_destination");
              announce("alighted", "Você chegou à sua parada. Agora caminhe até o destino.");
              analytics.track("bus_alighting_detected", { lineId: line?.id, method: "heuristic" });
            }
          } else if (currentPhase === "walking_to_destination") {
            const distance = distanceMeters(location, activeRoute.destination);
            if (distance <= ARRIVAL_RADIUS_METERS) {
              setPhaseTracked("arrived");
              announce("arrived_destination", "Você chegou ao destino.");
              analytics.track("destination_reached", { lineId: line?.id });
            } else if (distance <= APPROACHING_RADIUS_METERS) {
              announce("approaching_destination", "Você está chegando ao destino.");
            }
          }
        });
      } catch (error) {
        if (!cancelled) setWatchError(error instanceof Error ? error.message : "Não foi possível acompanhar sua localização.");
      }
    })();

    return () => {
      cancelled = true;
      handle?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute?.destination.latitude, activeRoute?.destination.longitude, boardingStop?.id, alightingStop?.id, trackedVehicle?.id]);

  // FIX: "avise quando o ônibus estiver chegando" — enquanto espera no
  // ponto (waiting_at_stop), acompanha a distância real do veículo
  // rastreado (trackedVehicle, posição SPTrans) até o ponto de embarque.
  // Dispara uma vez por viagem quando o ônibus entra no raio de
  // aproximação, com notificação local (chega mesmo com tela bloqueada).
  // Efeito separado do watch de GPS acima porque depende só da posição do
  // veículo (atualizada pelo polling de vehiclesQuery, não pelo GPS do
  // usuário), e não deve reiniciar o watch de localização ao disparar.
  useEffect(() => {
    if (phase !== "waiting_at_stop" || !boardingStop || !trackedVehicle) return;
    const distance = distanceMeters(trackedVehicle, boardingStop);
    if (distance > BUS_APPROACHING_METERS) return;
    announce("bus_approaching", `O ônibus${line ? ` da linha ${line.label}` : ""} está chegando ao seu ponto.`, { notify: true });
    analytics.track("bus_approaching_detected", { lineId: line?.id, distanceMeters: Math.round(distance) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, boardingStop?.id, trackedVehicle?.latitude, trackedVehicle?.longitude]);

  // Recálculo: só depois de leituras consecutivas fora da rota (evita reagir
  // a ruído comum de GPS) e só até o próximo ponto relevante (o ponto de
  // embarque) — sem recalcular a viagem inteira toda vez.
  useEffect(() => {
    if (offRouteReadings < OFF_ROUTE_CONFIRM_READINGS || !currentLocation || !boardingStop || phaseRef.current !== "walking_to_stop") return;
    setOffRouteReadings(0);
    analytics.track("navigation_rerouted", { reason: "off_route" });
    announce("rerouted", "Você saiu um pouco da rota. Recalculando o caminho até o ponto.");
    routeMutation
      .mutateAsync({
        origin: "Local atual",
        destination: "Ponto de ônibus",
        originLatitude: currentLocation.latitude,
        originLongitude: currentLocation.longitude,
        destinationLatitude: boardingStop.latitude,
        destinationLongitude: boardingStop.longitude,
      })
      .then((result) => {
        if (result?.route) setReroutedPoints(result.route.points);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offRouteReadings]);

  const distanceToNext = useMemo(() => {
    if (!currentLocation) return null;
    if (phase === "walking_to_stop" && boardingStop) return distanceMeters(currentLocation, boardingStop);
    if (phase === "on_bus" && alightingStop) return distanceMeters(currentLocation, alightingStop);
    if (phase === "walking_to_destination" && activeRoute) return distanceMeters(currentLocation, activeRoute.destination);
    return null;
  }, [currentLocation, phase, boardingStop, alightingStop, activeRoute]);

  return {
    phase,
    boardingStop,
    alightingStop,
    trackedVehicle,
    linePrediction,
    stopsAvailable: Boolean(stopsQuery.data?.length),
    watchError,
    reroutedPoints,
    distanceToNext,
    confirmBoarding,
    confirmAlighting,
    cancel: () => analytics.track("navigation_cancelled", { phase: phaseRef.current, lineId: line?.id }),
  };
}
