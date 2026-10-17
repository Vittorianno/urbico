import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db";
import { findUserByEmail } from "../google-user";
import { saveUserAvatarUrl } from "../user-avatar";
import { sanitizeAvatarUrl } from "./avatar";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { appendQuery, createLoginCodeStore, isAllowedReturnTo, parseAllowedOrigins } from "./google-login";
import { buildUserResponse } from "./oauth";
import { sdk } from "./sdk";

/**
 * Login direto com o Google (OAuth 2.0 "authorization code", feito no servidor):
 *
 *  1. GET  /api/auth/google/start?return_to=...  → redireciona para o Google
 *  2. GET  /api/auth/google/callback             → troca o code (com o client secret,
 *     que nunca sai do servidor), valida o id_token, cria/atualiza o usuário e
 *     devolve o usuário ao app com um código de uso único (login_code)
 *  3. POST /api/auth/google/exchange {code}      → troca o código pela sessão do
 *     Urbico (cookie no web, token no nativo)
 *
 * Funciona igual no web e no app nativo. Não há outro sistema de identidade:
 * a sessão é a mesma do Urbico (JWT assinado, cookie `app_session_id`).
 */

const NONCE_COOKIE = "urbico_oauth_nonce";
const NONCE_COOKIE_PATH = "/api/auth/google";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const loginCodes = createLoginCodeStore();

function isConfigured() {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret && ENV.googleAuthRedirectUri && ENV.cookieSecret);
}

function stateSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

function allowedOrigins() {
  return parseAllowedOrigins(ENV.authAllowedReturnOrigins, ENV.isProduction);
}

function queryString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type GoogleClaims = { sub: string; email: string; name: string; picture: string | null };

async function exchangeCodeForClaims(code: string): Promise<GoogleClaims> {
  const { data } = await axios.post<{ id_token?: string }>(
    GOOGLE_TOKEN_URL,
    new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: ENV.googleAuthRedirectUri,
      grant_type: "authorization_code",
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: AXIOS_TIMEOUT_MS },
  );
  if (!data?.id_token) throw new Error("O Google não devolveu id_token");

  const { payload } = await jwtVerify(data.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ENV.googleClientId,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("id_token sem sub");
  if (typeof payload.email !== "string" || !payload.email) throw new Error("id_token sem e-mail");
  if (payload.email_verified !== true) throw new Error("e-mail do Google não verificado");

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" && payload.name ? payload.name : payload.email.split("@")[0],
    picture: sanitizeAvatarUrl(payload.picture),
  };
}

// Mantém a conta antiga (por e-mail verificado) quando ela existe, para não
// "perder" favoritos/agenda de quem entrava pelo Supabase; senão, openId novo.
async function resolveOpenId(claims: GoogleClaims): Promise<string> {
  const googleOpenId = `google:${claims.sub}`;
  if (await db.getUserByOpenId(googleOpenId)) return googleOpenId;
  const existing = await findUserByEmail(claims.email);
  return existing?.openId ?? googleOpenId;
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/start", async (req: Request, res: Response) => {
    if (!isConfigured()) {
      res.status(503).send("Login com Google não configurado no servidor (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_AUTH_REDIRECT_URI e JWT_SECRET).");
      return;
    }
    const returnTo = queryString(req.query.return_to);
    if (!isAllowedReturnTo(returnTo, allowedOrigins())) {
      res.status(400).send("return_to não permitido.");
      return;
    }

    const nonce = randomBytes(16).toString("hex");
    const state = await new SignJWT({ returnTo, nonce })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime("10m")
      .sign(stateSecret());

    // O nonce no cookie amarra o retorno ao mesmo navegador que iniciou o login
    // (evita "login CSRF"); o state assinado impede adulteração do return_to.
    res.cookie(NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
      path: NONCE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: ENV.googleAuthRedirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    let returnTo = "";
    try {
      const { payload } = await jwtVerify(queryString(req.query.state), stateSecret(), { algorithms: ["HS256"] });
      const cookieNonce = parseCookieHeader(req.headers.cookie ?? "")[NONCE_COOKIE];
      if (typeof payload.returnTo !== "string" || typeof payload.nonce !== "string" || !cookieNonce || cookieNonce !== payload.nonce) {
        throw new Error("state inválido");
      }
      if (!isAllowedReturnTo(payload.returnTo, allowedOrigins())) throw new Error("return_to não permitido");
      returnTo = payload.returnTo;
    } catch {
      res.status(400).send("Sessão de login inválida ou expirada. Volte ao app e tente novamente.");
      return;
    }
    res.clearCookie(NONCE_COOKIE, { path: NONCE_COOKIE_PATH });

    const code = queryString(req.query.code);
    if (queryString(req.query.error) || !code) {
      res.redirect(appendQuery(returnTo, { login_error: "cancelled" }));
      return;
    }

    try {
      const claims = await exchangeCodeForClaims(code);
      const openId = await resolveOpenId(claims);
      await db.upsertUser({ openId, name: claims.name, email: claims.email, loginMethod: "google", lastSignedIn: new Date() });
      try {
        await saveUserAvatarUrl(openId, claims.picture);
      } catch (error) {
        console.warn("[GoogleAuth] Não foi possível gravar a foto de perfil:", String(error));
      }
      res.redirect(appendQuery(returnTo, { login_code: loginCodes.issue(openId) }));
    } catch (error) {
      // Nunca registrar o code, o id_token nem o corpo da resposta do Google.
      console.error("[GoogleAuth] Falha no login:", String(error));
      res.redirect(appendQuery(returnTo, { login_error: "failed" }));
    }
  });

  app.post("/api/auth/google/exchange", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const entry = loginCodes.consume(typeof req.body?.code === "string" ? req.body.code : "");
    if (!entry) {
      res.status(401).json({ error: "Código inválido ou expirado" });
      return;
    }
    const user = await db.getUserByOpenId(entry.openId);
    if (!user) {
      res.status(401).json({ error: "Usuário não encontrado" });
      return;
    }
    const token = await sdk.signSession({ openId: user.openId, appId: ENV.appId || "urbico", name: user.name || "Usuário" });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ success: true, app_session_id: token, user: buildUserResponse(user) });
  });
}
