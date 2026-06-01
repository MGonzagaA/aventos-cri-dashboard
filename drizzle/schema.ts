import {
  pgTable, pgEnum, serial, text, varchar, integer,
  timestamp, jsonb, index
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum         = pgEnum("role",          ["user", "admin"]);
export const oppStatusEnum    = pgEnum("opp_status",    ["pending", "accepted", "rejected"]);
export const criPortfolioEnum = pgEnum("cri_portfolio", ["high-yield", "centro-oeste"]);
export const riskLevelEnum    = pgEnum("risk_level",    ["low", "medium", "high"]);

// ─── Users (auth) ─────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  openId:       varchar("open_id",       { length: 64  }).notNull().unique(),
  name:         text("name"),
  email:        varchar("email",         { length: 320 }),
  loginMethod:  varchar("login_method",  { length: 64  }),
  role:         roleEnum("role").default("user").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

// ─── Opportunities ────────────────────────────────────────────────────────────

export const opportunities = pgTable("opportunities", {
  id:             serial("id").primaryKey(),
  criName:        varchar("cri_name",      { length: 255 }).notNull(),
  debtor:         varchar("debtor",        { length: 255 }).notNull(),
  securitizer:    varchar("securitizer",   { length: 255 }).notNull(),
  rate:           varchar("rate",          { length: 100 }).notNull(),
  maturityDate:   varchar("maturity_date", { length: 50  }),
  portfolio:      criPortfolioEnum("portfolio").notNull(),
  status:         oppStatusEnum("status").default("pending").notNull(),
  source:         varchar("source",        { length: 100 }).notNull(),
  sourceUrl:      text("source_url"),
  geminiAnalysis: text("gemini_analysis"),
  riskLevel:      riskLevelEnum("risk_level"),
  opportunity:    text("opportunity"),
  discoveredAt:   timestamp("discovered_at").defaultNow().notNull(),
  acceptedAt:     timestamp("accepted_at"),
  rejectedAt:     timestamp("rejected_at"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

// ─── CRI Approval workflow ────────────────────────────────────────────────────

export const pendingCRIs = pgTable("pending_cris", {
  id:           serial("id").primaryKey(),
  isin:         varchar("isin", { length: 30 }).notNull().unique(),
  name:         text("name").notNull(),
  debtor:       text("debtor"),
  securitizer:  text("securitizer"),
  rate:         text("rate"),
  maturityDate: text("maturity_date"),
  portfolio:    text("portfolio"),
  lastro:       text("lastro"),
  estado:       varchar("estado", { length: 5 }),
  regiao:       text("regiao"),
  situacao:     text("situacao"),
  classe:       text("classe"),
  motivoFiltro: text("motivo_filtro"),
  data:         jsonb("data"),
  scannedAt:    timestamp("scanned_at").defaultNow().notNull(),
}, (t) => [index("pending_isin_idx").on(t.isin)]);

export const approvedCRIs = pgTable("approved_cris", {
  id:         serial("id").primaryKey(),
  isin:       varchar("isin", { length: 30 }).notNull().unique(),
  name:       text("name").notNull(),
  data:       jsonb("data").notNull(),
  approvedAt: timestamp("approved_at").defaultNow().notNull(),
}, (t) => [index("approved_isin_idx").on(t.isin)]);

export const rejectedISINs = pgTable("rejected_isins", {
  id:         serial("id").primaryKey(),
  isin:       varchar("isin", { length: 30 }).notNull().unique(),
  rejectedAt: timestamp("rejected_at").defaultNow().notNull(),
}, (t) => [index("rejected_isin_idx").on(t.isin)]);

export const portfolioDecisions = pgTable("portfolio_decisions", {
  id:        serial("id").primaryKey(),
  key:       varchar("key", { length: 100 }).notNull().unique(),
  value:     jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type User              = typeof users.$inferSelect;
export type InsertUser        = typeof users.$inferInsert;
export type Opportunity       = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;
export type PendingCRI        = typeof pendingCRIs.$inferSelect;
export type ApprovedCRI       = typeof approvedCRIs.$inferSelect;
