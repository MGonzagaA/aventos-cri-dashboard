import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { getCVMStore } from "./cvm-store";
import { getCRIOffersStore, filterByDays } from "./cri-offers-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveCRI {
  name: string;
  debtor: string;
  securitizer: string;
  rate: string;
  maturityDate: string;
  carteira: "High Yield" | "Centro-Oeste" | "Portfólio Principal";
  lastro: string;
  isin: string;
}

// ─── File-based decisions store ───────────────────────────────────────────────

const DECISIONS_FILE = path.resolve(process.cwd(), "data", "portfolio-decisions.json");

interface CRIEntry {
  criName: string;
  isin?: string;
  debtor?: string;
  securitizer?: string;
  rate?: string;
  maturityDate?: string;
  portfolio?: string;
  decidedAt: string;
}

interface Decisions {
  approved: CRIEntry[];
  rejected: string[];
}

function readDecisions(): Decisions {
  try {
    if (fs.existsSync(DECISIONS_FILE)) {
      return JSON.parse(fs.readFileSync(DECISIONS_FILE, "utf8"));
    }
  } catch {}
  return { approved: [], rejected: [] };
}

function writeDecisions(decisions: Decisions): void {
  try {
    const dir = path.dirname(DECISIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2), "utf8");
  } catch (e) {
    console.warn("[Opportunities] Erro ao salvar decisions:", e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilMaturity(dateStr: string): number {
  const [d, m, y] = dateStr.split("/").map(Number);
  const maturity = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dateToDD_MM_YYYY(iso: string): string {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "";
}

function extractSpread(taxa: string): number {
  const match = taxa.match(/\+\s*([\d,\.]+)\s*%/);
  return match ? parseFloat(match[1].replace(",", ".")) : 0;
}

const CENTRO_OESTE_KW = [
  "rural", "agro", "soja", "milho", "cana", "fazenda", "goiás", "goias",
  "mato grosso", "campo grande", "cuiabá", "brasília", "distrito federal",
  " go ", " mt ", " ms ", " df ", "cerrado", "pecuária", "pecuaria",
];

const HIGH_YIELD_KW = [
  "hotel", "resort", "varejo", "shopping", "reestrutura", "estressado",
  "laje", "escritório", "retrofit", "subordina",
];

function classifyPortfolio(
  taxa: string,
  lastro: string,
  garantia: string,
  classe: string,
): "High Yield" | "Centro-Oeste" | "Portfólio Principal" {
  const texto = (lastro + " " + garantia + " " + taxa + " " + classe).toLowerCase();
  if (CENTRO_OESTE_KW.some(kw => texto.includes(kw))) return "Centro-Oeste";
  const spread = extractSpread(taxa);
  if (
    HIGH_YIELD_KW.some(kw => texto.includes(kw)) ||
    (taxa.toLowerCase().includes("ipca") && spread >= 10) ||
    (taxa.toLowerCase().includes("cdi") && spread >= 3.5)
  )
    return "High Yield";
  return "Portfólio Principal";
}

// ─── CVM Data ────────────────────────────────────────────────────────────────

async function getLiveMaturingCRIs(): Promise<(LiveCRI & { daysLeft: number })[]> {
  const s = await getCVMStore();
  const today = new Date().toISOString().slice(0, 10);
  const results: (LiveCRI & { daysLeft: number })[] = [];

  console.log(`[Opportunities] CVM store: ${s.classe.size} ISINs`);

  for (const [isin, rows] of s.classe) {
    const cRow = rows[0];
    const vencimento = cRow["Data_Vencimento"]?.trim() ?? "";
    const situacao = cRow["Situacao"]?.trim() ?? "";
    const taxa = cRow["Taxa_Juros"]?.trim() ?? "";
    const classe = cRow["Classe"]?.trim() ?? "";

    if (vencimento && vencimento <= today) continue;
    const sit = situacao.toLowerCase();
    if (
      sit.includes("inadimplente") ||
      sit.includes("cancelad") ||
      sit.includes("liquidado") ||
      sit.includes("resgatado")
    )
      continue;

    const maturityDate = dateToDD_MM_YYYY(vencimento);
    if (!maturityDate) continue;

    const daysLeft = daysUntilMaturity(maturityDate);
    if (daysLeft < 1 || daysLeft > 360) continue;

    const gRow = s.geral.get(isin) ?? {};
    const lastro =
      gRow["Detalhamento_Lastro"]?.trim() ||
      gRow["Tipo_Lastro"]?.trim() ||
      "Ver documentação";
    const garantia = gRow["Tipos_Garantias_Coobrigacao_Securitizadora"]?.trim() ?? "";
    const emissora =
      gRow["Companhia_Emissora"]?.trim() ||
      cRow["Companhia_Emissora"]?.trim() ||
      "Securitizadora";
    const numSerie = cRow["Numero_Serie"]?.trim() ?? "";
    const nomeEmissao = gRow["Nome_Emissao"]?.trim() ?? "";

    const carteira = classifyPortfolio(taxa, lastro, garantia, classe);
    const debtor =
      nomeEmissao && !/^[A-Z]{3}\d+$/.test(nomeEmissao)
        ? nomeEmissao
        : lastro !== "Ver documentação"
          ? lastro.substring(0, 60)
          : "Devedor Diversificado";

    results.push({
      isin,
      name: `CRI ${numSerie ? numSerie + "ª Série - " : ""}${emissora.split(" ")[0]}`,
      debtor,
      securitizer: emissora,
      rate: taxa || "Ver documentação",
      maturityDate,
      carteira,
      lastro,
      daysLeft,
    });
  }

  return results.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 500);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const opportunitiesRouter = router({
  monitor: publicProcedure.query(async () => {
    try {
      console.log("[Opportunities] Buscando CRIs vencendo na CVM...");
      const allCRIs = await getLiveMaturingCRIs();
      console.log(`[Opportunities] ${allCRIs.length} CRIs encontrados (próximos 360 dias)`);

      const decisions = readDecisions();
      const rejectedSet = new Set(decisions.rejected);
      const approvedSet = new Set(decisions.approved.map(d => d.criName));

      const pending = allCRIs.filter(
        cri => !rejectedSet.has(cri.name) && !approvedSet.has(cri.name),
      );

      return {
        success: true,
        found: allCRIs.length,
        opportunities: pending.map((cri, idx) => ({
          id: idx + 1,
          criName: cri.name,
          debtor: cri.debtor,
          securitizer: cri.securitizer,
          rate: cri.rate,
          maturityDate: cri.maturityDate,
          portfolio:
            cri.carteira === "High Yield"
              ? "high-yield"
              : cri.carteira === "Centro-Oeste"
                ? "centro-oeste"
                : "principal",
          status: "pending",
          isin: cri.isin,
          daysLeft: cri.daysLeft,
          geminiAnalysis: "",
        })),
      };
    } catch (error) {
      console.error("[Opportunities] Erro:", error);
      return { success: false, found: 0, opportunities: [] };
    }
  }),

  accept: publicProcedure
    .input(
      z.object({
        id: z.number(),
        criName: z.string().optional(),
        isin: z.string().optional(),
        criData: z
          .object({
            debtor: z.string().optional(),
            securitizer: z.string().optional(),
            rate: z.string().optional(),
            maturityDate: z.string().optional(),
            portfolio: z.enum(["high-yield", "centro-oeste", "portfolio-principal"]).optional(),
          })
          .optional(),
      }),
    )
    .mutation(({ input }) => {
      if (!input.criName) return { success: false };
      const decisions = readDecisions();
      if (!decisions.approved.find(d => d.criName === input.criName)) {
        decisions.approved.push({
          criName: input.criName,
          isin: input.isin,
          ...input.criData,
          decidedAt: new Date().toISOString(),
        });
        writeDecisions(decisions);
        console.log(`[Opportunities] "${input.criName}" aprovado → portfólio`);
      }
      return { success: true };
    }),

  reject: publicProcedure
    .input(z.object({ id: z.number(), criName: z.string().optional() }))
    .mutation(({ input }) => {
      if (!input.criName) return { success: false };
      const decisions = readDecisions();
      if (!decisions.rejected.includes(input.criName)) {
        decisions.rejected.push(input.criName);
        writeDecisions(decisions);
        console.log(`[Opportunities] "${input.criName}" rejeitado`);
      }
      return { success: true };
    }),

  list: publicProcedure.query(() => {
    return readDecisions().approved;
  }),

  // ─── Novas Emissões (Mapa de CRIs) ───────────────────────────────────────────
  // Fonte: OFERTA/DISTRIB — registros reais de novas emissões de CRI na CVM.
  // Atualização diária. Lógica baseada em cri_monitor.py (Ofertas Públicas CVM).
  newEmissions: publicProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(90) }).optional())
    .query(async ({ input }) => {
      const windowDays = input?.days ?? 90;

      const decisions   = readDecisions();
      const rejectedSet = new Set(decisions.rejected);
      const approvedSet = new Set(decisions.approved.map(d => d.criName));

      const store = await getCRIOffersStore();
      const inWindow = filterByDays(store.rows, windowDays);

      const emissions = inWindow
        .filter(r => {
          const criName = r.emissor || "CRI";
          return !rejectedSet.has(criName) && !approvedSet.has(criName);
        })
        .map(r => {
          const diasDesdeEmissao = r.dataRef
            ? Math.ceil((Date.now() - new Date(r.dataRef).getTime()) / 86_400_000)
            : 0;

          // Classifica carteira usando emissor e tipo de oferta como proxy de lastro
          const textoClassif = (r.emissor + " " + r.tipoOferta + " " + r.situacao).toLowerCase();
          let portfolio = "principal";
          if (CENTRO_OESTE_KW.some(kw => textoClassif.includes(kw))) portfolio = "centro-oeste";
          else if (HIGH_YIELD_KW.some(kw => textoClassif.includes(kw))) portfolio = "high-yield";

          return {
            isin:             "",          // não disponível nesta fonte
            criName:          r.emissor || "CRI sem nome",
            emissora:         r.emissor,
            coordenador:      r.coordenadorLider,
            debtor:           r.emissor,
            taxa:             "Ver prospecto",
            lastro:           "Ofertas Públicas CVM",
            dataEmissao:      dateToDD_MM_YYYY(r.dataRegistro || r.dataRef),
            dataEmissaoISO:   r.dataRef,
            dataInicio:       dateToDD_MM_YYYY(r.dataInicio),
            dataEncerramento: dateToDD_MM_YYYY(r.dataEncerramento),
            valorTotal:       r.valorTotal,
            quantidadeTotal:  r.quantidadeTotal,
            precoUnitario:    r.precoUnitario,
            situacao:         r.situacao,
            tipoOferta:       r.tipoOferta,
            protocolo:        r.protocolo,
            fonte:            r.fonte,
            carteira:         portfolio === "high-yield" ? "High Yield"
                            : portfolio === "centro-oeste" ? "Centro-Oeste"
                            : "Portfólio Principal",
            portfolio,
            diasDesdeEmissao,
          };
        });

      console.log(`[Mapa de CRIs] ${emissions.length} novas emissões reais nos últimos ${windowDays} dias (fonte: OFERTA/DISTRIB CVM)`);
      return {
        success: true,
        count: emissions.length,
        totalNoStore: store.rows.length,
        windowDays,
        emissions,
        fonte: "CVM OFERTA/DISTRIB — oferta_distribuicao + oferta_resolucao_160",
        updatedAt: new Date(store.loadedAt).toISOString(),
      };
    }),

  // Retorna apenas os CRIs aprovados, enriquecidos com dados da CVM
  portfolio: publicProcedure.query(async () => {
    const decisions = readDecisions();
    const s = await getCVMStore();

    return decisions.approved.map(entry => {
      const isin = entry.isin;
      const portfolioVal = (entry.portfolio || "portfolio-principal") as
        | "high-yield"
        | "centro-oeste"
        | "portfolio-principal";

      if (isin) {
        const rows = s.classe.get(isin) ?? [];
        const cRow = rows[0] ?? {};
        const gRow = s.geral.get(isin) ?? {};
        return {
          id: `approved-${isin}`,
          name: entry.criName,
          debtor: entry.debtor || gRow["Nome_Emissao"]?.trim() || "—",
          securitizer: entry.securitizer || gRow["Companhia_Emissora"]?.trim() || "—",
          rate: entry.rate || cRow["Taxa_Juros"]?.trim() || "—",
          maturityDate: entry.maturityDate || "—",
          portfolio: portfolioVal,
          riskLevel: "low" as const,
          lastro: gRow["Detalhamento_Lastro"]?.trim() || gRow["Tipo_Lastro"]?.trim() || "—",
          source: "ANBIMA" as const,
          isin,
          cetipCode: cRow["Codigo_CETIP"]?.trim() || undefined,
        };
      }

      // Entrada sem ISIN (aprovadas antes da nova lógica) — usa dados gravados
      return {
        id: `approved-${entry.criName.replace(/\s+/g, "-")}`,
        name: entry.criName,
        debtor: entry.debtor || "—",
        securitizer: entry.securitizer || "—",
        rate: entry.rate || "—",
        maturityDate: entry.maturityDate || "—",
        portfolio: portfolioVal,
        riskLevel: "low" as const,
        lastro: "—",
        source: "ANBIMA" as const,
      };
    });
  }),
});
