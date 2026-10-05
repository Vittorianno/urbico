// Acesso ao MySQL (Drizzle) para viagens e relatos detalhados de lotação.
// Mantido fora de server/db.ts para não tocar nas funções existentes; usa o
// mesmo getDb() e as mesmas tabelas do schema.
import { and, count, desc, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { crowdReports, trips, type InsertCrowdReport, type InsertTrip, type Trip } from "../drizzle/schema";
import { TRIP_MAX_MS, TRIP_STALE_MS } from "../lib/trip-rules";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para viagens e lotação.");
  return db;
}

/** Expira viagens ACTIVE sem sinal de vida ou acima da duração máxima. Apaga a posição. */
export async function expireStaleTrips(now: Date) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(trips)
    .set({ status: "EXPIRED", endedAt: now, approxLatitude: null, approxLongitude: null })
    .where(and(eq(trips.status, "ACTIVE"), or(lt(trips.lastSeenAt, new Date(now.getTime() - TRIP_STALE_MS)), lt(trips.startedAt, new Date(now.getTime() - TRIP_MAX_MS)))));
}

export async function getTripById(id: number): Promise<Trip | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveTripForInstallation(installationId: string): Promise<Trip | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(trips)
    .where(and(eq(trips.installationId, installationId), eq(trips.status, "ACTIVE")))
    .orderBy(desc(trips.id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Cria a viagem. Sem constraint única para "uma ACTIVE por aparelho" (MySQL
 * não tem índice parcial), então duas criações simultâneas são reconciliadas
 * aqui: fica a de menor id e as demais viram CANCELLED.
 */
export async function createTrip(values: InsertTrip): Promise<Trip> {
  const db = await requireDb();
  const [result] = await db.insert(trips).values(values);
  const insertedId = Number((result as { insertId: number }).insertId);
  const active = await db
    .select()
    .from(trips)
    .where(and(eq(trips.installationId, values.installationId), eq(trips.status, "ACTIVE")))
    .orderBy(trips.id);
  const [keep, ...extras] = active;
  for (const extra of extras) {
    await db.update(trips).set({ status: "CANCELLED", endedAt: new Date(), approxLatitude: null, approxLongitude: null }).where(eq(trips.id, extra.id));
  }
  const row = keep ?? (await getTripById(insertedId));
  if (!row) throw new Error("Não foi possível criar a viagem.");
  return row;
}

export async function updateTrip(id: number, patch: Partial<InsertTrip>): Promise<Trip | null> {
  const db = await requireDb();
  await db.update(trips).set(patch).where(eq(trips.id, id));
  return getTripById(id);
}

/** Passageiros com CHECK_IN ainda recente na linha (e sentido, se informado). Apenas contagem. */
export async function countActiveCheckIns(lineId: number, direction: number | null, since: Date): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const conditions = [eq(trips.lineId, lineId), eq(trips.status, "ACTIVE"), isNotNull(trips.checkedInAt), gte(trips.lastSeenAt, since)];
  if (direction != null) conditions.push(or(isNull(trips.direction), eq(trips.direction, direction))!);
  const [row] = await db
    .select({ total: count() })
    .from(trips)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export async function listRecentCrowdReports(lineId: number, since: Date, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      level: crowdReports.level,
      createdAt: crowdReports.createdAt,
      reporterKey: crowdReports.reporterKey,
      tripId: crowdReports.tripId,
      direction: crowdReports.direction,
      vehiclePrefix: crowdReports.vehiclePrefix,
    })
    .from(crowdReports)
    .where(and(eq(crowdReports.lineId, lineId), gte(crowdReports.createdAt, since)))
    .orderBy(desc(crowdReports.createdAt))
    .limit(limit);
}

/** Histórico agregado: apenas nível e horário, nunca quem reportou. */
export async function listCrowdReportsForHistory(lineId: number, since: Date, limit = 1000) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ level: crowdReports.level, createdAt: crowdReports.createdAt })
    .from(crowdReports)
    .where(and(eq(crowdReports.lineId, lineId), gte(crowdReports.createdAt, since)))
    .orderBy(desc(crowdReports.createdAt))
    .limit(limit);
}

/** Atividade recente de um reporterKey, para o anti-spam. */
export async function getReporterActivity(reporterKey: string, lineId: number, now: Date) {
  const db = await getDb();
  if (!db) return { countLastHour: 0, last: null as { level: InsertCrowdReport["level"]; createdAt: Date } | null };
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [totals] = await db
    .select({ total: count() })
    .from(crowdReports)
    .where(and(eq(crowdReports.reporterKey, reporterKey), gte(crowdReports.createdAt, hourAgo)));
  const lastRows = await db
    .select({ level: crowdReports.level, createdAt: crowdReports.createdAt })
    .from(crowdReports)
    .where(and(eq(crowdReports.reporterKey, reporterKey), eq(crowdReports.lineId, lineId)))
    .orderBy(desc(crowdReports.createdAt))
    .limit(1);
  return { countLastHour: Number(totals?.total ?? 0), last: lastRows[0] ?? null };
}

/** Relatos sem reporterKey (legado/Norby) na linha desde `since`: teto global anti-flood. */
export async function countKeylessReports(lineId: number, since: Date): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ total: count() })
    .from(crowdReports)
    .where(and(eq(crowdReports.lineId, lineId), isNull(crowdReports.reporterKey), gte(crowdReports.createdAt, since)));
  return Number(row?.total ?? 0);
}

export async function insertCrowdReportDetailed(values: InsertCrowdReport) {
  const db = await requireDb();
  await db.insert(crowdReports).values(values);
}
