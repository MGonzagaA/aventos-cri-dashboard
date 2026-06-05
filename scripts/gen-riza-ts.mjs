/**
 * Lê scripts/riza-api-data.json e gera client/src/data/criRizaSecData.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN  = path.join(__dirname, 'riza-api-data.json');
const OUT = path.join(__dirname, '..', 'client', 'src', 'data', 'criRizaSecData.ts');

const raw = JSON.parse(fs.readFileSync(IN, 'utf-8'));

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────
function isoToDate(iso) {
  if (!iso) return null;
  return new Date(iso);
}
function isoToBr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
function parseValue(n) {
  if (!n) return 0;
  return Math.round(n / 1_000_000 * 100) / 100;
}

function buildTaxa(cri) {
  // Tenta primeiro série com taxaSpread
  for (const s of (cri.series || [])) {
    const idx = s.indexador?.nome || s.indexer?.name || '';
    const spread = s.taxaSpread ?? s.spread ?? null;
    if (idx && spread !== null) {
      const idxLabel = idx === 'DI' ? 'CDI' : idx;
      return `${idxLabel} + ${Number(spread).toFixed(2)}% a.a.`;
    }
    if (idx) return `${idxLabel(idx)} + ver portal`;
  }
  // Fallback para indexer da listagem
  const serie0 = (cri.series || [])[0];
  const idx0 = serie0?.indexer?.name || serie0?.indexador?.nome || '';
  return idx0 ? `${idxLabel(idx0)} + ver portal` : 'Ver portal';
}
function idxLabel(n) {
  if (n === 'DI') return 'CDI';
  return n || 'N/D';
}

function buildCode(cri) {
  for (const s of (cri.series || [])) {
    const c = s.codigoIf || s.ifCode;
    if (c) return c;
  }
  return cri.criId || `RZA${cri.oid}`;
}

function buildIsin(cri) {
  for (const s of (cri.series || [])) {
    if (s.codigoISIN) return s.codigoISIN;
  }
  return '';
}

function icvmLabel(icvm) {
  if (icvm === '160') return 'Profissionais';
  if (icvm === '400') return 'Oferta Pública Ampla';
  if (icvm === '476') return 'Esforços Restritos';
  return icvm || '—';
}

function periodicidadeLabel(p) {
  const m = { DIARIO: 'Diário', MENSAL: 'Mensal', TRIMESTRAL: 'Trimestral', SEMESTRAL: 'Semestral', ANUAL: 'Anual' };
  return m[p] || p || '—';
}

function buildDebtor(cri) {
  const alias = (cri.alias || cri.apelido || '').toUpperCase();
  const KNOWN = {
    'EINSTEIN': 'Hospital Albert Einstein', 'HAPVIDA': 'Hapvida S.A.',
    'MRV': 'MRV Engenharia S.A.', 'DIRECIONAL': 'Direcional Engenharia S.A.',
    'PLANO E PLANO': 'Plano&Plano Construtora', 'SOMA': 'Grupo Soma S.A.',
    'MULTIPLAN': 'Multiplan S.A.', 'LOCALIZA': 'Localiza & Co.',
    'BMG': 'Banco BMG S.A.', 'TRISUL': 'Trisul S.A.',
    'TENDA': 'Construtora Tenda S.A.', 'GAFISA': 'Gafisa S.A.',
    'PATRIMAR': 'Patrimar Engenharia', 'MITRE': 'Mitre Realty',
    'HELBOR': 'Helbor Empreendimentos', 'CYRELA': 'Cyrela Brazil Realty',
    'EVEN': 'Even Construtora', 'NATURA': 'Natura S.A.',
    'GPA': 'GPA – Grupo Pão de Açúcar', 'CSN': 'CSN S.A.',
    'ANIMA': 'Ânima Educação', 'LOG III': 'Log CP S.A.',
    'MOGNO': 'Mogno S.A.', 'SMART FIT': 'Smart Fit S.A.',
    'LEONARDO': 'Shopping Leonardo', 'COTEMINAS': 'Coteminas S.A.',
    'STARBUCKS': 'Starbucks do Brasil', 'BRASILATA': 'Brasilata S.A.',
    'TRINITY': 'Trinity Energia', 'ILUMISOL': 'Ilumisol Energia',
    'EAB ENERGIA': 'EAB Energia', 'RZK': 'RZK Energia',
    'KWP': 'KWP Energia', 'CONEXAMERICA': 'Conexamerica S.A.',
    'ALDO': 'Aldo Components', 'EXTO': 'Exto Serviços',
    'GUARDIAN': 'Guardian S.A.', 'CPOF': 'CPOF S.A.',
    'GGRC11': 'GGRC11 – FII', 'HGBS': 'HGBS – FII',
    'KEYCASH': 'Keycash S.A.', 'WIMO': 'WIMO Home Equity',
    'LAREDO': 'Laredo Multipropriedade', 'BURITI': 'Buriti Incorporadora',
    'GAV': 'GAV Desenvolvimento Imobiliário', 'VISC': 'Viscardi Shoppings',
    'RIVER SHOPPING': 'River Shopping', 'HSI': 'HSI – Hedge Shoppings',
    'MOINHO': 'Moinho Salvador', 'LOTUS': 'Lotus Desenvolvimento',
    'VIP AIR': 'VIP Air S.A.', 'URBA': 'URBA Incorporadora',
    'PACAEMBU': 'Pacaembú Construtora', 'MERCANTIL': 'Banco Mercantil',
    'CONSIGAZ': 'Consigaz S.A.', 'PATRIANI': 'Patriani Incorporadora',
    'TAUA': 'Taúa Resort & Convention', 'SERPASA': 'Serpasa S.A.',
    'SINAL': 'Sinal Incorporadora', 'BEAL': 'BEAL S.A.',
    'BELENUS': 'Belenus S.A.', 'DURLI': 'Durli S.A.',
    'SCHERER': 'Scherer S.A.', 'NAGUMO': 'Nagumo S.A.',
    'GJA': 'GJA S.A.', 'YORK': 'York S.A.',
    'RBR CURY': 'RBR / Cury Construtora', 'CPOF': 'CPOF S.A.',
    'BIM': 'BIM Distribuidora', 'ARMARINHOS': 'Armarinhos Fernando',
    'IZP': 'IZP Investimentos', 'SER RIO': 'Ser Rio Incorporadora',
    'TAKONO': 'Takono S.A.', 'ROJEMAC': 'Rojemac S.A.',
    'BALASSIANO': 'Balassiano Incorporadora', 'LIONS': 'Lions Investimentos',
    'MAUI': 'Maui Incorporadora', 'AMPLA UP': 'Ampla UP',
    'TIMES SQUARE': 'Times Square S.A.', 'MARINI': 'Marini Incorporadora',
    'ENSEADAS': 'Enseadas Palms', 'PONTTE': 'Pontte / WIMO',
    'ALMARIAS': 'Almarias Incorporadora', 'GAV II': 'GAV Desenvolvimento',
    'GAV III': 'GAV Desenvolvimento', 'BIT': 'BIT Multipropriedade',
    'MAYFAIR': 'Mayfair Incorporadora', 'GT': 'GT Incorporadora',
    'TERRAL': 'Terral S.A.', 'CASA FENDI': 'Casa Fendi',
    'BURITI III': 'Buriti Incorporadora', 'MAEHARA': 'Maehara Incorporadora',
    'GLOBAL': 'Global Incorporadora', 'DAL POZZO': 'Dal Pozzo Incorporadora',
    'TRISUL': 'Trisul S.A.', 'EINSTEIN II': 'Hospital Albert Einstein',
    'RIO ANIL': 'Rio Anil S.A.', 'EMIVE': 'Emive S.A.',
    'CFL': 'CFL Incorporações', 'AURA': 'Aura Minerals',
    'RL80': 'RL80 / Direcional', 'JOTA ELE': 'Jota Ele',
    'TABELA DIRETA': 'Direcional Engenharia', 'GT BUILDING': 'GT Building',
    'MAXI': 'Maxi Incorporadora', 'IBEN': 'IBEN S.A.',
    'TELLUS': 'Tellus Brasil', 'NEW INC': 'New Incorporadora',
    'LIBERATO': 'Liberato S.A.', 'LAREDO II': 'Laredo Multipropriedade',
    'XPEX': 'XPEX S.A.', 'ONE': 'One Properties',
    'RCP II': 'Rio Claro Properties', 'MORADA DO LAGO': 'Morada do Lago',
    'SUPER X': 'Super X S.A.', 'ITACEMA': 'Itacema Incorporadora',
    'IPIOCA': 'Ipioca Multipropriedade', 'PATRIMAR III': 'Patrimar Engenharia',
    'SOROCAPS': 'Sorocaps S.A.', 'BRAVO LOG': 'Bravo Log',
    'BURITI': 'Buriti Incorporadora', 'BBP': 'BBP Matera',
    'GLOBALMAX': 'Globalmax S.A.', 'GRAN TORINO': 'Gran Torino',
    'ALMARIAS': 'Almarias', 'GIP ESTOQUE': 'GIP Estoque',
    'MITRE II': 'Mitre Realty', 'CETILPARK': 'Cetilpark',
    'TRINITY II': 'Trinity Energia', 'BRAVA SIXTEEN': 'Brava Sixteen',
    'GRAN PARADISO': 'Gran Paradiso Multipropriedade', 'AMORA': 'Amora S.A.',
    'WIMO 5': 'WIMO Home Equity', 'WIMO 4': 'WIMO Home Equity',
    'WIMO 3': 'WIMO Home Equity', 'WIMO 2': 'WIMO Home Equity',
    'MZM': 'MZM Incorporadora', 'VITACON': 'Vitacon S.A.',
    'ARENA MRV': 'Arena MRV / Mineiro', 'ATHENA': 'FII Athena',
    'CEMARA': 'Cemara S.A.', 'SPLICE': 'Splice S.A.',
    'DOME': 'Dome S.A.', 'LINK': 'Link S.A.',
    'VENANCIO': 'Venâncio S.A.', 'CASA COSTA': 'Casa Costa',
    'SER RIO': 'Ser Rio', 'BEAL': 'BEAL S.A.',
    'RIO PARK': 'Rio Park', 'PHV': 'PHV Incorporadora',
    'MAEFAIR': 'Mayfair Incorporadora',
  };
  for (const [k, v] of Object.entries(KNOWN)) {
    if (alias.includes(k)) return v;
  }
  // Capitaliza alias como fallback
  const cap = (alias.replace(/^(ESTR|CORP|PULV|CD|AMPLA|ESTRUT|GIP|CRI)\s+/i, '').trim() || alias)
    .split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  return cap || 'Riza Securitizadora';
}

function mapStatus(s) {
  if (s === 'Em Andamento' || s === 'Em andamento') return 'active';
  if (s === 'Default') return 'critical';
  return 'active';
}

function classifyCarteira(rate, status) {
  if (status === 'critical') return 'High Yield';
  if (!rate) return 'Portfólio Principal';

  const cdi = rate.match(/CDI\s*\+\s*([\d.,]+)/i);
  if (cdi && parseFloat(cdi[1].replace(',', '.')) > 4.0) return 'High Yield';

  const ipca = rate.match(/IPCA\s*\+\s*([\d.,]+)/i);
  if (ipca && parseFloat(ipca[1].replace(',', '.')) > 10.0) return 'High Yield';

  const fixed = rate.match(/^([\d.,]+)\s*%\s*a\.a\./i);
  if (fixed && parseFloat(fixed[1].replace(',', '.')) > 15.0) return 'High Yield';

  return 'Portfólio Principal';
}

// ─── FILTRO ───────────────────────────────────────────────────────────────────
const CUTOFF = new Date('2025-01-01');

const filtered = raw.filter(cri => {
  if (cri.type !== 'CRI') return false;
  const due = isoToDate(cri.dueDate);
  const st = cri.status || '';
  if (st === 'Em Andamento' || st === 'Em andamento') return true;
  if (due && due >= CUTOFF) return true;
  return false;
});

console.log(`Total CRIs na API: ${raw.filter(c => c.type==='CRI').length}`);
console.log(`Após filtro (Em Andamento + vencimento >= 2025): ${filtered.length}`);

// ─── GERAÇÃO ─────────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/'/g, "\\'").replace(/\\/g, '\\\\');

// Mapa: id → dados detalhados das séries
const detailsMap = {};

const lines = filtered.map((cri, i) => {
  const id      = `rz${String(i + 1).padStart(3, '0')}`;
  const name    = `CRI ${esc(cri.alias || cri.apelido || '')}`;
  const debtor  = esc(buildDebtor(cri));
  const status  = mapStatus(cri.status);
  const code    = buildCode(cri);
  const isin    = buildIsin(cri);
  const taxa    = esc(buildTaxa(cri));
  const matDate = isoToBr(cri.dueDate);
  const emDate  = isoToBr(cri.emissionDate);
  const rawEmissor = (cri.emissor || 'Riza Securitizadora S.A.').replace(' S.A', '').replace(' S.A.', '').trim();
  const securt  = esc(rawEmissor);
  const lastro  = esc(cri.assetRisk || cri.lastroRisco || 'Imóvel');
  const emval   = parseValue(cri.emissionTotalValue || cri.volumeTotalEmissao);
  const rzaUrl  = `https://investidor.rizasec.com/emissoes/RZA${cri.oid}`;

  // Constrói detalhes para o modal
  const series = (cri.series || []).map(s => {
    const idx = s.indexador?.nome || s.indexer?.name || '';
    const idxLabel = idx === 'DI' ? 'CDI' : idx;
    const spread = s.taxaSpread ?? s.spread ?? null;
    const taxaSerie = spread !== null ? `${idxLabel} + ${Number(spread).toFixed(4)}% a.a.` : (idxLabel || '—');
    return {
      codigoIsin: s.codigoISIN || '',
      codigoCetip: s.codigoIf || s.ifCode || '',
      numeroSerie: s.numeroSerie ?? '',
      tipoSerie: s.tipoSerie || '—',
      tipoOferta: icvmLabel(s.icvm),
      taxa: taxaSerie,
      status: s.status || cri.status || '',
      volumeEmissao: parseValue(s.volumeEmissao) || 0,
      dataVencimento: isoToBr(s.dataVencimento || cri.dueDate),
      base: s.base || '—',
      periodicidadeCorrecao: periodicidadeLabel(s.periodicidadeCorrecao),
      periodicidadePagamento: periodicidadeLabel(s.periodicidadePagamento),
      indexador: idxLabel,
    };
  });

  detailsMap[id] = {
    emissao: cri.emissionNumber || '—',
    dataEmissao: emDate,
    agenteFiduciario: (cri.fiduciaryAgent || '').replace(' DISTRIBUIDORA DE TITULOS E VALORES MOBILIARIOS LTDA', '').replace(' DISTRIBUIDORA DE TITULOS E VALORES MOBILIARIO', '').trim() || '—',
    tipoLastro: esc(cri.lastroRisco || cri.assetRisk || '—'),
    detalhamentoLastro: esc(cri.lastroDescricao || '—'),
    segmentoLastro: esc(cri.lastroSegmento || '—'),
    volumeTotal: emval,
    rzaUrl,
    series,
  };

  const carteira = classifyCarteira(taxa, status);
  return `  { id: '${id}', name: '${name}', debtor: '${debtor}', status: '${status}', code: '${code}', isin: '${isin}', cetipCode: '${code}', rate: '${taxa}', maturityDate: '${matDate}', securitizer: '${securt}', securitizerId: '10', downloadLink: '${rzaUrl}', linkType: 'portal', lastro: '${lastro}', carteira: '${carteira}', emissionValue: ${emval}, cidade: '', estado: '', regiao: '' }`;
});

// Salva detalhes num JSON separado para o servidor (não vai no bundle do cliente)
const DETAILS_OUT = path.join(__dirname, '..', 'server', 'data', 'rizaDetails.json');
fs.mkdirSync(path.dirname(DETAILS_OUT), { recursive: true });
fs.writeFileSync(DETAILS_OUT, JSON.stringify(detailsMap, null, 2), 'utf-8');
console.log(`✅ Detalhes salvos: ${DETAILS_OUT}`);

const hy = lines.filter(l => l.includes("carteira: 'High Yield'")).length;
const pp = lines.filter(l => l.includes("carteira: 'Portfólio Principal'")).length;
console.log(`Portfólio Principal: ${pp} | High Yield: ${hy}`);

const content = `// Gerado automaticamente por scripts/gen-riza-ts.mjs
// Fonte: aks-prod.virgo.inc (API RizaSec) — ${new Date().toLocaleDateString('pt-BR')}
// ${filtered.length} CRIs (Em Andamento + Default com vencimento ≥ 2025)

export type CarteiraCRI = 'Portfólio Principal' | 'Centro-Oeste' | 'High Yield';

export interface CRIDataRiza {
  id: string;
  name: string;
  debtor: string;
  status: 'active' | 'warning' | 'critical';
  code: string;
  isin?: string;
  cetipCode?: string;
  rate: string;
  maturityDate: string;
  securitizer: string;
  securitizerId: string;
  downloadLink: string;
  linkType: 'direct' | 'portal';
  lastro: string;
  carteira: CarteiraCRI;
  emissionValue: number;
  cidade: string;
  estado: string;
  regiao: string;
}

export const criRizaSec: CRIDataRiza[] = [
${lines.join(',\n')}
];
`;

fs.writeFileSync(OUT, content, 'utf-8');
console.log(`✅ Arquivo gerado: ${OUT}`);
console.log(`   Taxa preenchida: ${filtered.filter(c => buildTaxa(c) !== 'N/D').length}/${filtered.length}`);
