import * as ReactNative from "react-native";

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
};

export const API_BASE_URL = env.apiBaseUrl;

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000 (server/_core/index.ts).
 * URL pattern (sandbox em nuvem): https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  // Se EXPO_PUBLIC_API_BASE_URL estiver definida, ela sempre vence.
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;

    // Padrão de sandbox em nuvem: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const sandboxApiHostname = hostname.replace(/^8081-/, "3000-");
    if (sandboxApiHostname !== hostname) {
      return `${protocol}//${sandboxApiHostname}`;
    }

    // FIX (auditoria — "[API] Request failed: <!DOCTYPE..."): sem cair no
    // padrão de sandbox acima (dev local via Termux/localhost, IP de LAN,
    // etc), esta função retornava "" e o app chamava um caminho relativo —
    // que bate na própria porta do Metro (8081), não no backend
    // (server/_core/index.ts, porta 3000 por padrão). O Metro responde com
    // sua própria página HTML pra qualquer rota que não reconhece, daí o
    // "<!DOCTYPE" em vez de JSON. Se a página está servida na porta do
    // Metro, assume o mesmo host na porta do backend em vez de cair pra
    // "" — cobre localhost, 127.0.0.1 e qualquer IP de LAN.
    if (port === "8081") {
      return `${protocol}//${hostname}:3000`;
    }
  }

  // Fallback final: URL relativa (mesma origem — correto quando app e API
  // já estão servidos pelo mesmo host:porta, ex.: build de produção).
  return "";
}

// Chaves de armazenamento local da sessão do Urbico (ver lib/_core/auth.ts).
// Não são segredos do provedor de login - só nomes de chave locais.
export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "urbico-user-info";
