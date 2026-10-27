import { Image, StyleSheet } from "react-native";

export function NorbyAvatar({ large = false, diameter }: { large?: boolean; diameter?: number }) {
  const size = diameter ?? (large ? 82 : 44);

  return (
    <Image
      source={require("../assets/images/norby-avatar.png")}
      style={[styles.avatar, { width: size, height: size }]}
      resizeMode="contain"
      accessibilityLabel="Norby, mascote amigável do Urbico"
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 999,
  },
});
