import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, InfoCard, PrimaryButton } from "@/components/urbico-ui";
import { UrbicoMap } from "@/components/urbico-map";
import { getCurrentUrbicoLocation } from "@/lib/location-service";
import { useUrbico } from "@/lib/urbico-context";
import { trpc } from "@/lib/trpc";

export default function MapScreen() {
  const { activeRoute, currentLocation, setCurrentLocation } = useUrbico();
  const [center, setCenter] = useState({ latitude: -23.55052, longitude: -46.633308 });
  const lineId = activeRoute?.line?.id ?? 1;
  const context = trpc.transit.relevantVehicles.useQuery({ lineIds: [lineId] }, { enabled: Boolean(activeRoute?.line) });
  const selected = context.data?.lines[0];
  const vehicles = useMemo(() => (selected?.vehicles ?? []).map((vehicle) => ({ id: vehicle.prefix, label: `Veículo ${vehicle.prefix}`, latitude: vehicle.latitude, longitude: vehicle.longitude })), [selected?.vehicles]);
  const stops = useMemo(() => (selected?.stops ?? []).map((stop) => ({ id: String(stop.id), label: stop.name, latitude: stop.latitude, longitude: stop.longitude })), [selected?.stops]);
  useEffect(() => { if (currentLocation) setCenter(currentLocation); }, [currentLocation]);
  const locate = async () => {
    try {
      const position = await getCurrentUrbicoLocation();
      setCurrentLocation(position);
      setCenter(position);
    } catch (error) {
      Alert.alert("Localização indisponível", error instanceof Error ? error.message : "Não foi possível obter sua localização.");
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerLeft}><MaterialIcons name="menu" size={23} color={colors.text} /><Text style={styles.headerTitle}>Mapa</Text></View>
          <View style={styles.headerActions}><Pressable accessibilityLabel="Planejar rota" onPress={() => router.push("/routes")}><MaterialIcons name="search" size={22} color={colors.text} /></Pressable><MaterialIcons name="layers" size={21} color={colors.text} /></View>
        </View>

        <View style={styles.mapCanvas}><UrbicoMap center={center} userLocation={currentLocation} path={activeRoute?.points ?? []} vehicles={vehicles} stops={stops} /><Pressable onPress={() => void locate()} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}><MaterialIcons name="my-location" size={23} color={colors.text} /></Pressable></View>

        <InfoCard style={styles.bottomCard}>
          <View style={styles.bottomHeader}><View style={styles.busMini}><MaterialIcons name="directions-bus" size={21} color={colors.blue} /></View><Text style={styles.bottomTitle}>{activeRoute?.line ? `Linha ${activeRoute.line.label}` : "Sem linha selecionada"}</Text></View>
          <Text style={styles.bottomText}>{activeRoute?.line ? context.isFetching ? "Atualizando veículos e paradas da sua linha." : `${vehicles.length} veículo(s) e ${stops.length} parada(s) desta linha estão no mapa. Nenhuma outra linha é exibida.` : "Planeje uma rota e escolha uma linha para ver somente os veículos relevantes ao seu deslocamento."}</Text>
          <View style={styles.bottomActions}>
            <PrimaryButton label="Planejar rota" icon="alt-route" onPress={() => router.push("/routes")} style={{ flex: 1 }} />
            <Pressable accessibilityLabel="Atualizar veículos" onPress={() => void context.refetch()} style={({ pressed }) => [styles.layerButton, pressed && styles.pressed]}><MaterialIcons name="refresh" size={21} color={colors.blue} /></Pressable>
          </View>
        </InfoCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 62, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.background },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 18 }, headerTitle: { color: colors.text, fontSize: 18, fontWeight: "700" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 19 },
  mapCanvas: { flex: 1, backgroundColor: "#07111D", overflow: "hidden", position: "relative", borderTopWidth: 1, borderColor: "#172A3C" },
  locateButton: { position: "absolute", bottom: 22, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  bottomCard: { margin: 14, padding: 16 }, bottomHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, busMini: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, bottomTitle: { color: colors.text, fontSize: 16, fontWeight: "700" }, bottomText: { marginTop: 11, color: colors.muted, fontSize: 12, lineHeight: 18 }, bottomActions: { marginTop: 15, flexDirection: "row", gap: 10, alignItems: "center" }, layerButton: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
