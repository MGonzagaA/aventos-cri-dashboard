import { db } from "./index";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  if (!db) return;
  try {
    // Colunas da tabela users
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`);

    // Tabelas do sistema de aprovação
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS approved_cris (
        id serial PRIMARY KEY,
        isin varchar(30) NOT NULL UNIQUE,
        name text NOT NULL,
        data jsonb NOT NULL,
        approved_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pending_cris (
        id serial PRIMARY KEY,
        isin varchar(30) NOT NULL UNIQUE,
        name text NOT NULL,
        debtor text, securitizer text, rate text,
        maturity_date text, portfolio text, lastro text,
        estado varchar(5), regiao text, situacao text,
        classe text, motivo_filtro text, data jsonb,
        scanned_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rejected_isins (
        id serial PRIMARY KEY,
        isin varchar(30) NOT NULL UNIQUE,
        rejected_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS portfolio_decisions (
        id serial PRIMARY KEY,
        key varchar(100) NOT NULL UNIQUE,
        value jsonb NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);

    // Criar conta admin se não existir
    await seedAdmin();

    console.log("[DB] Migrações aplicadas com sucesso");
  } catch (e: any) {
    console.error("[DB] Erro na migração:", e.message);
  }
}

async function seedAdmin() {
  if (!db) return;
  const adminEmail = process.env.ADMIN_EMAIL ?? "gonzaga.cntts@gmail.com";
  const adminPass  = process.env.ADMIN_PASSWORD ?? "1234";

  const existing = await db.execute(
    sql`SELECT id FROM users WHERE email = ${adminEmail} AND password_hash IS NOT NULL LIMIT 1`
  );
  if ((existing as any).length > 0) return;

  const bcrypt = await import("bcryptjs");
  const hash   = await bcrypt.hash(adminPass, 12);

  await db.execute(sql`
    INSERT INTO users (open_id, name, email, password_hash, login_method, role, status)
    VALUES (
      ${"local:" + adminEmail},
      'Matheus Gonzaga',
      ${adminEmail},
      ${hash},
      'email',
      'admin',
      'active'
    )
    ON CONFLICT (open_id) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'admin',
      status = 'active'
  `);
  console.log(`[DB] Conta admin criada: ${adminEmail}`);
}
