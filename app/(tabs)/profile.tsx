import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { UserAvatar } from "@/components/user-avatar";
import { colors, PrimaryButton, SectionTitle } from "@/components/urbico-ui";
import { confirmAsync } from "@/lib/confirm";
import { useUrbico } from "@/lib/urbico-context";
import { useAuth } from "@/hooks/use-auth";

export default function ProfileScreen() {
  const { notificationsEnabled, voiceEnabled, setVoiceEnabled } = useUrbico();
  const { user, loading, error, isAuthenticated, logout, refresh } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  // FIX (auditoria — mesma causa raiz do botão "limpar conversa" do
  // Norby): Alert.alert com Cancelar/Sair não mostra diálogo na Web, então
  // "Sair" nunca era de fato confirmado ali. Trocado por confirmAsync.
  // Modo visitante: terminar a sessão NÃO leva mais para a tela de login — a
  // pessoa continua no app como visitante.
  const handleLogout = async () => {
    const confirmed = await confirmAsync(
      "Sair da conta",
      "Tem certeza que deseja sair? Seus dados continuam salvos na sua conta.",
      "Sair",
      true,
    );
    if (confirmed) await logout();
  };

  // FIX: removida a seção "Integrações" (Google Agenda) do Perfil, a pedido
  // — não deve mais aparecer na interface. O código da integração
  // (server/integrations/google-calendar.ts, rotas tRPC googleCalendar.*)
  // continua existindo no backend, só sem nenhum ponto de entrada visível
  // no app; pode ser removido de vez ou reativado depois se fizer sentido.

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Text style={styles.title}>Perfil</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir configurações de privacidade"
            hitSlop={10}
            onPress={() => router.push("/settings")}
          >
            <MaterialIcons name="settings" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Quatro estados: carregando, autenticado, erro ao verificar a sessão e visitante. */}
        {loading ? (
          <View style={styles.account} accessibilityLabel="Carregando perfil">
            <ActivityIndicator color={colors.blue} />
            <Text style={styles.accountEmail}>Verificando sua sessão…</Text>
          </View>
        ) : isAuthenticated ? (
          <View style={styles.account}>
            <UserAvatar
              uri={user?.avatarUrl}
              name={user?.name}
              email={user?.email}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{user?.name ?? "Sua conta"}</Text>
              <Text style={styles.accountEmail}>
                {user?.email ?? "Conta Urbico"}
              </Text>
              <View style={styles.plan}>
                <Text style={styles.planText}>Plano Free</Text>
              </View>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.account}>
              <UserAvatar size={70} />
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>Você está como visitante</Text>
                <Text style={styles.accountEmail}>
                  {error
                    ? "Não foi possível verificar sua sessão agora. Você pode continuar usando o app."
                    : "Mapa, linhas, rotas e Norby funcionam sem conta. Entre para guardar seus dados na conta; por enquanto eles ficam só neste aparelho."}
                </Text>
              </View>
            </View>
            {error ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void refresh()}
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Tentar novamente</Text>
              </Pressable>
            ) : null}
            <PrimaryButton
              label="Entrar ou criar conta"
              onPress={() => router.push("/login")}
              style={styles.loginButton}
            />
          </View>
        )}

        <SectionTitle title="Preferências" />
        <View style={styles.list}>
          <ProfileItem
            icon="alt-route"
            title="Rotas"
            subtitle="Opções de deslocamento"
            onPress={() => router.push("/routes")}
          />
          <ProfileItem
            icon="notifications"
            title="Notificações"
            subtitle={
              notificationsEnabled
                ? "Ativadas · escolha o que receber"
                : "Desativadas"
            }
            // Rota nova (app/notifications.tsx): o cast evita erro de tipo
            // enquanto os tipos de rota do Expo Router não são regenerados.
            onPress={() => router.push("/notifications" as never)}
          />
          <View style={styles.switchItem}>
            <View style={styles.itemIcon}>
              <MaterialIcons name="mic" size={21} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Voz do Norby</Text>
              <Text style={styles.itemSubtitle}>
                {voiceEnabled ? "Pronta para usar" : "Desativada"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Voz do Norby"
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
              trackColor={{ false: "#33485C", true: colors.blue }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        <SectionTitle title="Meus dados" />
        <View style={styles.list}>
          <ProfileItem
            icon="history"
            title="Histórico de viagens"
            subtitle="Consulte atividades recentes"
            onPress={() => router.push("/history")}
          />
          <ProfileItem
            icon="place"
            title="Locais salvos"
            subtitle="Casa, trabalho e favoritos"
            onPress={() => router.push("/favorites")}
          />
          <ProfileItem
            icon="event"
            title="Agenda"
            subtitle="Organize seus compromissos"
            onPress={() => router.push("/agenda")}
          />
        </View>
        <SectionTitle title="Segurança e privacidade" />
        <View style={styles.list}>
          <ProfileItem
            icon="shield"
            title="Segurança"
            subtitle="Compartilhamento e emergência"
            onPress={() => router.push("/security")}
          />
          <ProfileItem
            icon="privacy-tip"
            title="Privacidade"
            subtitle="Controle seus dados locais"
            onPress={() => router.push("/settings")}
          />
        </View>
        {isAdmin ? (
          <>
            <SectionTitle title="Administração" />
            <View style={styles.list}>
              <ProfileItem
                icon="admin-panel-settings"
                title="Painel admin"
                subtitle="Usuários, alertas e lotação"
                onPress={() => router.push("/admin")}
              />
            </View>
          </>
        ) : null}
        {isAuthenticated ? (
          <>
            <SectionTitle title="Conta" />
            <View style={styles.list}>
              <ProfileItem
                icon="logout"
                title="Sair da conta"
                subtitle="Você continua usando o app como visitante"
                onPress={() => void handleLogout()}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
function ProfileItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <View style={styles.itemIcon}>
        <MaterialIcons name={icon} size={21} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSubtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={21} color={colors.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 14, paddingBottom: 32 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: colors.text, fontSize: 23, fontWeight: "800" },
  account: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  accountName: { color: colors.text, fontSize: 17, fontWeight: "700" },
  accountEmail: { marginTop: 3, color: colors.muted, fontSize: 12, lineHeight: 17 },
  loginButton: { marginTop: 16 },
  retry: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 6 },
  retryText: { color: colors.blue, fontSize: 13, fontWeight: "700" },
  plan: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: colors.blue,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  list: {
    overflow: "hidden",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  item: {
    minHeight: 67,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  switchItem: {
    minHeight: 67,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#172A40",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  itemSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
