import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Endurecimento básico do backend (auditoria de produção).
 *
 * - CORS: o código anterior refletia QUALQUER origem com
 *   `Access-Control-Allow-Credentials: true` e o cookie de sessão usa
 *   `SameSite=None`. Na web, isso permitiria que qualquer site chamasse o
 *   backend em nome do usuário logado. Em produção agora só passam as origens
 *   listadas em CORS_ALLOWED_ORIGINS (e a própria origem do servidor). O app
 *   nativo (Android) não envia cabeçalho Origin e não é afetado.
 *   Em desenvolvimento o comportamento antigo (refletir a origem) é mantido
 *   para não quebrar Metro/web em localhost, IP da rede local ou preview.
 * - Rate limit: não havia nenhum. Endpoints públicos (Norby, SPTrans,
 *   relatos de lotação, analytics) ficavam abertos a abuso e a esgotar a cota
 *   do token da SPTrans.
 */

export function parseAllowedOrigins(raw: string | undefined = process.env.CORS_ALLOWED_ORIGINS): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);
}

function isSameHost(origin: string, hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  try {
    return new URL(origin).host === hostHeader;
  } catch {
    return false;
  }
}

export type CorsOptions = {
  isProduction?: boolean;
  allowedOrigins?: string[];
};

export function createCorsMiddleware(options: CorsOptions = {}): RequestHandler {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const allowedOrigins = options.allowedOrigins ?? parseAllowedOrigins();

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const permitted =
      !origin ||
      !isProduction ||
      allowedOrigins.includes(origin.replace(/\/+$/, "")) ||
      isSameHost(origin, req.headers.host);

    if (origin && !permitted) {
      // Origem de navegador não autorizada: nem preflight nem requisição real.
      res.sendStatus(403);
      return;
    }

    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization",
      );
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  };
}

export type RateLimitOptions = {
  windowMs: number;
  max: number;
};

/** Limitador de janela fixa, em memória, por IP (suficiente para uma instância). */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, options.windowMs);
  (sweeper as unknown as { unref?: () => void }).unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
      return;
    }
    next();
  };
}

/** Avisos de configuração insegura em produção (não derruba o servidor). */
export function logSecurityWarnings(): void {
  if (process.env.NODE_ENV !== "production") return;

  if ((process.env.JWT_SECRET ?? "").length < 32) {
    console.warn("[security] JWT_SECRET ausente ou com menos de 32 caracteres — use `openssl rand -base64 48`.");
  }
  if (!process.env.DATABASE_URL) {
    console.warn("[security] DATABASE_URL ausente — login, alertas e relatos de lotação não funcionam sem banco.");
  }
  if (parseAllowedOrigins().length === 0) {
    console.warn("[security] CORS_ALLOWED_ORIGINS vazio — clientes web de outra origem serão bloqueados (o app Android não é afetado).");
  }
  if (!process.env.TRUST_PROXY) {
    console.warn("[security] TRUST_PROXY não definido — assumindo 1 proxy reverso na frente (padrão da maioria das hospedagens).");
  }
  if (process.env.GOOGLE_CLIENT_ID && !process.env.TOKEN_ENCRYPTION_KEY?.trim()) {
    console.warn("[security] Google Agenda configurado sem TOKEN_ENCRYPTION_KEY — conectar a agenda vai falhar em produção até definir a chave (`openssl rand -base64 32`).");
  }
}
