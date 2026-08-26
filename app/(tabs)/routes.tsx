import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, PrimaryButton, SectionTitle } from "@/components/urbico-ui";
import { useUrbico } from "@/lib/urbico-context";
import { trpc } from "@/lib/trpc";

export default function RoutesScreen() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const { startTrip } = useUrbico();
  const ready = origin.trim().length > 1 && destination.trim().length > 1;
  const routeMutation = trpc.routing.planWalking.useMutation();
  const plannedRoute = routeMutation.data?.route;
  const walkingMinutes = plannedRoute ? Math.max(1, Math.ceil(plannedRoute.durationSeconds / 60)) : null;
  const start = async () => {
    if (!ready) return;
    try {
      const result = await routeMutation.mutateAsync({ origin, destination });
      if (!result?.route) return;
      startTrip();
      router.push("/trip");
    } catch {
      return;
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.top}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable><Text style={styles.title}>Rotas</Text><MaterialIcons name="more-vert" size={23} color={colors.text} /></View>
        <View style={styles.form}><View style={styles.field}><Text style={styles.fieldLabel}>De:</Text><TextInput value={origin} onChangeText={setOrigin} placeholder="Minha localização" placeholderTextColor={colors.muted} style={styles.input} /></View><View style={styles.divider} /><View style={styles.field}><Text style={styles.fieldLabel}>Para:</Text><TextInput value={destination} onChangeText={setDestination} placeholder="Digite um destino" placeholderTextColor={colors.muted} style={styles.input} /></View><Pressable onPress={() => { const previous = origin; setOrigin(destination); setDestination(previous); }} style={({ pressed }) => [styles.swap, pressed && styles.pressed]}><MaterialIcons name="swap-vert" size={19} color={colors.text} /></Pressable></View>
        <View style={styles.modeRow}><View style={styles.modeActive}><MaterialIcons name="directions-bus" size={20} color={colors.blue} /></View><View style={styles.mode}><MaterialIcons name="directions-car" size={20} color={colors.muted} /></View><View style={styles.mode}><MaterialIcons name="directions-walk" size={20} color={colors.muted} /></View></View>
        <SectionTitle title="Opções" />
        <View style={[styles.routeCard, styles.bestRoute]}><View style={styles.routeHeader}><Text style={styles.routeCardTitle}>{plannedRoute ? "Melhor rota a pé" : "Melhor rota"}</Text><Text style={styles.routeCardTime}>{routeMutation.isPending ? "Calculando" : walkingMinutes ? `${walkingMinutes} min` : "Aguardando"}</Text></View><Text style={styles.routeCardText}>{plannedRoute ? `${Math.round(plannedRoute.distanceMeters)} m · ${plannedRoute.instructions.length} instruções para chegar ao destino.` : routeMutation.error ? "Não foi possível calcular esta rota. Revise os endereços e tente novamente." : ready ? "A origem e o destino estão prontos para consulta segura no serviço de rotas." : "Informe origem e destino para organizar caminhada, ônibus e conexões."}</Text><View style={styles.steps}><Step icon="directions-walk" label="Caminhada" /><View style={styles.stepLine} /><Step icon="directions-bus" label="Transporte" /><View style={styles.stepLine} /><Step icon="directions-walk" label="Chegada" /></View></View>
        <View style={styles.routeCard}><Text style={styles.routeCardTitle}>Alternativa 1</Text><Text style={styles.routeCardText}>Rotas alternativas serão exibidas após a disponibilidade de tráfego e transporte.</Text></View>
        <View style={styles.leaveNow}><MaterialIcons name="schedule" size={19} color={colors.muted} /><Text style={styles.leaveText}>Horário de saída será calculado para este trajeto.</Text></View>
        <PrimaryButton label={routeMutation.isPending ? "CALCULANDO ROTA" : plannedRoute ? "INICIAR VIAGEM" : "CALCULAR ROTA"} icon={routeMutation.isPending ? "hourglass-top" : "play-arrow"} disabled={!ready || routeMutation.isPending} onPress={() => void start()} style={styles.start} />
      </ScrollView>
    </ScreenContainer>
  );
}
function Step({ icon, label }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string }) { return <View style={styles.step}><MaterialIcons name={icon} size={19} color="#FFFFFF" /><Text style={styles.stepText}>{label}</Text></View>; }
const styles = StyleSheet.create({ content: { padding: 20, paddingTop: 10, paddingBottom: 30 }, top: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, title: { color: colors.text, fontSize: 18, fontWeight: "700" }, form: { marginTop: 18, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden", position: "relative" }, field: { minHeight: 53, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12 }, fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" }, input: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10 }, divider: { height: 1, marginLeft: 15, backgroundColor: colors.border }, swap: { position: "absolute", right: 12, top: 45, width: 29, height: 29, borderRadius: 15, backgroundColor: "#182C42", alignItems: "center", justifyContent: "center" }, modeRow: { marginTop: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 4, flexDirection: "row", gap: 4 }, mode: { flex: 1, minHeight: 39, borderRadius: 10, alignItems: "center", justifyContent: "center" }, modeActive: { flex: 1, minHeight: 39, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.blueSoft }, routeCard: { marginTop: 11, borderRadius: 17, padding: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, bestRoute: { backgroundColor: "#073778", borderColor: colors.blue }, routeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, routeCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" }, routeCardTime: { color: colors.cyan, fontSize: 13, fontWeight: "800" }, routeCardText: { marginTop: 7, color: colors.muted, fontSize: 12, lineHeight: 18 }, steps: { marginTop: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, step: { width: 66, alignItems: "center", gap: 4 }, stepText: { color: "#DDF4FF", fontSize: 10, fontWeight: "600", textAlign: "center" }, stepLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.35)", marginBottom: 17 }, leaveNow: { marginTop: 15, padding: 13, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 9 }, leaveText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 }, start: { marginTop: 18 }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] } });
