import { SignJWT, jwtVerify } from "jose";

import { ENV } from "../_core/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
// Escopo mínimo necessário: só eventos do calendário (não pede acesso a
// nenhuma outra informação do Google Agenda/conta da pessoa).
const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function requireGoogleConfig() {
  if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.googleRedirectUri) {
    throw new Error(
      "Integração com o Google Agenda ainda não configurada. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env (veja .env.example).",
    );
  }
}

// ---------------------------------------------------------------------------
// "state" do OAuth — carrega, de forma assinada (não pode ser forjado), qual
// usuário do Urbico iniciou a conexão. Necessário porque quem chama nosso
// endpoint de callback é o navegador sendo redirecionado pelo próprio Google
// — não há como anexar um Authorization: Bearer da sessão do Urbico nesse
// redirecionamento. Reaproveita o mesmo segredo (JWT_SECRET) já usado para
// assinar a sessão do app (server/_core/sdk.ts), mas como um JWT à parte,
// de vida curta (10 min, só o tempo da pessoa completar o consentimento).
function getStateSecret() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET não configurado — necessário para assinar o state do OAuth do Google.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function signGoogleOAuthState(openId: string): Promise<string> {
  const expirationSeconds = Math.floor(Date.now() / 1000) + 10 * 60;
  return new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getStateSecret());
}

export async function verifyGoogleOAuthState(state: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(state, getStateSecret(), { algorithms: ["HS256"] });
    return typeof payload.openId === "string" ? payload.openId : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OAuth: URL de consentimento e troca/renovação de tokens.
export function buildGoogleAuthUrl(state: string): string {
  requireGoogleConfig();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", ENV.googleClientId);
  url.searchParams.set("redirect_uri", ENV.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_EVENTS_SCOPE);
  url.searchParams.set("access_type", "offline");
  // access_type=offline sozinho só garante um refresh_token na PRIMEIRA
  // autorização; prompt=consent força a tela de consentimento sempre, o que
  // garante recebê-lo de novo caso a pessoa desconecte e reconecte depois.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

type GoogleTokenResponse = { access_token: string; refresh_token?: string; expires_in: number; token_type: string };

export async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenResponse> {
  requireGoogleConfig();
  const body = new URLSearchParams({ code, client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, redirect_uri: ENV.googleRedirectUri, grant_type: "authorization_code" });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Google recusou a troca do código de autorização (status ${response.status}).`);
  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  requireGoogleConfig();
  const body = new URLSearchParams({ refresh_token: refreshToken, client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, grant_type: "refresh_token" });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Não foi possível renovar o acesso ao Google Agenda (status ${response.status}). A pessoa provavelmente precisa reconectar.`);
  const payload = (await response.json()) as GoogleTokenResponse;
  return payload.access_token;
}

// ---------------------------------------------------------------------------
// API do Google Calendar (v3) — só os endpoints de eventos, que é tudo que o
// Urbico precisa (escopo pedido é calendar.events, não calendar completo).
export type GoogleCalendarEventInput = { summary: string; location?: string; description?: string; startIso: string; endIso: string; timeZone?: string };
export type GoogleCalendarEvent = { id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string }; location?: string; htmlLink?: string };

const eventsUrl = (calendarId: string) => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

async function calendarRequest(accessToken: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`O Google Agenda respondeu com status ${response.status}.`);
  if (response.status === 204) return null;
  return response.json();
}

function toGoogleEventBody(event: GoogleCalendarEventInput) {
  const timeZone = event.timeZone ?? "America/Sao_Paulo";
  return { summary: event.summary, location: event.location, description: event.description, start: { dateTime: event.startIso, timeZone }, end: { dateTime: event.endIso, timeZone } };
}

export async function createGoogleCalendarEvent(accessToken: string, calendarId: string, event: GoogleCalendarEventInput): Promise<GoogleCalendarEvent> {
  return calendarRequest(accessToken, eventsUrl(calendarId), { method: "POST", body: JSON.stringify(toGoogleEventBody(event)) }) as Promise<GoogleCalendarEvent>;
}

export async function updateGoogleCalendarEvent(accessToken: string, calendarId: string, eventId: string, event: GoogleCalendarEventInput): Promise<GoogleCalendarEvent> {
  return calendarRequest(accessToken, `${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(toGoogleEventBody(event)) }) as Promise<GoogleCalendarEvent>;
}

export async function deleteGoogleCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  await calendarRequest(accessToken, `${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}`, { method: "DELETE" });
}

export async function listGoogleCalendarEvents(accessToken: string, calendarId: string, timeMinIso: string): Promise<GoogleCalendarEvent[]> {
  const url = new URL(eventsUrl(calendarId));
  url.searchParams.set("timeMin", timeMinIso);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "20");
  const payload = (await calendarRequest(accessToken, url.toString())) as { items?: GoogleCalendarEvent[] } | null;
  return payload?.items ?? [];
}
