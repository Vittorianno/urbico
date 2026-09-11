import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, InfoCard, SecondaryButton } from "@/components/urbico-ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

/**
 * Painel administrativo mínimo (Fase 12 do plano de auditoria). Deliberadamente
 * pequeno e dentro do próprio app (não um dashboard web separado) - o Urbico
 * ainda tem um único administrador (o dono do projeto), e o pedido explícito
 * era "não criar um painel gigantesco sem necessidade" e respeitar uma
 * experiência adequada para mobile. Cresce por aqui conforme a necessidade
 * real aparecer (moderação de relatos, mais métricas), não antes.
 */
export default function AdminScreen() {
  const { user, isAuthenticated } = useAuth();
  const overviewQuery = trpc.admin.overview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60_000,
  });
  const notifyOwnerMutation = trpc.system.notifyOwner.useMutation();

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <ScreenContainer>
        <View style={styles.deniedScreen}>
          <MaterialIcons name="lock" size={34} color={colors.muted} />
          <Text style={styles.deniedTitle}>Acesso restrito</Text>
          <Text style={styles.deniedText}>Esta área é só para administradores do Urbico.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const data = overviewQuery.data;

  const sendTestNotice = () => {
    notifyOwnerMutation.mutate(
      { title: "Teste do painel admin", content: "Notificação de teste disparada pelo painel administrativo do Urbico." },
      {
        onSuccess: (result) => Alert.alert(result.success ? "Enviado" : "Não entregue", result.success ? "Notificação de teste enviada." : "O canal de notificação não está configurado ou falhou."),
        onError: (error) => Alert.alert("Erro", error.message),
      },
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.text} /></Pressable>
          <Text style={styles.title}>Painel admin</Text>
          <View style={styles.back} />
        </View>

        {overviewQuery.isLoading ? (
          <ActivityIndicator color={colors.blue} style={styles.loading} />
        ) : overviewQuery.error ? (
          <InfoCard style={styles.errorCard}><Text style={styles.errorText}>Não foi possível carregar os dados agora.</Text></InfoCard>
        ) : (
          <View style={styles.grid}>
            <StatCard icon="group" label="Usuários" value={data?.totalUsers ?? 0} hint={`${data?.adminUsers ?? 0} admin(s)`} />
            <StatCard icon="person-pin-circle" label="Ativos (7 dias)" value={data?.activeUsersLast7d ?? 0} />
            <StatCard icon="alarm-on" label="Alertas de saída ativos" value={data?.armedDepartureAlerts ?? 0} />
            <StatCard icon="groups" label="Relatos de lotação (24h)" value={data?.crowdReportsLast24h ?? 0} />
          </View>
        )}

        <Text style={styles.sectionLabel}>LINHAS MAIS RELATADAS (24H)</Text>
        {data && data.topLinesLast24h.length > 0 ? (
          <View style={styles.list}>
            {data.topLinesLast24h.map((row) => (
              <View key={row.lineId} style={styles.listRow}>
                <Text style={styles.listLine}>Linha {row.lineId}</Text>
                <Text style={styles.listCount}>{row.reports} relato{row.reports === 1 ? "" : "s"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Sem relatos de lotação nas últimas 24 horas.</Text>
        )}

        <Text style={styles.sectionLabel}>AÇÕES</Text>
        <SecondaryButton
          label={notifyOwnerMutation.isPending ? "Enviando…" : "Enviar notificação de teste"}
          icon="send"
          onPress={sendTestNotice}
          style={styles.action}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: number; hint?: string }) {
  return (
    <InfoCard style={styles.stat}>
      <MaterialIcons name={icon} size={20} color={colors.cyan} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 10, paddingBottom: 30 },
  header: { height: 50, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  deniedScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },
  deniedTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  deniedText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  loading: { marginTop: 40 },
  errorCard: { marginTop: 20 },
  errorText: { color: colors.muted, fontSize: 13 },
  grid: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "47%", padding: 14, gap: 4 },
  statValue: { marginTop: 6, color: colors.text, fontSize: 22, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  statHint: { color: colors.muted, fontSize: 10 },
  sectionLabel: { marginTop: 22, marginBottom: 8, color: colors.cyan, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  list: { overflow: "hidden", borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  listRow: { minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.border },
  listLine: { color: colors.text, fontSize: 13, fontWeight: "700" },
  listCount: { color: colors.muted, fontSize: 12 },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: "center" },
  action: { marginTop: 4 },
  pressed: { opacity: 0.7 },
});
