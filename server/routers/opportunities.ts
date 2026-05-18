import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { opportunities } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { getCVMStore } from "./cvm-store";
import { invokeLLM } from "../_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveCRI {
  name: string;
  debtor: string;
  securitizer: string;
  rate: string;
  maturityDate: string; // DD/MM/YYYY
  carteira: 'High Yield' | 'Centro-Oeste' | 'Portfólio Principal';
  lastro: string;
  isin: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  const [d, m, y] = dateStr.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function daysUntilMaturity(dateStr: string): number {
  const maturity = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dateToDD_MM_YYYY(iso: string): string {
  if (!iso) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
}

function extractSpread(taxa: string): number {
  const m = taxa.match(/\+\s*([\d,\.]+)\s*%/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

const CENTRO_OESTE_KW = [
  'rural', 'agro', 'soja', 'milho', 'cana', 'fazenda', 'goiás', 'goias',
  'mato grosso', 'campo grande', 'cuiabá', 'brasília', 'distrito federal',
  ' go ', ' mt ', ' ms ', ' df ', 'cerrado', 'pecuária', 'pecuaria',
];

const HIGH_YIELD_KW = [
  'hotel', 'resort', 'varejo', 'shopping', 'reestrutura', 'estressado',
  'laje', 'escritório', 'retrofit', 'subordina',
];

function classifyPortfolio(taxa: string, lastro: string, garantia: string, classe: string): 'High Yield' | 'Centro-Oeste' | 'Portfólio Principal' {
  const texto = (lastro + ' ' + garantia + ' ' + taxa + ' ' + classe).toLowerCase();
  if (CENTRO_OESTE_KW.some(kw => texto.includes(kw))) return 'Centro-Oeste';
  const spread = extractSpread(taxa);
  if (
    HIGH_YIELD_KW.some(kw => texto.includes(kw)) ||
    (taxa.toLowerCase().includes('ipca') && spread >= 10) ||
    (taxa.toLowerCase().includes('cdi') && spread >= 3.5)
  ) return 'High Yield';
  return 'Portfólio Principal';
}

// ─── Live CRI data from CVM — ALL securitizers, all portfolios ────────────────

const MAX_RESULTS = 120;

async function getLiveMaturingCRIs(): Promise<(LiveCRI & { daysLeft: number })[]> {
  const s = await getCVMStore();
  const today = new Date().toISOString().slice(0, 10);
  const results: (LiveCRI & { daysLeft: number })[] = [];
  console.log(`[Opportunities] CVM store: ${s.classe.size} ISINs na classe`);

  for (const [isin, rows] of s.classe) {
    const cRow      = rows[0];
    const vencimento = cRow['Data_Vencimento']?.trim() ?? '';
    const situacao   = cRow['Situacao']?.trim() ?? '';
    const taxa       = cRow['Taxa_Juros']?.trim() ?? '';
    const classe     = cRow['Classe']?.trim() ?? '';

    // Skip already matured (including today) and explicitly bad situations
    if (vencimento && vencimento <= today) continue;
    const sit = situacao.toLowerCase();
    if (sit.includes('inadimplente') || sit.includes('cancelad') || sit.includes('liquidado') || sit.includes('resgatado')) continue;

    const maturityDate = dateToDD_MM_YYYY(vencimento);
    if (!maturityDate) continue;

    const daysLeft = daysUntilMaturity(maturityDate);
    if (daysLeft < 1 || daysLeft > 360) continue;

    const gRow     = s.geral.get(isin) ?? {};
    const lastro   = gRow['Detalhamento_Lastro']?.trim() || gRow['Tipo_Lastro']?.trim() || 'Ver documentação';
    const garantia = gRow['Tipos_Garantias_Coobrigacao_Securitizadora']?.trim() ?? '';
    const emissora = gRow['Companhia_Emissora']?.trim() || cRow['Companhia_Emissora']?.trim() || 'Securitizadora';
    const numSerie = cRow['Numero_Serie']?.trim() ?? '';
    const nomeEmissao = gRow['Nome_Emissao']?.trim() ?? '';

    const carteira = classifyPortfolio(taxa, lastro, garantia, classe);
    const debtor   = nomeEmissao && !/^[A-Z]{3}\d+$/.test(nomeEmissao)
      ? nomeEmissao
      : (lastro !== 'Ver documentação' ? lastro.substring(0, 60) : 'Devedor Diversificado');

    results.push({
      isin,
      name: `CRI ${numSerie ? numSerie + 'ª Série - ' : ''}${emissora.split(' ')[0]}`,
      debtor,
      securitizer: emissora,
      rate: taxa || 'Ver documentação',
      maturityDate,
      carteira,
      lastro,
      daysLeft,
    });
  }

  if (results.length === 0 && s.classe.size > 0) {
    // Sample first ISIN to debug field names
    const [firstIsin, firstRows] = [...s.classe.entries()][0];
    const sample = firstRows[0];
    console.log(`[Opportunities] DEBUG sample ISIN=${firstIsin}`, {
      Situacao: sample['Situacao'],
      Data_Vencimento: sample['Data_Vencimento'],
      Taxa_Juros: sample['Taxa_Juros'],
      Classe: sample['Classe'],
    });
  }

  return results
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, MAX_RESULTS);
}

// ─── AI analysis with Gemini + fallback ───────────────────────────────────────

async function analyzeWithAI(cri: LiveCRI, daysLeft: number): Promise<{
  analysis: string;
  riskLevel: 'low' | 'medium' | 'high';
  opportunity: string;
}> {
  const prompt = `Analise este CRI que vence em ${daysLeft} dias:

Nome: ${cri.name}
Devedor: ${cri.debtor}
Securitizadora: ${cri.securitizer}
Taxa: ${cri.rate}
Vencimento: ${cri.maturityDate}
Carteira: ${cri.carteira}
Lastro: ${cri.lastro}

Responda SOMENTE em JSON válido: {"analysis":"análise breve em 2 frases","riskLevel":"low|medium|high","opportunity":"oportunidade de refinanciamento em 1 frase"}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            analysis: parsed.analysis || '',
            riskLevel: parsed.riskLevel || 'medium',
            opportunity: parsed.opportunity || '',
          };
        }
      }
    } catch {
      console.warn('[Opportunities] Gemini falhou, usando fallback LLM');
    }
  }

  try {
    const response = await invokeLLM({ messages: [{ role: 'user', content: prompt }] });
    const content = response.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        analysis: parsed.analysis || '',
        riskLevel: parsed.riskLevel || 'medium',
        opportunity: parsed.opportunity || '',
      };
    }
  } catch (e) {
    console.warn('[Opportunities] LLM fallback falhou:', e);
  }

  return { analysis: '', riskLevel: 'medium', opportunity: '' };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const opportunitiesRouter = router({
  /**
   * Returns live market CRIs maturing in ≤180 days from ALL securitizers.
   * Also persists new ones to DB as "pending" for workflow tracking.
   */
  monitor: publicProcedure.query(async () => {
    try {
      console.log('[Opportunities] Buscando CRIs vencendo em todas as securitizadoras...');

      const maturingCRIs = await getLiveMaturingCRIs();
      console.log(`[Opportunities] ${maturingCRIs.length} CRIs vencendo nos próximos 360 dias`);

      // Persist to DB — insert only new CRIs (upsert by name)
      const db = await getDb();
      if (db) {
        try {
          // Remove stale pending entries whose maturity date has passed
          const allPending = await db.select().from(opportunities)
            .where(eq(opportunities.status, 'pending'));
          const staleIds = allPending
            .filter(row => !row.maturityDate || daysUntilMaturity(row.maturityDate) < 1)
            .map(row => row.id);
          if (staleIds.length > 0) {
            await db.delete(opportunities).where(inArray(opportunities.id, staleIds));
            console.log(`[Opportunities] Limpou ${staleIds.length} entradas vencidas`);
          }

          const existing = await db.select().from(opportunities);
          const existingKeys = new Set(existing.map(e => e.criName));

          for (const cri of maturingCRIs.slice(0, 80)) {
            if (existingKeys.has(cri.name)) continue;
            const portfolio = cri.carteira === 'High Yield' ? 'high-yield' : 'centro-oeste';
            await db.insert(opportunities).values({
              criName:       cri.name,
              debtor:        cri.debtor,
              securitizer:   cri.securitizer,
              rate:          cri.rate,
              maturityDate:  cri.maturityDate,
              portfolio,
              status:        'pending',
              source:        'cvm-maturity',
              geminiAnalysis: '',
              riskLevel:     'medium',
              opportunity:   '',
            });
          }
        } catch (dbErr) {
          console.warn('[Opportunities] DB persist falhou:', dbErr);
        }

        // Return DB pending list with real IDs so UI actions work correctly
        try {
          const pending = await db.select().from(opportunities)
            .where(eq(opportunities.status, 'pending'));

          return {
            success: true,
            found: maturingCRIs.length,
            opportunities: pending.map(row => ({
              ...row,
              carteira: row.portfolio === 'high-yield' ? 'High Yield' : 'Centro-Oeste',
            })),
          };
        } catch { /* fall through to live data */ }
      }

      // Fallback: return live CVM data with temporary IDs (no DB available)
      return {
        success: true,
        found: maturingCRIs.length,
        opportunities: maturingCRIs.map((cri, idx) => ({
          id: -(idx + 1), // negative = temp ID, signals no DB row
          criName:     cri.name,
          debtor:      cri.debtor,
          securitizer: cri.securitizer,
          rate:        cri.rate,
          maturityDate: cri.maturityDate,
          portfolio:   cri.carteira === 'High Yield' ? 'high-yield' : cri.carteira === 'Centro-Oeste' ? 'centro-oeste' : 'principal',
          carteira:    cri.carteira,
          daysLeft:    cri.daysLeft,
          isin:        cri.isin,
          status:      'pending',
          geminiAnalysis: '',
        })),
      };
    } catch (error) {
      console.error('[Opportunities] Erro:', error);
      return { success: false, found: 0, opportunities: [] };
    }
  }),

  list: publicProcedure
    .input(z.object({
      portfolio: z.enum(['high-yield', 'centro-oeste']).optional(),
      status: z.enum(['pending', 'accepted', 'rejected']).optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return [];
        let result = await db.select().from(opportunities).orderBy(opportunities.discoveredAt);
        if (input?.status) result = result.filter(r => r.status === input.status);
        if (input?.portfolio) result = result.filter(r => r.portfolio === input.portfolio);
        return result;
      } catch (error) {
        console.error('[Opportunities] Erro ao listar:', error);
        return [];
      }
    }),

  accept: publicProcedure
    .input(z.object({
      id: z.number(),
      criName: z.string().optional(),
      criData: z.object({
        debtor: z.string().optional(),
        securitizer: z.string().optional(),
        rate: z.string().optional(),
        maturityDate: z.string().optional(),
        portfolio: z.enum(['high-yield', 'centro-oeste']).optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false };

        if (input.id > 0) {
          // Real DB row — just update status
          await db.update(opportunities)
            .set({ status: 'accepted', acceptedAt: new Date() })
            .where(eq(opportunities.id, input.id));
          console.log(`[Opportunities] id=${input.id} aceito`);
        } else if (input.criName) {
          // Temp ID (no DB row yet) — insert as accepted
          const exists = await db.select().from(opportunities)
            .where(eq(opportunities.criName, input.criName));
          if (exists.length > 0) {
            await db.update(opportunities)
              .set({ status: 'accepted', acceptedAt: new Date() })
              .where(eq(opportunities.criName, input.criName));
          } else {
            await db.insert(opportunities).values({
              criName:      input.criName,
              debtor:       input.criData?.debtor ?? 'N/A',
              securitizer:  input.criData?.securitizer ?? 'N/A',
              rate:         input.criData?.rate ?? 'N/A',
              maturityDate: input.criData?.maturityDate ?? '',
              portfolio:    input.criData?.portfolio ?? 'high-yield',
              status:       'accepted',
              source:       'cvm-maturity',
              geminiAnalysis: '',
              riskLevel:    'medium',
              opportunity:  '',
              acceptedAt:   new Date(),
            });
          }
          console.log(`[Opportunities] "${input.criName}" aceito e inserido na base`);
        }

        return { success: true };
      } catch (error) {
        console.error('[Opportunities] Erro ao aceitar:', error);
        return { success: false };
      }
    }),

  reject: publicProcedure
    .input(z.object({ id: z.number(), criName: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false };

        if (input.id > 0) {
          await db.update(opportunities)
            .set({ status: 'rejected', rejectedAt: new Date() })
            .where(eq(opportunities.id, input.id));
        } else if (input.criName) {
          const exists = await db.select().from(opportunities)
            .where(eq(opportunities.criName, input.criName));
          if (exists.length > 0) {
            await db.update(opportunities)
              .set({ status: 'rejected', rejectedAt: new Date() })
              .where(eq(opportunities.criName, input.criName));
          } else {
            await db.insert(opportunities).values({
              criName:      input.criName,
              debtor:       'N/A',
              securitizer:  'N/A',
              rate:         'N/A',
              maturityDate: '',
              portfolio:    'high-yield',
              status:       'rejected',
              source:       'cvm-maturity',
              geminiAnalysis: '',
              riskLevel:    'medium',
              opportunity:  '',
              rejectedAt:   new Date(),
            });
          }
        }
        console.log(`[Opportunities] id=${input.id} descartado`);
        return { success: true };
      } catch (error) {
        console.error('[Opportunities] Erro ao rejeitar:', error);
        return { success: false };
      }
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(opportunities).where(eq(opportunities.id, input.id));
        return result[0] || null;
      } catch (error) {
        return null;
      }
    }),
});
