/**
 * CRI Offers Store
 * ================
 * Baixa os dados de Ofertas Públicas de Distribuição da CVM (atualização diária)
 * e filtra apenas Certificados de Recebíveis Imobiliários.
 *
 * Fontes:
 *  - oferta_distribuicao.zip  → ICVM 400 / RCVM 160 rito ordinário + ICVM 476
 *  - oferta_resolucao_160.zip → RCVM 160 rito automático (a partir de 02/01/2023)
 *
 * Espelha a lógica do cri_monitor.py enviado pelo usuário.
 */

import { inflateRawSync } from "zlib";

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h — CVM atualiza diariamente

const OFFER_URLS = [
  "https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip",
  "https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_resolucao_160.zip",
];

// Padrões para identificar CRI na coluna de tipo de valor mobiliário
const CRI_PATTERNS = [
  "CERTIFICADO DE RECEBIVEIS IMOBILIARIOS",
  "CERTIFICADOS DE RECEBIVEIS IMOBILIARIOS",
  "CRI",
];

// Candidatos ao nome da coluna que identifica o tipo — CVM já mudou de schema
const TYPE_COL_CANDIDATES = [
  "Tipo_Valor_Mobiliario",
  "Tipo_Ativo",
  "Valor_Mobiliario",
];

// Colunas de data, em ordem de prioridade para filtros temporais
const DATE_COL_PRIORITY = [
  "Data_Encerramento_Oferta",
  "Data_Registro",
  "Data_Concessao_Registro",
  "Data_Inicio_Oferta",
  "Data_Protocolo",
];

export interface CRIOfferRow {
  fonte: string;                         // "oferta_distribuicao" | "oferta_resolucao_160"
  protocolo: string;
  tipoOferta: string;                    // "Pública" | "Restrita"
  emissor: string;
  cnpjEmissor: string;
  coordenadorLider: string;
  dataRegistro: string;                  // ISO YYYY-MM-DD ou ""
  dataInicio: string;
  dataEncerramento: string;
  dataRef: string;                       // melhor data disponível (para ordenação)
  valorTotal: number;                    // R$
  quantidadeTotal: number;
  precoUnitario: number;
  situacao: string;
  rawRow: Record<string, string>;        // linha original completa
}

interface OffersCache {
  rows: CRIOfferRow[];
  loadedAt: number;
}

let cache: OffersCache | null = null;
let loading: Promise<OffersCache> | null = null;

// ─── ZIP helpers ─────────────────────────────────────────────────────────────

function parseZipEntries(buf: Buffer) {
  const entries: { name: string; compSize: number; comprMethod: number; dataStart: number }[] = [];
  let offset = 0;
  while (offset < buf.length - 4) {
    if (buf.readUInt32LE(offset) === 0x04034b50) {
      const fnl = buf.readUInt16LE(offset + 26);
      const xl  = buf.readUInt16LE(offset + 28);
      const cs  = buf.readUInt32LE(offset + 18);
      const cm  = buf.readUInt16LE(offset + 8);
      const name = buf.subarray(offset + 30, offset + 30 + fnl).toString("latin1");
      const ds  = offset + 30 + fnl + xl;
      entries.push({ name, compSize: cs, comprMethod: cm, dataStart: ds });
      offset = ds + cs;
    } else {
      offset++;
    }
  }
  return entries;
}

function extractEntry(buf: Buffer, e: ReturnType<typeof parseZipEntries>[number]): Buffer {
  const raw = buf.subarray(e.dataStart, e.dataStart + e.compSize);
  return e.comprMethod === 8 ? inflateRawSync(raw) : raw;
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSVLatin1(raw: Buffer): Record<string, string>[] {
  const text = new TextDecoder("latin1").decode(raw);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(";").map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

// ─── Column detection ─────────────────────────────────────────────────────────

function findTypeColumn(row: Record<string, string>): string | null {
  for (const c of TYPE_COL_CANDIDATES) {
    if (c in row) return c;
  }
  // fallback: coluna cujo nome contenha "tipo" + "valor"/"ativo"/"oferta"
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if (k.includes("tipo") && (k.includes("valor") || k.includes("ativo") || k.includes("oferta"))) {
      return key;
    }
  }
  return null;
}

function isCRI(row: Record<string, string>): boolean {
  const typeCol = findTypeColumn(row);
  if (typeCol) {
    const val = (row[typeCol] ?? "").toUpperCase();
    // "CRI" como token isolado (evita falso positivo em "CRIPTOATIVOS")
    return CRI_PATTERNS.some(p => {
      if (p === "CRI") return /\bCRI\b/.test(val);
      return val.includes(p);
    });
  }
  // fallback: busca em todas as colunas string
  return Object.values(row).some(v =>
    v.toUpperCase().includes("RECEBIVEIS IMOBILIARIOS")
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseISODate(val: string): string {
  if (!val || val === "nan") return "";
  // Formatos possíveis: YYYY-MM-DD, DD/MM/YYYY, YYYY/MM/DD
  const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = val.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}

function bestDate(row: Record<string, string>): string {
  for (const col of DATE_COL_PRIORITY) {
    const d = parseISODate(row[col] ?? "");
    if (d) return d;
  }
  return "";
}

function parseBRL(val: string): number {
  if (!val) return 0;
  // remove separadores de milhar, troca vírgula decimal por ponto
  const clean = val.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: Record<string, string>, fonte: string): CRIOfferRow {
  return {
    fonte,
    protocolo:       row["Numero_Protocolo"]       ?? row["Protocolo"]         ?? "",
    tipoOferta:      row["Tipo_Oferta"]            ?? "",
    emissor:         row["Nome_Emissor_Companhia"] ?? row["Nome_Emissor"]      ?? row["Emissor"] ?? "",
    cnpjEmissor:     row["CNPJ_Emissor_Companhia"] ?? row["CNPJ_Emissor"]      ?? "",
    coordenadorLider: row["Coordenador_Lider"]     ?? row["Lider"]             ?? "",
    dataRegistro:    parseISODate(row["Data_Registro"]            ?? row["Data_Concessao_Registro"] ?? ""),
    dataInicio:      parseISODate(row["Data_Inicio_Oferta"]       ?? ""),
    dataEncerramento: parseISODate(row["Data_Encerramento_Oferta"] ?? ""),
    dataRef:         bestDate(row),
    valorTotal:      parseBRL(row["Valor_Total_Oferta"]           ?? ""),
    quantidadeTotal: parseBRL(row["Quantidade_Total_Ofertada"]    ?? ""),
    precoUnitario:   parseBRL(row["Preco_Unitario"]               ?? ""),
    situacao:        row["Situacao_Atual"]          ?? row["Situacao"]         ?? "",
    rawRow:          row,
  };
}

// ─── Main loader ──────────────────────────────────────────────────────────────

async function loadOffers(): Promise<OffersCache> {
  console.log("[CRI Offers] Baixando dados de novas emissões CVM...");
  const allRows: CRIOfferRow[] = [];

  for (const url of OFFER_URLS) {
    const fonteKey = url.includes("resolucao_160")
      ? "oferta_resolucao_160"
      : "oferta_distribuicao";

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(90_000),
      });
      if (!resp.ok) {
        console.warn(`[CRI Offers] ${fonteKey} retornou HTTP ${resp.status}`);
        continue;
      }

      const buf = Buffer.from(await resp.arrayBuffer());
      const entries = parseZipEntries(buf);
      let criCount = 0;
      let totalCount = 0;

      for (const entry of entries) {
        if (!entry.name.toLowerCase().endsWith(".csv")) continue;
        const csvBuf = extractEntry(buf, entry);
        const rows   = parseCSVLatin1(csvBuf);
        totalCount  += rows.length;

        for (const row of rows) {
          if (!isCRI(row)) continue;
          allRows.push(mapRow(row, fonteKey));
          criCount++;
        }
      }

      console.log(`[CRI Offers] ${fonteKey}: ${criCount.toLocaleString()} CRIs de ${totalCount.toLocaleString()} registros`);
    } catch (err: any) {
      console.warn(`[CRI Offers] Erro em ${fonteKey}: ${err.message}`);
    }
  }

  // Remove duplicatas por protocolo (pode aparecer nas duas fontes)
  const seen = new Set<string>();
  const unique = allRows.filter(r => {
    const key = r.protocolo || `${r.emissor}-${r.dataRef}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Ordena por data mais recente primeiro
  unique.sort((a, b) => b.dataRef.localeCompare(a.dataRef));

  console.log(`[CRI Offers] Total: ${unique.length} emissões únicas de CRI`);
  return { rows: unique, loadedAt: Date.now() };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getCRIOffersStore(): Promise<OffersCache> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL) return cache;
  if (loading) return loading;
  loading = loadOffers()
    .then(s => { cache = s; loading = null; return s; })
    .catch(e => {
      loading = null;
      if (cache) {
        console.warn("[CRI Offers] Erro ao recarregar, mantendo cache anterior");
        return cache;
      }
      throw e;
    });
  return loading;
}

/** Filtra por janela de dias (usando dataRef) */
export function filterByDays(rows: CRIOfferRow[], days: number): CRIOfferRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  return rows.filter(r => r.dataRef >= cutoffISO);
}

export function getCachedOffers(): OffersCache | null {
  return cache;
}
