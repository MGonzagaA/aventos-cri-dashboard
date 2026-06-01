import { publicProcedure } from "../_core/trpc";
import { getCVMStore } from "./cvm-store";
import { db, approvedCRIs } from "../db/index";

async function readApprovedExtra(): Promise<CRIFromCVM[]> {
  try {
    const rows = await db.select().from(approvedCRIs);
    return rows.map(r => r.data as unknown as CRIFromCVM);
  } catch (e) {
    console.warn("[CVM] Não foi possível carregar aprovados do Supabase:", e);
    return [];
  }
}

export interface CRIFromCVM {
  id: string;
  name: string;
  debtor: string;
  securitizer: string;
  rate: string;
  maturityDate: string; // DD/MM/YYYY
  portfolio: "high-yield" | "centro-oeste" | "portfolio-principal";
  riskLevel: "low" | "medium" | "high";
  lastro: string;
  source: "ANBIMA";
  puValue?: string;
  cetipCode?: string; // código B3/CETIP para link ANBIMA
  isin?: string;
  cidade?: string;
  estado?: string;
  regiao?: string;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000;
let cachedData: CRIFromCVM[] | null = null;
export function invalidateAnbimaCache() { cachedData = null; }
let lastFetchTime = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function dateToDD_MM_YYYY(iso: string): string {
  if (!iso) return "31/12/2030";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "31/12/2030";
}

function extractSpread(taxa: string): number {
  const m = taxa.match(/\+\s*([\d,\.]+)\s*%/);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

const CENTRO_OESTE_KW = ["rural", "agro", "soja", "milho", "cana", "fazenda", "goiás", "goias",
  "mato grosso", "mato-grosso", "campo grande", "cuiabá", "brasília", "distrito federal",
  " go ", " mt ", " ms ", " df ", "cerrado", "pecuária", "pecuaria"];

const HIGH_YIELD_KW = ["hotel", "resort", "varejo", "shopping", "reestrutura", "estressado",
  "laje", "escritório", "retrofit"];

export function classifyPortfolio(taxa: string, lastro: string, garantia: string, classe: string): CRIFromCVM["portfolio"] {
  const texto = (lastro + " " + garantia + " " + taxa).toLowerCase();
  if (CENTRO_OESTE_KW.some(kw => texto.includes(kw))) return "centro-oeste";
  const spread = extractSpread(taxa);
  if (
    classe.toLowerCase().includes("subordina") ||
    HIGH_YIELD_KW.some(kw => texto.includes(kw)) ||
    (taxa.toLowerCase().includes("ipca") && spread >= 12) ||
    (taxa.toLowerCase().includes("cdi")  && spread >= 4)
  ) return "high-yield";
  return "portfolio-principal";
}

export function classifyRisk(classe: string, situacao: string): CRIFromCVM["riskLevel"] {
  if (!situacao.toLowerCase().includes("adimplente")) return "high";
  if (classe.toLowerCase().includes("subordina")) return "high";
  if (classe.toLowerCase().includes("mezzan"))    return "medium";
  return "low";
}

const UF_REGIAO: Record<string, string> = {
  SP: "Sudeste", RJ: "Sudeste", MG: "Sudeste", ES: "Sudeste",
  GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste", DF: "Centro-Oeste",
  RS: "Sul", SC: "Sul", PR: "Sul",
  BA: "Nordeste", PE: "Nordeste", CE: "Nordeste", MA: "Nordeste",
  RN: "Nordeste", PB: "Nordeste", SE: "Nordeste", AL: "Nordeste", PI: "Nordeste",
  AM: "Norte", PA: "Norte", TO: "Norte", RO: "Norte", AC: "Norte", AP: "Norte", RR: "Norte",
};

export function extractUF(
  lastro: string,
  garantia: string,
  nomeEmissao: string,
  portfolio: string,
): { estado: string; regiao: string } {
  const t = ` ${(lastro + " " + garantia + " " + nomeEmissao).toUpperCase()} `;

  // Nomes completos primeiro (mais específicos)
  if (t.includes("MATO GROSSO DO SUL"))                        return { estado: "MS", regiao: "Centro-Oeste" };
  if (t.includes("MATO GROSSO") || t.includes("MATO-GROSSO")) return { estado: "MT", regiao: "Centro-Oeste" };
  if (t.includes("GOIÁS") || t.includes("GOIAS"))              return { estado: "GO", regiao: "Centro-Oeste" };
  if (t.includes("BRASÍLIA") || t.includes("BRASILIA") || t.includes("DISTRITO FEDERAL")) return { estado: "DF", regiao: "Centro-Oeste" };
  if (t.includes("SÃO PAULO") || t.includes("SAO PAULO"))      return { estado: "SP", regiao: "Sudeste" };
  if (t.includes("RIO DE JANEIRO"))                             return { estado: "RJ", regiao: "Sudeste" };
  if (t.includes("MINAS GERAIS"))                               return { estado: "MG", regiao: "Sudeste" };
  if (t.includes("SANTA CATARINA"))                             return { estado: "SC", regiao: "Sul" };
  if (t.includes("RIO GRANDE DO SUL"))                          return { estado: "RS", regiao: "Sul" };
  if (t.includes("PARANÁ") || t.includes("PARANA"))            return { estado: "PR", regiao: "Sul" };
  if (t.includes("BAHIA"))                                      return { estado: "BA", regiao: "Nordeste" };
  if (t.includes("PERNAMBUCO"))                                 return { estado: "PE", regiao: "Nordeste" };
  if (t.includes("CEARÁ") || t.includes("CEARA"))              return { estado: "CE", regiao: "Nordeste" };

  // Siglas com word boundary
  const m = t.match(/\b(SP|RJ|MG|ES|GO|MT|MS|DF|RS|SC|PR|BA|PE|CE|MA|RN|PB|SE|AL|PI|AM|PA|TO|RO|AC|AP|RR)\b/);
  if (m) return { estado: m[1], regiao: UF_REGIAO[m[1]] ?? "" };

  // Fallback garantido por carteira (todos os CRIs terão localização)
  if (portfolio === "centro-oeste") return { estado: "GO", regiao: "Centro-Oeste" };
  if (portfolio === "high-yield")   return { estado: "SP", regiao: "Sudeste" };
  return { estado: "SP", regiao: "Sudeste" }; // portfolio-principal: maioria é SP
}

const GARBAGE_KW = ["emissão", "emissao", "série", "serie", "certificado", "cri emiss"];

export function extractDebtorFromCertName(certName: string): string {
  const m = certName.match(/S[ÉE]RIE[:\(][^)]*\)\s+(.+?)\s+\d{2}\/\d{4}/i)
         ?? certName.match(/S[ÉE]RIE:\d+\s+(.+?)\s+\d{2}\/\d{4}/i);
  if (m) {
    const candidate = m[1].trim();
    if (candidate.length > 2 && !GARBAGE_KW.some(kw => candidate.toLowerCase().includes(kw)))
      return candidate;
  }
  return "";
}

const SECURITIZER_CLEAN: Record<string, string> = {
  "VIRGO": "Virgo", "OPEA": "OPEA Securitizadora", "CIBRASEC": "Cibrasec",
  "TRUE": "True Securitizadora", "HABITASEC": "Habitasec", "FORTESEC": "Fortesec",
  "VÓRTX": "Vórtx", "VORTX": "Vórtx", "RB CAPITAL": "RB Capital",
  "BRL TRUST": "BRL Trust", "RIZA": "Riza", "ISEC": "iSec", "GAIA": "Gaia",
  "OCTANTE": "Octante", "EXES": "Éxes Securitizadora", "ÉXES": "Éxes Securitizadora",
  "BARI": "BARI Securitizadora",
};

export function cleanSecuritizerName(raw: string): string {
  const upper = raw.toUpperCase();
  for (const [key, val] of Object.entries(SECURITIZER_CLEAN)) {
    if (upper.includes(key)) return val;
  }
  return raw.split(" ")[0].charAt(0).toUpperCase() + raw.split(" ")[0].slice(1).toLowerCase();
}

// ─── Build CRI list — ALL active CRIs from CVM ───────────────────────────────

function parseDateISO(iso: string): number {
  if (!iso) return 0;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

async function buildCRIList(): Promise<CRIFromCVM[]> {
  const s = await getCVMStore();
  const today = new Date().toISOString().slice(0, 10);
  const results: CRIFromCVM[] = [];
  let idx = 0;

  for (const [isin, rows] of s.classe) {
    const cRow       = rows[0];
    const vencimento = cRow["Data_Vencimento"]?.trim() ?? "";
    const situacao   = cRow["Situacao"]?.trim() ?? "";
    const taxa       = cRow["Taxa_Juros"]?.trim() ?? "";
    const classe     = cRow["Classe"]?.trim() ?? "";

    if (!situacao.toLowerCase().includes("adimplente")) continue;
    if (vencimento && vencimento < today) continue;
    if (!taxa) continue;

    const gRow        = s.geral.get(isin) ?? {};
    const emissora    = gRow["Companhia_Emissora"]?.trim() || "Securitizadora";
    const lastro      = gRow["Detalhamento_Lastro"]?.trim() || gRow["Tipo_Lastro"]?.trim() || "Ver documentação";
    const garantia    = gRow["Tipos_Garantias_Coobrigacao_Securitizadora"]?.trim() ?? "";
    const nomeEmissao = gRow["Nome_Emissao"]?.trim() ?? isin;
    const numSerie    = cRow["Numero_Serie"]?.trim() ?? "";
    const cetipCode   = cRow["Codigo_CETIP"]?.trim() ?? "";

    const rawDebtor = s.dfin.get(isin)
      ? extractDebtorFromCertName(s.dfin.get(isin)!["Nome_Certificado"] ?? "")
      : "";
    const debtor = rawDebtor
      || (nomeEmissao && !/^[A-Z]{3}\d+$/.test(nomeEmissao) ? nomeEmissao : "Devedor Diversificado");
    const securitizerClean = cleanSecuritizerName(emissora);

    const portfolio = classifyPortfolio(taxa, lastro, garantia, classe);
    const riskLevel = classifyRisk(classe, situacao);
    const location  = extractUF(lastro, garantia, nomeEmissao, portfolio);

    let puValue: string | undefined;
    const qtd = parseFloat(cRow["Quantidade_Certificados"]?.replace(",", ".") ?? "0");
    const val = parseFloat(cRow["Valor_Certificados"]?.replace(",", ".") ?? "0");
    if (qtd > 0 && val > 0) {
      puValue = (val / qtd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    results.push({
      id: `cvm-${isin}-${idx}`,
      name: `CRI ${numSerie ? numSerie + "ª Série - " : ""}${securitizerClean}`,
      debtor,
      securitizer: securitizerClean,
      rate: taxa,
      maturityDate: dateToDD_MM_YYYY(vencimento),
      portfolio,
      riskLevel,
      lastro,
      source: "ANBIMA" as const,
      puValue,
      cetipCode: cetipCode || undefined,
      isin,
      cidade: "",
      estado: location.estado,
      regiao: location.regiao,
    });

    idx++;
  }

  // Sort by maturity date ascending (nearest first)
  results.sort((a, b) => {
    const toISO = (dd: string) => {
      const [d, m, y] = dd.split("/");
      return y && m && d ? `${y}-${m}-${d}` : "9999-12-31";
    };
    return parseDateISO(toISO(a.maturityDate)) - parseDateISO(toISO(b.maturityDate));
  });

  // Merge manually approved CRIs (not in main filters)
  const extra = await readApprovedExtra();
  const existingISINs = new Set(results.map(r => r.isin));
  for (const cri of extra) {
    if (cri.isin && !existingISINs.has(cri.isin)) {
      results.push(cri);
      existingISINs.add(cri.isin);
    }
  }

  console.log(`[CVM] ${results.length} CRIs ativos (${extra.length} aprovados manualmente)`);
  return results;
}

// ─── tRPC procedure ───────────────────────────────────────────────────────────

export const anbimaProcedure = {
  get: publicProcedure.query(async () => {
    try {
      if (cachedData && cachedData.length > 0 && Date.now() - lastFetchTime < CACHE_DURATION) {
        console.log(`[CVM Cache] ${cachedData.length} CRIs`);
        return { cris: cachedData, source: "CVM", timestamp: lastFetchTime, cached: true, count: cachedData.length };
      }

      const cris = await buildCRIList();
      if (cris.length > 0) { cachedData = cris; lastFetchTime = Date.now(); }

      return { cris: cris.length > 0 ? cris : (cachedData ?? []), source: "CVM", timestamp: Date.now(), cached: false, count: cris.length || cachedData?.length || 0 };
    } catch (error) {
      console.error("[CVM] Erro:", error);
      return { cris: cachedData ?? [], source: "CVM", error: error instanceof Error ? error.message : "Erro", cached: !!cachedData, count: cachedData?.length ?? 0 };
    }
  }),
};
