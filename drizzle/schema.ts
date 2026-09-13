import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const departureAlerts = mysqlTable("departure_alerts", {
  id: int("id").autoincrement().primaryKey(),
  installationId: varchar("installation_id", { length: 64 }).notNull().unique(),
  appointmentLabel: varchar("appointment_label", { length: 160 }).notNull(),
  appointmentAt: timestamp("appointment_at").notNull(),
  lineId: int("line_id").notNull(),
  destinationLatitude: decimal("destination_latitude", { precision: 10, scale: 7 }).notNull(),
  destinationLongitude: decimal("destination_longitude", { precision: 10, scale: 7 }).notNull(),
  latestLatitude: decimal("latest_latitude", { precision: 10, scale: 7 }),
  latestLongitude: decimal("latest_longitude", { precision: 10, scale: 7 }),
  locationConsented: boolean("location_consented").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  alertedAt: timestamp("alerted_at"),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DepartureAlert = typeof departureAlerts.$inferSelect;
export type InsertDepartureAlert = typeof departureAlerts.$inferInsert;

/**
 * Relatos de lotação por linha. Anônimo por design: não guarda
 * installationId nem qualquer identificador de quem reportou, apenas a
 * linha, o nível relatado e o momento — o suficiente para agregar por
 * recência/quantidade sem expor identidade (ver decisão de produto do
 * Urbico sobre lotação colaborativa).
 */
export const crowdReports = mysqlTable("crowd_reports", {
  id: int("id").autoincrement().primaryKey(),
  lineId: int("line_id").notNull(),
  level: mysqlEnum("level", ["Vazio", "Baixa", "Normal", "Alta", "Lotado"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrowdReport = typeof crowdReports.$inferSelect;
export type InsertCrowdReport = typeof crowdReports.$inferInsert;

/**
 * Uma linha por usuário conectado ao Google Agenda. Guarda só o
 * refresh_token (de longa duração) — o access_token de curta duração é
 * pedido sob demanda a cada operação (ver server/integrations/google-calendar.ts)
 * e nunca fica persistido. IMPORTANTE: refreshToken é uma credencial
 * sensível (dá acesso à agenda da pessoa) — em produção considere
 * criptografar esta coluna em repouso (ex.: com uma chave do provedor de
 * banco, ou cifrando na aplicação antes de gravar).
 */
export const googleCalendarAccounts = mysqlTable("google_calendar_accounts", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  refreshToken: text("refresh_token").notNull(),
  calendarId: varchar("calendar_id", { length: 255 }).notNull().default("primary"),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type GoogleCalendarAccount = typeof googleCalendarAccounts.$inferSelect;
export type InsertGoogleCalendarAccount = typeof googleCalendarAccounts.$inferInsert;

/**
 * Backup/sincronização na nuvem dos dados locais do app (favoritos, agenda,
 * preferências) — uma linha por usuário (openId), guardando tudo como um
 * único JSON. Permite recuperar esses dados ao entrar com a mesma conta em
 * outro aparelho (ver lib/cloud-sync.tsx). Deliberadamente um blob único em
 * vez de tabelas normalizadas por favorito/compromisso: o formato local já
 * é uma lista de objetos JSON-serializáveis simples, e nenhuma outra parte
 * do backend precisa consultar favoritos/compromissos individualmente — só
 * ler/gravar tudo de uma vez por usuário, o que este formato faz com uma
 * única linha por conta em vez de N linhas por item.
 */
export const userDataSync = mysqlTable("user_data_sync", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  payload: text("payload").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UserDataSync = typeof userDataSync.$inferSelect;
export type InsertUserDataSync = typeof userDataSync.$inferInsert;
