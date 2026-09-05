import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { Platform, Text } from "react-native";
import { colors } from "@/components/urbico-ui";

const tabGlyphs = { home: "⌂", map: "▣", norby: "◉", profile: "●" } as const;

function TabIcon({ name, color }: { name: keyof typeof tabGlyphs; color: string }) {
  return <Text style={{ color, fontSize: name === "norby" ? 22 : 24, lineHeight: 27, fontWeight: "800" }}>{tabGlyphs[name]}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        // FIX: antes usava useColors(), que segue o tema claro/escuro do
        // sistema operacional. Como todas as outras telas do app usam a
        // paleta escura fixa de components/urbico-ui (decisão documentada de
        // "tema único escuro, sem light"), um aparelho no modo claro fazia só
        // a barra de abas virar clara, destoando do resto da interface, que
        // continua sempre escura. Agora a barra de abas usa a mesma paleta
        // fixa das demais telas.
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: "Mapa", tabBarIcon: ({ color }) => <TabIcon name="map" color={color} /> }}
      />
      <Tabs.Screen
        name="norby"
        options={{ title: "Norby", tabBarIcon: ({ color }) => <TabIcon name="norby" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} /> }}
      />
      <Tabs.Screen name="routes" options={{ href: null }} />
      <Tabs.Screen name="agenda" options={{ href: null }} />
    </Tabs>
  );
}
