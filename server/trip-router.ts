// tRPC da Etapa 4: viagem (start/checkIn/ping/checkOut/cancel/current) e
// lotação (submit/estimate/history). Reaproveita o router, o banco e a SPTrans
// atuais; nenhuma infraestrutura nova.
import { TRPCError } from "@trpc/server";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { ESTIMATE_WINDOW_MINUTES, estimateCrowd } from "../lib/crowd-estimate";
import {
  CHECKIN_FRESH_MS,
  CROWD_LEVELS,
  KEYLESS_REPORTS_PER_MINUTE_CAP,
  PING_MIN_INTERVAL_MS,
  REPORT_DEDUPE_MS,
  REPORT_HOURLY_CAP,
  REPORT_MIN_INTERVAL_MS,
  TRIP_STALE_MS,
  isCheckInFresh,
  roundApprox,
} from "../lib/trip-rules";
import type { Trip } from "../drizzle/schema";
import { publicProcedure, router } from "./_core/trpc";
import { getLineStops, getLineVehicles } from "./integrations/sptrans";
import * as tripsDb from "./trips-db";

const installationIdSchema = z.string().uuid();
const lineIdSchema = z.number().int().positive();
const directionSchema = z.union([z.literal(1), z.literal(2)]);
const vehiclePrefixSchema = z.string().trim().min(1).max(32);
const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);
const levelSchema = z.enum(CROWD_LEVELS);

/** Identificador não reversível (sem o segredo do servidor) usado só para anti-spam. */
export function reporterKeyFor(installationId: string): string {
  return createHmac("sha256", process.env.JWT_SECRET || "urbico-reporter").update(installationId).digest("hex").slice(0, 32);
}

function serializeTrip(trip: Trip, now: Date) {
  return {
    id: trip.id,
    lineId: trip.lineId,
    direction: trip.direction,
    vehiclePrefix: trip.vehiclePrefix,
    status: trip.status,
    checkedIn: trip.checkedInAt !== null,
    checkedInFresh: isCheckInFresh(trip, now),
    startedAt: trip.startedAt.toISOString(),
    checkedInAt: trip.checkedInAt ? trip.checkedInAt.toISOString() : null,
    lastSeenAt: trip.lastSeenAt.toISOString(),
    endedAt: trip.endedAt ? trip.endedAt.toISOString() : null,
    expiresAt: trip.status === "ACTIVE" ? new Date(trip.lastSeenAt.getTime() + TRIP_STALE_MS).toISOString() : null,
  };
}

function locationPatch(latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) return {};
  return { approxLatitude: String(roundApprox(latitude)), approxLongitude: String(roundApprox(longitude)) };
}

/** Linha desconhecida pela SPTrans → recusa. SPTrans fora do ar → não bloqueia (melhor esforço). */
async function assertKnownLine(lineId: number) {
  let stops: unknown[];
  try {
    stops = await getLineStops(lineId);
  } catch {
    return;
  }
  if (stops.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Linha desconhecida." });
}

/** Veículo informado pelo cliente só é aceito se existir de fato na linha segundo a SPTrans. */
async function verifiedVehiclePrefix(lineId: number, prefix: string | null | undefined): Promise<string | null> {
  if (!prefix) return null;
  try {
    const vehicles = await getLineVehicles(lineId);
    return vehicles.some((vehicle) => String(vehicle.prefix) === prefix) ? prefix : null;
  } catch {
    return null;
  }
}

async function requireOwnedTrip(installationId: string, tripId: number): Promise<Trip> {
  const trip = await tripsDb.getTripById(tripId);
  // Mesma resposta para "não existe" e "é de outra pessoa": não revela existência.
  if (!trip || trip.installationId !== installationId) throw new TRPCError({ code: "NOT_FOUND", message: "Viagem não encontrada." });
  return trip;
}

function requireActive(trip: Trip): Trip {
  if (trip.status !== "ACTIVE") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A viagem não está mais ativa." });
  return trip;
}

const endedPatch = (status: "COMPLETED" | "CANCELLED", now: Date) => ({ status, endedAt: now, approxLatitude: null, approxLongitude: null });

export const tripRouter = router({
  start: publicProcedure
    .input(
      z.object({
        installationId: installationIdSchema,
        lineId: lineIdSchema,
        direction: directionSchema.optional(),
        vehiclePrefix: vehiclePrefixSchema.optional(),
        originLabel: z.string().trim().max(160).optional(),
        destinationLabel: z.string().trim().max(160).optional(),
        boardingStopId: z.number().int().positive().optional(),
        alightingStopId: z.number().int().positive().optional(),
        latitude: latitudeSchema.optional(),
        longitude: longitudeSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      await tripsDb.expireStaleTrips(now);
      const existing = await tripsDb.getActiveTripForInstallation(input.installationId);
      // Idempotente: mesma linha → devolve a viagem já ativa (e renova o sinal de vida).
      if (existing && existing.lineId === input.lineId) {
        const refreshed = await tripsDb.updateTrip(existing.id, { lastSeenAt: now, ...locationPatch(input.latitude, input.longitude) });
        return { trip: serializeTrip(refreshed ?? existing, now), reused: true };
      }
      await assertKnownLine(input.lineId);
      if (existing) {
        // Viagem incompatível: se já há CHECK_IN recente em outra linha, não troca sozinho.
        if (isCheckInFresh(existing, now)) {
          throw new TRPCError({ code: "CONFLICT", message: "Você já está em outra viagem. Encerre-a antes de iniciar uma nova." });
        }
        await tripsDb.updateTrip(existing.id, endedPatch("CANCELLED", now));
      }
      const vehiclePrefix = await verifiedVehiclePrefix(input.lineId, input.vehiclePrefix);
      const created = await tripsDb.createTrip({
        installationId: input.installationId,
        lineId: input.lineId,
        direction: input.direction ?? null,
        vehiclePrefix,
        originLabel: input.originLabel ?? null,
        destinationLabel: input.destinationLabel ?? null,
        boardingStopId: input.boardingStopId ?? null,
        alightingStopId: input.alightingStopId ?? null,
        status: "ACTIVE",
        startedAt: now,
        lastSeenAt: now,
        ...locationPatch(input.latitude, input.longitude),
      });
      return { trip: serializeTrip(created, now), reused: false };
    }),

  // "Estou neste ônibus." Idempotente: repetir não muda o primeiro checkedInAt.
  checkIn: publicProcedure
    .input(z.object({ installationId: installationIdSchema, tripId: z.number().int().positive(), vehiclePrefix: vehiclePrefixSchema.optional(), latitude: latitudeSchema.optional(), longitude: longitudeSchema.optional() }))
    .mutation(async ({ input }) => {
      const now = new Date();
      await tripsDb.expireStaleTrips(now);
      const trip = requireActive(await requireOwnedTrip(input.installationId, input.tripId));
      const patch: Parameters<typeof tripsDb.updateTrip>[1] = { lastSeenAt: now, ...locationPatch(input.latitude, input.longitude) };
      if (trip.checkedInAt === null) patch.checkedInAt = now;
      if (trip.vehiclePrefix === null && input.vehiclePrefix) {
        const verified = await verifiedVehiclePrefix(trip.lineId, input.vehiclePrefix);
        if (verified) patch.vehiclePrefix = verified;
      }
      const updated = await tripsDb.updateTrip(trip.id, patch);
      return { trip: serializeTrip(updated ?? trip, now) };
    }),

  // Sinal de vida periódico (o app envia a cada poucos minutos, NÃO a cada leitura de GPS).
  ping: publicProcedure
    .input(z.object({ installationId: installationIdSchema, tripId: z.number().int().positive(), latitude: latitudeSchema.optional(), longitude: longitudeSchema.optional() }))
    .mutation(async ({ input }) => {
      const now = new Date();
      await tripsDb.expireStaleTrips(now);
      const trip = requireActive(await requireOwnedTrip(input.installationId, input.tripId));
      if (now.getTime() - trip.lastSeenAt.getTime() < PING_MIN_INTERVAL_MS) return { trip: serializeTrip(trip, now) };
      const updated = await tripsDb.updateTrip(trip.id, { lastSeenAt: now, ...locationPatch(input.latitude, input.longitude) });
      return { trip: serializeTrip(updated ?? trip, now) };
    }),

  // Idempotente: encerrar o que já está encerrado devolve o estado final sem alterá-lo.
  checkOut: publicProcedure.input(z.object({ installationId: installationIdSchema, tripId: z.number().int().positive() })).mutation(async ({ input }) => {
    const now = new Date();
    const trip = await requireOwnedTrip(input.installationId, input.tripId);
    if (trip.status !== "ACTIVE") return { trip: serializeTrip(trip, now) };
    const updated = await tripsDb.updateTrip(trip.id, endedPatch("COMPLETED", now));
    return { trip: serializeTrip(updated ?? trip, now) };
  }),

  cancel: publicProcedure.input(z.object({ installationId: installationIdSchema, tripId: z.number().int().positive() })).mutation(async ({ input }) => {
    const now = new Date();
    const trip = await requireOwnedTrip(input.installationId, input.tripId);
    if (trip.status !== "ACTIVE") return { trip: serializeTrip(trip, now) };
    const updated = await tripsDb.updateTrip(trip.id, endedPatch("CANCELLED", now));
    return { trip: serializeTrip(updated ?? trip, now) };
  }),

  // Recupera a viagem ativa (app reaberto, sessão perdida). Aplica a expiração antes de responder.
  current: publicProcedure.input(z.object({ installationId: installationIdSchema })).query(async ({ input }) => {
    const now = new Date();
    await tripsDb.expireStaleTrips(now);
    const trip = await tripsDb.getActiveTripForInstallation(input.installationId);
    return { trip: trip ? serializeTrip(trip, now) : null };
  }),
});

// Procedures de lotação, mescladas em `crowdReports` (routers.ts). `submit`
// mantém o contrato antigo ({ lineId, level }) e acrescenta campos opcionais.
export const crowdProcedures = {
  submit: publicProcedure
    .input(
      z.object({
        lineId: lineIdSchema,
        level: levelSchema,
        installationId: installationIdSchema.optional(),
        tripId: z.number().int().positive().optional(),
        direction: directionSchema.optional(),
        vehiclePrefix: vehiclePrefixSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      let direction: number | null = input.direction ?? null;
      let vehiclePrefix: string | null = null;
      let tripId: number | null = null;

      if (input.tripId !== undefined) {
        if (!input.installationId) throw new TRPCError({ code: "BAD_REQUEST", message: "installationId é obrigatório ao informar a viagem." });
        await tripsDb.expireStaleTrips(now);
        const trip = requireActive(await requireOwnedTrip(input.installationId, input.tripId));
        // Linha, sentido e veículo vêm da viagem validada, não do cliente.
        if (trip.lineId !== input.lineId) throw new TRPCError({ code: "BAD_REQUEST", message: "A linha não corresponde à viagem." });
        tripId = trip.id;
        direction = trip.direction;
        vehiclePrefix = trip.vehiclePrefix;
      } else {
        vehiclePrefix = await verifiedVehiclePrefix(input.lineId, input.vehiclePrefix);
      }

      let reporterKey: string | null = null;
      if (input.installationId) {
        reporterKey = reporterKeyFor(input.installationId);
        const activity = await tripsDb.getReporterActivity(reporterKey, input.lineId, now);
        if (activity.last) {
          const elapsed = now.getTime() - activity.last.createdAt.getTime();
          // Repetição do mesmo nível na mesma linha: ignorada sem erro.
          if (elapsed < REPORT_DEDUPE_MS && activity.last.level === input.level) return { submitted: true as const, deduped: true };
          if (elapsed < REPORT_MIN_INTERVAL_MS) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Aguarde um minuto antes de enviar outro relato." });
        }
        if (activity.countLastHour >= REPORT_HOURLY_CAP) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Limite de relatos por hora atingido." });
      } else {
        // Cliente legado/Norby sem installationId: não dá para limitar por pessoa,
        // então há um teto por linha por minuto contra inundação.
        const recent = await tripsDb.countKeylessReports(input.lineId, new Date(now.getTime() - 60 * 1000));
        if (recent >= KEYLESS_REPORTS_PER_MINUTE_CAP) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitos relatos recentes para esta linha. Tente em instantes." });
      }

      await tripsDb.insertCrowdReportDetailed({ lineId: input.lineId, level: input.level, tripId, direction, vehiclePrefix, reporterKey });
      return { submitted: true as const, deduped: false };
    }),

  // Estimativa atual com nível de confiança. Sem dados → level null, confidence NONE (nada é inventado).
  estimate: publicProcedure
    .input(z.object({ lineId: lineIdSchema, direction: directionSchema.optional(), vehiclePrefix: vehiclePrefixSchema.optional() }))
    .query(async ({ input }) => {
      const now = new Date();
      const since = new Date(now.getTime() - ESTIMATE_WINDOW_MINUTES * 60 * 1000);
      const [rows, activeCheckIns] = await Promise.all([
        tripsDb.listRecentCrowdReports(input.lineId, since),
        tripsDb.countActiveCheckIns(input.lineId, input.direction ?? null, new Date(now.getTime() - CHECKIN_FRESH_MS)),
      ]);
      const estimate = estimateCrowd({ reports: rows, now, activeCheckIns, direction: input.direction ?? null, vehiclePrefix: input.vehiclePrefix ?? null });
      return { lineId: input.lineId, ...estimate, updatedAt: now.toISOString() };
    }),

  // Histórico agregado em blocos de 30 min; nunca inclui quem reportou.
  history: publicProcedure.input(z.object({ lineId: lineIdSchema, hours: z.number().int().min(1).max(24).default(6) })).query(async ({ input }) => {
    const now = new Date();
    const since = new Date(now.getTime() - input.hours * 60 * 60 * 1000);
    const rows = await tripsDb.listCrowdReportsForHistory(input.lineId, since);
    const bucketMs = 30 * 60 * 1000;
    const buckets = new Map<number, { count: number; sum: number }>();
    for (const row of rows) {
      const key = Math.floor(row.createdAt.getTime() / bucketMs) * bucketMs;
      const entry = buckets.get(key) ?? { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += CROWD_LEVELS.indexOf(row.level);
      buckets.set(key, entry);
    }
    return {
      lineId: input.lineId,
      bucketMinutes: 30,
      buckets: [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([start, entry]) => {
          const average = entry.sum / entry.count;
          return { start: new Date(start).toISOString(), reportCount: entry.count, averageLevelIndex: Math.round(average * 100) / 100, level: CROWD_LEVELS[Math.round(average)] };
        }),
    };
  }),
};
