/**
 * Busca todos os CRIs da RizaSec via API REST (aks-prod.virgo.inc).
 * ID do detalhe = "{TYPE}_{ALIAS_UPPERCASE_UNDERSCORES}"
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://investidor.rizasec.com';
const API = 'https://aks-prod.virgo.inc';
const EMAIL = 'Tvgonzaga8@gmail.com';
const SENHA = '123456789@Abc';
const OUT = path.join(__dirname, 'riza-api-data.json');

// ─── LOGIN E CAPTURA DO TOKEN ─────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
});
const page = await ctx.newPage();

let authToken = null;
page.on('request', req => {
  const auth = req.headers()['authorization'];
  if (auth && !authToken) authToken = auth;
});

console.log('🔐 Login...');
await page.goto(`${BASE}/emissoes`, { waitUntil: 'networkidle', timeout: 30000 });
const lb = await page.$('a:has-text("LOGIN"), button:has-text("LOGIN")');
if (lb) { await lb.click(); await page.waitForTimeout(2000); }
await page.fill('input[type="email"], input[name*="email"]', EMAIL);
await page.fill('input[type="password"]', SENHA);
const sub = await page.$('button[type="submit"], button:has-text("Entrar")');
if (sub) await sub.click(); else await page.press('input[type="password"]', 'Enter');
await page.waitForTimeout(4000);

// Dispara uma request autenticada
await page.goto(`${BASE}/emissoes/RZA1037`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const cookies = await ctx.cookies();
const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
await browser.close();

console.log('   Token:', authToken ? `${authToken.slice(0,50)}...` : 'não obtido');

const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Origin': BASE,
  'Referer': `${BASE}/emissoes`,
  'Cookie': cookieHeader,
  ...(authToken ? { 'Authorization': authToken } : {}),
};

const get = async (url) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url.slice(0,80)}`);
  return r.json();
};

// ─── LISTA COMPLETA ────────────────────────────────────────────────────────────
console.log('\n📋 Buscando todas as emissões...');
let emissions = [];
for (let p = 0; ; p++) {
  try {
    const d = await get(`${API}/mtr/bff-portal/v1/emissions?pageNumber=${p}&pageSize=50&orderBy=EMISSION_DATE_DESC`);
    const page_content = d.content || [];
    if (!page_content.length) break;
    emissions.push(...page_content);
    process.stdout.write(`   p${p}: +${page_content.length} (total ${emissions.length})\n`);
    const total = d.totalElements || 9999;
    if (emissions.length >= total || page_content.length < 50) break;
  } catch(e) { console.error(e.message); break; }
}

// Filtra só CRIs
const cris = emissions.filter(e => e.type === 'CRI');
console.log(`\n✓ ${emissions.length} emissões totais | ${cris.length} CRIs`);

// ─── DETALHES INDIVIDUAIS ─────────────────────────────────────────────────────
console.log('\n📊 Buscando detalhes...');
const results = [];

for (let i = 0; i < cris.length; i++) {
  const em = cris[i];
  // ID = "CRI_ALIAS_COM_UNDERSCORES"
  const criId = `CRI_${em.alias.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')}`;
  process.stdout.write(`[${i+1}/${cris.length}] ${criId} ... `);

  try {
    // Tenta endpoint autenticado
    let det;
    try {
      det = await get(`${API}/portal-api/api/v1/portal/emissoes/${criId}`);
    } catch {
      det = await get(`${API}/portal-api/api/v1/site/emissoes/${criId}`);
    }
    results.push({ ...em, ...det, criId });
    // Extrai taxa da primeira série
    const serie = det.series?.[0];
    const taxa = extractTaxa(serie || em.series?.[0]);
    process.stdout.write(`✓ taxa:${taxa || '—'}\n`);
  } catch(e) {
    results.push({ ...em, criId, _error: e.message });
    process.stdout.write(`✗ ${e.message.slice(0,50)}\n`);
  }

  if ((i+1) % 30 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(`   ↳ checkpoint (${results.length})`);
  }
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\n✅ ${results.length} CRIs → riza-api-data.json`);

// Mostra amostra
const sample = results.find(r => !r._error);
if (sample) {
  console.log('\nAmostra:');
  console.log(JSON.stringify(sample, null, 2).slice(0, 2000));
}

function extractTaxa(serie) {
  if (!serie) return '';
  const idx = serie.indexer?.name || serie.indexName || '';
  const spread = serie.spread || serie.rate || serie.taxa || '';
  if (idx && spread) return `${idx} + ${spread}%`;
  if (idx) return idx;
  return '';
}
