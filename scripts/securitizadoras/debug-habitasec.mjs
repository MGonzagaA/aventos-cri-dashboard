import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
});
const pg = await ctx.newPage();

// Visita uma página individual e mostra o texto completo
await pg.goto('https://habitasec.com.br/emissoes/abecker-florescer-27i0000801-982-brh', {
  waitUntil: 'networkidle', timeout: 20000
});
await pg.waitForTimeout(1500);

const txt = await pg.evaluate(() => document.body.innerText);
console.log('=== TEXTO COMPLETO ===');
console.log(txt.slice(0, 3000));

// Tenta extrair campos específicos
const data = await pg.evaluate(() => {
  const b = document.body.innerText;
  return {
    allText: b.slice(0, 2000),
    // Procura por padrões de data
    datas: b.match(/\d{2}\/\d{2}\/\d{4}/g),
    // Status
    statusKeywords: ['Ativo', 'Vencido', 'Em Andamento', 'Encerrado', 'Liquidado']
      .filter(k => b.includes(k)),
    // ISIN
    isin: b.match(/BR[A-Z0-9]{10,12}/)?.[0],
  };
});
console.log('\n=== CAMPOS EXTRAÍDOS ===');
console.log('Datas:', data.datas);
console.log('Status:', data.statusKeywords);
console.log('ISIN:', data.isin);

// Verifica Bari - quantos links de emissão existem
await pg.goto('https://barisec.com.br/emissoes', { waitUntil: 'networkidle', timeout: 20000 });
await pg.waitForTimeout(2000);
// Scroll para carregar mais
for (let i = 0; i < 10; i++) {
  await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pg.waitForTimeout(500);
}
const bariData = await pg.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a')).filter(a =>
    a.href.includes('/emissoes/') && a.href.match(/\d{2}[A-Z]\d{7}/)
  ).map(a => ({ href: a.href, text: a.textContent?.trim().slice(0,50) }));

  // Também procura códigos IF no texto
  const codes = document.body.innerText.match(/\d{2}[A-Z]\d{7}/g) || [];
  const text = document.body.innerText.slice(0,1000);
  return { links, codes: [...new Set(codes)], text };
});
console.log('\n=== BARI LINKS ===');
console.log('Links:', bariData.links.length);
bariData.links.forEach(l => console.log(' ', l.href, '|', l.text));
console.log('Códigos IF no texto:', bariData.codes.slice(0, 10));
console.log('Texto:', bariData.text.replace(/\n+/g,' ').slice(0, 500));

await browser.close();
