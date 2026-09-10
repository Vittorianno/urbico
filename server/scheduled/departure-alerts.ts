import type { Request, Response } from "express";

import { evaluateDepartureAlerts } from "../leave-alert-monitor";
import { ENV } from "../_core/env";

/**
 * Acionamento por cron HTTP externo (ex.: GitHub Actions, Vercel Cron) para
 * hospedagens sem processo de longa duração. Não é uma sessão de usuário —
 * autenticado por segredo compartilhado (`CRON_SECRET`), não pelo login do
 * app. O agendador interno (server/_core/index.ts) já roda essa mesma
 * checagem periodicamente sozinho; este endpoint é só um gatilho alternativo.
 */
export async function handleDepartureAlertMonitor(req: Request, res: Response) {
  const providedSecret = req.headers["x-cron-secret"];
  if (!ENV.cronSecret || providedSecret !== ENV.cronSecret) {
    return res.status(403).json({ error: "cron-only" });
  }

  try {
    const results = await evaluateDepartureAlerts();
    return res.json({ ok: true, evaluated: results.length, results });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Falha no monitoramento de alertas.",
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
