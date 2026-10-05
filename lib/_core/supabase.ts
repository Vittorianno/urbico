import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const hasValidSupabaseUrl = Boolean(supabaseUrl && /^https:\/\/[^\s/]+\.supabase\.co(?:\/.*)?$/i.test(supabaseUrl));

export const isSupabaseConfigured = hasValidSupabaseUrl && Boolean(supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Não lança: o app deve continuar abrindo (outras telas não dependem de
  // login) mesmo sem essas variáveis configuradas, só o login em si falha.
  // Ver README "Autenticação (Supabase Auth)".
  //
  // O cliente continua instanciável para que as telas públicas do app abram,
  // mas o login verifica isSupabaseConfigured antes de fazer qualquer chamada.
  // O endereço local reservado evita uma tentativa DNS contra um domínio
  // fictício e torna a falha de configuração explícita e determinística.
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
  hasValidSupabaseUrl ? supabaseUrl : "http://127.0.0.1:9",
  supabaseAnonKey || "disabled-anon-key",
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
