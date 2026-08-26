import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, InfoCard, PrimaryButton } from "@/components/urbico-ui";

export default function MapScreen() {
  const [selectedLayer, setSelectedLayer] = useState<"paradas" | "veículos" | null>(null);

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerLeft}><MaterialIcons name="menu" size={23} color={colors.text} /><Text style={styles.headerTitle}>Mapa</Text></View>
          <View style={styles.headerActions}><MaterialIcons name="search" size={22} color={colors.text} /><MaterialIcons name="layers" size={21} color={colors.text} /></View>
        </View>

        <View style={styles.mapCanvas}>
          <View style={[styles.road, styles.roadA]} /><View style={[styles.road, styles.roadB]} /><View style={[styles.road, styles.roadC]} /><View style={[styles.road, styles.roadD]} />
          <View style={styles.routeLineOne} /><View style={styles.routeLineTwo} /><View style={styles.routeLineThree} />
          <View style={[styles.routeNode, styles.nodeOne]} /><View style={[styles.routeNode, styles.nodeTwo]} /><View style={[styles.routeNode, styles.nodeThree]} />
          <Pressable onPress={() => setSelectedLayer("veículos")} style={({ pressed }) => [styles.busMarker, styles.busOne, pressed && styles.pressed]}><MaterialIcons name="directions-bus" size={18} color="#FFFFFF" /></Pressable>
          <Pressable onPress={() => setSelectedLayer("paradas")} style={({ pressed }) => [styles.busMarker, styles.busTwo, pressed && styles.pressed]}><MaterialIcons name="directions-bus" size={18} color="#FFFFFF" /></Pressable>
          <View style={styles.positionMarker}><View style={styles.positionCore} /></View>
          <Pressable onPress={() => setSelectedLayer(null)} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}><MaterialIcons name="my-location" size={23} color={colors.text} /></Pressable>
        </View>

        <InfoCard style={styles.bottomCard}>
          <View style={styles.bottomHeader}><View style={styles.busMini}><MaterialIcons name="directions-bus" size={21} color={colors.blue} /></View><Text style={styles.bottomTitle}>{selectedLayer ? `Camada: ${selectedLayer}` : "Dados em conexão"}</Text></View>
          <Text style={styles.bottomText}>{selectedLayer ? "A seleção exibirá linha, destino, previsão, distância e lotação quando os dados oficiais estiverem disponíveis." : "O mapa ficará pronto para mostrar sua posição, paradas, ônibus e a rota selecionada assim que você autorizar a localização e conectar o transporte."}</Text>
          <View style={styles.bottomActions}>
            <PrimaryButton label="Planejar rota" icon="alt-route" onPress={() => router.push("/routes")} style={{ flex: 1 }} />
            <Pressable onPress={() => setSelectedLayer(selectedLayer === "paradas" ? null : "paradas")} style={({ pressed }) => [styles.layerButton, pressed && styles.pressed]}><MaterialIcons name="layers" size={21} color={colors.blue} /></Pressable>
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
  road: { position: "absolute", backgroundColor: "#142438", opacity: 0.9 }, roadA: { width: 610, height: 18, top: 120, left: -90, transform: [{ rotate: "-25deg" }] }, roadB: { width: 620, height: 25, top: 250, left: -120, transform: [{ rotate: "27deg" }] }, roadC: { width: 20, height: 620, top: -100, left: 180, transform: [{ rotate: "18deg" }] }, roadD: { width: 20, height: 620, top: -80, right: 70, transform: [{ rotate: "-27deg" }] },
  routeLineOne: { position: "absolute", width: 6, height: 145, borderRadius: 4, backgroundColor: colors.blue, top: 82, left: "51%", transform: [{ rotate: "33deg" }] }, routeLineTwo: { position: "absolute", width: 6, height: 132, borderRadius: 4, backgroundColor: colors.blue, top: 215, left: "57%", transform: [{ rotate: "-25deg" }] }, routeLineThree: { position: "absolute", width: 6, height: 120, borderRadius: 4, backgroundColor: colors.blue, top: 315, left: "44%", transform: [{ rotate: "11deg" }] },
  routeNode: { position: "absolute", width: 15, height: 15, borderRadius: 8, backgroundColor: colors.blue, borderWidth: 3, borderColor: "#9CEBFF" }, nodeOne: { top: 155, left: "56%" }, nodeTwo: { top: 270, left: "52%" }, nodeThree: { top: 394, left: "49%" },
  busMarker: { position: "absolute", width: 36, height: 36, borderRadius: 10, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#74E4FF" }, busOne: { top: 95, right: 55 }, busTwo: { top: 310, left: 58 },
  positionMarker: { position: "absolute", top: 185, left: "38%", width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,124,255,0.28)", alignItems: "center", justifyContent: "center" }, positionCore: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.blue, borderWidth: 2, borderColor: "#FFFFFF" },
  locateButton: { position: "absolute", bottom: 22, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  bottomCard: { margin: 14, padding: 16 }, bottomHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, busMini: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, bottomTitle: { color: colors.text, fontSize: 16, fontWeight: "700" }, bottomText: { marginTop: 11, color: colors.muted, fontSize: 12, lineHeight: 18 }, bottomActions: { marginTop: 15, flexDirection: "row", gap: 10, alignItems: "center" }, layerButton: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
