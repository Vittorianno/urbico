/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Isola o router: sem contexto/sessão reais, sem MySQL e sem SPTrans.
vi.mock("../server/_core/trpc", async () => {
  const { initTRPC } = await import("@trpc/server");
  const t = initTRPC.create();
  return { router: t.router, publicProcedure: t.procedure };
});

vi.mock("../server/integrations/sptrans", () => ({
  getLineStops: async (lineId: number) => (lineId === 404 ? [] : [{ id: 1 }]),
  getLineVehicles: async () => [{ prefix: "11111" }],
}));

const store = vi.hoisted(() => ({ trips: [] as any[], reports: [] as any[], nextTripId: 1 }));

vi.mock("../server/trips-db", () => ({
  expireStaleTrips: async (now: Date) => {
    for (const trip of store.trips) {
      if (trip.status === "ACTIVE" && (now.getTime() - trip.lastSeenAt.getTime() > 20 * 60 * 1000 || now.getTime() - trip.startedAt.getTime() > 4 * 60 * 60 * 1000)) {
        trip.status = "EXPIRED";
        trip.endedAt = now;
        trip.approxLatitude = null;
        trip.approxLongitude = null;
      }
    }
  },
  getTripById: async (id: number) => store.trips.find((trip) => trip.id === id) ?? null,
  getActiveTripForInstallation: async (installationId: string) => [...store.trips].reverse().find((trip) => trip.installationId === installationId && trip.status === "ACTIVE") ?? null,
  createTrip: async (values: any) => {
    const trip = {
      id: store.nextTripId++,
      direction: null,
      vehiclePrefix: null,
      originLabel: null,
      destinationLabel: null,
      boardingStopId: null,
      alightingStopId: null,
      checkedInAt: null,
      endedAt: null,
      approxLatitude: null,
      approxLongitude: null,
      ...values,
    };
    store.trips.push(trip);
    return trip;
  },
  updateTrip: async (id: number, patch: any) => {
    const trip = store.trips.find((item) => item.id === id);
    if (!trip) return null;
    Object.assign(trip, patch);
    return trip;
  },
  countActiveCheckIns: async (lineId: number, direction: number | null, since: Date) =>
    store.trips.filter((trip) => trip.lineId === lineId && trip.status === "ACTIVE" && trip.checkedInAt !== null && trip.lastSeenAt >= since && (direction == null || trip.direction == null || trip.direction === direction)).length,
  listRecentCrowdReports: async (lineId: number, since: Date) => store.reports.filter((item) => item.lineId === lineId && item.createdAt >= since).sort((a, b) => b.createdAt - a.createdAt),
  listCrowdReportsForHistory: async (lineId: number, since: Date) => store.reports.filter((item) => item.lineId === lineId && item.createdAt >= since),
  getReporterActivity: async (reporterKey: string, lineId: number, now: Date) => {
    const mine = store.reports.filter((item) => item.reporterKey === reporterKey);
    const lastOnLine = mine.filter((item) => item.lineId === lineId).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    return { countLastHour: mine.filter((item) => item.createdAt.getTime() >= now.getTime() - 60 * 60 * 1000).length, last: lastOnLine ? { level: lastOnLine.level, createdAt: lastOnLine.createdAt } : null };
  },
  countKeylessReports: async (lineId: number, since: Date) => store.reports.filter((item) => item.lineId === lineId && item.reporterKey === null && item.createdAt >= since).length,
  insertCrowdReportDetailed: async (values: any) => {
    store.reports.push({ ...values, createdAt: new Date() });
  },
}));

import { router } from "../server/_core/trpc";
import { crowdProcedures, tripRouter } from "../server/trip-router";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const E = "55555555-5555-4555-8555-555555555555";

const trip = tripRouter.createCaller({} as never);
const crowd = router(crowdProcedures as any).createCaller({} as never) as any;

const advance = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));
const MINUTE = 60 * 1000;

beforeEach(() => {
  store.trips.length = 0;
  store.reports.length = 0;
  store.nextTripId = 1;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("viagem", () => {
  it("inicia uma viagem ACTIVE e é idempotente para a mesma linha", async () => {
    const first = await trip.start({ installationId: A, lineId: 100 });
    expect(first.trip.status).toBe("ACTIVE");
    expect(first.reused).toBe(false);
    const again = await trip.start({ installationId: A, lineId: 100 });
    expect(again.reused).toBe(true);
    expect(again.trip.id).toBe(first.trip.id);
    expect(store.trips).toHaveLength(1);
  });

  it("troca a viagem anterior quando ainda não houve CHECK_IN", async () => {
    await trip.start({ installationId: A, lineId: 100 });
    const second = await trip.start({ installationId: A, lineId: 200 });
    expect(second.reused).toBe(false);
    expect(store.trips.map((item) => item.status)).toEqual(["CANCELLED", "ACTIVE"]);
  });

  it("impede viagem incompatível quando já há CHECK_IN recente em outra linha", async () => {
    const started = await trip.start({ installationId: A, lineId: 100 });
    await trip.checkIn({ installationId: A, tripId: started.trip.id });
    await expect(trip.start({ installationId: A, lineId: 200 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.trips).toHaveLength(1);
    expect(store.trips[0].status).toBe("ACTIVE");
  });

  it("recusa linha desconhecida pela SPTrans", async () => {
    await expect(trip.start({ installationId: A, lineId: 404 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(store.trips).toHaveLength(0);
  });

  it("CHECK_IN é idempotente e preserva o primeiro horário", async () => {
    const started = await trip.start({ installationId: A, lineId: 100 });
    const first = await trip.checkIn({ installationId: A, tripId: started.trip.id });
    expect(first.trip.checkedIn).toBe(true);
    advance(MINUTE);
    const second = await trip.checkIn({ installationId: A, tripId: started.trip.id });
    expect(second.trip.checkedInAt).toBe(first.trip.checkedInAt);
  });

  it("CHECK_OUT encerra, apaga a posição e é idempotente", async () => {
    const started = await trip.start({ installationId: A, lineId: 100, latitude: -23.550523, longitude: -46.633308 });
    expect(store.trips[0].approxLatitude).toBe("-23.551");
    const out = await trip.checkOut({ installationId: A, tripId: started.trip.id });
    expect(out.trip.status).toBe("COMPLETED");
    expect(store.trips[0].approxLatitude).toBeNull();
    const outAgain = await trip.checkOut({ installationId: A, tripId: started.trip.id });
    expect(outAgain.trip.status).toBe("COMPLETED");
    await expect(trip.checkIn({ installationId: A, tripId: started.trip.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("cancelar não altera uma viagem já concluída", async () => {
    const started = await trip.start({ installationId: A, lineId: 100 });
    await trip.checkOut({ installationId: A, tripId: started.trip.id });
    const cancelled = await trip.cancel({ installationId: A, tripId: started.trip.id });
    expect(cancelled.trip.status).toBe("COMPLETED");
  });

  it("expira por ausência prolongada", async () => {
    await trip.start({ installationId: A, lineId: 100 });
    advance(21 * MINUTE);
    const current = await trip.current({ installationId: A });
    expect(current.trip).toBeNull();
    expect(store.trips[0].status).toBe("EXPIRED");
  });

  it("ping mantém a viagem viva além dos 20 minutos", async () => {
    const started = await trip.start({ installationId: A, lineId: 100 });
    advance(15 * MINUTE);
    await trip.ping({ installationId: A, tripId: started.trip.id });
    advance(15 * MINUTE);
    const current = await trip.current({ installationId: A });
    expect(current.trip?.id).toBe(started.trip.id);
  });

  it("recupera a viagem ativa após perda de sessão, só para o mesmo aparelho", async () => {
    const started = await trip.start({ installationId: A, lineId: 100 });
    const recovered = await trip.current({ installationId: A });
    expect(recovered.trip?.id).toBe(started.trip.id);
    expect((await trip.current({ installationId: B })).trip).toBeNull();
  });

  it("outro aparelho não consegue alterar nem encerrar a viagem alheia", async () => {
    const started = await trip.start({ installationId: A, lineId: 100 });
    await expect(trip.checkIn({ installationId: B, tripId: started.trip.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(trip.ping({ installationId: B, tripId: started.trip.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(trip.checkOut({ installationId: B, tripId: started.trip.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(trip.cancel({ installationId: B, tripId: started.trip.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.trips[0].status).toBe("ACTIVE");
    expect(store.trips[0].checkedInAt).toBeNull();
  });

  it("só aceita veículo que exista de fato na linha segundo a SPTrans", async () => {
    const fake = await trip.start({ installationId: A, lineId: 100, vehiclePrefix: "99999" });
    expect(fake.trip.vehiclePrefix).toBeNull();
    const real = await trip.start({ installationId: B, lineId: 100, vehiclePrefix: "11111" });
    expect(real.trip.vehiclePrefix).toBe("11111");
  });

  it("valida os inputs", async () => {
    await expect(trip.start({ installationId: A, lineId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(trip.start({ installationId: "abc", lineId: 100 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(trip.start({ installationId: A, lineId: 100, latitude: 91, longitude: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(trip.start({ installationId: A, lineId: 100, direction: 3 as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("lotação", () => {
  it("registra um relato válido", async () => {
    const result = await crowd.submit({ lineId: 100, level: "Alta", installationId: A });
    expect(result).toEqual({ submitted: true, deduped: false });
    expect(store.reports).toHaveLength(1);
    expect(store.reports[0].reporterKey).toMatch(/^[0-9a-f]{32}$/);
    expect(store.reports[0].reporterKey).not.toContain(A);
  });

  it("ignora o mesmo nível repetido pela mesma pessoa na mesma linha", async () => {
    await crowd.submit({ lineId: 100, level: "Alta", installationId: A });
    advance(2 * MINUTE);
    const again = await crowd.submit({ lineId: 100, level: "Alta", installationId: A });
    expect(again.deduped).toBe(true);
    expect(store.reports).toHaveLength(1);
  });

  it("aplica intervalo mínimo entre relatos de níveis diferentes", async () => {
    await crowd.submit({ lineId: 100, level: "Alta", installationId: A });
    advance(10 * 1000);
    await expect(crowd.submit({ lineId: 100, level: "Vazio", installationId: A })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    advance(61 * 1000);
    await expect(crowd.submit({ lineId: 100, level: "Vazio", installationId: A })).resolves.toMatchObject({ submitted: true });
  });

  it("limita relatos por hora por pessoa", async () => {
    for (let index = 0; index < 20; index += 1) {
      await crowd.submit({ lineId: 100, level: index % 2 === 0 ? "Vazio" : "Lotado", installationId: A });
      advance(61 * 1000);
    }
    await expect(crowd.submit({ lineId: 100, level: "Vazio", installationId: A })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(store.reports).toHaveLength(20);
  });

  it("mantém compatível o relato anônimo antigo (sem installationId)", async () => {
    await expect(crowd.submit({ lineId: 100, level: "Normal" })).resolves.toMatchObject({ submitted: true });
    expect(store.reports[0].reporterKey).toBeNull();
  });

  it("liga o relato à viagem e usa linha/sentido/veículo da viagem, não do cliente", async () => {
    const started = await trip.start({ installationId: A, lineId: 100, direction: 1, vehiclePrefix: "11111" });
    await crowd.submit({ lineId: 100, level: "Alta", installationId: A, tripId: started.trip.id, direction: 2, vehiclePrefix: "22222" });
    expect(store.reports[0]).toMatchObject({ tripId: started.trip.id, direction: 1, vehiclePrefix: "11111" });
  });

  it("recusa relato com viagem de outro aparelho ou de outra linha", async () => {
    const started = await trip.start({ installationId: A, lineId: 100 });
    await expect(crowd.submit({ lineId: 100, level: "Alta", installationId: B, tripId: started.trip.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(crowd.submit({ lineId: 999, level: "Alta", installationId: A, tripId: started.trip.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(crowd.submit({ lineId: 100, level: "Alta", tripId: started.trip.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(store.reports).toHaveLength(0);
  });

  it("valida o nível informado", async () => {
    await expect(crowd.submit({ lineId: 100, level: "Cheio", installationId: A })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("estimativa sem dados não inventa nada", async () => {
    const result = await crowd.estimate({ lineId: 999 });
    expect(result.level).toBeNull();
    expect(result.confidence).toBe("NONE");
  });

  it("estimativa combina relatos recentes e CHECK_INS ativos", async () => {
    await crowd.submit({ lineId: 300, level: "Alta", installationId: A });
    advance(MINUTE);
    await crowd.submit({ lineId: 300, level: "Alta", installationId: B });
    advance(MINUTE);
    await crowd.submit({ lineId: 300, level: "Lotado", installationId: C });
    for (const installationId of [D, E]) {
      const started = await trip.start({ installationId, lineId: 300 });
      await trip.checkIn({ installationId, tripId: started.trip.id });
    }
    advance(MINUTE);
    const result = await crowd.estimate({ lineId: 300 });
    expect(result.level).toBe("Alta");
    expect(result.code).toBe("CROWDED");
    expect(result.reportCount).toBe(3);
    expect(result.activeCheckIns).toBe(2);
    expect(result.confidence).toBe("HIGH");
  });

  it("histórico é agregado e não expõe quem reportou", async () => {
    await crowd.submit({ lineId: 400, level: "Alta", installationId: A });
    const history = await crowd.history({ lineId: 400, hours: 6 });
    expect(history.buckets).toHaveLength(1);
    expect(history.buckets[0]).toMatchObject({ reportCount: 1, level: "Alta" });
    expect(JSON.stringify(history)).not.toContain("reporterKey");
  });
});
