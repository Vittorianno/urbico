import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
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

export default function LoginScreen() {
  const { refresh } = useAuth({ autoFetch: false });
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signUp";

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

      // Troca o token do Supabase pela sessão própria do Urbico (cookie no
      // web, token guardado no SecureStore no app nativo) - ver
      // server/_core/oauth.ts POST /api/auth/session.
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
    } catch (err) {
      Alert.alert("Erro inesperado", err instanceof Error ? err.message : "Tente novamente em instantes.");
    } finally {
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

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.blue} />
            </View>
          ) : (
            <PrimaryButton
              label={isSignUp ? "Criar conta" : "Entrar"}
              onPress={() => void handleSubmit()}
              style={styles.submit}
            />
          )}

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
  loading: { marginTop: 26, height: 48, alignItems: "center", justifyContent: "center" },
  switchMode: { marginTop: 18, alignItems: "center", paddingVertical: 8 },
  switchModeText: { color: colors.blue, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
