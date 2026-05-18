/**
 * Shared CVM data store — downloads the INF_MENSAL_CRI ZIP once per day
 * and parses all CSV files into in-memory maps for fast lookup by ISIN.
 */
import { inflateRawSync } from "zlib";

const CACHE_TTL = 24 * 60 * 60 * 1000;

export interface CVMStore {
  /** classe: ISIN → rows sorted by Data_Referencia desc */
  classe: Map<string, Record<string, string>[]>;
  /** geral: ISIN → most recent row */
  geral: Map<string, Record<string, string>>;
  /** fluxoCaixa: ISIN → rows sorted by Data_Referencia desc */
  fluxoCaixa: Map<string, Record<string, string>[]>;
  /** ativoPassivo: ISIN → rows sorted by Data_Referencia desc */
  ativoPassivo: Map<string, Record<string, string>[]>;
  /** creditos: ISIN → most recent row */
  creditos: Map<string, Record<string, string>>;
  /** dfin: ISIN → row with Nome_Certificado + Link_Download */
  dfin: Map<string, Record<string, string>>;
  loadedAt: number;
}

let store: CVMStore | null = null;
let loading: Promise<CVMStore> | null = null;

// ─── ZIP ─────────────────────────────────────────────────────────────────────

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
    } else { offset++; }
  }
  return entries;
}

function extractEntry(buf: Buffer, e: ReturnType<typeof parseZipEntries>[number]): Buffer {
  const raw = buf.subarray(e.dataStart, e.dataStart + e.compSize);
  return e.comprMethod === 8 ? inflateRawSync(raw) : raw;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function parseCSV(raw: Buffer): Record<string, string>[] {
  const text = new TextDecoder("latin1").decode(raw);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(";").map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

// ─── Grouping helpers ────────────────────────────────────────────────────────

function groupByISIN(
  rows: Record<string, string>[],
  sortDesc = true,
): Map<string, Record<string, string>[]> {
  const m = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const isin = row["Codigo_Identificacao_Certificado"]?.trim();
    if (!isin) continue;
    if (!m.has(isin)) m.set(isin, []);
    m.get(isin)!.push(row);
  }
  if (sortDesc) {
    for (const [, arr] of m) {
      arr.sort((a, b) => (b["Data_Referencia"] ?? "").localeCompare(a["Data_Referencia"] ?? ""));
    }
  }
  return m;
}

function latestByISIN(
  rows: Record<string, string>[],
): Map<string, Record<string, string>> {
  const m = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const isin = row["Codigo_Identificacao_Certificado"]?.trim();
    if (!isin) continue;
    const ex = m.get(isin);
    if (!ex || (row["Data_Referencia"] ?? "") > (ex["Data_Referencia"] ?? "")) {
      m.set(isin, row);
    }
  }
  return m;
}

// ─── Load ────────────────────────────────────────────────────────────────────

async function loadStore(): Promise<CVMStore> {
  const year = new Date().getFullYear();
  const zipUrl  = `https://dados.cvm.gov.br/dados/SECURIT/DOC/INF_MENSAL_CRI/DADOS/inf_mensal_cri_${year}.zip`;
  const dfinUrl = `https://dados.cvm.gov.br/dados/SECURIT/DOC/DFIN_CRI/DADOS/dfin_cri_${year - 1}.csv`;

  console.log("[CVM Store] Baixando ZIP e DFIN...");
  const [zipResp, dfinResp] = await Promise.all([
    fetch(zipUrl,  { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(90_000) }),
    fetch(dfinUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(30_000) }),
  ]);

  if (!zipResp.ok) throw new Error(`CVM ZIP HTTP ${zipResp.status}`);
  const zipBuf = Buffer.from(await zipResp.arrayBuffer());
  const entries = parseZipEntries(zipBuf);

  function getCSV(keyword: string): Record<string, string>[] {
    const e = entries.find(e => e.name.includes(keyword));
    return e ? parseCSV(extractEntry(zipBuf, e)) : [];
  }

  const classeRows      = getCSV("classe");
  const geralRows       = getCSV("geral");
  const fluxoRows       = getCSV("fluxo_caixa");
  const ativoPassivoRows = getCSV("ativo_passivo");
  const creditosRows    = getCSV("creditos");

  console.log(`[CVM Store] Linhas: classe=${classeRows.length} geral=${geralRows.length} fluxo=${fluxoRows.length} ap=${ativoPassivoRows.length}`);

  // DFIN
  const dfinMap = new Map<string, Record<string, string>>();
  if (dfinResp.ok) {
    const dfinBuf = Buffer.from(await dfinResp.arrayBuffer());
    const dfinRows = parseCSV(dfinBuf);
    for (const row of dfinRows) {
      const isin = row["Codigo_Identificacao_Certificado"]?.trim();
      if (isin && !dfinMap.has(isin)) dfinMap.set(isin, row);
    }
    console.log(`[CVM Store] DFIN: ${dfinMap.size} entradas`);
  }

  return {
    classe:       groupByISIN(classeRows),
    geral:        latestByISIN(geralRows),
    fluxoCaixa:   groupByISIN(fluxoRows),
    ativoPassivo: groupByISIN(ativoPassivoRows),
    creditos:     latestByISIN(creditosRows),
    dfin:         dfinMap,
    loadedAt:     Date.now(),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getCVMStore(): Promise<CVMStore> {
  if (store && Date.now() - store.loadedAt < CACHE_TTL) return store;
  if (loading) return loading;
  loading = loadStore()
    .then(s => { store = s; loading = null; return s; })
    .catch(e => { loading = null; throw e; });
  return loading;
}

export function getCachedStore(): CVMStore | null {
  return store;
}
