CREATE TYPE "public"."cri_portfolio" AS ENUM('high-yield', 'centro-oeste');--> statement-breakpoint
CREATE TYPE "public"."opp_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "approved_cris" (
	"id" serial PRIMARY KEY NOT NULL,
	"isin" varchar(30) NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"approved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approved_cris_isin_unique" UNIQUE("isin")
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"cri_name" varchar(255) NOT NULL,
	"debtor" varchar(255) NOT NULL,
	"securitizer" varchar(255) NOT NULL,
	"rate" varchar(100) NOT NULL,
	"maturity_date" varchar(50),
	"portfolio" "cri_portfolio" NOT NULL,
	"status" "opp_status" DEFAULT 'pending' NOT NULL,
	"source" varchar(100) NOT NULL,
	"source_url" text,
	"gemini_analysis" text,
	"risk_level" "risk_level",
	"opportunity" text,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_cris" (
	"id" serial PRIMARY KEY NOT NULL,
	"isin" varchar(30) NOT NULL,
	"name" text NOT NULL,
	"debtor" text,
	"securitizer" text,
	"rate" text,
	"maturity_date" text,
	"portfolio" text,
	"lastro" text,
	"estado" varchar(5),
	"regiao" text,
	"situacao" text,
	"classe" text,
	"motivo_filtro" text,
	"data" jsonb,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_cris_isin_unique" UNIQUE("isin")
);
--> statement-breakpoint
CREATE TABLE "portfolio_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_decisions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rejected_isins" (
	"id" serial PRIMARY KEY NOT NULL,
	"isin" varchar(30) NOT NULL,
	"rejected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rejected_isins_isin_unique" UNIQUE("isin")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"login_method" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE INDEX "approved_isin_idx" ON "approved_cris" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "pending_isin_idx" ON "pending_cris" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "rejected_isin_idx" ON "rejected_isins" USING btree ("isin");