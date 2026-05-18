import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const opportunities = mysqlTable("opportunities", {
  id: int("id").autoincrement().primaryKey(),
  criName: varchar("criName", { length: 255 }).notNull(),
  debtor: varchar("debtor", { length: 255 }).notNull(),
  securitizer: varchar("securitizer", { length: 255 }).notNull(),
  rate: varchar("rate", { length: 100 }).notNull(),
  maturityDate: varchar("maturityDate", { length: 50 }),
  portfolio: mysqlEnum("portfolio", ["high-yield", "centro-oeste"]).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  sourceUrl: text("sourceUrl"),
  geminiAnalysis: text("geminiAnalysis"),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]),
  opportunity: text("opportunity"),
  discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  rejectedAt: timestamp("rejectedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;
