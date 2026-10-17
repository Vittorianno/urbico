import { COOKIE_NAME } from "../../shared/const.js";
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
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });
}
