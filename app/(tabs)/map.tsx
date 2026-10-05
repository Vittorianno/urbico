import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, InfoCard, PrimaryButton } from "@/components/urbico-ui";
import { UrbicoMap } from "@/components/urbico-map";
import { analytics } from "@/lib/analytics";
import { getCurrentUrbicoLocation } from "@/lib/location-service";
import { useUrbico } from "@/lib/urbico-context";
import { trpc } from "@/lib/trpc";

export default function MapScreen() {
  const { activeRoute, currentLocation, setCurrentLocation } = useUrbico();
  const [center, setCenter] = useState({
    latitude: -23.55052,
    longitude: -46.633308,
  });
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showTransit, setShowTransit] = useState(true);
  const lineId = activeRoute?.line?.id ?? 1;
  const context = trpc.transit.relevantVehicles.useQuery(
    { lineIds: [lineId] },
    { enabled: Boolean(activeRoute?.line) },
  );
  const selected = context.data?.lines[0];
  const vehicles = useMemo(
    () =>
      (selected?.vehicles ?? []).map((vehicle) => ({
        id: vehicle.prefix,
        label: `Veículo ${vehicle.prefix}`,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
      })),
    [selected?.vehicles],
  );
  const stops = useMemo(
    () =>
      (selected?.stops ?? []).map((stop) => ({
        id: String(stop.id),
        label: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
    [selected?.stops],
  );
  const mapCenter = currentLocation ?? center;
  // FIX (analytics): map_opened uma vez por montagem da tela — ver
  // docs/analytics.md.
  useEffect(() => {
    analytics.track("map_opened");
  }, []);
  const locate = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const position = await getCurrentUrbicoLocation();
      setCurrentLocation(position);
      setCenter(position);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível obter sua localização.";
      setLocationError(message);
      Alert.alert("Localização indisponível", message);
    } finally {
      setLocationLoading(false);
    }
  }, [setCurrentLocation]);
  useEffect(() => {
    if (currentLocation) return;
    // A solicitação acessa uma API externa e atualiza loading/erro conforme
    // a permissão e o GPS respondem.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void locate();
    // A localização é solicitada uma vez na abertura; o botão continua
    // disponível para repetir a tentativa sem recriar a tela.
  }, [currentLocation, locate]);

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.header}>
          {/* FIX: o ícone de menu parecia clicável (igual ao da Home, que
              abre o Perfil), mas não tinha nenhuma ação aqui — agora leva
              para /profile, consistente com o resto do app. */}
          <Pressable
            accessibilityLabel="Abrir perfil"
            onPress={() => router.push("/profile")}
            style={styles.headerLeft}
          >
            <MaterialIcons name="menu" size={23} color={colors.text} />
            <Text style={styles.headerTitle}>Mapa</Text>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Planejar rota"
              onPress={() => router.push("/routes")}
            >
              <MaterialIcons name="search" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityLabel={
                showTransit ? "Ocultar transporte" : "Mostrar transporte"
              }
              onPress={() => setShowTransit((visible) => !visible)}
            >
              <MaterialIcons
                name="layers"
                size={21}
                color={showTransit ? colors.blue : colors.muted}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.mapCanvas}>
          <UrbicoMap
            center={mapCenter}
            userLocation={currentLocation}
            path={activeRoute?.points ?? []}
            vehicles={showTransit ? vehicles : []}
            stops={showTransit ? stops : []}
          />
          <Text style={styles.attribution}>
            © OpenStreetMap contributors · OpenFreeMap
          </Text>
          {!currentLocation ? (
            <View pointerEvents="none" style={styles.mapHint}>
              <Text style={styles.mapHintText}>
                {locationLoading
                  ? "Localizando você…"
                  : "Mapa centrado em São Paulo"}
              </Text>
            </View>
          ) : null}
          {locationError && !locationLoading ? (
            <Text style={styles.locationError}>{locationError}</Text>
          ) : null}
          <View style={styles.mapControls}>
            <Pressable
              accessibilityLabel={
                showTransit ? "Ocultar transporte" : "Mostrar transporte"
              }
              onPress={() => setShowTransit((visible) => !visible)}
              style={({ pressed }) => [
                styles.mapControl,
                showTransit && styles.mapControlActive,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name="layers"
                size={21}
                color={showTransit ? colors.blue : colors.text}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Minha localização"
              onPress={() => void locate()}
              style={({ pressed }) => [
                styles.mapControl,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="my-location" size={21} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <InfoCard style={styles.bottomCard}>
          <View style={styles.bottomHeader}>
            <View style={styles.busMini}>
              <MaterialIcons
                name="directions-bus"
                size={21}
                color={colors.blue}
              />
            </View>
            <Text style={styles.bottomTitle}>
              {activeRoute?.line
                ? `Linha ${activeRoute.line.label}`
                : "Sem linha selecionada"}
            </Text>
          </View>
          <Text style={styles.bottomText}>
            {activeRoute?.line
              ? context.isFetching
                ? "Atualizando veículos e paradas da sua linha."
                : `${vehicles.length} veículo(s) e ${stops.length} parada(s) desta linha estão no mapa. Nenhuma outra linha é exibida.`
              : "Planeje uma rota e escolha uma linha para ver somente os veículos relevantes ao seu deslocamento."}
          </Text>
          <View style={styles.bottomActions}>
            <PrimaryButton
              label="Planejar rota"
              icon="alt-route"
              onPress={() => router.push("/routes")}
              style={{ flex: 1 }}
            />
            <Pressable
              accessibilityLabel="Atualizar veículos"
              onPress={() => void context.refetch()}
              style={({ pressed }) => [
                styles.layerButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="refresh" size={21} color={colors.blue} />
            </Pressable>
          </View>
        </InfoCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 62,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 18 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 19 },
  mapCanvas: {
    flex: 1,
    minHeight: 320,
    backgroundColor: "#07111D",
    overflow: "hidden",
    position: "relative",
    borderTopWidth: 1,
    borderColor: "#172A3C",
  },
  attribution: {
    position: "absolute",
    left: 8,
    bottom: 7,
    color: "#294057",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontSize: 9,
  },
  mapHint: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(8,19,31,0.84)",
  },
  mapHintText: { color: colors.text, fontSize: 11 },
  locationError: {
    position: "absolute",
    left: 12,
    right: 82,
    bottom: 10,
    color: colors.red,
    backgroundColor: "rgba(8,19,31,0.88)",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 10,
  },
  mapControls: { position: "absolute", bottom: 22, right: 20, gap: 8 },
  mapControl: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControlActive: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  bottomCard: { margin: 14, padding: 16 },
  bottomHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  busMini: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  bottomText: {
    marginTop: 11,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  bottomActions: {
    marginTop: 15,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  layerButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
