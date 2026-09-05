import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { evaluateDepartureAlerts } from "../leave-alert-monitor";
import { handleDepartureAlertMonitor } from "../scheduled/departure-alerts";

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

function startDepartureAlertScheduler() {
  const run = () => {
    evaluateDepartureAlerts().catch((error) => {
      console.error("[departure-alerts] evaluation failed:", error);
    });
  };
  run();
  setInterval(run, DEPARTURE_ALERT_INTERVAL_MS);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
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
}

startServer().catch(console.error);
