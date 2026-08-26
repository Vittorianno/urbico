import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

export const colors = {
  background: "#07111D",
  card: "#0D1A2A",
  cardRaised: "#102238",
  text: "#F3F8FF",
  muted: "#94A8BC",
  border: "#1B3147",
  blue: "#087DF5",
  blueSoft: "#0A284D",
  cyan: "#56D7FF",
  green: "#55CF84",
  amber: "#F4BF39",
  red: "#EA3A47",
  teal: "#087DF5",
  mint: "#0A284D",
  ink: "#F3F8FF",
  paper: "#07111D",
  line: "#1B3147",
  success: "#55CF84",
  warning: "#F4BF39",
};

export function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <MaterialIcons name="arrow-back" size={22} color={colors.ink} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, disabled = false, style }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, style, (pressed || disabled) && styles.pressed, disabled && styles.disabled]}>
      {icon ? <MaterialIcons name={icon} size={20} color="#FFFFFF" /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, icon, onPress, style }: { label: string; icon?: IconName; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, style, pressed && styles.pressed]}>
      {icon ? <MaterialIcons name={icon} size={19} color={colors.teal} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InfoCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.ink },
  headerSubtitle: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.muted },
  primaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.blue, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryButton: { minHeight: 46, borderRadius: 14, backgroundColor: colors.blueSoft, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryButtonText: { color: colors.blue, fontSize: 14, fontWeight: "700" },
  sectionTitleRow: { marginTop: 26, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.ink },
  sectionAction: { color: colors.blue, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  card: { borderRadius: 20, padding: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});

export const uiStyles = styles;
