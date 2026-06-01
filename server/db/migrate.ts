import "dotenv/config";
import { sqlRaw, supabase } from "./index";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function exec(query: string, label: string) {
  if (!sqlRaw) return;
  try {
    await sqlRaw.unsafe(query);
    console.log(`[DB] ✓ ${label}`);
  } catch (e: any) {
    const msg = e.message ?? e.detail ?? String(e);
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log(`[DB] ~ ${label} (já existe)`);
    } else {
      console.error(`[DB] ✗ ${label}: ${msg}`);
    }
  }
}

const SCHEMA_SQL = `
-- Execute este SQL no Supabase SQL Editor (https://supabase.com/dashboard/project/coitdqyhcaaxtmghpajy/editor)
CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  open_id varchar(64) NOT NULL UNIQUE,
  name text,
  email varchar(320),
  password_hash text,
  login_method varchar(64),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  last_signed_in timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.approved_cris (
  id serial PRIMARY KEY, isin varchar(30) NOT NULL UNIQUE,
  name text NOT NULL, data jsonb NOT NULL, approved_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pending_cris (
  id serial PRIMARY KEY, isin varchar(30) NOT NULL UNIQUE, name text NOT NULL,
  debtor text, securitizer text, rate text, maturity_date text, portfolio text,
  lastro text, estado varchar(5), regiao text, situacao text, classe text,
  motivo_filtro text, data jsonb, scanned_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.rejected_isins (
  id serial PRIMARY KEY, isin varchar(30) NOT NULL UNIQUE,
  rejected_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.portfolio_decisions (
  id serial PRIMARY KEY, key varchar(100) NOT NULL UNIQUE,
  value jsonb NOT NULL, updated_at timestamp NOT NULL DEFAULT now()
);
`;

// ─── Migrations via postgres direto ──────────────────────────────────────────

async function runSqlMigrations() {
  await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`, "users.password_hash");
  await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`, "users.status");

  await exec(`CREATE TABLE IF NOT EXISTS approved_cris (
    id serial PRIMARY KEY, isin varchar(30) NOT NULL UNIQUE,
    name text NOT NULL, data jsonb NOT NULL, approved_at timestamp NOT NULL DEFAULT now()
  )`, "approved_cris");

  await exec(`CREATE TABLE IF NOT EXISTS pending_cris (
    id serial PRIMARY KEY, isin varchar(30) NOT NULL UNIQUE,
    name text NOT NULL, debtor text, securitizer text, rate text,
    maturity_date text, portfolio text, lastro text,
    estado varchar(5), regiao text, situacao text,
    classe text, motivo_filtro text, data jsonb,
    scanned_at timestamp NOT NULL DEFAULT now()
  )`, "pending_cris");

  await exec(`CREATE TABLE IF NOT EXISTS rejected_isins (
    id serial PRIMARY KEY, isin varchar(30) NOT NULL UNIQUE,
    rejected_at timestamp NOT NULL DEFAULT now()
  )`, "rejected_isins");

  await exec(`CREATE TABLE IF NOT EXISTS portfolio_decisions (
    id serial PRIMARY KEY, key varchar(100) NOT NULL UNIQUE,
    value jsonb NOT NULL, updated_at timestamp NOT NULL DEFAULT now()
  )`, "portfolio_decisions");
}

// ─── Seed admin via postgres direto ──────────────────────────────────────────

async function seedAdminViaSql() {
  if (!sqlRaw) return;
  const adminEmail = process.env.ADMIN_EMAIL    ?? "gonzaga.cntts@gmail.com";
  const adminPass  = process.env.ADMIN_PASSWORD ?? "1234";

  try {
    const rows = await sqlRaw`SELECT id FROM users WHERE email = ${adminEmail} AND password_hash IS NOT NULL LIMIT 1`;
    if (rows.length > 0) { console.log(`[DB] Admin já existe`); return; }

    const bcrypt = await import("bcryptjs");
    const hash   = await bcrypt.hash(adminPass, 12);

    await sqlRaw`
      INSERT INTO users (open_id, name, email, password_hash, login_method, role, status)
      VALUES (
        ${"local:" + adminEmail}, 'Matheus Gonzaga', ${adminEmail},
        ${hash}, 'email', 'admin', 'active'
      )
      ON CONFLICT (open_id) DO UPDATE SET
        password_hash = EXCLUDED.password_hash, role = 'admin', status = 'active'
    `;
    console.log(`[DB] ✓ Admin criado: ${adminEmail}`);
  } catch (e: any) {
    console.error("[DB] Seed admin:", e.message);
  }
}

// ─── Seed admin via Supabase REST ────────────────────────────────────────────

async function seedAdminViaRest() {
  if (!supabase) return;
  const adminEmail = process.env.ADMIN_EMAIL    ?? "gonzaga.cntts@gmail.com";
  const adminPass  = process.env.ADMIN_PASSWORD ?? "1234";

  try {
    // Verifica se a tabela users existe fazendo uma query simples
    const { error: tableErr } = await supabase.from("users").select("id").limit(1);
    if (tableErr) {
      if (tableErr.code === "42P01" || tableErr.message?.includes("does not exist") || tableErr.message?.includes("schema cache")) {
        console.warn("[DB] Tabela 'users' não existe no Supabase. Execute o SQL abaixo no Supabase SQL Editor:");
        console.warn(SCHEMA_SQL);
      } else {
        console.error("[DB] Erro ao verificar tabela users:", tableErr.message);
      }
      return;
    }

    // Verifica se admin já existe
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", adminEmail)
      .not("password_hash", "is", null)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log("[DB] Admin já existe (REST)");
      return;
    }

    const bcrypt = await import("bcryptjs");
    const hash   = await bcrypt.hash(adminPass, 12);

    const { error } = await supabase.from("users").upsert({
      open_id:       `local:${adminEmail}`,
      name:          "Matheus Gonzaga",
      email:         adminEmail,
      password_hash: hash,
      login_method:  "email",
      role:          "admin",
      status:        "active",
    }, { onConflict: "open_id" });

    if (error) throw new Error(error.message);
    console.log(`[DB] ✓ Admin criado via REST: ${adminEmail}`);
  } catch (e: any) {
    console.error("[DB] Seed admin via REST:", e.message);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runMigrations() {
  if (sqlRaw) {
    // Tenta migrações via postgres direto (pode falhar se inacessível)
    await runSqlMigrations();
    await seedAdminViaSql();
  }

  // Sempre executa seed via REST quando disponível (garante admin mesmo sem postgres)
  if (supabase) {
    await seedAdminViaRest();
  }

  if (!sqlRaw && !supabase) {
    console.warn("[DB] Sem conexão com banco — modo offline (apenas admin hardcoded)");
  }
}
