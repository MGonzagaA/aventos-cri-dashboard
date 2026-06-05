/**
 * Visita cada página de CRI sem taxaSpread e captura a resposta completa
 * da API do site, extraindo o taxaSpread correto.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, 'riza-api-data.json');
const EMAIL = 'Tvgonzaga8@gmail.com';
const SENHA = '123456789@Abc';
const BASE = 'https://investidor.rizasec.com';

let all = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

// Filtra apenas CRIs sem spread que passam no filtro de exibição
const CUTOFF = new Date('2025-01-01');
const semSpread = all.filter(c => {
  if (c.type !== 'CRI') return false;
  if ((c.series || []).some(s => s.taxaSpread != null)) return false;
  const due = c.dueDate ? new Date(c.dueDate) : null;
  return c.status === 'Em Andamento' || (due && due >= CUTOFF);
});
console.log(`CRIs sem spread no filtro: ${semSpread.length}`);

// Login
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
});
const loginPg = await ctx.newPage();
await loginPg.goto(`${BASE}/emissoes`, { waitUntil: 'networkidle', timeout: 30000 });
const lb = await loginPg.$('a:has-text("LOGIN"), button:has-text("LOGIN")');
if (lb) { await lb.click(); await loginPg.waitForTimeout(2000); }
await loginPg.fill('input[type="email"]', EMAIL);
await loginPg.fill('input[type="password"]', SENHA);
const sub = await loginPg.$('button[type="submit"], button:has-text("Entrar")');
if (sub) await sub.click(); else await loginPg.press('input[type="password"]', 'Enter');
await loginPg.waitForTimeout(4000);
console.log('Login:', loginPg.url());
await loginPg.close();

let found = 0;
let errors = 0;
const dp = await ctx.newPage();

for (let i = 0; i < semSpread.length; i++) {
  const cri = semSpread[i];
  const rzaUrl = `${BASE}/emissoes/RZA${cri.oid}`;
  process.stdout.write(`[${i+1}/${semSpread.length}] RZA${cri.oid} ${cri.alias} ... `);

  let captured = null;

  // Intercepta a resposta da API de detalhes
  const handler = async (res) => {
    const url = res.url();
    if (!url.includes('/emissoes/') || !url.includes('portal-api')) return;
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const j = await res.json();
      if (j && j.series && j.series.length > 0 && j.oid === cri.oid) {
        captured = j;
      }
    } catch {}
  };

  dp.on('response', handler);

  try {
    await dp.goto(rzaUrl, { waitUntil: 'networkidle', timeout: 25000 });
    await dp.waitForTimeout(3000);
  } catch { errors++; }

  dp.off('response', handler);

  if (captured && captured.series && captured.series.some(s => s.taxaSpread != null)) {
    // Atualiza os dados
    const idx = all.findIndex(c => c.oid === cri.oid);
    if (idx >= 0) all[idx] = { ...all[idx], ...captured };
    found++;
    const s0 = captured.series.find(s => s.taxaSpread != null);
    const idxName = s0?.indexador?.nome || '';
    const label = idxName === 'DI' ? 'CDI' : idxName;
    process.stdout.write(`✓ ${label} + ${s0?.taxaSpread}%\n`);
  } else if (captured) {
    process.stdout.write(`sem spread no retorno\n`);
  } else {
    process.stdout.write(`✗ sem resposta\n`);
  }

  if ((i + 1) % 20 === 0) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(all, null, 2));
    console.log(`  ↳ checkpoint: ${found} taxas encontradas`);
  }
}

await dp.close();
await browser.close();

fs.writeFileSync(DATA_PATH, JSON.stringify(all, null, 2));
console.log(`\n✅ Taxas encontradas: ${found}/${semSpread.length}`);
console.log(`   Erros de navegação: ${errors}`);
