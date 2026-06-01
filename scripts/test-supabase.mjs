// Teste rápido da conexão Supabase REST
// Uso: node scripts/test-supabase.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "..", ".env");

// Carrega .env manualmente
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL ?? "https://coitdqyhcaaxtmghpajy.supabase.co";
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY ?? "";

if (!SUPABASE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY não encontrada no .env");
  process.exit(1);
}

console.log("🔗 URL:", SUPABASE_URL);
console.log("🔑 Key:", SUPABASE_KEY.slice(0, 20) + "...");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Testa conectividade e existência das tabelas
const tables = ["users", "approved_cris", "pending_cris", "rejected_isins", "portfolio_decisions"];

console.log("\n📋 Verificando tabelas...");
for (const table of tables) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (error) {
    const missing = error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("schema cache");
    console.log(`  ${missing ? "❌ FALTA" : "⚠️  ERRO"} ${table}:`, error.message);
  } else {
    console.log(`  ✅ OK    ${table}`);
  }
}

console.log("\n✅ Teste concluído. Tabelas marcadas com ❌ precisam ser criadas via supabase/schema.sql");
