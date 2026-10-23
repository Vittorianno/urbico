import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { isSupabaseConfigured, supabase } from "@/lib/_core/supabase";
import { analytics } from "@/lib/analytics";
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
      // FIX (OAuth Google): encerra também a sessão local do cliente Supabase
      // (AsyncStorage/localStorage). Sem isto, a sessão do Supabase sobrevivia
      // ao logout do Urbico e o próximo "Continuar com Google" reaproveitava a
      // identidade anterior em vez de começar um login limpo.
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch (err) {
          console.error("[Auth] Supabase signOut failed:", err);
        }
      }
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
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
