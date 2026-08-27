import type { Request, Response } from "express";

import { evaluateDepartureAlerts } from "../leave-alert-monitor";
import { sdk } from "../_core/sdk";

export async function handleDepartureAlertMonitor(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
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
