import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors } from "@/components/urbico-ui";
import { useAuth } from "@/hooks/use-auth";
import * as Api from "@/lib/_core/api";
import { analytics } from "@/lib/analytics";

// Login do Urbico: SOMENTE com o Google (feito no servidor, sem Supabase — ver
// server/_core/google-auth-routes.ts). O login é opcional: o "X" e
// "Continuar sem conta" fecham a tela sem autenticar (modo visitante).
//
// Fluxo: o app abre /api/auth/google/start → Google → servidor → volta para
// esta tela (web) ou para urbico://login (nativo) com `login_code` → o app
// troca o código pela sessão. Erros são mostrados na própria tela (Alert.alert
// não aparece no web).
export default function LoginScreen() {
  const { refresh } = useAuth({ autoFetch: false });
  const params = useLocalSearchParams<{ login_code?: string; login_error?: string }>();
  const handledCode = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closeLogin = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const finishLogin = useCallback(
    async (code: string) => {
      if (handledCode.current === code) return;
      handledCode.current = code;
      setLoading(true);
      setErrorMessage(null);
      try {
        const sessionToken = await Api.exchangeGoogleLoginCode(code);
        if (!sessionToken) throw new Error("Não foi possível iniciar a sessão. Tente novamente.");
        if (Platform.OS !== "web") {
          const { setSessionToken } = await import("@/lib/_core/auth");
          await setSessionToken(sessionToken);
        }
        const user = await refresh();
        if (!user) throw new Error("A sessão foi criada, mas o usuário não pôde ser carregado.");
        analytics.track("user_login", { method: "google" });
        router.replace("/(tabs)");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Tente novamente em instantes.");
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  // Retorno no web: o servidor redireciona para /login?login_code=... (ou
  // ?login_error=...).
  useEffect(() => {
    if (params.login_code) {
      void finishLogin(String(params.login_code));
    } else if (params.login_error) {
      setErrorMessage(
        params.login_error === "cancelled"
          ? "Login cancelado."
          : "Não foi possível entrar com o Google. Tente novamente.",
      );
    }
  }, [finishLogin, params.login_code, params.login_error]);

  const continueWithGoogle = async () => {
    setErrorMessage(null);

    if (Platform.OS === "web") {
      setLoading(true);
      window.location.href = Api.getGoogleLoginStartUrl(`${window.location.origin}/login`);
      return;
    }

    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        Api.getGoogleLoginStartUrl("urbico://login"),
        "urbico://login",
      );
      if (result.type !== "success") {
        setLoading(false);
        return;
      }
      const query = Linking.parse(result.url).queryParams ?? {};
      const code = typeof query.login_code === "string" ? query.login_code : null;
      if (!code) {
        setErrorMessage(
          query.login_error === "cancelled"
            ? "Login cancelado."
            : "Não foi possível entrar com o Google. Tente novamente.",
        );
        setLoading(false);
        return;
      }
      await finishLogin(code);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Tente novamente em instantes.");
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar e continuar sem conta"
          onPress={closeLogin}
          disabled={loading}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Entrar</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.form}>
        <Text style={styles.lead}>
          Entre com sua conta Google para guardar favoritos, agenda e preferências na sua conta e usar em outros aparelhos.
        </Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.blue} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void continueWithGoogle()}
            style={({ pressed }) => [styles.google, pressed && styles.pressed]}
          >
            <AntDesign name="google" size={18} color="#4285F4" />
            <Text style={styles.googleText}>Continuar com Google</Text>
          </Pressable>
        )}

        {errorMessage ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={closeLogin}
          disabled={loading}
          style={({ pressed }) => [styles.guest, pressed && styles.pressed]}
        >
          <Text style={styles.guestText}>Continuar sem conta</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 50,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  form: { padding: 20, paddingTop: 16 },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 22 },
  google: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  loading: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { marginTop: 14, color: "#FF6B6B", fontSize: 13, lineHeight: 18 },
  guest: { marginTop: 22, alignItems: "center", paddingVertical: 8 },
  guestText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
