import type { Express, Request, Response } from "express";

import * as db from "../db";
import { exchangeGoogleAuthCode, verifyGoogleOAuthState } from "../integrations/google-calendar";

/**
 * Callback do OAuth do Google Agenda. Precisa ser uma rota HTTP comum (não
 * um procedimento tRPC) porque quem "chama" essa URL é o navegador sendo
 * redirecionado pelo próprio Google — não há como anexar um
 * Authorization: Bearer da sessão do Urbico nesse redirecionamento. Por
 * isso a identidade de quem conectou vem do parâmetro `state`, assinado no
 * passo anterior (procedimento tRPC googleCalendar.getAuthUrl) e verificado
 * aqui. Ao final, redireciona de volta para dentro do app via deep link
 * (esquema "urbico://", ver app.config.ts) para o WebBrowser.openAuthSessionAsync
 * no cliente detectar o retorno e fechar a aba de consentimento sozinho.
 */
export function registerGoogleCalendarRoutes(app: Express) {
  app.get("/api/google-calendar/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    const redirectBack = (status: "connected" | "error", message?: string) => {
      const url = new URL("urbico://google-calendar");
      url.searchParams.set("status", status);
      if (message) url.searchParams.set("message", message);
      res.redirect(url.toString());
    };

    if (error) {
      redirectBack("error", String(error));
      return;
    }
    if (typeof code !== "string" || typeof state !== "string") {
      redirectBack("error", "missing_params");
      return;
    }

    const openId = await verifyGoogleOAuthState(state);
    if (!openId) {
      redirectBack("error", "invalid_state");
      return;
    }

    try {
      const tokens = await exchangeGoogleAuthCode(code);
      if (!tokens.refresh_token) {
        // Google só devolve refresh_token quando a pessoa vê a tela de
        // consentimento de verdade (garantido por prompt=consent em
        // buildGoogleAuthUrl) — se mesmo assim não vier, é mais seguro pedir
        // para tentar de novo do que salvar um acesso que expira em ~1h sem
        // nenhuma forma de renovar depois.
        redirectBack("error", "no_refresh_token");
        return;
      }
      await db.saveGoogleCalendarAccount(openId, tokens.refresh_token);
      redirectBack("connected");
    } catch (err) {
      console.error("[GoogleCalendar] callback failed:", err);
      redirectBack("error", "exchange_failed");
    }
  });
}
