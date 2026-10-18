import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BackHeader, InfoCard, PrimaryButton, SectionTitle } from "@/components/urbico-ui";
import { colors } from "@/components/urbico-ui";

const plannedBenefits = [
  { icon: "notifications-active" as const, title: "Alertas avançados", description: "Preferências e alertas de mobilidade configuráveis." },
  { icon: "route" as const, title: "Planejamento ampliado", description: "Ferramentas adicionais para organizar deslocamentos." },
  { icon: "support-agent" as const, title: "Experiência Norby ampliada", description: "Recursos adicionais do assistente, quando implementados e validados." },
];

export default function PremiumScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackHeader title="Urbico Premium" subtitle="Mais recursos para sua mobilidade" />

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="workspace-premium" size={36} color={colors.cyan} />
          </View>
          <Text style={styles.eyebrow}>PLANOS URBICO</Text>
          <Text style={styles.heroTitle}>Sua mobilidade, com mais possibilidades.</Text>
          <Text style={styles.heroDescription}>
            Estamos estruturando os recursos Premium. O plano pago ainda não está habilitado neste app.
          </Text>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Assinaturas indisponíveis no momento</Text>
          </View>
        </View>

        <SectionTitle title="O que está sendo planejado" />
        <View style={styles.benefits}>
          {plannedBenefits.map((benefit) => (
            <View key={benefit.title} style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <MaterialIcons name={benefit.icon} size={22} color={colors.cyan} />
              </View>
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionTitle title="Transparência" />
        <InfoCard>
          <View style={styles.transparencyRow}>
            <MaterialIcons name="verified-user" size={22} color={colors.green} />
            <Text style={styles.transparencyText}>
              Nenhuma cobrança é feita nesta tela. Não há checkout, assinatura ou desbloqueio Premium ativo ainda.
            </Text>
          </View>
          <View style={styles.transparencyRow}>
            <MaterialIcons name="lock-outline" size={22} color={colors.cyan} />
            <Text style={styles.transparencyText}>
              O login Google identifica sua conta, mas não significa que exista uma assinatura. O estado Premium só deve ser ativado após integrar cobrança e validação segura no servidor.
            </Text>
          </View>
        </InfoCard>

        <PrimaryButton label="Voltar ao Urbico" icon="arrow-back" onPress={() => router.back()} style={styles.backButton} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 14, paddingBottom: 36 },
  hero: { padding: 22, borderRadius: 24, backgroundColor: "#0A2035", borderWidth: 1, borderColor: "#1D4964" },
  heroIcon: { width: 66, height: 66, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#12344D", borderWidth: 1, borderColor: "#28617A", marginBottom: 20 },
  eyebrow: { color: colors.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: colors.text, fontSize: 27, lineHeight: 33, fontWeight: "800", marginTop: 8 },
  heroDescription: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  status: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8, marginTop: 18, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, backgroundColor: "#172A40" },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  statusText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  benefits: { gap: 10 },
  benefit: { flexDirection: "row", alignItems: "flex-start", gap: 13, padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  benefitIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  benefitDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  transparencyRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginBottom: 12 },
  transparencyText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  backButton: { marginTop: 24 },
});
