import { randomBytes } from "crypto";

/**
 * Lógica pura do login com Google (sem Express/rede), isolada para ser testada.
 */

/** Origens web que podem receber o usuário de volta após o login. */
export function parseAllowedOrigins(raw: string | undefined, isProduction: boolean): string[] {
  const origins = new Set<string>();
  for (const item of (raw ?? "").split(",")) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
    } catch {
      // entrada inválida: ignora
    }
  }
  if (!isProduction) origins.add("http://localhost:8081");
  return Array.from(origins);
}

/**
 * Protege contra open redirect: só devolvemos o usuário ao app nativo
 * (urbico://login) ou a uma origem web explicitamente permitida.
 */
export function isAllowedReturnTo(value: string, allowedOrigins: string[]): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol === "urbico:") {
    return url.hostname === "login" && (url.pathname === "" || url.pathname === "/");
  }
  if (url.protocol === "http:" || url.protocol === "https:") {
    return allowedOrigins.includes(url.origin);
  }
  return false;
}

export function appendQuery(url: string, params: Record<string, string>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) parsed.searchParams.set(key, value);
  return parsed.toString();
}

/**
 * Códigos de uso único e vida curta que o servidor entrega ao app depois do
 * login no Google (o app troca o código pela sessão). Evita colocar o token de
 * sessão em uma URL/deep link. Guardado em memória: com várias instâncias do
 * servidor, seria preciso um armazenamento compartilhado.
 */
export function createLoginCodeStore(options: { ttlMs?: number; now?: () => number } = {}) {
  const ttlMs = options.ttlMs ?? 60_000;
  const now = options.now ?? Date.now;
  const entries = new Map<string, { openId: string; expiresAt: number }>();

  const purgeExpired = () => {
    const current = now();
    for (const [code, entry] of entries) {
      if (entry.expiresAt <= current) entries.delete(code);
    }
  };

  return {
    issue(openId: string): string {
      purgeExpired();
      const code = randomBytes(32).toString("base64url");
      entries.set(code, { openId, expiresAt: now() + ttlMs });
      return code;
    },
    consume(code: string): { openId: string } | null {
      if (!code) return null;
      const entry = entries.get(code);
      if (!entry) return null;
      entries.delete(code);
      if (entry.expiresAt <= now()) return null;
      return { openId: entry.openId };
    },
  };
}
