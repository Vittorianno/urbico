import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { colors, PrimaryButton } from "@/components/urbico-ui";
import { useAuth } from "@/hooks/use-auth";
import * as Api from "@/lib/_core/api";
import { supabase } from "@/lib/_core/supabase";

type Mode = "signIn" | "signUp";

// FIX: ponto único de autenticação do Urbico (ver decisão de produto: não
// duplicar telas/áreas de login em nenhum outro lugar do app — qualquer
// funcionalidade que precise de conta só usa esta mesma sessão via
// useAuth()/isAuthenticated). "Continuar com Google" é o método preferido;
// e-mail/senha continua disponível como alternativa.
export default function LoginScreen() {
  const { refresh } = useAuth({ autoFetch: false });
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signUp";

  // Troca o access token do Supabase pela sessão própria do Urbico (cookie
  // no web, token no SecureStore no nativo) — mesmo passo final para
  // e-mail/senha e para Google, então fica centralizado aqui.
  const completeUrbicoSession = async (accessToken: string) => {
    const established = await Api.establishSession(accessToken);
    if (!established) {
      Alert.alert("Erro ao entrar", "Não foi possível iniciar a sessão. Tente novamente.");
      return;
    }
    if (Platform.OS !== "web") {
      const { setSessionToken } = await import("@/lib/_core/auth");
      await setSessionToken(accessToken);
    }
    await refresh();
    router.back();
  };

  // FIX: no fluxo "Continuar com Google", a sessão do Supabase é concluída
  // de dois jeitos diferentes dependendo da plataforma — no nativo, depois
  // de `exchangeCodeForSession`; no web, pelo próprio redirecionamento de
  // página completo (detectSessionInUrl já ligado em lib/_core/supabase.ts).
  // Um único listener de onAuthStateChange cobre os dois casos sem duplicar
  // a lógica de "o que fazer quando o login termina".
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) {
        setLoading(true);
        completeUrbicoSession(session.access_token).finally(() => setLoading(false));
      }
    });
    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert("Dados incompletos", "Preencha e-mail e senha para continuar.");
      return;
    }
    if (isSignUp && password.length < 6) {
      Alert.alert("Senha curta", "Use uma senha com pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = isSignUp
        ? await supabase.auth.signUp({ email: trimmedEmail, password })
        : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

      if (error) {
        Alert.alert(isSignUp ? "Não foi possível criar a conta" : "Não foi possível entrar", error.message);
        return;
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        // Acontece quando o projeto Supabase exige confirmação de e-mail
        // antes de liberar uma sessão: o cadastro foi feito, mas o login
        // real só acontece depois que a pessoa confirmar o e-mail.
        Alert.alert(
          "Confirme seu e-mail",
          "Enviamos um link de confirmação para o seu e-mail. Confirme e depois volte para entrar.",
        );
        setMode("signIn");
        return;
      }

      await completeUrbicoSession(accessToken);
    } catch (err) {
      Alert.alert("Erro inesperado", err instanceof Error ? err.message : "Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  // FIX: "Continuar com Google" — método preferido pedido explicitamente:
  // login simples, e a mesma conta Google permite recuperar a conta do
  // Urbico ao reinstalar o app ou trocar de aparelho (o openId do usuário
  // fica ligado à identidade do Google via Supabase, não a um dispositivo).
  const continueWithGoogle = async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
        if (error) {
          Alert.alert("Não foi possível continuar com o Google", error.message);
          setLoading(false);
        }
        // Sem mais nada a fazer aqui: o navegador já está sendo redirecionado
        // para o Google. A volta é tratada pelo onAuthStateChange acima.
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "urbico://login", skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        Alert.alert("Não foi possível continuar com o Google", error?.message ?? "Tente novamente.");
        setLoading(false);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, "urbico://login");
      if (result.type !== "success") {
        setLoading(false);
        return;
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (exchangeError) {
        Alert.alert("Não foi possível continuar com o Google", exchangeError.message);
        setLoading(false);
        return;
      }
      // O exchangeCodeForSession acima já dispara o onAuthStateChange
      // (SIGNED_IN), que conclui a sessão do Urbico sozinho.
    } catch (err) {
      Alert.alert("Erro inesperado", err instanceof Error ? err.message : "Tente novamente em instantes.");
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{isSignUp ? "Criar conta" : "Entrar"}</Text>
          <View style={styles.back} />
        </View>

        <View style={styles.form}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.blue} />
            </View>
          ) : (
            <>
              <Pressable onPress={() => void continueWithGoogle()} style={({ pressed }) => [styles.google, pressed && styles.pressed]}>
                <AntDesign name="google" size={18} color="#4285F4" />
                <Text style={styles.googleText}>Continuar com Google</Text>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="voce@exemplo.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? "Mínimo 6 caracteres" : "Sua senha"}
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            editable={!loading}
          />

          {!loading ? (
            <PrimaryButton
              label={isSignUp ? "Criar conta" : "Entrar"}
              onPress={() => void handleSubmit()}
              style={styles.submit}
            />
          ) : null}

          <Pressable
            onPress={() => setMode(isSignUp ? "signIn" : "signUp")}
            disabled={loading}
            style={({ pressed }) => [styles.switchMode, pressed && styles.pressed]}
          >
            <Text style={styles.switchModeText}>
              {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Criar uma"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { height: 50, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  form: { padding: 20, paddingTop: 10 },
  google: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  googleText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  dividerRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 18 },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
  },
  submit: { marginTop: 26 },
  loading: { marginTop: 6, marginBottom: 12, height: 48, alignItems: "center", justifyContent: "center" },
  switchMode: { marginTop: 18, alignItems: "center", paddingVertical: 8 },
  switchModeText: { color: colors.blue, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
