import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import type { User } from "../../drizzle/schema";

function buildUserResponse(user: User) {
  return {
    id: user.id,
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  // Troca um access token do Supabase Auth (app já autenticado via
  // @supabase/supabase-js) por uma sessão própria do Urbico. Usado tanto no
  // web (define o cookie `app_session_id`) quanto no mobile (o app guarda o
  // `token` retornado e o envia como `Authorization: Bearer` nas próximas
  // chamadas tRPC).
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token do Supabase é obrigatório" });
        return;
      }
      const supabaseAccessToken = authHeader.slice("Bearer ".length).trim();

      const { token, user } = await sdk.createSessionFromSupabaseToken(supabaseAccessToken);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, app_session_id: token, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Token do Supabase inválido" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Usuário autenticado atual - funciona com cookie (web) ou Bearer token
  // (mobile), ambos a sessão própria do Urbico (não o token do Supabase).
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
