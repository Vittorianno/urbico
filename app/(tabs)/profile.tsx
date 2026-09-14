import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, SectionTitle } from "@/components/urbico-ui";
import { useUrbico } from "@/lib/urbico-context";
import { enableTravelNotifications } from "@/lib/notifications";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

// FIX: o redirecionamento final do callback do Google (server/_core/google-calendar-routes.ts)
// volta para dentro do app via deep link (urbico://google-calendar?status=...).
// `URL`/`URLSearchParams` não são garantidos no runtime do React Native, então
// extrai o parâmetro com uma regex simples em vez de depender deles.
function extractQueryParam(url: string, key: string): string | null {
  const match = new RegExp(`[?&]${key}=([^&]*)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ProfileScreen() {
  const { notificationsEnabled, setNotificationsEnabled, voiceEnabled, setVoiceEnabled } = useUrbico();
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";
  const utils = trpc.useUtils();
  const googleStatus = trpc.googleCalendar.status.useQuery(undefined, { enabled: isAuthenticated });
  const authUrlMutation = trpc.googleCalendar.getAuthUrl.useMutation();
  const disconnectMutation = trpc.googleCalendar.disconnect.useMutation();

  const changeNotificationPreference = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }
    const granted = await enableTravelNotifications();
    setNotificationsEnabled(granted);
    if (!granted) Alert.alert("Permissão necessária", "Autorize notificações nas configurações do dispositivo para receber alertas da viagem.");
  };
  const handleAccountPress = () => {
    if (isAuthenticated) {
      Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: () => void logout() },
      ]);
    } else {
      router.push("/login");
    }
  };

  // FIX (ponto único de login): "Google Agenda" só é interativo quando a
  // pessoa já está logada no Urbico. Antes, tocar nesse item sem estar
  // logado abria um Alert + navegava para /login por conta própria — o que,
  // mesmo levando ao mesmo /login de sempre, criava um segundo *gatilho* de
  // autenticação dentro da integração. Agora, sem sessão, o item é só
  // informativo (desabilitado); a única forma de entrar continua sendo o
  // cartão de conta lá em cima.
  const connectGoogleCalendar = async () => {
    try {
      const { url } = await authUrlMutation.mutateAsync();
      const result = await WebBrowser.openAuthSessionAsync(url, "urbico://google-calendar");
      if (result.type !== "success") return;
      const status = extractQueryParam(result.url, "status");
      if (status === "connected") {
        await utils.googleCalendar.status.invalidate();
        Alert.alert("Google Agenda conectado", "A partir de agora, compromissos criados no Urbico podem ser enviados para o seu Google Agenda.");
      } else {
        Alert.alert("Não foi possível conectar", "A conexão com o Google Agenda não foi concluída. Tente novamente.");
      }
    } catch (error) {
      Alert.alert("Não foi possível conectar", error instanceof Error ? error.message : "Tente novamente em instantes.");
    }
  };

  const disconnectGoogleCalendar = () => {
    Alert.alert("Desconectar Google Agenda", "O Urbico para de enviar novos compromissos para o Google. Os eventos já sincronizados continuam lá normalmente.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desconectar",
        style: "destructive",
        onPress: async () => {
          await disconnectMutation.mutateAsync();
          await utils.googleCalendar.status.invalidate();
        },
      },
    ]);
  };

  const googleConnected = Boolean(googleStatus.data?.connected);
  const googleSubtitle = !isAuthenticated
    ? "Entre na sua conta acima para conectar"
    : authUrlMutation.isPending
      ? "Abrindo..."
      : googleConnected
        ? "Conectado · toque para desconectar"
        : "Não conectado · toque para conectar";

  return <ScreenContainer><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.top}><Text style={styles.title}>Perfil</Text><MaterialIcons name="settings" size={22} color={colors.text} /></View><Pressable onPress={handleAccountPress} style={({ pressed }) => [styles.account, pressed && styles.pressed]}><View style={styles.avatar}><MaterialIcons name="person" size={38} color={colors.cyan} /></View><View style={{ flex: 1 }}><Text style={styles.accountName}>{isAuthenticated ? (user?.name ?? "Sua conta") : "Fazer login"}</Text><Text style={styles.accountEmail}>{isAuthenticated ? (user?.email ?? "Personalize suas preferências") : "Entre para sincronizar seus dados"}</Text>{isAuthenticated ? <View style={styles.plan}><Text style={styles.planText}>Plano Free</Text></View> : null}</View>{isAuthenticated ? <MaterialIcons name="logout" size={20} color={colors.muted} /> : <MaterialIcons name="chevron-right" size={21} color={colors.muted} />}</Pressable><SectionTitle title="Preferências" /><View style={styles.list}><ProfileItem icon="alt-route" title="Rotas" subtitle="Opções de deslocamento" onPress={() => router.push("/routes")} /><View style={styles.switchItem}><View style={styles.itemIcon}><MaterialIcons name="notifications" size={21} color={colors.text} /></View><View style={{ flex: 1 }}><Text style={styles.itemTitle}>Notificações</Text><Text style={styles.itemSubtitle}>{notificationsEnabled ? "Ativadas" : "Desativadas"}</Text></View><Switch value={notificationsEnabled} onValueChange={(value) => void changeNotificationPreference(value)} trackColor={{ false: "#33485C", true: colors.blue }} thumbColor="#FFFFFF" /></View><View style={styles.switchItem}><View style={styles.itemIcon}><MaterialIcons name="mic" size={21} color={colors.text} /></View><View style={{ flex: 1 }}><Text style={styles.itemTitle}>Voz do Norby</Text><Text style={styles.itemSubtitle}>{voiceEnabled ? "Pronta para usar" : "Desativada"}</Text></View><Switch value={voiceEnabled} onValueChange={setVoiceEnabled} trackColor={{ false: "#33485C", true: colors.blue }} thumbColor="#FFFFFF" /></View></View><SectionTitle title="Integrações" /><View style={styles.list}><Pressable onPress={!isAuthenticated ? undefined : googleConnected ? disconnectGoogleCalendar : () => void connectGoogleCalendar()} disabled={!isAuthenticated || authUrlMutation.isPending} style={({ pressed }) => [styles.item, pressed && styles.pressed, !isAuthenticated && styles.itemDisabled]}><View style={styles.itemIcon}><MaterialIcons name="event" size={21} color={colors.text} /></View><View style={{ flex: 1 }}><Text style={styles.itemTitle}>Google Agenda</Text><Text style={styles.itemSubtitle}>{googleSubtitle}</Text></View>{googleConnected ? <View style={styles.connectedDot} /> : isAuthenticated ? <MaterialIcons name="chevron-right" size={21} color={colors.muted} /> : null}</Pressable></View><SectionTitle title="Meus dados" /><View style={styles.list}><ProfileItem icon="history" title="Histórico de viagens" subtitle="Consulte atividades recentes" onPress={() => router.push("/history")} /><ProfileItem icon="place" title="Locais salvos" subtitle="Casa, trabalho e favoritos" onPress={() => router.push("/favorites")} /><ProfileItem icon="event" title="Agenda" subtitle="Organize seus compromissos" onPress={() => router.push("/agenda")} /></View><SectionTitle title="Segurança e privacidade" /><View style={styles.list}><ProfileItem icon="shield" title="Segurança" subtitle="Compartilhamento e emergência" onPress={() => router.push("/security")} /><ProfileItem icon="privacy-tip" title="Privacidade" subtitle="Controle seus dados locais" onPress={() => router.push("/settings")} /></View>{isAdmin ? <><SectionTitle title="Administração" /><View style={styles.list}><ProfileItem icon="admin-panel-settings" title="Painel admin" subtitle="Usuários, alertas e lotação" onPress={() => router.push("/admin")} /></View></> : null}</ScrollView></ScreenContainer>;
}
function ProfileItem({ icon, title, subtitle, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; subtitle: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}><View style={styles.itemIcon}><MaterialIcons name={icon} size={21} color={colors.text} /></View><View style={{ flex: 1 }}><Text style={styles.itemTitle}>{title}</Text><Text style={styles.itemSubtitle}>{subtitle}</Text></View><MaterialIcons name="chevron-right" size={21} color={colors.muted} /></Pressable>; }
const styles = StyleSheet.create({ content: { padding: 20, paddingTop: 14, paddingBottom: 32 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.text, fontSize: 23, fontWeight: "800" }, account: { marginTop: 22, flexDirection: "row", alignItems: "center", gap: 14 }, avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.blue }, accountName: { color: colors.text, fontSize: 17, fontWeight: "700" }, accountEmail: { marginTop: 3, color: colors.muted, fontSize: 12 }, plan: { marginTop: 8, alignSelf: "flex-start", borderRadius: 8, backgroundColor: colors.blue, paddingHorizontal: 8, paddingVertical: 3 }, planText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" }, list: { overflow: "hidden", borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, item: { minHeight: 67, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderColor: colors.border }, itemDisabled: { opacity: 0.55 }, switchItem: { minHeight: 67, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderColor: colors.border }, itemIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#172A40", alignItems: "center", justifyContent: "center" }, itemTitle: { color: colors.text, fontSize: 14, fontWeight: "700" }, itemSubtitle: { marginTop: 2, color: colors.muted, fontSize: 10, lineHeight: 14 }, connectedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.green }, pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] } });
