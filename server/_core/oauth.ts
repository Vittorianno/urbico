import { COOKIE_NAME } from "../../shared/const.js";
import { HttpError } from "../../shared/_core/errors.js";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import type { User } from "../../drizzle/schema";

export function buildUserResponse(user: User) {
  return {
    id: user.id,
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    // URL https da foto do provedor de login (ou null → o app mostra iniciais).
    avatarUrl: user.avatarUrl ?? null,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
  };
}

// A criação da sessão (login) mora em server/_core/google-auth-routes.ts — o
// login é direto com o Google. Aqui ficam só logout e "quem sou eu".
export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Usuário autenticado atual - funciona com cookie (web) ou Bearer token
  // (mobile), ambos a sessão própria do Urbico.
  //
  // 401 = não há sessão válida (o app pode descartá-la). Qualquer outra falha
  // (ex.: banco de dados fora do ar) é 503 — antes tudo virava 401, e o app
  // achava que a sessão era inválida e deslogava a pessoa sem motivo.
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(401).json({ error: "Not authenticated", user: null });
        return;
      }
      const code = (error as { cause?: { code?: string } })?.cause?.code;
      console.error("[Auth] /api/auth/me indisponível:", code ?? (error instanceof Error ? error.message.slice(0, 120) : "erro desconhecido"));
      res.status(503).json({ error: "Serviço de conta indisponível", user: null });
    }
  });
}
