import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import * as schema from "../../drizzle/schema";

const connectionString = process.env.DATABASE_URL;
const supabaseUrl      = process.env.SUPABASE_URL      ?? "https://coitdqyhcaaxtmghpajy.supabase.co";
const supabaseKey      = process.env.SUPABASE_SERVICE_KEY || "";

if (!connectionString && !supabaseKey) {
  console.warn("[DB] Sem DATABASE_URL nem SUPABASE_SERVICE_KEY — banco desativado");
}

// Cliente REST (sempre disponível quando há chave)
export const supabase = supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

if (supabase) {
  console.log("[DB] ✓ Supabase REST client inicializado");
} else if (!supabaseKey) {
  console.warn("[DB] ✗ Supabase REST client não inicializado — SUPABASE_SERVICE_KEY ausente");
}

// Cliente PostgreSQL direto (opcional, pode falhar em algumas redes)
const pgClient = connectionString
  ? (() => {
      try {
        return postgres(connectionString, { max: 3, idle_timeout: 20, connect_timeout: 10, ssl: { rejectUnauthorized: false } });
      } catch { return null; }
    })()
  : null;

export const db     = pgClient ? drizzle(pgClient, { schema }) : null as unknown as ReturnType<typeof drizzle<typeof schema>>;
export const sqlRaw = pgClient;

export * from "../../drizzle/schema";
