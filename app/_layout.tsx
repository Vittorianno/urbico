import "@/lib/polyfills";
import "@/global.css";
import "@/lib/departure-location-task";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { ActivityIndicator, Platform, View } from "react-native";
import { ThemeProvider } from "@/lib/theme-provider";
import { CloudSync } from "@/lib/cloud-sync";
import { UrbicoProvider } from "@/lib/urbico-context";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { analytics } from "@/lib/analytics";
import { trpc, createTRPCClient } from "@/lib/trpc";
import {
  initManusRuntime,
  subscribeSafeAreaInsets,
} from "@/lib/_core/manus-runtime";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

// FIX (modo visitante): o guard NÃO força mais login. Mapa, linhas, rotas,
// horários e Norby (consultas públicas) funcionam sem conta — o backend já
// separa publicProcedure (público, com rate limit) de protectedProcedure
// (favoritos/agenda sincronizados, Google Agenda etc.), e é ele quem decide
// o acesso; a interface não é a barreira. A conta é pedida só quando a
// pessoa escolhe entrar (Perfil → "Fazer login"). Único redirecionamento
// que sobra: quem já está autenticado não precisa ver a tela de login.
function AuthGuard() {
  const pathname = usePathname();
  const { loading, isAuthenticated } = useAuth();
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && isLoginRoute) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoginRoute, loading]);

  // O indicador de carregamento cobre só a tela de login (concluindo a
  // sessão); o restante do app abre direto, sem esperar a checagem de sessão.
  if (!loading || !isLoginRoute) return null;
  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#08131F",
      }}
    >
      <ActivityIndicator color="#4DA3FF" />
    </View>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // FIX (analytics): app_opened uma única vez por carregamento do app —
  // ver docs/analytics.md e lib/analytics.ts.
  useEffect(() => {
    analytics.track("app_opened");
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? {
      insets: initialInsets,
      frame: initialFrame,
    };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          <AuthProvider>
            <UrbicoProvider>
              {/* FIX (sincronização na nuvem): montado uma única vez aqui,
                fora de qualquer tela — não pertence à Agenda, aos Favoritos
                nem a nenhuma área específica. Não renderiza nada; só
                mantém favoritos/agenda/preferências sincronizados com a
                conta quando a pessoa está logada (ver lib/cloud-sync.tsx). */}
              <CloudSync />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="login"
                  options={{ presentation: "fullScreenModal" }}
                />
                <Stack.Screen name="admin" />
              </Stack>
              <AuthGuard />
            </UrbicoProvider>
          </AuthProvider>
          <StatusBar style="light" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {content}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
