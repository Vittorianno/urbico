import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, PrimaryButton } from "@/components/urbico-ui";
import { type CrowdLevel, useUrbico } from "@/lib/urbico-context";

const levels: { name: CrowdLevel; color: string; note: string }[] = [
  { name: "Vazio", color: colors.green, note: "Há bastante espaço disponível." },
  { name: "Baixa", color: "#8CD46A", note: "Há espaço para embarcar com conforto." },
  { name: "Normal", color: colors.amber, note: "O veículo segue com ocupação usual." },
  { name: "Alta", color: "#F38A45", note: "Há pouco espaço disponível." },
  { name: "Lotado", color: colors.red, note: "O embarque pode estar difícil." },
];

export default function CrowdReportScreen() {
  const [selected, setSelected] = useState<CrowdLevel | null>(null);
  const { addCrowdReport } = useUrbico();
  const submit = () => { if (!selected) return; addCrowdReport(selected); Alert.alert("Relato enviado", "Sua contribuição foi registrada sem identificar você publicamente.", [{ text: "Concluir", onPress: () => router.back() }]); };
  return <ScreenContainer><View style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable><Text style={styles.title}>Lotação</Text><View style={styles.back} /></View><View style={styles.icon}><MaterialIcons name="groups" size={31} color={colors.cyan} /></View><Text style={styles.heading}>Como está o ônibus?</Text><Text style={styles.copy}>O seu relato ajuda outras pessoas. Ele será combinado com relatos recentes e nunca exibirá sua identidade.</Text><View style={styles.levels}>{levels.map((level) => <Pressable key={level.name} onPress={() => setSelected(level.name)} style={({ pressed }) => [styles.level, selected === level.name && { borderColor: level.color, backgroundColor: `${level.color}20` }, pressed && styles.pressed]}><View style={[styles.levelDot, { backgroundColor: level.color }]} /><View style={{ flex: 1 }}><Text style={styles.levelTitle}>{level.name}</Text><Text style={styles.levelNote}>{level.note}</Text></View><MaterialIcons name={selected === level.name ? "check-circle" : "radio-button-unchecked"} size={21} color={selected === level.name ? level.color : colors.muted} /></Pressable>)}</View><PrimaryButton label="ENVIAR RELATO" icon="send" disabled={!selected} onPress={submit} style={styles.submit} /></View></ScreenContainer>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, paddingTop: 10 }, header: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, title: { color: colors.text, fontSize: 18, fontWeight: "700" }, icon: { width: 68, height: 68, borderRadius: 22, marginTop: 27, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: colors.blueSoft }, heading: { marginTop: 20, color: colors.text, fontSize: 24, lineHeight: 31, fontWeight: "800", textAlign: "center" }, copy: { marginTop: 8, color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }, levels: { marginTop: 24, gap: 9 }, level: { minHeight: 61, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 11 }, levelDot: { width: 11, height: 11, borderRadius: 6 }, levelTitle: { color: colors.text, fontSize: 14, fontWeight: "700" }, levelNote: { marginTop: 2, color: colors.muted, fontSize: 10, lineHeight: 14 }, submit: { marginTop: 20 }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] } });
