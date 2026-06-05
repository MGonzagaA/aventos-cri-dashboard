import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// ─── HABITASEC: Intercepta TODAS as chamadas da página de detalhe ─────────────
console.log('=== HABITASEC API CALLS ===');
const ctx1 = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
});
const pg1 = await ctx1.newPage();
const calls1 = [];
pg1.on('response', async res => {
  const url = res.url();
  const ct = res.headers()['content-type'] || '';
  // Captura JSON e também REST/GraphQL
  if (ct.includes('json') || url.includes('/api/') || url.includes('wp-json') || url.includes('graphql')) {
    try {
      const j = await res.json();
      const s = JSON.stringify(j);
      if (s.length > 50) calls1.push({ url, len: s.length, preview: s.slice(0, 400) });
    } catch {}
  }
});
await pg1.goto('https://habitasec.com.br/emissoes/abecker-florescer-27i0000801-982-brh', { waitUntil: 'networkidle', timeout: 30000 });
await pg1.waitForTimeout(5000); // espera mais tempo para carregar dados

// Verifica se os dados carregaram
const loaded = await pg1.evaluate(() => {
  const text = document.body.innerText;
  // Verifica se algum código IF apareceu (não --- )
  const codigoField = document.querySelector('[data-field="codigoIf"], [class*="codigo"]');
  return {
    hasData: !text.includes('---\n---\n---') || text.match(/\d{2}[A-Z]\d{7}/),
    codigoIf: text.match(/\d{2}[A-Z]\d{7}/)?.[0],
    isin: text.match(/BR[A-Z0-9]{10,12}/)?.[0],
    dates: text.match(/\d{2}\/\d{2}\/\d{4}/g),
    textSample: text.slice(100, 600).replace(/\n+/g, ' | '),
  };
});
console.log('Dados carregados?', loaded);
console.log('API calls:', calls1.length);
calls1.forEach(c => console.log(` ${c.url.slice(0,80)} (${c.len}B)\n  ${c.preview.slice(0,200)}\n`));
await ctx1.close();

// ─── BARI: Tenta encontrar lista completa ────────────────────────────────────
console.log('\n=== BARI LISTA COMPLETA ===');
const ctx2 = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
});
const pg2 = await ctx2.newPage();
const bariCalls = [];
pg2.on('response', async res => {
  const url = res.url();
  const ct = res.headers()['content-type'] || '';
  if (ct.includes('json')) {
    try {
      const j = await res.json();
      const s = JSON.stringify(j);
      if (s.length > 100) bariCalls.push({ url, len: s.length, preview: s.slice(0, 500) });
    } catch {}
  }
});
await pg2.goto('https://barisec.com.br/emissoes', { waitUntil: 'networkidle', timeout: 30000 });
await pg2.waitForTimeout(3000);
// Scroll para lazy load
for (let i = 0; i < 15; i++) {
  await pg2.evaluate(() => window.scrollBy(0, window.innerHeight));
  await pg2.waitForTimeout(400);
}
await pg2.waitForTimeout(2000);

// Conta links encontrados após scroll
const bariLinks = await pg2.evaluate(() =>
  Array.from(document.querySelectorAll('a[href*="/emissoes/"]'))
    .filter(a => a.href.match(/\d{2}[A-Z]\d{7}/))
    .map(a => a.href)
    .filter((h, i, arr) => arr.indexOf(h) === i)
);
console.log('Links após scroll:', bariLinks.length);
bariLinks.forEach(l => console.log(' ', l));
console.log('\nBari API calls:');
bariCalls.forEach(c => console.log(` ${c.url.slice(0,80)} (${c.len}B)\n  ${c.preview.slice(0,300)}\n`));

// Tenta a URL do _next/data para lista de emissões
const buildId = 'fb877bd01a4c11387ed7222919399a455d597d07';
const listUrls = [
  `https://barisec.com.br/_next/data/${buildId}/emissoes.json`,
  `https://barisec.com.br/api/emissoes`,
  `https://barisec.com.br/api/emissions`,
];
for (const url of listUrls) {
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    console.log(`\n${url}: HTTP ${r.status}`);
    console.log(text.slice(0, 400));
  } catch(e) { console.log(`${url}: ERRO ${e.message}`); }
}

await ctx2.close();
await browser.close();
