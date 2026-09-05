import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { crowdReports, departureAlerts, InsertDepartureAlert, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertDepartureAlert(alert: InsertDepartureAlert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para alertas de saída.");
  await db.insert(departureAlerts).values(alert).onDuplicateKeyUpdate({
    set: {
      appointmentLabel: alert.appointmentLabel,
      appointmentAt: alert.appointmentAt,
      lineId: alert.lineId,
      destinationLatitude: alert.destinationLatitude,
      destinationLongitude: alert.destinationLongitude,
      latestLatitude: alert.latestLatitude,
      latestLongitude: alert.latestLongitude,
      locationConsented: alert.locationConsented,
      isEnabled: alert.isEnabled,
      alertedAt: null,
    },
  });
}

// FIX: antes só gravava a localização e não devolvia nada. Como nenhuma tela
// do app nunca consultava `departureAlerts.state` separadamente, o cliente
// jamais descobria quando o servidor marcava alertedAt — o alerta calculado
// nunca chegava a notificar ninguém. Agora devolve o registro atualizado, que
// o router repassa na própria resposta de updateLocation (já chamada
// periodicamente em segundo plano), permitindo ao app notificar localmente
// assim que alertedAt aparecer, sem round-trip extra.
export async function updateDepartureAlertLocation(installationId: string, latitude: string, longitude: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para alertas de saída.");
  await db.update(departureAlerts).set({ latestLatitude: latitude, latestLongitude: longitude }).where(eq(departureAlerts.installationId, installationId));
  const records = await db.select().from(departureAlerts).where(eq(departureAlerts.installationId, installationId)).limit(1);
  return records[0] ?? null;
}

export async function disableDepartureAlert(installationId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(departureAlerts).set({ isEnabled: false, locationConsented: false, latestLatitude: null, latestLongitude: null }).where(eq(departureAlerts.installationId, installationId));
}

export async function getDepartureAlert(installationId: string) {
  const db = await getDb();
  if (!db) return null;
  const records = await db.select().from(departureAlerts).where(eq(departureAlerts.installationId, installationId)).limit(1);
  return records[0] ?? null;
}

export async function listEligibleDepartureAlerts(now: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departureAlerts).where(and(eq(departureAlerts.isEnabled, true), eq(departureAlerts.locationConsented, true), isNull(departureAlerts.alertedAt), gt(departureAlerts.appointmentAt, now)));
}

export async function markDepartureAlertSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(departureAlerts).set({ alertedAt: new Date() }).where(eq(departureAlerts.id, id));
}

/**
 * Grava um relato de lotação anônimo para uma linha. Não guarda nenhum
 * identificador do dispositivo/usuário — só linha, nível e horário.
 */
export async function insertCrowdReport(lineId: number, level: (typeof crowdReports.$inferInsert)["level"]) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para relatos de lotação.");
  await db.insert(crowdReports).values({ lineId, level });
}

const CROWD_LEVEL_ORDER = ["Vazio", "Baixa", "Normal", "Alta", "Lotado"] as const;

/**
 * Agrega os relatos recentes (últimos `windowMinutes`) de uma linha pelo
 * nível mais reportado. Retorna null se não há relatos recentes o
 * suficiente para uma estimativa razoável.
 */
export async function getRecentCrowdSummary(lineId: number, windowMinutes = 30) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const rows = await db
    .select({ level: crowdReports.level, count: sql<number>`count(*)`.as("count") })
    .from(crowdReports)
    .where(and(eq(crowdReports.lineId, lineId), gte(crowdReports.createdAt, since)))
    .groupBy(crowdReports.level)
    .orderBy(desc(sql`count(*)`));
  if (rows.length === 0) return null;
  const totalReports = rows.reduce((total, row) => total + Number(row.count), 0);
  const topLevel = rows[0].level;
  return {
    level: topLevel,
    totalReports,
    // Índice na escala Vazio→Lotado, útil para ordenar/exibir sem repetir a lista de níveis no cliente.
    levelIndex: CROWD_LEVEL_ORDER.indexOf(topLevel),
  };
}
