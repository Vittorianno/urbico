import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { isSupabaseConfigured, supabase } from "@/lib/_core/supabase";
import { analytics } from "@/lib/analytics";
import { emitSessionCleared } from "@/lib/session-events";
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  /** Mantido por compatibilidade; o estado agora é carregado pelo AuthProvider. */
  autoFetch?: boolean;
};

type AuthContextValue = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<Auth.User | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function apiUserToAuthUser(
  apiUser: NonNullable<Awaited<ReturnType<typeof Api.getMe>>>,
): Auth.User {
  return {
    id: apiUser.id,
    openId: apiUser.openId,
    name: apiUser.name,
    email: apiUser.email,
    loginMethod: apiUser.loginMethod,
    avatarUrl: apiUser.avatarUrl ?? null,
    role: apiUser.role,
    lastSignedIn: new Date(apiUser.lastSignedIn),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<Auth.User | null> => {
    setLoading(true);
    setError(null);

    try {
      // Sempre valida a sessão no backend. O cache é apenas uma otimização de
      // dados, nunca uma segunda fonte de verdade nem prova de autenticação.
      if (Platform.OS !== "web") {
        const sessionToken = await Auth.getSessionToken();
        if (!sessionToken) {
          setUser(null);
          await Auth.clearUserInfo();
          return null;
        }
      }

      const apiUser = await Api.getMe();
      if (!apiUser) {
        // O servidor respondeu 401/403: a sessão realmente não vale mais.
        setUser(null);
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
        return null;
      }

      const nextUser = apiUserToAuthUser(apiUser);
      setUser(nextUser);
      await Auth.setUserInfo(nextUser);
      return nextUser;
    } catch (err) {
      // Falha de rede/servidor NÃO apaga o token nem os dados locais: o app
      // segue utilizável como visitante e a sessão pode ser retomada com
      // "tentar novamente" (refresh) quando a conexão voltar.
      const nextError =
        err instanceof Error ? err : new Error("Falha ao verificar a sessão");
      console.error("[useAuth] refresh error:", nextError);
      setError(nextError);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
    } finally {
      analytics.track("user_logout");
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      // Encerra também a sessão do Supabase guardada no aparelho (refresh
      // token no AsyncStorage) — sem isso o "logout" deixaria a credencial.
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch (err) {
          console.warn("[Auth] Falha ao encerrar a sessão do Supabase:", err);
        }
      }
      setUser(null);
      setError(null);
      // Quem está dentro do UrbicoProvider limpa os dados pessoais locais.
      emitSessionCleared();
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
      refresh,
      logout,
    }),
    [error, loading, logout, refresh, user],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(_options?: UseAuthOptions): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
