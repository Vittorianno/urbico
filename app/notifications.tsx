import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, SectionTitle } from "@/components/urbico-ui";
import { useAuth } from "@/hooks/use-auth";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-preferences";
import {
  enableTravelNotifications,
  getNotificationPermissionStatus,
  type NotificationPermissionStatus,
} from "@/lib/notifications";
import { useSyncStatus } from "@/lib/sync-status";
import { useUrbico } from "@/lib/urbico-context";

// Tela "Notificações" (acessível pelo Perfil). Duas coisas distintas, de
// propósito separadas na interface:
// 1) a PREFERÊNCIA do usuário dentro do app (chave geral + categorias);
// 2) a PERMISSÃO concedida pelo sistema operacional/navegador.
// Hoje todas as notificações são LOCAIS (geradas no aparelho); não existe
// envio push remoto — a tela não afirma o contrário.
export default function NotificationsScreen() {
  const { notificationsEnabled, setNotificationsEnabled, notificationPreferences, setNotificationPreference } = useUrbico();
  const { isAuthenticated } = useAuth();
  const syncStatus = useSyncStatus();
  const [permission, setPermission] = useState<NotificationPermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);

  const refreshPermission = useCallback(async () => {
    setPermission(await getNotificationPermissionStatus());
  }, []);

  useEffect(() => {
    void refreshPermission();
    // Ao voltar das configurações do sistema, relê a permissão.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPermission();
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  const closeScreen = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const toggleMaster = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }
    // Só pede a permissão do sistema aqui, a partir de um toque do usuário.
    setRequesting(true);
    const granted = await enableTravelNotifications();
    setNotificationsEnabled(true);
    setRequesting(false);
    await refreshPermission();
    if (!granted) {
      // A preferência fica ligada, mas a tela deixa claro (abaixo) que o
      // sistema ainda não autorizou — nada é "simulado" como entregue.
    }
  };

  const permissionBlocked = permission === "denied";
  const permissionPending = permission === "undetermined";
  const permissionUnsupported = permission === "unsupported";

  const saveMessage = !isAuthenticated
    ? "Suas escolhas ficam salvas só neste aparelho. Entre na sua conta para guardá-las nela."
    : syncStatus === "saving"
      ? "Salvando na sua conta…"
      : syncStatus === "error"
        ? "Não foi possível salvar na conta agora. Suas escolhas estão salvas neste aparelho e serão enviadas depois."
        : syncStatus === "saved"
          ? "Salvo na sua conta."
          : "Suas escolhas são guardadas na sua conta.";

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={closeScreen} hitSlop={10} style={styles.back}>
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Notificações</Text>
          <View style={styles.back} />
        </View>

        <SectionTitle title="Permissão do sistema" />
        <View style={styles.card}>
          <View style={styles.row}>
            <MaterialIcons
              name={permission === "granted" ? "check-circle" : "info-outline"}
              size={22}
              color={permission === "granted" ? colors.green : colors.muted}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>
                {permission === null
                  ? "Verificando…"
                  : permission === "granted"
                    ? "Autorizadas no dispositivo"
                    : permissionBlocked
                      ? "Bloqueadas no dispositivo"
                      : permissionUnsupported
                        ? "Indisponíveis neste ambiente"
                        : "Ainda não autorizadas"}
              </Text>
              <Text style={styles.itemSubtitle}>
                {permissionBlocked
                  ? Platform.OS === "web"
                    ? "O navegador bloqueou as notificações deste site. Libere nas configurações do site no navegador para receber avisos."
                    : "As notificações do Urbico estão bloqueadas nas configurações do aparelho. Ative lá para receber avisos."
                  : permissionPending
                    ? "Ao ligar as notificações abaixo, o sistema vai pedir sua autorização."
                    : permissionUnsupported
                      ? "Este aparelho ou navegador não oferece notificações para o app."
                      : permission === "granted"
                        ? "O sistema permite que o Urbico mostre avisos. O que você recebe depende das escolhas abaixo."
                        : ""}
              </Text>
            </View>
          </View>
          {permissionBlocked && Platform.OS !== "web" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>Abrir configurações do aparelho</Text>
            </Pressable>
          ) : null}
        </View>

        <SectionTitle title="Receber notificações" />
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Notificações do Urbico</Text>
              <Text style={styles.itemSubtitle}>
                {notificationsEnabled ? "Ativadas — escolha abaixo o que receber" : "Desativadas — nenhum aviso será mostrado"}
              </Text>
            </View>
            {requesting ? (
              <ActivityIndicator color={colors.blue} />
            ) : (
              <Switch
                accessibilityLabel="Notificações do Urbico"
                value={notificationsEnabled}
                onValueChange={(value) => void toggleMaster(value)}
                trackColor={{ false: "#33485C", true: colors.blue }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>
        </View>

        <SectionTitle title="O que receber" />
        <View style={styles.card}>
          {NOTIFICATION_CATEGORIES.map((category, index) => (
            <View key={category.id} style={[styles.switchRow, index > 0 && styles.divider, !notificationsEnabled && styles.disabled]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{category.title}</Text>
                <Text style={styles.itemSubtitle}>{category.description}</Text>
              </View>
              <Switch
                accessibilityLabel={category.title}
                disabled={!notificationsEnabled}
                value={notificationPreferences[category.id]}
                onValueChange={(value) => setNotificationPreference(category.id, value)}
                trackColor={{ false: "#33485C", true: colors.blue }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        <Text style={styles.status} accessibilityLiveRegion="polite">
          {saveMessage}
        </Text>

        <Text style={styles.note}>
          Hoje o Urbico envia apenas avisos locais, gerados no próprio aparelho — não há envio push remoto. Interrupções de linhas, linhas e paradas favoritas e lembretes pessoais ainda não estão disponíveis, por isso não aparecem como opção.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 14, paddingBottom: 32 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  card: {
    overflow: "hidden",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  divider: { borderTopWidth: 1, borderColor: colors.border, marginTop: 12, paddingTop: 12 },
  disabled: { opacity: 0.5 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  itemSubtitle: { marginTop: 2, color: colors.muted, fontSize: 11, lineHeight: 16 },
  linkButton: { marginTop: 12, alignSelf: "flex-start", paddingVertical: 6 },
  linkText: { color: colors.blue, fontSize: 13, fontWeight: "700" },
  status: { marginTop: 14, color: colors.muted, fontSize: 12, lineHeight: 17 },
  note: { marginTop: 14, color: colors.muted, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
