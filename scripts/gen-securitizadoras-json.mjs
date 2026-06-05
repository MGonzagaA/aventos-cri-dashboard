/**
 * Lê os CSVs gerados pelo scraper multi-securitizadora
 * e gera server/data/securitizadoras.json para servir via tRPC.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_DIR = path.join(__dirname, 'securitizadoras');
const OUT     = path.join(__dirname, '..', 'server', 'data', 'securitizadoras.json');

// Securitizadoras a incluir (com respectivo nome curto para securitizerId)
const SOURCES = [
  { file: 'CRIs_Opea.csv',      origem: 'Opea Securitizadora',  carteira: 'Opea',      id: '20' },
  { file: 'CRIs_Habitasec.csv', origem: 'HabitaSec',            carteira: 'HabitaSec', id: '21' },
  { file: 'CRIs_Bari.csv',      origem: 'Bari Securitizadora',  carteira: 'Bari',      id: '22' },
];

function parseDate(str) {
  if (!str) return null;
  const d = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (d) return new Date(+d[3], +d[2]-1, +d[1]);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str.slice(0,10));
  return null;
}

function parseCSV(content) {
  const lines = content.replace(/^﻿/, '').split('\n').filter(Boolean);
  const header = lines[0].split(';').map(h => h.replace(/"/g,'').trim());
  return lines.slice(1).map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ';' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return Object.fromEntries(header.map((h,i) => [h, cells[i] || '']));
  });
}

function mapStatus(row) {
  const s = (row['Status'] || '').toLowerCase();
  if (['ativo','ativa','em andamento','active','vigente'].some(k => s.includes(k))) return 'active';
  if (['default','vencido','encerrado','inadimplente','execução','resgatada','quitada'].some(k => s.includes(k))) return 'critical';
  if (s) return 'warning';
  return 'active'; // sem status = assume ativo
}

function mapMaturityDate(row) {
  const raw = row['Data Vencimento'] || '';
  const d = parseDate(raw);
  if (!d) return raw;
  return d.toLocaleDateString('pt-BR');
}

function mapEmissionValue(row) {
  const raw = row['Volume (R$)'] || '';
  const n = parseFloat(raw.replace(/\./g,'').replace(',','.'));
  return isNaN(n) ? 0 : Math.round(n / 1_000_000 * 100) / 100;
}

function classifyCarteira(rate, status) {
  if (status === 'critical') return 'High Yield';
  if (!rate) return 'Portfólio Principal';

  const cdi = rate.match(/CDI\s*\+\s*([\d,]+)/i);
  if (cdi && parseFloat(cdi[1].replace(',', '.')) > 4.0) return 'High Yield';

  const ipca = rate.match(/IPCA\s*\+\s*([\d,]+)/i);
  if (ipca && parseFloat(ipca[1].replace(',', '.')) > 10.0) return 'High Yield';

  const fixed = rate.match(/^([\d,]+)\s*%\s*a\.a\./i);
  if (fixed && parseFloat(fixed[1].replace(',', '.')) > 15.0) return 'High Yield';

  return 'Portfólio Principal';
}

// ISINs sem dados no CVM (gerado por audit-isin-cvm.mjs — opcional)
const AUDIT_PATH = path.join(__dirname, 'isin-not-in-cvm.json');
const cvmNotFoundSet = fs.existsSync(AUDIT_PATH)
  ? new Set(JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8')).map(d => d.isin))
  : new Set();
if (cvmNotFoundSet.size) console.log(`ISINs sem CVM carregados: ${cvmNotFoundSet.size}`);

const all = [];
let idx = 1;

for (const src of SOURCES) {
  const fp = path.join(CSV_DIR, src.file);
  if (!fs.existsSync(fp)) {
    console.warn(`⚠️  Arquivo não encontrado: ${src.file}`);
    continue;
  }
  const rows = parseCSV(fs.readFileSync(fp, 'utf-8'));
  console.log(`${src.origem}: ${rows.length} registros`);

  for (const row of rows) {
    const nome = row['Nome'] || '';
    if (!nome) continue;

    all.push({
      id: `sec${String(idx++).padStart(4,'0')}`,
      name: nome,
      debtor: row['Devedor / Cedente'] || nome.split(' ').slice(0,4).join(' '),
      status: mapStatus(row),
      code: row['Código IF / CETIP'] || '',
      isin: row['ISIN'] || '',
      rate: row['Taxa / Remuneração'] || '',
      maturityDate: mapMaturityDate(row),
      securitizer: src.origem,
      securitizerId: src.id,
      downloadLink: '#',
      linkType: 'portal',
      lastro: row['Lastro'] || '',
      carteira: classifyCarteira(row['Taxa / Remuneração'] || '', mapStatus(row)),
      cvmNotFound: cvmNotFoundSet.size > 0 ? cvmNotFoundSet.has(row['ISIN'] || '') : undefined,
      emissionValue: mapEmissionValue(row),
      cidade: '',
      estado: '',
      regiao: '',
    });
  }
}

// Deduplica por ISIN (mantém primeiro encontrado)
const seenISIN = new Set();
const deduped = all.filter(item => {
  if (!item.isin) return true;
  if (seenISIN.has(item.isin)) return false;
  seenISIN.add(item.isin);
  return true;
});
console.log(`Duplicatas removidas por ISIN: ${all.length - deduped.length}`);

// Re-índica IDs sequenciais após dedup
deduped.forEach((item, i) => { item.id = `sec${String(i+1).padStart(4,'0')}`; });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(deduped, null, 2), 'utf-8');

const bytes = fs.statSync(OUT).size;
const hy = deduped.filter(r => r.carteira === 'High Yield').length;
const pp = deduped.filter(r => r.carteira === 'Portfólio Principal').length;
console.log(`\n✅ ${deduped.length} CRIs → server/data/securitizadoras.json (${(bytes/1024).toFixed(0)}KB)`);
console.log(`Portfólio Principal: ${pp} | High Yield: ${hy}`);
