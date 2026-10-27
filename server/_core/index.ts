import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleCalendarRoutes } from "./google-calendar-routes";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { evaluateDepartureAlerts } from "../leave-alert-monitor";
import { handleDepartureAlertMonitor } from "../scheduled/departure-alerts";
import { getNorbyStatus } from "../integrations/norby";
import { createCorsMiddleware, createRateLimiter, logSecurityWarnings } from "./security";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// FIX: o monitoramento do alerta de saída (evaluateDepartureAlerts) só era
// disparado via POST /api/scheduled/monitor-departure-alerts, autenticado
// como uma tarefa de cron do Manus (ver server/_core/heartbeat.ts). Nada no
// projeto jamais registrava esse cron (createHeartbeatJob nunca é chamado em
// lugar nenhum) — ou seja, fora da hospedagem do Manus, essa avaliação nunca
// rodava sozinha. Para o backend funcionar de forma independente, ele agora
// roda a própria checagem periodicamente, sem depender de nenhum serviço
// externo de agendamento. O endpoint HTTP continua disponível para quem
// preferir acioná-lo por um cron externo da própria infraestrutura de
// hospedagem (ex.: Vercel Cron, GitHub Actions).
const DEPARTURE_ALERT_INTERVAL_MS = 60_000;

let departureAlertTimer: ReturnType<typeof setInterval> | undefined;

function startDepartureAlertScheduler() {
  const run = () => {
    evaluateDepartureAlerts().catch((error) => {
      console.error("[departure-alerts] evaluation failed:", error);
    });
  };
  run();
  departureAlertTimer = setInterval(run, DEPARTURE_ALERT_INTERVAL_MS);
}

// TRUST_PROXY: quantos proxies reversos existem na frente do servidor
// ("1" na maioria das hospedagens; "true"/"loopback" também aceitos). Sem isto
// atrás de um proxy, req.ip seria o IP do proxy e o rate limit trataria todos
// os usuários como um só. Em produção o padrão é 1; em dev, desligado.
function configureTrustProxy(app: express.Express) {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
    return;
  }
  if (raw === "true") app.set("trust proxy", true);
  else if (raw === "false" || raw === "0") app.set("trust proxy", false);
  else if (/^\d+$/.test(raw)) app.set("trust proxy", Number(raw));
  else app.set("trust proxy", raw);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.disable("x-powered-by");
  configureTrustProxy(app);
  logSecurityWarnings();

  // CORS: allowlist em produção (CORS_ALLOWED_ORIGINS); em desenvolvimento
  // reflete a origem, como antes. Ver server/_core/security.ts.
  app.use(createCorsMiddleware());

  // Limite de payload: os 50mb anteriores não eram necessários (nenhuma rota
  // recebe upload por JSON) e facilitavam esgotar memória.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Rate limit por IP. Valores generosos para uso normal (polling de
  // veículos, chat) e restritivos para troca de token de login.
  app.use("/api/auth/session", createRateLimiter({ windowMs: 60_000, max: 30 }));
  app.use("/api/trpc", createRateLimiter({ windowMs: 60_000, max: 600 }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleCalendarRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Estado REAL do Ollama (configurado? alcançável? modelo instalado?) —
  // permite verificar o Llama sem depender de ler código. Não expõe a URL.
  app.get("/api/norby/status", createRateLimiter({ windowMs: 60_000, max: 30 }), async (_req, res) => {
    res.json(await getNorbyStatus());
  });

  // Mantido para hospedagens que preferem acionar o monitoramento via cron
  // HTTP externo em vez do agendador interno abaixo.
  app.post("/api/scheduled/monitor-departure-alerts", handleDepartureAlertMonitor);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    startDepartureAlertScheduler();
  });

  // Encerramento gracioso (hospedagens enviam SIGTERM ao reiniciar/deploy).
  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} recebido, encerrando...`);
    if (departureAlertTimer) clearInterval(departureAlertTimer);
    server.close(() => process.exit(0));
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    (forceExit as unknown as { unref?: () => void }).unref?.();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
