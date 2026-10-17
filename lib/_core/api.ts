import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

/** Erro de resposta HTTP da API — carrega o status para distinguir sessão inválida (401/403) de falha de rede/servidor. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Determine the auth method:
  // - Native platform: use stored session token as Bearer auth
  // - Web (including iframe): use cookie-based auth (browser handles automatically)
  //   Cookie is set on backend domain via POST /api/auth/google/exchange after the Google login
  if (Platform.OS !== "web") {
    const sessionToken = await Auth.getSessionToken();
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Error response:", errorText);
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        // Not JSON, use text as is
      }
      throw new ApiError(
        errorMessage || `API call failed: ${response.statusText}`,
        response.status,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    console.error("[API] Request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

// Get current authenticated user (web uses cookie-based auth).
// Devolve null SOMENTE quando o servidor responde que não há sessão válida
// (401/403). Falha de rede ou erro do servidor lança — quem chama não deve
// tratar isso como "sessão inválida" nem apagar o token.
export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  avatarUrl?: string | null;
  role?: "user" | "admin";
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    console.error("[API] getMe failed:", error);
    throw error;
  }
}

// Login com Google (feito no servidor — ver server/_core/google-auth-routes.ts).
// URL que o app abre (navegador no web, aba de autenticação no nativo) para
// iniciar o login; `returnTo` é para onde o servidor devolve o usuário depois.
export function getGoogleLoginStartUrl(returnTo: string): string {
  const baseUrl = getApiBaseUrl();
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`;
}

// Troca o código de uso único devolvido pelo servidor (login_code) pela sessão
// do Urbico: no web o servidor já grava o cookie; no nativo o app guarda o
// token devolvido. Retorna o token da sessão ou null se o código for inválido.
export async function exchangeGoogleLoginCode(code: string): Promise<string | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const response = await fetch(`${cleanBaseUrl}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // permite gravar o cookie de sessão no web
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      console.error("[API] exchangeGoogleLoginCode failed:", response.status);
      return null;
    }
    const result = (await response.json()) as { app_session_id?: string };
    return result.app_session_id || null;
  } catch (error) {
    console.error("[API] exchangeGoogleLoginCode error:", error);
    return null;
  }
}
