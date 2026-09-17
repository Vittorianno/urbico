import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { CrowdLevelBadge } from "@/components/crowd-level";
import { ScreenContainer } from "@/components/screen-container";
import { UrbicoMap } from "@/components/urbico-map";
import { colors, PrimaryButton, SecondaryButton } from "@/components/urbico-ui";
import { useTripNavigation, type NavigationPhase } from "@/lib/trip-navigation";
import { getCurrentUrbicoLocation } from "@/lib/location-service";
import { trpc } from "@/lib/trpc";
import { useUrbico } from "@/lib/urbico-context";

function formatDistance(meters: number | null): string {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const STAGE_ICONS = ["directions-walk", "directions-bus", "directions-walk", "flag"] as const;
const STAGE_LABELS = ["A pé", "Ônibus", "A pé", "Destino"] as const;

function stageIndex(phase: NavigationPhase): number {
  if (phase === "walking_to_stop" || phase === "waiting_at_stop") return 0;
  if (phase === "on_bus") return 1;
  if (phase === "walking_to_destination") return 2;
  return 3;
}

export default function TripScreen() {
  const { activeRoute, currentLocation, crowdReports, endTrip, voiceEnabled, setVoiceEnabled } = useUrbico();
  const nav = useTripNavigation();
  const [recentering, setRecentering] = useState(false);
  const lineId = activeRoute?.line?.id ?? null;

  const crowdSummaryQuery = trpc.crowdReports.recent.useQuery({ lineId: lineId ?? 0 }, { enabled: Boolean(lineId), refetchInterval: 60_000 });
  const latestCrowd = crowdReports.at(-1) ?? null;
  const displayedLevel = lineId ? (crowdSummaryQuery.data?.level ?? null) : latestCrowd;
  const aggregatedCount = crowdSummaryQuery.data?.totalReports ?? 0;

  // FIX: GPS indisponível/permissão negada continua avisado por Alert (é um
  // erro pontual, faz sentido interromper) — mas SPTrans fora do ar ou sem
  // veículo localizado agora ganham um AVISO FIXO no painel (não some
  // sozinho, não bloqueia a tela) em vez de só deixar boardingStop/
  // trackedVehicle como null silenciosamente (item 20 do briefing).
  useEffect(() => {
    if (nav.watchError) Alert.alert("Localização indisponível", nav.watchError);
  }, [nav.watchError]);

  const statusBanner = !nav.stopsAvailable && activeRoute.line
    ? { icon: "cloud-off" as const, text: "Não foi possível carregar as paradas desta linha agora. Verifique sua conexão ou tente novamente em instantes." }
    : nav.sptransUnavailable
      ? { icon: "cloud-off" as const, text: "Os dados da SPTrans/Olho Vivo estão indisponíveis no momento. As instruções de caminhada continuam funcionando; o acompanhamento do ônibus, não." }
      : nav.noVehicleTracked
        ? { icon: "directions-bus-filled" as const, text: "Nenhum veículo desta linha está reportando posição em tempo real agora — sem dado real de ônibus para acompanhar." }
        : null;

  const mapVehicles = useMemo(() => (nav.trackedVehicle ? [{ id: nav.trackedVehicle.prefix, label: activeRoute?.line ? `Linha ${activeRoute.line.label}` : `Veículo ${nav.trackedVehicle.prefix}`, latitude: nav.trackedVehicle.latitude, longitude: nav.trackedVehicle.longitude }] : []), [nav.trackedVehicle, activeRoute?.line]);
  const mapStops = useMemo(() => {
    const stops: { id: string; label: string; latitude: number; longitude: number }[] = [];
    if (nav.boardingStop) stops.push({ id: `board-${nav.boardingStop.id}`, label: `Embarque · ${nav.boardingStop.name}`, latitude: nav.boardingStop.latitude, longitude: nav.boardingStop.longitude });
    if (nav.alightingStop) stops.push({ id: `alight-${nav.alightingStop.id}`, label: `Desembarque · ${nav.alightingStop.name}`, latitude: nav.alightingStop.latitude, longitude: nav.alightingStop.longitude });
    return stops;
  }, [nav.boardingStop, nav.alightingStop]);

  const mapPath = nav.reroutedPoints ?? activeRoute?.points ?? [];
  const mapCenter = currentLocation ?? activeRoute?.origin ?? { latitude: -23.55052, longitude: -46.633308 };

  const recenter = async () => {
    setRecentering(true);
    try {
      await getCurrentUrbicoLocation();
    } catch (error) {
      Alert.alert("Localização indisponível", error instanceof Error ? error.message : "Não foi possível obter sua localização.");
    } finally {
      setRecentering(false);
    }
  };

  const shareTrip = async () => {
    await Share.share({ message: "Estou acompanhando uma viagem pelo Urbico. Acompanhe meu status pelo aplicativo." });
  };

  const confirmFinish = () => {
    Alert.alert("Encerrar viagem?", "O acompanhamento por GPS será interrompido.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Encerrar", style: "destructive", onPress: () => { nav.cancel(); endTrip(); router.replace("/"); } },
    ]);
  };

  // FIX: sem rota ativa, a tela antes ficava mostrando placeholders vagos
  // ("Aguardando sua rota") em vez de dizer claramente o que fazer — agora
  // orienta a pessoa a planejar uma rota primeiro, sem tela vazia.
  if (!activeRoute) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <MaterialIcons name="map" size={40} color={colors.blue} />
          <Text style={styles.emptyTitle}>Nenhuma viagem em andamento</Text>
          <Text style={styles.emptyText}>Planeje uma rota para começar o acompanhamento passo a passo.</Text>
          <PrimaryButton label="Planejar rota" icon="alt-route" onPress={() => router.replace("/routes")} style={styles.emptyButton} />
        </View>
      </ScreenContainer>
    );
  }

  const stage = stageIndex(nav.phase);
  const instruction =
    nav.phase === "walking_to_stop"
      ? nav.boardingStop
        ? `Caminhe ${formatDistance(nav.distanceToNext)} até o ponto${nav.boardingStop.name ? ` (${nav.boardingStop.name})` : ""}.`
        : "Procurando o ponto de embarque mais próximo da linha selecionada."
      : nav.phase === "waiting_at_stop"
        ? nav.trackedVehicle
          ? `Aguarde no ponto. O ônibus${activeRoute.line ? ` ${activeRoute.line.label}` : ""} está a caminho.`
          : "Aguarde no ponto. Ainda não localizamos um veículo desta linha em tempo real."
        : nav.phase === "on_bus"
          ? nav.alightingStop
            ? `Você está no ônibus. Desembarque perto de ${nav.alightingStop.name}.`
            : "Você está no ônibus. Acompanhando o trajeto."
          : nav.phase === "walking_to_destination"
            ? `Caminhe ${formatDistance(nav.distanceToNext)} até o destino.`
            : "Você chegou ao destino.";

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.mapWrap}>
          <UrbicoMap center={mapCenter} userLocation={currentLocation} path={mapPath} vehicles={mapVehicles} stops={mapStops} />
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable>
            <View style={styles.topBarActions}>
              <Pressable accessibilityLabel={voiceEnabled ? "Silenciar Norby" : "Ativar Norby"} onPress={() => setVoiceEnabled(!voiceEnabled)} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}><MaterialIcons name={voiceEnabled ? "volume-up" : "volume-off"} size={20} color={colors.text} /></Pressable>
              <Pressable accessibilityLabel="Compartilhar viagem" onPress={() => void shareTrip()} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}><MaterialIcons name="share" size={19} color={colors.text} /></Pressable>
            </View>
          </View>
          <Pressable accessibilityLabel="Centralizar localização" onPress={() => void recenter()} style={({ pressed }) => [styles.recenterButton, pressed && styles.pressed]}>
            <MaterialIcons name={recentering ? "hourglass-top" : "my-location"} size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.panel}>
          {statusBanner ? (
            <View style={styles.statusBanner}>
              <MaterialIcons name={statusBanner.icon} size={17} color={colors.warning} />
              <Text style={styles.statusBannerText}>{statusBanner.text}</Text>
            </View>
          ) : null}

          <View style={styles.stageRow}>
            {STAGE_ICONS.map((icon, index) => (
              <View key={icon + index} style={styles.stageItem}>
                <View style={[styles.stageDot, index === stage && styles.stageDotActive, index < stage && styles.stageDotDone]}>
                  <MaterialIcons name={icon} size={16} color={index <= stage ? "#FFFFFF" : colors.muted} />
                </View>
                <Text style={[styles.stageLabel, index === stage && styles.stageLabelActive]}>{STAGE_LABELS[index]}</Text>
                {index < STAGE_ICONS.length - 1 ? <View style={[styles.stageConnector, index < stage && styles.stageConnectorDone]} /> : null}
              </View>
            ))}
          </View>

          <Text style={styles.instruction}>{instruction}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>LINHA</Text>
              <Text style={styles.metaValue}>{activeRoute.line?.label ?? "Sem linha"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>DISTÂNCIA</Text>
              <Text style={styles.metaValue}>{formatDistance(nav.distanceToNext)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>LOTAÇÃO</Text>
              <CrowdLevelBadge level={displayedLevel} count={lineId ? aggregatedCount : undefined} compact />
            </View>
          </View>

          {nav.phase === "waiting_at_stop" ? (
            <SecondaryButton label="Confirmar embarque" icon="check-circle" onPress={nav.confirmBoarding} style={styles.confirmButton} />
          ) : nav.phase === "on_bus" ? (
            <SecondaryButton label="Confirmar desembarque" icon="check-circle" onPress={nav.confirmAlighting} style={styles.confirmButton} />
          ) : null}

          <View style={styles.actions}>
            <SecondaryButton label="Segurança" icon="shield" onPress={() => router.push("/security")} style={{ flex: 1 }} />
            <PrimaryButton label="ENCERRAR" icon="stop-circle" onPress={confirmFinish} style={styles.finishButton} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mapWrap: { flex: 1, position: "relative", backgroundColor: "#07111D" },
  topBar: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  topBarActions: { flexDirection: "row", gap: 8 },
  roundButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(15,26,41,0.85)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  recenterButton: { position: "absolute", right: 14, bottom: 14, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  panel: { padding: 16, paddingBottom: 20, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border },
  statusBanner: { marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: "rgba(255,176,32,0.12)", borderWidth: 1, borderColor: "rgba(255,176,32,0.35)", flexDirection: "row", gap: 8, alignItems: "flex-start" },
  statusBannerText: { flex: 1, color: colors.warning, fontSize: 11, lineHeight: 15 },
  stageRow: { flexDirection: "row", alignItems: "center" },
  stageItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  stageDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stageDotActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  stageDotDone: { backgroundColor: colors.green, borderColor: colors.green },
  stageLabel: { marginLeft: 6, color: colors.muted, fontSize: 10, fontWeight: "700" },
  stageLabelActive: { color: colors.text },
  stageConnector: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  stageConnectorDone: { backgroundColor: colors.green },
  instruction: { marginTop: 16, color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "700" },
  metaRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  metaItem: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  metaLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  metaValue: { marginTop: 4, color: colors.text, fontSize: 13, fontWeight: "700" },
  confirmButton: { marginTop: 14 },
  actions: { marginTop: 14, flexDirection: "row", gap: 10 },
  finishButton: { flex: 1, backgroundColor: colors.red },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 6 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  emptyButton: { marginTop: 14 },
});
