import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
});

async function recon(name, startUrl) {
  console.log(`\n${'═'.repeat(60)}\n📡 ${name} → ${startUrl}`);
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json')) {
      try {
        const j = await res.json();
        const s = JSON.stringify(j);
        if (s.length > 200) apis.push({ url, len: s.length, preview: s.slice(0,400) });
      } catch {}
    }
  });
  try {
    await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    // Scroll completo
    for (let i=0; i<5; i++) { await page.evaluate(() => window.scrollBy(0, window.innerHeight)); await page.waitForTimeout(500); }
    await page.waitForTimeout(2000);

    // Links que parecem de emissões
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .filter(a => {
          const h = (a.href||'').toLowerCase();
          const t = (a.textContent||'').toLowerCase();
          return h.includes('emiss') || h.includes('cri') || h.includes('produto') || h.includes('oferta')
              || t.includes('emiss') || t.includes('cri') || t.includes('produto');
        })
        .slice(0, 15)
        .map(a => ({ href: a.href, text: a.textContent.trim().slice(0,50) }));
    });

    const txt = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log('Texto:', txt.replace(/\n+/g,' ').slice(0,300));
    console.log('Links relevantes:', links.map(l => `${l.href.slice(0,70)} | ${l.text}`).join('\n  '));
    if (apis.length) {
      console.log(`APIs (${apis.length}):`);
      apis.forEach(a => console.log(`  ${a.url.slice(0,80)} (${a.len}B)\n  ${a.preview.slice(0,200)}`));
    }
  } catch(e) { console.log('ERRO:', e.message); }
  await ctx.close();
}

// RB Capital - tenta mais URLs
await recon('RBCapital emissoes', 'https://www.rbinvestimentos.com/emissoes');
await recon('RBCapital hub', 'https://hub.rbinvestimentos.com');
await recon('RBCapital ofertas', 'https://www.rbcapital.com.br/emissoes');

// Éxes - tenta URLs diferentes
await recon('Exes home', 'https://www.exes.com.br');
await recon('Exes securitizadora', 'https://exes.com.br');

// HabitaSec - mais detalhes do DOM
await recon('HabitaSec DOM detail', 'https://habitasec.com.br/lista-de-emissoes/');

// Opea - captura URL completa da API
const ctxOpea = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
const pgOpea = await ctxOpea.newPage();
let opeaApiUrl = '';
let opeaSample = null;
pgOpea.on('response', async res => {
  const url = res.url();
  if (url.includes('passivos') && !opeaApiUrl) {
    opeaApiUrl = url;
    try { opeaSample = await res.json(); } catch {}
  }
});
await pgOpea.goto('https://app.opea.com.br/pt/emissoes', { waitUntil: 'networkidle', timeout: 30000 });
await pgOpea.waitForTimeout(3000);
console.log('\n=== OPEA API URL COMPLETA ===');
console.log(opeaApiUrl);
if (opeaSample?.content?.emissoes?.items?.[0]) {
  console.log('Sample item keys:', Object.keys(opeaSample.content.emissoes.items[0]).join(', '));
  console.log('Sample:', JSON.stringify(opeaSample.content.emissoes.items[0]).slice(0, 600));
}
await ctxOpea.close();

// Bari - captura URL completa
const ctxBari = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
const pgBari = await ctxBari.newPage();
const bariApis = [];
pgBari.on('response', async res => {
  const url = res.url();
  const ct = res.headers()['content-type'] || '';
  if (ct.includes('json')) {
    try {
      const j = await res.json();
      const s = JSON.stringify(j);
      if (s.length > 500) bariApis.push({ url, preview: s.slice(0,600) });
    } catch {}
  }
});
await pgBari.goto('https://barisec.com.br/emissoes', { waitUntil: 'networkidle', timeout: 30000 });
await pgBari.waitForTimeout(3000);
console.log('\n=== BARI APIS ===');
bariApis.forEach(a => console.log(`URL: ${a.url}\nData: ${a.preview}\n`));
await ctxBari.close();

await browser.close();
