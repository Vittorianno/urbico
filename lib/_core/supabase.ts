import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // Não lança: o app deve continuar abrindo (outras telas não dependem de
  // login) mesmo sem essas variáveis configuradas, só o login em si falha.
  // Ver README "Autenticação (Supabase Auth)".
  console.error(
    "[Supabase] EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY não configurados — login indisponível.",
  );
}

/**
 * Cliente Supabase usado só para Auth (login/cadastro) no app. Os dados do
 * produto (favoritos, agenda, alertas, lotação) continuam servidos pelo
 * backend próprio do Urbico via tRPC — este cliente nunca é usado para
 * ler/gravar tabelas do Supabase diretamente.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage funciona em web e nativo; no web o Supabase já usa
    // localStorage por padrão, mas declarar explicitamente evita qualquer
    // ambiguidade entre plataformas.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
