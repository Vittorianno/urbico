import { COOKIE_NAME } from "../shared/const.js";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { geocode, planWalkingRoute, suggestAddresses } from "./integrations/open-geospatial";
import { askNorby } from "./integrations/norby";
import { getLineStops, getLineVehicles, getStopPredictions, searchLines, searchStops } from "./integrations/sptrans";
import * as db from "./db";

const safeIntegration = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch {
    throw new Error("A integração está indisponível no momento. Tente novamente em instantes.");
  }
};

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  transit: router({
    searchLines: publicProcedure.input(z.object({ term: z.string().trim().min(2).max(60) })).query(({ input }) => safeIntegration(() => searchLines(input.term))),
    searchStops: publicProcedure.input(z.object({ term: z.string().trim().min(2).max(80) })).query(({ input }) => safeIntegration(() => searchStops(input.term))),
    lineStops: publicProcedure.input(z.object({ lineId: z.number().int().positive() })).query(({ input }) => safeIntegration(() => getLineStops(input.lineId))),
    lineVehicles: publicProcedure.input(z.object({ lineId: z.number().int().positive() })).query(({ input }) => safeIntegration(() => getLineVehicles(input.lineId))),
    stopPredictions: publicProcedure.input(z.object({ stopId: z.number().int().positive() })).query(({ input }) => safeIntegration(() => getStopPredictions(input.stopId))),
    relevantVehicles: publicProcedure.input(z.object({ lineIds: z.array(z.number().int().positive()).min(1).max(3) })).query(({ input }) => safeIntegration(async () => {
      const lines = await Promise.all(input.lineIds.map(async (lineId) => ({ lineId, vehicles: await getLineVehicles(lineId), stops: await getLineStops(lineId) })));
      return { lines };
    })),
  }),
  routing: router({
    geocode: publicProcedure.input(z.object({ query: z.string().trim().min(2).max(160) })).query(({ input }) => safeIntegration(() => geocode(input.query))),
    suggestAddresses: publicProcedure.input(z.object({ query: z.string().trim().min(2).max(160) })).query(({ input }) => safeIntegration(() => suggestAddresses(input.query))),
    planWalking: publicProcedure.input(z.object({ origin: z.string().trim().min(2).max(160), destination: z.string().trim().min(2).max(160) })).mutation(async ({ input }) => safeIntegration(async () => {
      const [origin, destination] = await Promise.all([geocode(input.origin), geocode(input.destination)]);
      if (!origin || !destination) return null;
      const route = await planWalkingRoute(origin, destination);
      return { origin, destination, route };
    })),
  }),
  norby: router({
    chat: publicProcedure.input(z.object({ message: z.string().trim().min(1).max(700), transportContext: z.string().trim().max(3000).optional() })).mutation(({ input }) => safeIntegration(async () => ({ message: await askNorby(input.message, input.transportContext) }))),
  }),
  departureAlerts: router({
    arm: publicProcedure.input(z.object({ installationId: z.string().uuid(), appointmentLabel: z.string().trim().min(1).max(160), appointmentAt: z.coerce.date(), lineId: z.number().int().positive(), destinationLatitude: z.number().min(-90).max(90), destinationLongitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), locationConsented: z.literal(true) })).mutation(async ({ input }) => {
      await db.upsertDepartureAlert({ ...input, destinationLatitude: String(input.destinationLatitude), destinationLongitude: String(input.destinationLongitude), latestLatitude: String(input.latitude), latestLongitude: String(input.longitude), isEnabled: true });
      return { armed: true };
    }),
    updateLocation: publicProcedure.input(z.object({ installationId: z.string().uuid(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })).mutation(async ({ input }) => {
      await db.updateDepartureAlertLocation(input.installationId, String(input.latitude), String(input.longitude));
      return { updated: true };
    }),
    revoke: publicProcedure.input(z.object({ installationId: z.string().uuid() })).mutation(async ({ input }) => {
      await db.disableDepartureAlert(input.installationId);
      return { revoked: true };
    }),
    state: publicProcedure.input(z.object({ installationId: z.string().uuid() })).query(async ({ input }) => {
      const alert = await db.getDepartureAlert(input.installationId);
      return alert ? { armed: alert.isEnabled && alert.locationConsented, alertedAt: alert.alertedAt?.toISOString() ?? null } : { armed: false, alertedAt: null };
    }),
  }),
});

export type AppRouter = typeof appRouter;
