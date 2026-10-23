import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
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
import { analytics } from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/_core/supabase";

type Mode = "signIn" | "signUp";

// URL de retorno do OAuth no nativo. Precisa estar cadastrada em Supabase →
// Authentication → URL Configuration → Redirect URLs.
const NATIVE_OAUTH_REDIRECT = "urbico://login";

// FIX: ponto único de autenticação do Urbico (ver decisão de produto: não
// duplicar telas/áreas de login em nenhum outro lugar do app — qualquer
// funcionalidade que precise de conta só usa esta mesma sessão via
// useAuth()/isAuthenticated). "Continuar com Google" é o método preferido;
// e-mail/senha continua disponível como alternativa.
export default function LoginScreen() {
  const { refresh } = useAuth({ autoFetch: false });
  const completingSession = useRef<{
    token: string;
    promise: Promise<void>;
  } | null>(null);
  const pendingMethod = useRef<"password" | "google">("google");
  // FIX (OAuth Google, web): se a página abriu voltando do Google (?code=,
  // #access_token= ou ?error=), o supabase-js pode terminar a troca do código
  // ANTES deste componente assinar onAuthStateChange. Nesse caso o evento que
  // chega é INITIAL_SESSION (não SIGNED_IN) e o login ficaria parado. Captura
  // isso uma única vez, na primeira renderização, antes de o supabase-js
  // limpar a URL.
  const returningFromOAuth = useRef<boolean>(
    Platform.OS === "web" &&
      typeof window !== "undefined" &&
      /[?&#](code|access_token|error)=/.test(window.location.href),
  );
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signUp";

  // Troca o access token do Supabase pela sessão própria do Urbico (cookie
  // no web, token no SecureStore no nativo) — mesmo passo final para
  // e-mail/senha e para Google, então fica centralizado aqui.
  // FIX (analytics): `method` identifica como a sessão foi concluída
  // ("password" | "google"), registrado como user_login — ponto único de
  // login com sucesso, independente do caminho que levou até aqui.
  const completeUrbicoSession = (
    accessToken: string,
    method: "password" | "google",
  ) => {
    if (completingSession.current?.token === accessToken)
      return completingSession.current.promise;

    const promise = (async () => {
      const urbicoSessionToken = await Api.establishSession(accessToken);
      if (!urbicoSessionToken)
        throw new Error("Não foi possível iniciar a sessão. Tente novamente.");
      if (Platform.OS !== "web") {
        const { setSessionToken } = await import("@/lib/_core/auth");
        await setSessionToken(urbicoSessionToken);
      }
      const user = await refresh();
      if (!user)
        throw new Error(
          "A sessão foi criada, mas o usuário não pôde ser carregado.",
        );
      analytics.track("user_login", { method });
      // O guard global também cobre recarregamentos e links diretos; aqui a
      // troca explícita evita depender da tela anterior e remove o login do
      // histórico de navegação.
      router.replace("/(tabs)");
    })();

    completingSession.current = { token: accessToken, promise };
    void promise.catch(() => {
      if (completingSession.current?.token === accessToken)
        completingSession.current = null;
    });
    return promise;
  };

  // FIX: no fluxo "Continuar com Google", a sessão do Supabase é concluída
  // de dois jeitos diferentes dependendo da plataforma — no nativo, depois
  // de `exchangeCodeForSession`; no web, pelo próprio redirecionamento de
  // página completo (detectSessionInUrl já ligado em lib/_core/supabase.ts).
  // Um único listener de onAuthStateChange cobre os dois casos sem duplicar
  // a lógica de "o que fazer quando o login termina".
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const completesLogin =
          event === "SIGNED_IN" ||
          (event === "INITIAL_SESSION" && returningFromOAuth.current);
        if (completesLogin && session?.access_token) {
          setLoading(true);
          void completeUrbicoSession(
            session.access_token,
            pendingMethod.current,
          )
            .catch((err) => {
              Alert.alert(
                "Erro ao entrar",
                err instanceof Error ? err.message : "Tente novamente.",
              );
            })
            .finally(() => setLoading(false));
        }
      },
    );
    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Login indisponível",
        "Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no ambiente do app.",
      );
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert(
        "Dados incompletos",
        "Preencha e-mail e senha para continuar.",
      );
      return;
    }
    if (isSignUp && password.length < 6) {
      Alert.alert("Senha curta", "Use uma senha com pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      pendingMethod.current = "password";
      const { data, error } = isSignUp
        ? await supabase.auth.signUp({ email: trimmedEmail, password })
        : await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

      if (error) {
        Alert.alert(
          isSignUp
            ? "Não foi possível criar a conta"
            : "Não foi possível entrar",
          error.message,
        );
        return;
      }

      if (isSignUp) analytics.track("user_registered", { method: "password" });

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

      await completeUrbicoSession(accessToken, "password");
    } catch (err) {
      Alert.alert(
        "Erro inesperado",
        err instanceof Error ? err.message : "Tente novamente em instantes.",
      );
    } finally {
      setLoading(false);
    }
  };

  // FIX: "Continuar com Google" — método preferido pedido explicitamente:
  // login simples, e a mesma conta Google permite recuperar a conta do
  // Urbico ao reinstalar o app ou trocar de aparelho (o openId do usuário
  // fica ligado à identidade do Google via Supabase, não a um dispositivo).
  const continueWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Login indisponível",
        "Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no ambiente do app.",
      );
      return;
    }
    setLoading(true);
    pendingMethod.current = "google";
    try {
      if (Platform.OS === "web") {
        // FIX: redirectTo sem query/hash antigos (origem + /login). Usar
        // window.location.href podia carregar um ?code= ou #access_token=
        // anterior para dentro da nova URL de retorno, e a URL precisa bater
        // com a lista de Redirect URLs do Supabase.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/login` },
        });
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
        options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        Alert.alert(
          "Não foi possível continuar com o Google",
          error?.message ?? "Tente novamente.",
        );
        setLoading(false);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        NATIVE_OAUTH_REDIRECT,
      );
      if (result.type !== "success") {
        setLoading(false);
        return;
      }

      // FIX (OAuth Google, nativo): `exchangeCodeForSession` recebe só o
      // `code` (fluxo PKCE), não a URL inteira de retorno como era passado
      // antes — isso sempre falhava com "invalid flow state". Extrai o código
      // (ou o erro devolvido pelo provedor) da URL de retorno.
      const { queryParams } = Linking.parse(result.url);
      const rawError = queryParams?.error_description ?? queryParams?.error;
      const providerError = Array.isArray(rawError) ? rawError[0] : rawError;
      if (providerError) {
        Alert.alert("Não foi possível continuar com o Google", String(providerError));
        setLoading(false);
        return;
      }
      const rawCode = queryParams?.code;
      const authCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;
      if (!authCode) {
        Alert.alert(
          "Não foi possível continuar com o Google",
          "O Google não devolveu o código de autorização. Tente novamente.",
        );
        setLoading(false);
        return;
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(authCode);
      if (exchangeError) {
        Alert.alert(
          "Não foi possível continuar com o Google",
          exchangeError.message,
        );
        setLoading(false);
        return;
      }
      // O exchangeCodeForSession acima já dispara o onAuthStateChange
      // (SIGNED_IN), que conclui a sessão do Urbico sozinho.
    } catch (err) {
      Alert.alert(
        "Erro inesperado",
        err instanceof Error ? err.message : "Tente novamente em instantes.",
      );
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
          <View style={styles.back} />
          <Text style={styles.title}>
            {isSignUp ? "Criar conta" : "Entrar"}
          </Text>
          <View style={styles.back} />
        </View>

        <View style={styles.form}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.blue} />
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => void continueWithGoogle()}
                style={({ pressed }) => [
                  styles.google,
                  pressed && styles.pressed,
                ]}
              >
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
            style={({ pressed }) => [
              styles.switchMode,
              pressed && styles.pressed,
            ]}
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
  form: { padding: 20, paddingTop: 10 },
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
  dividerRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 18,
  },
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
  loading: {
    marginTop: 6,
    marginBottom: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  switchMode: { marginTop: 18, alignItems: "center", paddingVertical: 8 },
  switchModeText: { color: colors.blue, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
