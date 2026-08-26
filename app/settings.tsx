import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors } from "@/components/urbico-ui";
import { useUrbico } from "@/lib/urbico-context";
import { enableTravelNotifications } from "@/lib/notifications";

export default function SettingsScreen() {
  const { notificationsEnabled, setNotificationsEnabled, voiceEnabled, setVoiceEnabled } = useUrbico();
  const changeNotificationPreference = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }
    const granted = await enableTravelNotifications();
    setNotificationsEnabled(granted);
    if (!granted) Alert.alert("Permissão necessária", "Autorize notificações nas configurações do dispositivo para receber alertas da viagem.");
  };
  return <ScreenContainer><View style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable><Text style={styles.title}>Configurações</Text><View style={styles.back} /></View><Text style={styles.section}>EXPERIÊNCIA</Text><View style={styles.list}><Toggle icon="notifications" title="Notificações de viagem" enabled={notificationsEnabled} setEnabled={changeNotificationPreference} /><Toggle icon="mic" title="Entrada por voz" enabled={voiceEnabled} setEnabled={setVoiceEnabled} /></View><Text style={styles.section}>PRIVACIDADE</Text><View style={styles.list}><Pressable onPress={() => Alert.alert("Dados locais", "Favoritos, agenda e preferências desta versão são armazenados no dispositivo. Integrações em nuvem serão habilitadas apenas mediante configuração segura.")} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.icon}><MaterialIcons name="privacy-tip" size={21} color={colors.text} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Dados locais</Text><Text style={styles.rowSub}>Saiba como esta versão armazena informações.</Text></View><MaterialIcons name="chevron-right" size={21} color={colors.muted} /></Pressable></View></View></ScreenContainer>;
}
function Toggle({ icon, title, enabled, setEnabled }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; enabled: boolean; setEnabled: (value: boolean) => void | Promise<void> }) { return <View style={styles.row}><View style={styles.icon}><MaterialIcons name={icon} size={21} color={colors.text} /></View><Text style={[styles.rowTitle, { flex: 1 }]}>{title}</Text><Switch value={enabled} onValueChange={(value) => void setEnabled(value)} trackColor={{ false: "#33485C", true: colors.blue }} thumbColor="#FFFFFF" /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, paddingTop: 10 }, header: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, title: { color: colors.text, fontSize: 18, fontWeight: "700" }, section: { marginTop: 25, marginBottom: 9, color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.9 }, list: { overflow: "hidden", borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, row: { minHeight: 68, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderColor: colors.border }, icon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#172A40", alignItems: "center", justifyContent: "center" }, rowTitle: { color: colors.text, fontSize: 14, fontWeight: "700" }, rowSub: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 14 }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] } });
