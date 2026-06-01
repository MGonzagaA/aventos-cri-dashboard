import { sqlRaw } from "./index";

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

export async function runMigrations() {
  if (!sqlRaw) return;

  await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`, "users.password_hash");
  await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`, "users.status");

  await exec(`CREATE TABLE IF NOT EXISTS approved_cris (
    id serial PRIMARY KEY,
    isin varchar(30) NOT NULL UNIQUE,
    name text NOT NULL,
    data jsonb NOT NULL,
    approved_at timestamp NOT NULL DEFAULT now()
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
    id serial PRIMARY KEY,
    isin varchar(30) NOT NULL UNIQUE,
    rejected_at timestamp NOT NULL DEFAULT now()
  )`, "rejected_isins");

  await exec(`CREATE TABLE IF NOT EXISTS portfolio_decisions (
    id serial PRIMARY KEY,
    key varchar(100) NOT NULL UNIQUE,
    value jsonb NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now()
  )`, "portfolio_decisions");

  await seedAdmin();
}

async function seedAdmin() {
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
