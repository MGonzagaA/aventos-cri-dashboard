import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("[DB] DATABASE_URL não configurado — banco de dados desativado");
}

const client = connectionString
  ? postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: { rejectUnauthorized: false },
    })
  : null;

export const db     = client ? drizzle(client, { schema }) : null as unknown as ReturnType<typeof drizzle<typeof schema>>;
export const sqlRaw = client; // postgres.js client para DDL direto

export * from "../../drizzle/schema";
