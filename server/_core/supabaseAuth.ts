import axios from "axios";
import { AXIOS_TIMEOUT_MS } from "../../shared/const.js";
import { ENV } from "./env";

export type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null; [key: string]: unknown };
};

/**
 * Valida um access token do Supabase Auth chamando GET /auth/v1/user no
 * projeto Supabase configurado. Não precisa da chave "service role" nem do
 * segredo de assinatura JWT do projeto — o próprio endpoint do Supabase
 * confirma a validade do token, o mesmo padrão usado pelo cliente
 * @supabase/supabase-js no app.
 *
 * Retorna null (nunca lança) quando o token é inválido/expirado ou quando o
 * Supabase não está configurado, para que quem chamar decida como tratar —
 * ver sdk.ts `createSessionFromSupabaseToken`.
 */
export async function verifySupabaseAccessToken(accessToken: string): Promise<SupabaseUser | null> {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    console.error(
      "[SupabaseAuth] ERRO: SUPABASE_URL/SUPABASE_ANON_KEY não configurados — login não pode ser validado.",
    );
    return null;
  }
  if (!accessToken) return null;

  try {
    const { data } = await axios.get<SupabaseUser>(`${ENV.supabaseUrl}/auth/v1/user`, {
      timeout: AXIOS_TIMEOUT_MS,
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!data?.id) return null;
    return data;
  } catch (error) {
    console.warn("[SupabaseAuth] Falha ao validar access token:", String(error));
    return null;
  }
}
