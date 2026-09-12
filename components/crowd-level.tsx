import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/urbico-ui";
import type { CrowdLevel } from "@/lib/urbico-context";

// Metadados de cada nível: cor e quantos "bonequinhos" desenhar. "Vazio" não
// desenha nenhuma pessoa — usa um ícone de "pessoa cortada" para simbolizar
// zero, em vez de deixar o espaço em branco (o que pareceria "sem dado").
export const CROWD_LEVEL_META: Record<CrowdLevel, { color: string; people: number; note: string }> = {
  Vazio: { color: colors.green, people: 0, note: "Bastante espaço disponível." },
  Baixa: { color: "#8CD46A", people: 1, note: "Espaço para embarcar com conforto." },
  Normal: { color: colors.amber, people: 2, note: "Ocupação usual." },
  Alta: { color: "#F38A45", people: 3, note: "Pouco espaço disponível." },
  Lotado: { color: colors.red, people: 4, note: "O embarque pode estar difícil." },
};

export const CROWD_LEVELS = Object.keys(CROWD_LEVEL_META) as CrowdLevel[];

export function CrowdLevelBadge({
  level,
  count,
  compact = false,
}: {
  level: CrowdLevel | null | undefined;
  count?: number;
  compact?: boolean;
}) {
  const size = compact ? 15 : 18;

  if (!level) {
    // FIX: em modo compacto (usado por item numa lista de várias linhas —
    // ver app/next-buses.tsx) a maioria das linhas não vai ter relato, e
    // repetir "Sem relatos de lotação recentes" em toda linha da lista
    // poluiria a tela. Nesse modo simplesmente não mostra nada; a explicação
    // completa continua aparecendo no card de detalhes (modo não-compacto).
    if (compact) return null;
    return (
      <View style={styles.row}>
        <MaterialIcons name="help-outline" size={size} color={colors.muted} />
        <Text style={styles.emptyText}>Sem relatos de lotação recentes</Text>
      </View>
    );
  }

  const meta = CROWD_LEVEL_META[level];
  return (
    <View style={styles.row}>
      <View style={styles.people}>
        {meta.people === 0 ? (
          <MaterialIcons name="person-off" size={size} color={meta.color} />
        ) : (
          Array.from({ length: meta.people }).map((_, index) => (
            <MaterialIcons key={index} name="person" size={size} color={meta.color} />
          ))
        )}
      </View>
      <Text style={[styles.label, { color: meta.color }]}>{level}</Text>
      {typeof count === "number" && count > 0 ? (
        <Text style={styles.count}>
          · {count} relato{count === 1 ? "" : "s"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  people: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 12, fontWeight: "700" },
  count: { color: colors.muted, fontSize: 11 },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
