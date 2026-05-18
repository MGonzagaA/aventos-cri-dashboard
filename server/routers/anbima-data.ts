import { publicProcedure } from "../_core/trpc";
import { getCVMStore } from "./cvm-store";

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
}

const CACHE_DURATION = 24 * 60 * 60 * 1000;
let cachedData: CRIFromCVM[] | null = null;
let lastFetchTime = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToDD_MM_YYYY(iso: string): string {
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

function classifyPortfolio(taxa: string, lastro: string, garantia: string, classe: string): CRIFromCVM["portfolio"] {
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

function classifyRisk(classe: string, situacao: string): CRIFromCVM["riskLevel"] {
  if (!situacao.toLowerCase().includes("adimplente")) return "high";
  if (classe.toLowerCase().includes("subordina")) return "high";
  if (classe.toLowerCase().includes("mezzan"))    return "medium";
  return "low";
}

const GARBAGE_KW = ["emissão", "emissao", "série", "serie", "certificado", "cri emiss"];

function extractDebtorFromCertName(certName: string): string {
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

function cleanSecuritizerName(raw: string): string {
  const upper = raw.toUpperCase();
  for (const [key, val] of Object.entries(SECURITIZER_CLEAN)) {
    if (upper.includes(key)) return val;
  }
  return raw.split(" ")[0].charAt(0).toUpperCase() + raw.split(" ")[0].slice(1).toLowerCase();
}

// ─── Targeted securitizers (Éxes, BARI, Riza) ───────────────────────────────

const TARGET_SEC_KW = ["EXES", "ÉXES", "BARI", "RIZA", "RIZASEC"];
const TARGET_MAX_MATURITY = "2030-12-31";

async function buildTargetedCRIList(excludeISINs: Set<string>): Promise<CRIFromCVM[]> {
  const s = await getCVMStore();
  const today = new Date().toISOString().slice(0, 10);
  const results: CRIFromCVM[] = [];

  for (const [isin, rows] of s.classe) {
    if (excludeISINs.has(isin)) continue;

    const cRow      = rows[0];
    const vencimento = cRow["Data_Vencimento"]?.trim() ?? "";
    const situacao   = cRow["Situacao"]?.trim() ?? "";
    const taxa       = cRow["Taxa_Juros"]?.trim() ?? "";
    const classe     = cRow["Classe"]?.trim() ?? "";

    if (!situacao.toLowerCase().includes("adimplente")) continue;
    if (vencimento && vencimento < today) continue;
    if (!vencimento || vencimento > TARGET_MAX_MATURITY) continue;

    const gRow     = s.geral.get(isin) ?? {};
    const emissora = gRow["Companhia_Emissora"]?.trim() || "";
    if (!TARGET_SEC_KW.some(kw => emissora.toUpperCase().includes(kw))) continue;

    const lastro      = gRow["Detalhamento_Lastro"]?.trim() || gRow["Tipo_Lastro"]?.trim() || "Ver documentação";
    const garantia    = gRow["Tipos_Garantias_Coobrigacao_Securitizadora"]?.trim() ?? "";
    const nomeEmissao = gRow["Nome_Emissao"]?.trim() ?? isin;
    const numSerie    = cRow["Numero_Serie"]?.trim() ?? "";
    const cetipCode   = cRow["Codigo_CETIP"]?.trim() ?? "";

    const rawDebtor = s.dfin.get(isin) ? extractDebtorFromCertName(s.dfin.get(isin)!["Nome_Certificado"] ?? "") : "";
    const debtor    = rawDebtor || (nomeEmissao && !/^[A-Z]{3}\d+$/.test(nomeEmissao) ? nomeEmissao : "Devedor Diversificado");
    const securitizerClean = cleanSecuritizerName(emissora);
    const portfolio  = classifyPortfolio(taxa || "", lastro, garantia, classe);
    const riskLevel  = classifyRisk(classe, situacao);

    let puValue: string | undefined;
    const qtd = parseFloat(cRow["Quantidade_Certificados"]?.replace(",", ".") ?? "0");
    const val = parseFloat(cRow["Valor_Certificados"]?.replace(",", ".") ?? "0");
    if (qtd > 0 && val > 0) {
      puValue = (val / qtd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    results.push({
      id: `cvm-target-${isin}`,
      name: `CRI ${numSerie}ª Série - ${securitizerClean}`,
      debtor,
      securitizer: securitizerClean,
      rate: taxa || "Ver documentação",
      maturityDate: dateToDD_MM_YYYY(vencimento),
      portfolio,
      riskLevel,
      lastro,
      source: "ANBIMA" as const,
      puValue,
      cetipCode: cetipCode || undefined,
      isin,
    });
  }

  console.log(`[CVM Targeted] ${results.length} CRIs de Éxes/BARI/Riza (até 2030)`);
  return results;
}

// ─── Build CRI list ───────────────────────────────────────────────────────────

async function buildCRIList(): Promise<CRIFromCVM[]> {
  const s = await getCVMStore();
  const today = new Date().toISOString().slice(0, 10);
  const results: CRIFromCVM[] = [];
  let idx = 0;

  for (const [isin, rows] of s.classe) {
    const cRow = rows[0]; // most recent
    const vencimento = cRow["Data_Vencimento"]?.trim() ?? "";
    const situacao   = cRow["Situacao"]?.trim() ?? "";
    const taxa       = cRow["Taxa_Juros"]?.trim() ?? "";
    const classe     = cRow["Classe"]?.trim() ?? "";

    if (!situacao.toLowerCase().includes("adimplente")) continue;
    if (vencimento && vencimento < today) continue;
    if (!taxa) continue;

    const gRow       = s.geral.get(isin) ?? {};
    const emissora   = gRow["Companhia_Emissora"]?.trim() || "Securitizadora";
    const lastro     = gRow["Detalhamento_Lastro"]?.trim() || gRow["Tipo_Lastro"]?.trim() || "Ver documentação";
    const garantia   = gRow["Tipos_Garantias_Coobrigacao_Securitizadora"]?.trim() ?? "";
    const nomeEmissao = gRow["Nome_Emissao"]?.trim() ?? isin;
    const numSerie   = cRow["Numero_Serie"]?.trim() ?? "";
    const cetipCode  = cRow["Codigo_CETIP"]?.trim() ?? "";

    const rawDebtor  = (s.dfin.get(isin) ? extractDebtorFromCertName(s.dfin.get(isin)!["Nome_Certificado"] ?? "") : "");
    const debtor     = rawDebtor || (nomeEmissao && !/^[A-Z]{3}\d+$/.test(nomeEmissao) ? nomeEmissao : "Devedor Diversificado");
    const securitizerClean = cleanSecuritizerName(emissora);

    const portfolio  = classifyPortfolio(taxa, lastro, garantia, classe);
    const riskLevel  = classifyRisk(classe, situacao);

    let puValue: string | undefined;
    const qtd = parseFloat(cRow["Quantidade_Certificados"]?.replace(",", ".") ?? "0");
    const val = parseFloat(cRow["Valor_Certificados"]?.replace(",", ".") ?? "0");
    if (qtd > 0 && val > 0) {
      puValue = (val / qtd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    results.push({
      id: `cvm-${isin}-${idx}`,
      name: `CRI ${numSerie}ª Série - ${securitizerClean}`,
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
    });

    idx++;
    if (idx >= 80) break;
  }

  // Adiciona CRIs de Éxes/BARI/Riza (vencimento ≤ 2030) não presentes na lista geral
  const generalISINs = new Set(results.map(r => r.isin).filter(Boolean) as string[]);
  const targeted = await buildTargetedCRIList(generalISINs);
  const merged = [...results, ...targeted];

  console.log(`[CVM] ${results.length} gerais + ${targeted.length} Éxes/BARI/Riza = ${merged.length} total`);
  return merged;
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
