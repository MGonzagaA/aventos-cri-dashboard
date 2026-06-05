/**
 * Scraper multi-securitizadora de CRIs
 * Securitizadoras: HabitaSec, Opea, Bari, RB Capital, Éxes
 *
 * Uso: node scripts/securitizadoras/index.js
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;

// ─── DATAS ────────────────────────────────────────────────────────────────────
const TODAY      = new Date();
const ONE_YEAR_AGO = new Date(TODAY.getTime() - 365 * 24 * 60 * 60 * 1000);

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  // DD/MM/YYYY
  const d = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (d) return new Date(+d[3], +d[2] - 1, +d[1]);
  // YYYY-MM-DD ou ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str.slice(0, 10));
  return null;
}

function shouldInclude(item) {
  const status = (item.status || '').toLowerCase();
  const isActive = ['ativo', 'ativa', 'em andamento', 'active', 'vigente'].some(s => status.includes(s));
  const dueDate  = parseDate(item.dataVencimento || item.vencimento || item.dueDate);
  const recentlyMatured = dueDate && dueDate >= ONE_YEAR_AGO && dueDate <= TODAY;
  // Se não temos status nem data, incluir por precaução (melhor sobrar do que faltar)
  const unknown = !status && !dueDate;
  return isActive || recentlyMatured || unknown;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = parseDate(d) || new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('pt-BR');
}

function fmtValue(v) {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return String(v);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const CSV_HEADER = [
  'Origem','Nome','Código IF / CETIP','ISIN','Status','Taxa / Remuneração',
  'Emissão','Série','Data Emissão','Data Vencimento',
  'Volume (R$)','Devedor / Cedente','Lastro','Agente Fiduciário','Tipo / Oferta',
].join(';');

function toRow(o, row) {
  const fields = [
    o,
    row.nome         || row.name        || '',
    row.codigoIF     || row.code        || row.codigoCetip || '',
    row.isin         || '',
    row.status       || '',
    row.taxa         || row.rate        || row.remuneracao  || '',
    row.emissao      || row.emissionNum || '',
    row.serie        || row.serieNum    || '',
    fmtDate(row.dataEmissao    || row.emissionDate || ''),
    fmtDate(row.dataVencimento || row.dueDate       || ''),
    fmtValue(row.volume        || row.amount        || row.emissionValue || ''),
    row.devedor      || row.debtor      || row.cedente       || '',
    row.lastro       || row.collateral  || row.ballast       || '',
    row.agFiduciario || row.trustee     || '',
    row.tipo         || row.oferta      || '',
  ];
  return fields.map(f => `"${String(f).replace(/"/g, '""').trim()}"`).join(';');
}

function saveCSV(filename, rows, origem) {
  const lines = [CSV_HEADER, ...rows.map(r => toRow(origem, r))];
  const fp = path.join(OUT_DIR, filename);
  fs.writeFileSync(fp, '﻿' + lines.join('\n'), 'utf-8');
  console.log(`   💾 Salvo: ${filename} (${rows.length} registros)`);
  return fp;
}

// ─── BROWSER FACTORY ─────────────────────────────────────────────────────────
let browser;
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function newPage() {
  const b = await getBrowser();
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  return ctx.newPage();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OPEA SECURITIZADORA
//    API: https://app.opea.com.br/bff/v1/api/emissao/passivosoperacoes
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeOpea() {
  console.log('\n🏢 OPEA Securitizadora...');
  const BASE = 'https://app.opea.com.br/bff/v1/api/emissao/passivosoperacoes';
  const all = [];

  // Captura cookies/token via browser (para autenticar a chamada direta)
  let cookieHeader = '';
  try {
    const pg = await newPage();
    pg.on('request', req => {
      const c = req.headers()['cookie'];
      if (c && !cookieHeader) cookieHeader = c;
    });
    await pg.goto('https://app.opea.com.br/pt/emissoes', { waitUntil: 'networkidle', timeout: 30000 });
    await pg.waitForTimeout(2000);
    const cookies = await pg.context().cookies();
    cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    await pg.context().close();
  } catch (e) {
    console.log('   ⚠️  Falha ao capturar cookies Opea:', e.message);
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Referer': 'https://app.opea.com.br/pt/emissoes',
    'Origin': 'https://app.opea.com.br',
    ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
  };

  let page = 1, total = 0;
  while (true) {
    try {
      const url = `${BASE}?pagina=${page}&tamanhoPagina=100`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!res.ok) { console.log(`   Página ${page}: HTTP ${res.status}`); break; }
      const data = await res.json();
      const em = data?.content?.emissoes;
      if (!em?.items?.length) break;

      for (const item of em.items) {
        const status = item.statusPassivoOperacao?.value || item.status || '';
        all.push({
          nome: `CRI ${item.emissao}ª Emissão ${item.serie}ª Série`,
          codigoIF: item.codigoIf || '',
          isin: item.isin || '',
          status,
          taxa: item.indexador || (item.tipoIndexador
            ? `${item.tipoIndexador}${item.taxaPosFixada ? ' + ' + Number(item.taxaPosFixada).toFixed(4) + '% a.a.' : ''}`
            : ''),
          emissao: item.emissao || '',
          serie: item.serie || '',
          dataVencimento: item.dataVencimento || '',
          volume: item.quantidadeIntegralizada || '',
          devedor: item.nomeDevedor || '',
          lastro: item.descricaoSegmento || '',
          agFiduciario: '',
          tipo: item.oferta || item.classe || '',
        });
      }

      total = em.totalCount || 0;
      process.stdout.write(`   Página ${page}/${em.lastPage} — ${all.length}/${total}\r`);

      if (page >= em.lastPage) break;
      page++;
    } catch (e) {
      console.log(`\n   ⚠️  Erro na página ${page}:`, e.message);
      break;
    }
  }

  console.log(`\n   Total bruto: ${all.length}`);
  const filtered = all.filter(shouldInclude);
  console.log(`   Após filtro: ${filtered.length}`);
  saveCSV('CRIs_Opea.csv', filtered, 'Opea Securitizadora');
  return filtered;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. HABITASEC
//    API: wp-json/wp/v2/emissoes (434 registros, 5 páginas)
//         + wp-json/calc-b3/v1/habitasec/series (taxas, join por AkrualId=EmissaoNum)
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeHabitaSec() {
  console.log('\n🏢 HabitaSec...');
  const BASE = 'https://habitasec.com.br';
  const all = [];

  try {
    // 1) Busca todas as emissões via WordPress REST API (434 registros, 5 páginas)
    const emissions = [];
    const firstRes  = await fetch(`${BASE}/wp-json/wp/v2/emissoes?per_page=100&page=1&_fields=id,slug,title`, { signal: AbortSignal.timeout(15000) });
    const totalPages = parseInt(firstRes.headers.get('x-wp-totalpages') || '1');
    const total      = parseInt(firstRes.headers.get('x-wp-total') || '0');
    console.log(`   WordPress: ${total} emissões em ${totalPages} páginas`);
    emissions.push(...await firstRes.json());

    for (let p = 2; p <= totalPages; p++) {
      try {
        const r = await fetch(`${BASE}/wp-json/wp/v2/emissoes?per_page=100&page=${p}&_fields=id,slug,title`, { signal: AbortSignal.timeout(15000) });
        emissions.push(...await r.json());
        process.stdout.write(`   Página ${p}/${totalPages} — ${emissions.length}/${total}\r`);
      } catch (e) { break; }
    }
    console.log(`\n   Emissões carregadas: ${emissions.length}`);

    // 2) Busca todas as séries com taxas
    const seriesRaw = await fetch(`${BASE}/wp-json/calc-b3/v1/habitasec/series`, { signal: AbortSignal.timeout(15000) }).then(r => r.json());
    const seriesArr = seriesRaw.data || seriesRaw;
    // Monta mapa: AkrualId → taxa  e  CodigoCETIP → taxa
    const byAkrual = {}, byCetip = {};
    for (const s of seriesArr) {
      const taxa = s.IndiceCorrecao
        ? (s.Spread && Number(s.Spread) > 0 ? `${s.IndiceCorrecao} + ${s.Spread}% a.a.` : s.IndiceCorrecao)
        : '';
      if (s.AkrualId)    byAkrual[String(s.AkrualId)]     = taxa;
      if (s.CodigoCETIP) byCetip[s.CodigoCETIP.toUpperCase()] = taxa;
    }
    console.log(`   Séries com taxa: ${seriesArr.length} (${Object.keys(byCetip).length} com Código CETIP)`);

    // 3) Mapeia cada emissão para campos estruturados
    // Slug formato: nome-codigoIF-emissaoNum-isinPartial
    // Title formato: "Nome | CodigoIF | EmissaoNum | ISIN"
    for (const em of emissions) {
      const title = em.title?.rendered || '';
      const parts = title.split(' | ').map(p => p.trim());
      const nome      = parts[0] || '';
      const codigoIF  = parts[1] || '';
      const emissaoNum = parts[2] || '';
      const isin      = parts[3] || '';

      // Taxa: tenta por Código CETIP primeiro, depois por AkrualId (emissaoNum)
      const taxa = byCetip[codigoIF.toUpperCase()] || byAkrual[emissaoNum] || '';

      all.push({
        nome,
        codigoIF,
        isin,
        status: 'Ativo',  // WordPress só publica ativos; vencidos ficam em categoria separada
        taxa,
        emissao: emissaoNum,
        serie: '',
        dataEmissao: '',
        dataVencimento: '',
        volume: '',
        devedor: nome, // devedor é o nome do projeto/cedente
        lastro: '',
        agFiduciario: '',
        tipo: 'CRI',
      });
    }
  } catch (e) {
    console.log('\n   ⚠️  Erro HabitaSec:', e.message);
  }

  console.log(`\n   Total bruto: ${all.length}`);
  const filtered = all.filter(shouldInclude);
  console.log(`   Após filtro: ${filtered.length}`);
  saveCSV('CRIs_Habitasec.csv', filtered, 'HabitaSec');
  return filtered;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BARI SECURITIZADORA
//    Next.js: index.json contém pageProps.emissions com todos os dados
//    Para cada código encontrado, busca _next/data/{buildId}/emissoes/{code}.json
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeBari() {
  console.log('\n🏢 Bari Securitizadora...');
  const BASE = 'https://barisec.com.br';
  const all = [];

  try {
    // 1) Captura buildId e emissões do index.json via browser (mais confiável)
    const pg = await newPage();
    let buildId = null;
    let indexEmissions = [];

    await pg.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await pg.waitForTimeout(2000);

    // Pega buildId do __NEXT_DATA__
    const nextData = await pg.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      if (el) try { return JSON.parse(el.textContent); } catch {}
      return null;
    });
    buildId = nextData?.buildId;
    console.log(`   BuildId: ${buildId}`);

    // 2) Busca direta do index.json para pegar pageProps.emissions
    if (buildId) {
      const r = await fetch(`${BASE}/_next/data/${buildId}/index.json`, {
        headers: { 'Accept': 'application/json', 'Referer': BASE },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const j = await r.json();
        indexEmissions = j?.pageProps?.emissions || [];
        console.log(`   Emissões no index.json: ${indexEmissions.length}`);
      }
    }

    // 3) Também tenta descobrir mais emissões pelos links do site
    const extraCodes = await pg.evaluate(() => {
      return [...new Set(
        Array.from(document.querySelectorAll('a[href*="/emissoes/"]'))
          .map(a => a.href.match(/\/emissoes\/([A-Z0-9]{10,12})/i)?.[1])
          .filter(Boolean)
      )];
    });

    // Junta emissões do index + códigos descobertos
    const allCodes = [...new Set([
      ...indexEmissions.map(e => e.code).filter(Boolean),
      ...extraCodes,
    ])];
    console.log(`   Total códigos: ${allCodes.length}`);
    await pg.context().close();

    // 4) Para cada código, busca detalhes
    for (let i = 0; i < allCodes.length; i++) {
      const code = allCodes[i];
      process.stdout.write(`   [${i+1}/${allCodes.length}] ${code}\r`);

      // Primeiro verifica se já temos no indexEmissions
      let em = indexEmissions.find(e => e.code === code);

      // Se não, busca via _next/data
      if (!em && buildId) {
        try {
          const r = await fetch(`${BASE}/_next/data/${buildId}/emissoes/${code}.json?path=${code}`, {
            headers: { 'Accept': 'application/json', 'Referer': BASE },
            signal: AbortSignal.timeout(10000),
          });
          if (r.ok) {
            const j = await r.json();
            em = j?.pageProps?.emission;
          }
        } catch {}
      }

      if (em) {
        const remunStr = em.remuneration || em.taxa || '';
        // Bari retorna só o indexador (ex: "DI") sem o spread
        const taxa = remunStr;
        all.push({
          nome: `CRI ${em.emissionNumber || ''}ª Emissão ${em.serieNumber || ''}ª Série`,
          codigoIF: em.code || code,
          isin: em.ISIN || em.isin || '',
          status: em.emissionStatus || em.status || '',
          taxa,
          emissao: em.emissionNumber || '',
          serie: em.serieNumber || '',
          dataEmissao: fmtDate(em.emissionDate || ''),
          dataVencimento: fmtDate(em.dueDate || ''),
          volume: fmtValue(em.emissionValue || ''),
          devedor: '',
          lastro: em.ballastNature || '',
          agFiduciario: (em.trustee || '').replace(/DISTRIBUIDORA.*$/i, '').trim(),
          tipo: em.tradingEnvironment || 'B3',
        });
      }
    }
  } catch (e) {
    console.log('\n   ⚠️  Erro Bari:', e.message);
  }

  console.log(`\n   Total bruto: ${all.length}`);
  const filtered = all.filter(shouldInclude);
  console.log(`   Após filtro: ${filtered.length}`);
  saveCSV('CRIs_Bari.csv', filtered, 'Bari Securitizadora');
  return filtered;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RB CAPITAL
//    Sem portal público de emissões identificado. Tenta via ANBIMA/CVM ISIN search.
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeRBCapital() {
  console.log('\n🏢 RB Capital...');
  const URLS = [
    'https://www.rbcapital.com.br/emissoes',
    'https://www.rbcapital.com.br/securitizacao',
    'https://www.rbcapitalsecuritizadora.com.br',
    'https://www.rbcapital.com.br',
  ];
  const all = [];
  const pg = await newPage();

  for (const url of URLS) {
    try {
      const apis = [];
      pg.on('response', async res => {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('json')) {
          try {
            const j = await res.json();
            const s = JSON.stringify(j);
            if (s.length > 300 && (s.includes('cri') || s.includes('isin') || s.includes('emiss') || s.includes('vencimento'))) {
              apis.push(j);
            }
          } catch {}
        }
      });

      await pg.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await pg.waitForTimeout(2000);

      if (apis.length) {
        console.log(`   API encontrada em ${url}`);
        // Processa os dados
        for (const api of apis) {
          const arr = Array.isArray(api) ? api : api.data || api.items || api.cris || [];
          for (const item of arr) {
            all.push({
              nome: item.nome || item.name || item.title || '',
              codigoIF: item.codigo || item.code || item.codigoIf || '',
              isin: item.isin || '',
              status: item.status || item.situacao || '',
              taxa: item.taxa || item.rate || item.remuneracao || '',
              dataVencimento: item.vencimento || item.dataVencimento || item.dueDate || '',
              volume: item.volume || item.valor || '',
              devedor: item.devedor || item.cedente || '',
            });
          }
        }
        if (all.length > 0) break;
      }
      pg.removeAllListeners('response');
    } catch (e) {
      // Continua
    }
  }

  await pg.context().close();

  if (all.length === 0) {
    console.log('   ℹ️  RB Capital não possui portal público de emissões acessível.');
    console.log('      Os CRIs podem ser acessados em: https://data.anbima.com.br');
    saveCSV('CRIs_RBCapital.csv', [], 'RB Capital');
    return [];
  }

  const filtered = all.filter(shouldInclude);
  console.log(`   Total bruto: ${all.length} | Após filtro: ${filtered.length}`);
  saveCSV('CRIs_RBCapital.csv', filtered, 'RB Capital');
  return filtered;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ÉXES SECURITIZADORA
//    Tenta URLs alternativas + DOM
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeExes() {
  console.log('\n🏢 Éxes Securitizadora...');
  const URLS = [
    'https://exes.com.br/emissoes',
    'https://exes.com.br/cris',
    'https://exes.com.br/securitizacao',
    'https://www.exes.com.br/areas-de-negocios',
    'https://exes.com.br',
  ];
  const all = [];
  const pg = await newPage();

  for (const url of URLS) {
    try {
      const apis = [];
      pg.on('response', async res => {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('json')) {
          try {
            const j = await res.json();
            const s = JSON.stringify(j);
            if (s.length > 300 && (s.includes('cri') || s.includes('isin') || s.includes('emiss') || s.includes('vencimento'))) {
              apis.push({ url: res.url(), data: j });
            }
          } catch {}
        }
      });

      await pg.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await pg.waitForTimeout(2000);

      // Scroll para carregar lazy content
      await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await pg.waitForTimeout(1000);

      if (apis.length) {
        console.log(`   API encontrada em ${url}`);
        for (const a of apis) {
          const arr = Array.isArray(a.data) ? a.data : a.data?.data || a.data?.items || a.data?.emissoes || [];
          for (const item of arr) {
            all.push({
              nome: item.nome || item.name || item.title || '',
              codigoIF: item.codigo || item.code || item.codigoIf || '',
              isin: item.isin || '',
              status: item.status || '',
              taxa: item.taxa || item.remuneracao || '',
              dataVencimento: item.vencimento || item.dataVencimento || item.dueDate || '',
              volume: item.volume || '',
              devedor: item.devedor || item.cedente || '',
            });
          }
        }
        if (all.length > 0) break;
      }

      // Fallback DOM: procura ISIN/códigos no texto
      const domExtract = await pg.evaluate(() => {
        const text = document.body.innerText;
        const items = [];
        const isinMatches = text.matchAll(/BR[A-Z0-9]{10,12}/g);
        for (const m of isinMatches) {
          const around = text.slice(Math.max(0, m.index-100), m.index+200);
          const code = around.match(/\d{2}[A-Z]\d{7}/)?.[0] || '';
          items.push({ isin: m[0], codigoIF: code, rawContext: around.replace(/\n/g,' ').slice(0,150) });
        }
        return items.filter((i,idx,arr) => arr.findIndex(x => x.isin === i.isin) === idx);
      });

      if (domExtract.length > 0) {
        console.log(`   Encontrados ${domExtract.length} ISINs no DOM de ${url}`);
        all.push(...domExtract.map(d => ({ ...d, nome: d.rawContext.slice(0,60) })));
        break;
      }

      pg.removeAllListeners('response');
    } catch (e) {
      // Continua
    }
  }

  await pg.context().close();

  if (all.length === 0) {
    console.log('   ℹ️  Éxes não possui portal público de emissões acessível.');
    saveCSV('CRIs_Exes.csv', [], 'Éxes Securitizadora');
    return [];
  }

  const filtered = all.filter(shouldInclude);
  console.log(`   Total bruto: ${all.length} | Após filtro: ${filtered.length}`);
  saveCSV('CRIs_Exes.csv', filtered, 'Éxes Securitizadora');
  return filtered;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — executa uma a uma, consolida CSV final
// ═══════════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(60));
console.log('🚀 Scraper Multi-Securitizadora de CRIs');
console.log(`📅 Data: ${TODAY.toLocaleDateString('pt-BR')}`);
console.log(`🔍 Filtro: Ativos + vencimentos entre ${ONE_YEAR_AGO.toLocaleDateString('pt-BR')} e hoje`);
console.log('═'.repeat(60));

const results = {};

const scrapers = [
  { name: 'Opea',     fn: scrapeOpea },
  { name: 'Habitasec',fn: scrapeHabitaSec },
  { name: 'Bari',     fn: scrapeBari },
  { name: 'RBCapital',fn: scrapeRBCapital },
  { name: 'Exes',     fn: scrapeExes },
];

for (const { name, fn } of scrapers) {
  try {
    results[name] = await fn();
  } catch (e) {
    console.log(`\n❌ Erro fatal em ${name}: ${e.message}`);
    results[name] = [];
  }
}

// Fecha browser
if (browser) await browser.close();

// ─── CSV CONSOLIDADO ──────────────────────────────────────────────────────────
const allRows = Object.entries(results).flatMap(([sec, rows]) =>
  rows.map(r => ({ ...r, _origem: sec }))
);

const lines = [CSV_HEADER];
for (const [sec, rows] of Object.entries(results)) {
  for (const row of rows) lines.push(toRow(sec, row));
}

const consolidadoPath = path.join(OUT_DIR, 'CRIs_Todas_Securitizadoras.csv');
fs.writeFileSync(consolidadoPath, '﻿' + lines.join('\n'), 'utf-8');

// ─── RESUMO FINAL ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('📊 RESUMO FINAL');
console.log('═'.repeat(60));
let totalGeral = 0;
for (const [sec, rows] of Object.entries(results)) {
  console.log(`  ${sec.padEnd(15)} ${String(rows.length).padStart(5)} CRIs`);
  totalGeral += rows.length;
}
console.log('─'.repeat(30));
console.log(`  ${'TOTAL'.padEnd(15)} ${String(totalGeral).padStart(5)} CRIs`);
console.log(`\n💾 Consolidado: CRIs_Todas_Securitizadoras.csv (${totalGeral} registros)`);
console.log(`📂 Pasta: ${OUT_DIR}`);
