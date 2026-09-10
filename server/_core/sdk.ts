import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { verifySupabaseAccessToken } from "./supabaseAuth";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SDKServer {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) {
      throw new Error(
        "JWT_SECRET não configurado — sessões não podem ser assinadas/verificadas.",
      );
    }
    return new TextEncoder().encode(secret);
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  /**
   * Assina o JWT de sessão próprio do Urbico (independente do provedor de
   * identidade). Mesmo formato/expiração usados desde sempre pelo resto do
   * backend (cookie `app_session_id`, `sdk.verifySession`).
   */
  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return { openId, appId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * Troca um access token do Supabase Auth (obtido pelo app no
   * signIn/signUp via @supabase/supabase-js) por uma sessão própria do
   * Urbico. Valida o token contra o projeto Supabase, sincroniza o usuário
   * local (drizzle/MySQL, mesma tabela `users` de sempre) e assina o JWT de
   * sessão de longa duração que o resto do backend já sabe consumir.
   *
   * openId local passa a ser `supabase:<uuid>` — o `role` ("admin" para o
   * dono do projeto) continua decidido por `db.upsertUser`/ENV.ownerOpenId
   * sem nenhuma mudança.
   */
  async createSessionFromSupabaseToken(
    supabaseAccessToken: string,
  ): Promise<{ token: string; user: User }> {
    const supabaseUser = await verifySupabaseAccessToken(supabaseAccessToken);
    if (!supabaseUser) {
      throw ForbiddenError("Token do Supabase inválido ou expirado");
    }

    const openId = `supabase:${supabaseUser.id}`;
    const name =
      (supabaseUser.user_metadata?.full_name as string | undefined) ||
      supabaseUser.email?.split("@")[0] ||
      "Usuário";
    const lastSignedIn = new Date();

    await db.upsertUser({
      openId,
      name,
      email: supabaseUser.email ?? null,
      loginMethod: "supabase",
      lastSignedIn,
    });

    const user = await db.getUserByOpenId(openId);
    if (!user) {
      throw ForbiddenError("Falha ao sincronizar usuário local após login");
    }

    const token = await this.signSession({ openId, appId: ENV.appId || "urbico", name });
    return { token, user };
  }

  /**
   * Autentica uma requisição pela sessão própria do Urbico (cookie
   * `app_session_id` ou header `Authorization: Bearer <token>` no app
   * mobile). Usado por todo procedimento protegido do tRPC via
   * `createContext`.
   */
  async authenticateRequest(req: Request): Promise<User> {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Sessão inválida ou ausente");
    }

    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("Usuário não encontrado — faça login novamente");
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    return user;
  }
}

export const sdk = new SDKServer();
