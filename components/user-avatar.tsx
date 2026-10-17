import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/urbico-ui";
import { getInitials } from "@/lib/initials";

/**
 * Foto da conta (URL real devolvida pelo provedor de login) ou, quando não há
 * foto / ela falha ao carregar, um avatar com iniciais (ou ícone de pessoa).
 * `key={uri}` + reset de estado impedem reaproveitar a imagem de outra conta.
 */
export function UserAvatar({ uri, name, email, size = 70 }: { uri?: string | null; name?: string | null; email?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [uri]);

  const box = { width: size, height: size, borderRadius: size / 2 };
  const initials = getInitials(name, email);
  const showPhoto = Boolean(uri) && !failed;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={name ? `Foto de ${name}` : "Foto do perfil"} style={[styles.base, box]}>
      {showPhoto ? (
        <>
          <Image key={uri} source={{ uri: uri as string }} style={[styles.image, box]} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
          {!loaded ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.cyan} /> : null}
        </>
      ) : initials ? (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      ) : (
        <MaterialIcons name="person" size={size * 0.55} color={colors.cyan} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.blue, overflow: "hidden" },
  image: { position: "absolute" },
  initials: { color: colors.cyan, fontWeight: "800" },
});
