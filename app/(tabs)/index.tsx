import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, InfoCard, PrimaryButton, SectionTitle } from "@/components/urbico-ui";
import { useUrbico } from "@/lib/urbico-context";

export default function HomeScreen() {
  const { favorites, isTripActive } = useUrbico();

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Abrir perfil" onPress={() => router.push("/profile")} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialIcons name="menu" size={23} color={colors.text} />
          </Pressable>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>Urbi<Text style={styles.brandAccent}>co</Text></Text>
            <Text style={styles.tagline}>Mobilidade inteligente para o seu dia.</Text>
          </View>
          <Pressable accessibilityLabel="Abrir configurações" onPress={() => router.push("/profile")} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialIcons name="notifications-none" size={22} color={colors.text} />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        {isTripActive ? (
          <Pressable onPress={() => router.push("/trip")} style={({ pressed }) => [styles.tripNotice, pressed && styles.pressed]}>
            <View style={styles.liveDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tripNoticeTitle}>Sua viagem está em andamento</Text>
              <Text style={styles.tripNoticeText}>Abra o acompanhamento para continuar.</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.blue} />
          </Pressable>
        ) : null}

        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>Olá! <Text style={styles.wave}>●</Text></Text>
          <Text style={styles.greetingText}>Para onde vamos hoje?</Text>
        </View>

        <Pressable onPress={() => router.push("/norby")} style={({ pressed }) => [styles.norbyButton, pressed && styles.pressed]}>
          <View style={styles.norbyAvatar}><MaterialIcons name="smart-toy" size={25} color={colors.cyan} /></View>
          <Text style={styles.norbyButtonText}>FALAR COM NORBY</Text>
          <MaterialIcons name="mic" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.speakHint}>Toque para falar ou escrever</Text>

        <SectionTitle title="Próximos ônibus" action="Ver mapa" onAction={() => router.push("/map")} />
        <InfoCard style={styles.transitState}>
          <View style={styles.busIcon}><MaterialIcons name="directions-bus" size={23} color={colors.blue} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Aguardando atualização</Text>
            <Text style={styles.cardText}>Linha, destino, previsão e lotação aparecerão aqui quando os dados de transporte estiverem conectados.</Text>
          </View>
          <MaterialIcons name="more-horiz" size={22} color={colors.muted} />
        </InfoCard>

        <SectionTitle title="Seus lugares" action="Editar" onAction={() => router.push("/favorites")} />
        <View style={styles.favoriteRow}>
          {favorites.slice(0, 2).map((favorite) => (
            <Pressable key={favorite.id} onPress={() => router.push("/routes")} style={({ pressed }) => [styles.placeCard, pressed && styles.pressed]}>
              <View style={styles.placeIcon}><MaterialIcons name={favorite.label === "Trabalho" ? "business-center" : "home"} size={21} color={colors.blue} /></View>
              <Text style={styles.placeLabel}>{favorite.label}</Text>
              <Text numberOfLines={1} style={styles.placeAddress}>{favorite.address}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push("/favorites")} style={({ pressed }) => [styles.addPlace, pressed && styles.pressed]}>
            <MaterialIcons name="add" size={23} color={colors.blue} />
          </Pressable>
        </View>

        <PrimaryButton label="Planejar uma rota" icon="alt-route" onPress={() => router.push("/routes")} style={styles.planButton} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", position: "relative" },
  brandWrap: { alignItems: "center" },
  brand: { color: colors.text, fontSize: 31, lineHeight: 34, fontWeight: "800", letterSpacing: -1.4 },
  brandAccent: { color: colors.blue },
  tagline: { marginTop: 2, color: colors.muted, fontSize: 11, lineHeight: 15, textAlign: "center" },
  notificationDot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red, borderWidth: 1, borderColor: colors.background },
  greeting: { marginTop: 27 },
  greetingTitle: { color: colors.text, fontSize: 23, lineHeight: 30, fontWeight: "700" },
  wave: { color: colors.amber, fontSize: 17 },
  greetingText: { marginTop: 2, color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: "600" },
  norbyButton: { minHeight: 56, marginTop: 18, paddingHorizontal: 10, borderRadius: 17, backgroundColor: colors.blue, flexDirection: "row", alignItems: "center", gap: 11, shadowColor: colors.blue, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  norbyAvatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: "#0A1B31", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#61D9FF" },
  norbyButtonText: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  speakHint: { marginTop: 7, color: colors.muted, fontSize: 11, textAlign: "center" },
  transitState: { minHeight: 102, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  busIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  cardText: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 17 },
  favoriteRow: { flexDirection: "row", gap: 10 },
  placeCard: { flex: 1, minHeight: 105, padding: 14, borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  placeIcon: { width: 31, height: 31, borderRadius: 9, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  placeLabel: { marginTop: 9, color: colors.text, fontSize: 14, fontWeight: "700" },
  placeAddress: { marginTop: 2, color: colors.muted, fontSize: 11, lineHeight: 15 },
  addPlace: { width: 48, minHeight: 105, borderRadius: 17, borderWidth: 1, borderStyle: "dashed", borderColor: colors.blue, alignItems: "center", justifyContent: "center" },
  planButton: { marginTop: 22 },
  tripNotice: { marginTop: 18, padding: 13, borderRadius: 16, backgroundColor: colors.blueSoft, flexDirection: "row", alignItems: "center", gap: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  tripNoticeTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  tripNoticeText: { marginTop: 2, color: colors.muted, fontSize: 11, lineHeight: 15 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
