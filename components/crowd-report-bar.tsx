import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/urbico-ui";
import { CROWD_LEVELS, type CrowdLevel } from "@/lib/trip-rules";

/**
 * Cinco botões para relatar a lotação do ônibus em que a pessoa está.
 * O servidor aplica o anti-spam; a mensagem de erro dele é mostrada aqui.
 */
export function CrowdReportBar({ onReport }: { onReport: (level: CrowdLevel) => Promise<void> }) {
  const [sending, setSending] = useState<CrowdLevel | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const send = async (level: CrowdLevel) => {
    if (sending) return;
    setSending(level);
    setMessage(null);
    try {
      await onReport(level);
      setMessage("Relato enviado. Obrigado!");
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Não foi possível enviar o relato.");
    } finally {
      setSending(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>COMO ESTÁ A LOTAÇÃO?</Text>
      <View style={styles.row}>
        {CROWD_LEVELS.map((level) => (
          <Pressable
            key={level}
            accessibilityRole="button"
            accessibilityLabel={`Relatar lotação ${level}`}
            disabled={sending !== null}
            onPress={() => void send(level)}
            style={({ pressed }) => [styles.chip, sending === level && styles.chipActive, pressed && styles.pressed]}
          >
            <Text style={[styles.chipText, sending === level && styles.chipTextActive]}>{level}</Text>
          </Pressable>
        ))}
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  title: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  row: { marginTop: 6, flexDirection: "row", gap: 6 },
  chip: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  message: { marginTop: 6, color: colors.muted, fontSize: 11 },
  pressed: { opacity: 0.7 },
});
