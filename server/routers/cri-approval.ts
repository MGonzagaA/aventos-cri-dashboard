import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { db, pendingCRIs, approvedCRIs, rejectedISINs } from "../db/index";
import { getCVMStore } from "./cvm-store";
import {
  classifyPortfolio, classifyRisk, extractUF, cleanSecuritizerName,
  dateToDD_MM_YYYY, extractDebtorFromCertName, invalidateAnbimaCache,
  type CRIFromCVM,
} from "./anbima-data";

// ─── Build full CRIFromCVM from CVM store rows ────────────────────────────────

function buildCRIEntry(
  isin: string,
  cRow: Record<string, string>,
  gRow: Record<string, string>,
  dfin: Map<string, Record<string, string>>,
  idx: number,
): CRIFromCVM {
  const vencimento  = cRow["Data_Vencimento"]?.trim() ?? "";
  const taxa        = cRow["Taxa_Juros"]?.trim() ?? "";
  const classe      = cRow["Classe"]?.trim() ?? "";
  const situacao    = cRow["Situacao"]?.trim() ?? "";
  const emissora    = gRow["Companhia_Emissora"]?.trim() || "Securitizadora";
  const lastro      = gRow["Detalhamento_Lastro"]?.trim() || gRow["Tipo_Lastro"]?.trim() || "Ver documentação";
  const garantia    = gRow["Tipos_Garantias_Coobrigacao_Securitizadora"]?.trim() ?? "";
  const nomeEmissao = gRow["Nome_Emissao"]?.trim() ?? isin;
  const numSerie    = cRow["Numero_Serie"]?.trim() ?? "";
  const cetipCode   = cRow["Codigo_CETIP"]?.trim() ?? "";

  const rawDebtor = dfin.get(isin)
    ? extractDebtorFromCertName(dfin.get(isin)!["Nome_Certificado"] ?? "")
    : "";
  const debtor     = rawDebtor || (nomeEmissao && !/^[A-Z]{3}\d+$/.test(nomeEmissao) ? nomeEmissao : "Devedor Diversificado");
  const securitizerClean = cleanSecuritizerName(emissora);
  const portfolio  = classifyPortfolio(taxa, lastro, garantia, classe);
  const riskLevel  = classifyRisk(classe, situacao);
  const location   = extractUF(lastro, garantia, nomeEmissao, portfolio);

  let puValue: string | undefined;
  const qtd = parseFloat(cRow["Quantidade_Certificados"]?.replace(",", ".") ?? "0");
  const val = parseFloat(cRow["Valor_Certificados"]?.replace(",", ".") ?? "0");
  if (qtd > 0 && val > 0) {
    puValue = (val / qtd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return {
    id:           `approved-${isin}-${idx}`,
    name:         `CRI ${numSerie ? numSerie + "ª Série - " : ""}${securitizerClean}`,
    debtor,
    securitizer:  securitizerClean,
    rate:         taxa || "Taxa a confirmar",
    maturityDate: dateToDD_MM_YYYY(vencimento),
    portfolio,
    riskLevel,
    lastro,
    source:       "ANBIMA",
    puValue,
    cetipCode:    cetipCode || undefined,
    isin,
    cidade:       "",
    estado:       location.estado,
    regiao:       location.regiao,
  };
}

// ─── ISINs que já estão nos 2187 (mesmos filtros de buildCRIList) ─────────────

async function getMainISINs(): Promise<Set<string>> {
  const s     = await getCVMStore();
  const today = new Date().toISOString().slice(0, 10);
  const set   = new Set<string>();
  for (const [isin, rows] of s.classe) {
    const cRow     = rows[0];
    const venc     = cRow["Data_Vencimento"]?.trim() ?? "";
    const situacao = cRow["Situacao"]?.trim() ?? "";
    const taxa     = cRow["Taxa_Juros"]?.trim() ?? "";
    if (situacao.toLowerCase().includes("adimplente") && taxa && (!venc || venc >= today)) {
      set.add(isin);
    }
  }
  return set;
}

// ─── Purga: remove pendentes que migraram para os 2187 ───────────────────────

async function purgeDuplicatesFromPending() {
  if (!db) return [];
  const mainISINs  = await getMainISINs();
  const approvedRows = await db.select({ isin: approvedCRIs.isin }).from(approvedCRIs);
  const approvedSet  = new Set(approvedRows.map(r => r.isin));

  const pendingRows = await db.select().from(pendingCRIs);
  const toRemove    = pendingRows.filter(p =>
    mainISINs.has(p.isin) || approvedSet.has(p.isin)
  );

  if (toRemove.length > 0) {
    await db.delete(pendingCRIs).where(
      inArray(pendingCRIs.isin, toRemove.map(r => r.isin))
    );
    console.log(`[CRI Approval] Purga: ${toRemove.length} duplicatas removidas do pending`);
  }

  return await db.select().from(pendingCRIs);
}

// ─── Scan CVM para novos candidatos ──────────────────────────────────────────

async function scanNewCandidates(limit = 30): Promise<typeof pendingCRIs.$inferSelect[]> {
  if (!db) return [];
  const s       = await getCVMStore();
  const today   = new Date().toISOString().slice(0, 10);

  const mainISINs    = await getMainISINs();
  const rejRows      = await db.select({ isin: rejectedISINs.isin }).from(rejectedISINs);
  const pendRows     = await db.select({ isin: pendingCRIs.isin }).from(pendingCRIs);
  const appRows      = await db.select({ isin: approvedCRIs.isin }).from(approvedCRIs);

  const rejected  = new Set(rejRows.map(r => r.isin));
  const pending   = new Set(pendRows.map(r => r.isin));
  const approved  = new Set(appRows.map(r => r.isin));

  const toInsert: (typeof pendingCRIs.$inferInsert)[] = [];
  let idx = 0;

  for (const [isin, rows] of s.classe) {
    if (mainISINs.has(isin)) continue;
    if (rejected.has(isin))  continue;
    if (pending.has(isin))   continue;
    if (approved.has(isin))  continue;

    const cRow     = rows[0];
    const venc     = cRow["Data_Vencimento"]?.trim() ?? "";
    const situacao = cRow["Situacao"]?.trim() ?? "";
    const taxa     = cRow["Taxa_Juros"]?.trim() ?? "";
    const classe   = cRow["Classe"]?.trim() ?? "";

    if (venc && venc < today) continue;

    let motivoFiltro = "Fora dos filtros automáticos";
    if (!taxa) motivoFiltro = "Sem taxa informada";
    else if (!situacao.toLowerCase().includes("adimplente")) motivoFiltro = `Status: ${situacao}`;

    const gRow  = s.geral.get(isin) ?? {};
    const entry = buildCRIEntry(isin, cRow, gRow, s.dfin, idx);

    toInsert.push({
      isin,
      name:         entry.name,
      debtor:       entry.debtor,
      securitizer:  entry.securitizer,
      rate:         entry.rate,
      maturityDate: entry.maturityDate,
      portfolio:    entry.portfolio,
      lastro:       entry.lastro,
      estado:       entry.estado ?? null,
      regiao:       entry.regiao ?? null,
      situacao,
      classe,
      motivoFiltro,
      data:         entry as unknown as Record<string, unknown>,
    });

    idx++;
    if (toInsert.length >= limit) break;
  }

  if (toInsert.length > 0) {
    await db.insert(pendingCRIs).values(toInsert).onConflictDoNothing();
    console.log(`[CRI Approval] ${toInsert.length} novos candidatos salvos no Supabase`);
  } else {
    console.log(`[CRI Approval] Nenhum novo CRI encontrado`);
  }

  return await db.select().from(pendingCRIs);
}

// ─── Scan diário (uma vez por dia) ───────────────────────────────────────────

let lastScanDay = "";

export async function dailyCRIScan() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (lastScanDay === today) return;
  lastScanDay = today;
  await purgeDuplicatesFromPending();
  await scanNewCandidates(30);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const criApprovalRouter = router({

  getStats: publicProcedure.query(async () => {
    await dailyCRIScan();
    const [pending, rejected, approved] = await Promise.all([
      db.$count(pendingCRIs),
      db.$count(rejectedISINs),
      db.$count(approvedCRIs),
    ]);
    return { pending, rejected, approved };
  }),

  getPending: publicProcedure.query(async () => {
    await dailyCRIScan();
    return await purgeDuplicatesFromPending();
  }),

  approve: publicProcedure
    .input(z.object({ isin: z.string() }))
    .mutation(async ({ input }) => {
      const rows = await db.select().from(pendingCRIs).where(eq(pendingCRIs.isin, input.isin)).limit(1);
      const item = rows[0];
      if (!item) return { success: false, message: "CRI não encontrado" };

      // Re-constrói com dados frescos da CVM
      const s    = await getCVMStore();
      const cvmRows = s.classe.get(input.isin);
      let criData: CRIFromCVM = item.data as unknown as CRIFromCVM;
      if (cvmRows) {
        const gRow = s.geral.get(input.isin) ?? {};
        criData = buildCRIEntry(input.isin, cvmRows[0], gRow, s.dfin, 0);
      }

      await db.insert(approvedCRIs)
        .values({ isin: input.isin, name: item.name, data: criData as unknown as Record<string, unknown> })
        .onConflictDoNothing();

      await db.delete(pendingCRIs).where(eq(pendingCRIs.isin, input.isin));

      invalidateAnbimaCache();
      console.log(`[CRI Approval] ✓ Aprovado: ${input.isin} — ${item.name}`);
      return { success: true, message: `${item.name} adicionado à base` };
    }),

  reject: publicProcedure
    .input(z.object({ isin: z.string() }))
    .mutation(async ({ input }) => {
      await db.insert(rejectedISINs)
        .values({ isin: input.isin })
        .onConflictDoNothing();

      await db.delete(pendingCRIs).where(eq(pendingCRIs.isin, input.isin));

      console.log(`[CRI Approval] ✗ Rejeitado permanentemente: ${input.isin}`);
      return { success: true, message: "CRI descartado permanentemente" };
    }),

  scan: publicProcedure.mutation(async () => {
    lastScanDay = "";
    const rows = await scanNewCandidates(30);
    return { count: rows.length, message: `${rows.length} CRIs no pending` };
  }),
});
