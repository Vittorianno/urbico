import { COOKIE_NAME } from "../shared/const.js";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { geocode, planWalkingRoute, suggestAddresses } from "./integrations/open-geospatial";
import { askNorby } from "./integrations/norby";
import { getLineStops, getLineVehicles, getStopPredictions, searchLines, searchStops } from "./integrations/sptrans";
import {
  buildGoogleAuthUrl,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
  refreshGoogleAccessToken,
  signGoogleOAuthState,
  updateGoogleCalendarEvent,
} from "./integrations/google-calendar";
import * as db from "./db";

const safeIntegration = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch {
    throw new Error("A integração está indisponível no momento. Tente novamente em instantes.");
  }
};

const crowdLevelSchema = z.enum(["Vazio", "Baixa", "Normal", "Alta", "Lotado"]);

// FIX (sincronização na nuvem): schemas dos itens salvos localmente
// (favoritos/compromissos), usados só para validar o payload de
// userData.push — o formato espelha lib/urbico-context.tsx (Favorite /
// Appointment), mas fica duplicado aqui de propósito: o schema do tRPC não
// pode importar tipos de dentro de app/lib do cliente.
const favoriteSyncSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  address: z.string().min(1).max(300),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const appointmentSyncSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  date: z.string().min(1).max(20),
  time: z.string().min(1).max(10),
  address: z.string().min(1).max(300),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  relevantLineId: z.number().int().positive().optional(),
  relevantLineLabel: z.string().max(80).optional(),
  alertsEnabled: z.boolean().optional(),
  googleEventId: z.string().max(255).optional(),
});

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
  // Painel administrativo mínimo (Fase 12): só números reais agregados das
  // tabelas existentes. adminProcedure já exige role "admin" (ver
  // server/_core/trpc.ts) - qualquer outra pessoa recebe 403.
  admin: router({
    overview: adminProcedure.query(() => db.getAdminOverview()),
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
    status: publicProcedure.query(() => ({
      geocodingAvailable: Boolean(process.env.PELIAS_BASE_URL?.trim()),
      routingAvailable: Boolean(process.env.VALHALLA_BASE_URL?.trim()),
    })),
    geocode: publicProcedure.input(z.object({ query: z.string().trim().min(2).max(160) })).query(({ input }) => safeIntegration(() => geocode(input.query))),
    suggestAddresses: publicProcedure.input(z.object({ query: z.string().trim().min(2).max(160) })).query(({ input }) => safeIntegration(() => suggestAddresses(input.query))),
    // FIX: origin/destination antes eram sempre geocodificados por texto via
    // Pelias, mesmo quando o cliente já sabia a coordenada exata (favorito
    // salvo com lat/lng, ou localização atual por GPS) — isso obrigava a
    // depender do serviço de geocodificação (e podia falhar) mesmo tendo o
    // dado pronto. Agora origin/destinationLatitude/Longitude são opcionais
    // e, quando presentes, pulam o geocode() e usam a coordenada diretamente.
    planWalking: publicProcedure
      .input(
        z.object({
          origin: z.string().trim().min(2).max(160),
          destination: z.string().trim().min(2).max(160),
          originLatitude: z.number().min(-90).max(90).optional(),
          originLongitude: z.number().min(-180).max(180).optional(),
          destinationLatitude: z.number().min(-90).max(90).optional(),
          destinationLongitude: z.number().min(-180).max(180).optional(),
        }),
      )
      .mutation(async ({ input }) =>
        safeIntegration(async () => {
          const origin =
            input.originLatitude != null && input.originLongitude != null
              ? { name: input.origin, address: input.origin, latitude: input.originLatitude, longitude: input.originLongitude }
              : await geocode(input.origin);
          const destination =
            input.destinationLatitude != null && input.destinationLongitude != null
              ? { name: input.destination, address: input.destination, latitude: input.destinationLatitude, longitude: input.destinationLongitude }
              : await geocode(input.destination);
          if (!origin || !destination) return null;
          const route = await planWalkingRoute(origin, destination);
          return { origin, destination, route };
        }),
      ),
  }),
  norby: router({
    chat: publicProcedure.input(z.object({ message: z.string().trim().min(1).max(700), transportContext: z.string().trim().max(3000).optional() })).mutation(({ input }) => safeIntegration(async () => ({ message: await askNorby(input.message, input.transportContext) }))),
  }),
  departureAlerts: router({
    arm: publicProcedure.input(z.object({ installationId: z.string().uuid(), appointmentLabel: z.string().trim().min(1).max(160), appointmentAt: z.coerce.date(), lineId: z.number().int().positive(), destinationLatitude: z.number().min(-90).max(90), destinationLongitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), locationConsented: z.literal(true) })).mutation(async ({ input }) => {
      await db.upsertDepartureAlert({ ...input, destinationLatitude: String(input.destinationLatitude), destinationLongitude: String(input.destinationLongitude), latestLatitude: String(input.latitude), latestLongitude: String(input.longitude), isEnabled: true });
      return { armed: true };
    }),
    // FIX: antes devolvia só `{ updated: true }`. Como nenhuma tela do app
    // consultava `departureAlerts.state` separadamente, o cliente jamais
    // descobria quando o servidor decidia "hora de sair" — o alerta era
    // calculado, mas nunca chegava ao usuário. Esta é a única chamada de rede
    // feita periodicamente enquanto o alerta está armado (a cada atualização
    // de localização em segundo plano), então devolver o estado do alerta
    // aqui é o que permite ao app notificar localmente assim que o servidor
    // marcar alertedAt.
    updateLocation: publicProcedure.input(z.object({ installationId: z.string().uuid(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })).mutation(async ({ input }) => {
      const alert = await db.updateDepartureAlertLocation(input.installationId, String(input.latitude), String(input.longitude));
      return {
        updated: true,
        alertedAt: alert?.alertedAt?.toISOString() ?? null,
        appointmentLabel: alert?.appointmentLabel ?? null,
      };
    }),
    revoke: publicProcedure.input(z.object({ installationId: z.string().uuid() })).mutation(async ({ input }) => {
      await db.disableDepartureAlert(input.installationId);
      return { revoked: true };
    }),
    state: publicProcedure.input(z.object({ installationId: z.string().uuid() })).query(async ({ input }) => {
      const alert = await db.getDepartureAlert(input.installationId);
      return alert ? { armed: alert.isEnabled && alert.locationConsented, alertedAt: alert.alertedAt?.toISOString() ?? null, appointmentLabel: alert.appointmentLabel } : { armed: false, alertedAt: null, appointmentLabel: null };
    }),
  }),
  // Agregação colaborativa de lotação por linha. Anônima por design: o
  // servidor nunca recebe nem grava qualquer identificador do dispositivo.
  crowdReports: router({
    submit: publicProcedure.input(z.object({ lineId: z.number().int().positive(), level: crowdLevelSchema })).mutation(async ({ input }) => {
      await db.insertCrowdReport(input.lineId, input.level);
      return { submitted: true };
    }),
    recent: publicProcedure.input(z.object({ lineId: z.number().int().positive() })).query(async ({ input }) => {
      const summary = await db.getRecentCrowdSummary(input.lineId);
      return summary ?? { level: null, totalReports: 0, levelIndex: -1 };
    }),
    // Mesma agregação de `recent`, mas para várias linhas de uma vez — usada
    // pela lista de resultados em app/next-buses.tsx para mostrar a lotação
    // de cada linha sem exigir que a pessoa selecione uma por uma.
    recentBatch: publicProcedure.input(z.object({ lineIds: z.array(z.number().int().positive()).min(1).max(20) })).query(async ({ input }) => {
      return db.getRecentCrowdSummaryBatch(input.lineIds);
    }),
  }),
  // Integração com o Google Agenda (ver server/integrations/google-calendar.ts).
  // Tudo aqui é protectedProcedure: exige a pessoa logada no Urbico, porque
  // a conta do Google Agenda é ligada ao openId dela, não a um dispositivo
  // anônimo (diferente dos alertas de saída/lotação).
  googleCalendar: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const account = await db.getGoogleCalendarAccount(ctx.user.openId);
      return { connected: Boolean(account) };
    }),
    // Devolve a URL de consentimento do Google já pronta — o cliente abre
    // isso no navegador do sistema (WebBrowser.openAuthSessionAsync) e
    // aguarda o redirecionamento de volta (ver app/(tabs)/profile.tsx).
    getAuthUrl: protectedProcedure.mutation(async ({ ctx }) => {
      const state = await signGoogleOAuthState(ctx.user.openId);
      return { url: buildGoogleAuthUrl(state) };
    }),
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteGoogleCalendarAccount(ctx.user.openId);
      return { disconnected: true };
    }),
    // Cria (sem googleEventId) ou atualiza (com googleEventId) o evento
    // correspondente a um compromisso do Urbico na conta Google conectada.
    // Se a conta não estiver conectada, devolve synced:false sem lançar erro
    // — o compromisso continua salvo normalmente só no Urbico.
    pushAppointment: protectedProcedure
      .input(
        z.object({
          googleEventId: z.string().trim().min(1).max(255).optional(),
          title: z.string().trim().min(1).max(160),
          address: z.string().trim().min(1).max(300),
          startIso: z.string(),
          endIso: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        safeIntegration(async () => {
          const account = await db.getGoogleCalendarAccount(ctx.user.openId);
          if (!account) return { synced: false as const, eventId: null };
          const accessToken = await refreshGoogleAccessToken(account.refreshToken);
          const eventInput = { summary: input.title, location: input.address, startIso: input.startIso, endIso: input.endIso };
          const event = input.googleEventId
            ? await updateGoogleCalendarEvent(accessToken, account.calendarId, input.googleEventId, eventInput)
            : await createGoogleCalendarEvent(accessToken, account.calendarId, eventInput);
          return { synced: true as const, eventId: event.id };
        }),
      ),
    removeAppointment: protectedProcedure.input(z.object({ googleEventId: z.string().trim().min(1).max(255) })).mutation(async ({ ctx, input }) =>
      safeIntegration(async () => {
        const account = await db.getGoogleCalendarAccount(ctx.user.openId);
        if (!account) return { removed: false };
        const accessToken = await refreshGoogleAccessToken(account.refreshToken);
        await deleteGoogleCalendarEvent(accessToken, account.calendarId, input.googleEventId);
        return { removed: true };
      }),
    ),
    // Próximos eventos do Google Agenda da pessoa — base para, no futuro,
    // trazer compromissos criados direto no Google para dentro da tela de
    // Agenda do Urbico (hoje o app só empurra os compromissos criados nele
    // para o Google; puxar ainda não tem UI própria).
    listUpcoming: protectedProcedure.query(async ({ ctx }) =>
      safeIntegration(async () => {
        const account = await db.getGoogleCalendarAccount(ctx.user.openId);
        if (!account) return { connected: false as const, events: [] };
        const accessToken = await refreshGoogleAccessToken(account.refreshToken);
        const events = await listGoogleCalendarEvents(accessToken, account.calendarId, new Date().toISOString());
        return {
          connected: true as const,
          events: events.map((event) => ({ id: event.id, title: event.summary ?? "(sem título)", startIso: event.start?.dateTime ?? null, location: event.location ?? null })),
        };
      }),
    ),
  }),
  // Backup/sincronização na nuvem dos dados locais (favoritos, agenda,
  // preferências) — ver drizzle/schema.ts (userDataSync) e lib/cloud-sync.tsx.
  // protectedProcedure: cada pessoa só lê/grava o próprio payload (por
  // ctx.user.openId), nunca vaza dado de uma conta para outra.
  userData: router({
    pull: protectedProcedure.query(async ({ ctx }) => {
      const record = await db.getUserDataSync(ctx.user.openId);
      if (!record) return null;
      try {
        return JSON.parse(record.payload) as {
          favorites: z.infer<typeof favoriteSyncSchema>[];
          appointments: z.infer<typeof appointmentSyncSchema>[];
          notificationsEnabled: boolean;
          voiceEnabled: boolean;
        };
      } catch {
        // Payload corrompido (não deveria acontecer, já que só nós
        // escrevemos nele) — trata como "sem backup" em vez de derrubar a
        // consulta inteira.
        return null;
      }
    }),
    push: protectedProcedure
      .input(
        z.object({
          favorites: z.array(favoriteSyncSchema).max(200),
          appointments: z.array(appointmentSyncSchema).max(500),
          notificationsEnabled: z.boolean(),
          voiceEnabled: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await db.saveUserDataSync(ctx.user.openId, JSON.stringify(input));
        return { synced: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
