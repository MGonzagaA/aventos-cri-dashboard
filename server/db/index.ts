import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("[DB] DATABASE_URL não configurado no .env");
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(client, { schema });

export * from "../../drizzle/schema";
