import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Não lança: o app deve continuar abrindo (outras telas não dependem de
  // login) mesmo sem essas variáveis configuradas, só o login em si falha.
  // Ver README "Autenticação (Supabase Auth)".
  //
  // FIX: createClient() do @supabase/supabase-js lança exceção síncrona
  // ("supabaseUrl is required.") se receber uma URL vazia — isso derrubava
  // o app inteiro (e o SSR do Expo Router) em vez de só desabilitar o
  // login, contradizendo o comentário acima. Por isso usamos uma URL
  // placeholder válida (não vazia) quando a variável não está configurada,
  // mantendo o cliente instanciável; qualquer chamada de auth real vai
  // falhar normalmente contra esse host inexistente, o que é aceitável.
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
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      // AsyncStorage funciona em web e nativo; no web o Supabase já usa
      // localStorage por padrão, mas declarar explicitamente evita qualquer
      // ambiguidade entre plataformas.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);
