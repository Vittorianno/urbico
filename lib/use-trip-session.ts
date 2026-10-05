import { useCallback, useEffect, useRef, useState } from "react";

import { getInstallationId } from "@/lib/departure-location-task";
import type { NavigationPhase } from "@/lib/trip-navigation";
import type { CrowdLevel } from "@/lib/trip-rules";
import { trpc } from "@/lib/trpc";

// Sinal de vida enviado ao servidor: a cada poucos minutos, NUNCA a cada
// leitura de GPS (o servidor expira a viagem após 20 min sem sinal).
const PING_INTERVAL_MS = 3 * 60 * 1000;

type Coordinates = { latitude: number; longitude: number } | null;

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/**
 * Liga a navegação local (lib/trip-navigation.ts) à viagem no servidor:
 *  - recupera uma viagem ativa da mesma linha ao reabrir a tela;
 *  - inicia a viagem ao chegar no ponto / embarcar;
 *  - faz CHECK_IN quando a fase vira "on_bus";
 *  - faz CHECK_OUT ao descer; envia ping de sinal de vida;
 *  - envia relatos de lotação ligados à viagem.
 * Falhas de rede não interrompem a navegação: viram `error`.
 * Não envia veículo: o app não consegue identificar de forma confiável qual
 * ônibus a pessoa pegou, e o servidor não aceita veículo não verificado.
 */
export function useTripSession({ lineId, phase, location }: { lineId: number | null; phase: NavigationPhase; location: Coordinates }) {
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [tripId, setTripId] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const locationRef = useRef<Coordinates>(location);

  const utils = trpc.useUtils();
  const startTrip = trpc.trip.start.useMutation();
  const checkInTrip = trpc.trip.checkIn.useMutation();
  const pingTrip = trpc.trip.ping.useMutation();
  const checkOutTrip = trpc.trip.checkOut.useMutation();
  const cancelTrip = trpc.trip.cancel.useMutation();
  const submitReport = trpc.crowdReports.submit.useMutation();
  const currentQuery = trpc.trip.current.useQuery({ installationId: installationId ?? "" }, { enabled: Boolean(installationId) && Boolean(lineId), staleTime: Infinity });

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    void getInstallationId()
      .then(setInstallationId)
      .catch(() => setInstallationId(null));
  }, []);

  // Recuperação: app reaberto ou sessão perdida com viagem ainda ativa na mesma linha.
  useEffect(() => {
    const active = currentQuery.data?.trip;
    if (!active || active.lineId !== lineId || tripId !== null) return;
    setTripId(active.id);
    setCheckedIn(active.checkedIn);
  }, [currentQuery.data, lineId, tripId]);

  // Inicia a viagem quando a pessoa está no ponto ou a bordo.
  useEffect(() => {
    if (!installationId || !lineId || tripId !== null || busyRef.current) return;
    if (phase !== "waiting_at_stop" && phase !== "on_bus") return;
    if (!currentQuery.isFetched) return;
    busyRef.current = true;
    const here = locationRef.current;
    startTrip
      .mutateAsync({ installationId, lineId, ...(here ? { latitude: here.latitude, longitude: here.longitude } : {}) })
      .then((result) => {
        setTripId(result.trip.id);
        setCheckedIn(result.trip.checkedIn);
        setError(null);
      })
      .catch((cause) => setError(messageOf(cause, "Não foi possível iniciar o acompanhamento.")))
      .finally(() => {
        busyRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, lineId, phase, tripId, currentQuery.isFetched]);

  // CHECK_IN quando a fase vira "a bordo" (manual ou heurística).
  useEffect(() => {
    if (phase !== "on_bus" || tripId === null || checkedIn || !installationId || busyRef.current) return;
    busyRef.current = true;
    const here = locationRef.current;
    checkInTrip
      .mutateAsync({ installationId, tripId, ...(here ? { latitude: here.latitude, longitude: here.longitude } : {}) })
      .then((result) => {
        setCheckedIn(result.trip.checkedIn);
        setError(null);
      })
      .catch((cause) => setError(messageOf(cause, "Não foi possível confirmar o embarque.")))
      .finally(() => {
        busyRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tripId, checkedIn, installationId]);

  // CHECK_OUT ao descer do ônibus (ou chegar).
  useEffect(() => {
    if ((phase !== "walking_to_destination" && phase !== "arrived") || tripId === null || !installationId) return;
    const finishedTripId = tripId;
    setTripId(null);
    setCheckedIn(false);
    void checkOutTrip.mutateAsync({ installationId, tripId: finishedTripId }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tripId, installationId]);

  // Sinal de vida periódico enquanto há viagem.
  useEffect(() => {
    if (tripId === null || !installationId) return;
    const timer = setInterval(() => {
      const here = locationRef.current;
      void pingTrip.mutateAsync({ installationId, tripId, ...(here ? { latitude: here.latitude, longitude: here.longitude } : {}) }).catch(() => undefined);
    }, PING_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, installationId]);

  /** Encerramento manual: COMPLETED se já havia CHECK_IN, senão CANCELLED. */
  const end = useCallback(async () => {
    if (tripId === null || !installationId) return;
    const endingTripId = tripId;
    setTripId(null);
    setCheckedIn(false);
    try {
      if (checkedIn) await checkOutTrip.mutateAsync({ installationId, tripId: endingTripId });
      else await cancelTrip.mutateAsync({ installationId, tripId: endingTripId });
    } catch {
      // Melhor esforço: se falhar, o servidor expira a viagem sozinho.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, installationId, checkedIn]);

  /** Relato de lotação ligado à viagem ativa (cai para relato avulso se a viagem não valer mais). */
  const report = useCallback(
    async (level: CrowdLevel) => {
      if (!lineId) throw new Error("Selecione uma linha para relatar a lotação.");
      const base = { lineId, level, ...(installationId ? { installationId } : {}) };
      try {
        await submitReport.mutateAsync({ ...base, ...(tripId !== null ? { tripId } : {}) });
      } catch (cause) {
        if (tripId === null) throw cause;
        await submitReport.mutateAsync(base);
      }
      await utils.crowdReports.estimate.invalidate({ lineId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineId, installationId, tripId],
  );

  return { tripId, checkedIn, error, end, report };
}
