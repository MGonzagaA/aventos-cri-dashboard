/**
 * Reconhecimento: visita cada site e mostra estrutura + chamadas de API
 */
import { chromium } from 'playwright';

const SITES = [
  { name: 'HabitaSec',  url: 'https://habitasec.com.br/lista-de-emissoes/' },
  { name: 'RBCapital',  url: 'https://www.rbinvestimentos.com/produtos/ofertas-publicas/' },
  { name: 'Opea',       url: 'https://app.opea.com.br/pt/emissoes' },
  { name: 'Bari',       url: 'https://barisec.com.br/emissoes' },
  { name: 'Exes',       url: 'https://www.exes.com.br/emissoes' },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
});

for (const site of SITES) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📡 ${site.name} → ${site.url}`);
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await ctx.newPage();

  const apiCalls = [];
  page.on('response', async (res) => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const j = await res.json();
      const str = JSON.stringify(j);
      if (str.length > 100) {
        apiCalls.push({ url, len: str.length, preview: str.slice(0, 300) });
      }
    } catch {}
  });

  try {
    await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      const title = document.title;
      const bodyText = document.body.innerText.slice(0, 500).replace(/\n+/g, ' ');
      // Detecta tabelas
      const tables = document.querySelectorAll('table');
      const tableInfo = Array.from(tables).slice(0, 3).map(t => ({
        rows: t.querySelectorAll('tr').length,
        headers: Array.from(t.querySelectorAll('th')).map(h => h.innerText?.trim()).join(', ').slice(0, 100),
      }));
      // Detecta listas/cards
      const cards = document.querySelectorAll('[class*="card"], [class*="emission"], [class*="emiss"], [class*="product"]');
      return { title, bodyText, tableInfo, cardCount: cards.length };
    });

    console.log(`Title: ${info.title}`);
    console.log(`Texto: ${info.bodyText.slice(0, 200)}`);
    if (info.tableInfo.length) {
      console.log(`Tabelas: ${info.tableInfo.map(t => `${t.rows}rows [${t.headers}]`).join(' | ')}`);
    }
    if (info.cardCount) console.log(`Cards: ${info.cardCount}`);
    if (apiCalls.length) {
      console.log(`APIs JSON (${apiCalls.length}):`);
      apiCalls.forEach(a => console.log(`  ${a.url.slice(0, 80)} (${a.len}B)\n    ${a.preview.slice(0, 150)}`));
    } else {
      console.log('Nenhuma API JSON detectada');
    }
  } catch (e) {
    console.log(`ERRO: ${e.message}`);
  }

  await ctx.close();
}

await browser.close();
