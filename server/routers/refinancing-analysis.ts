import { publicProcedure } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { getDb } from '../db';
import { opportunities } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { criDocuments, criCentroOeste, criHighYield } from '../../client/src/data/criData';

// Cache para armazenar análises em memória
const analysisCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

interface RefinancingOpportunity {
  ticker: string;
  emissor: string;
  devedor: string;
  securitizadora: string;
  dataVencimento: string;
  diasParaVencimento: number;
  taxa: string;
  volume: number;
  carteira: string;
  risco: string;
  scoreRefinanciamento: number;
  recomendacao: string;
  analiseGemini?: string;
}

function parseDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const [d, m, y] = dateStr.split('/').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

function getDaysUntilMaturity(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const maturity = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function parseRate(rate: string): { indexador: string; spread: number } {
  const match = rate.match(/([A-Z]+)\s*\+?\s*([\d.]+)%/);
  if (match) {
    return {
      indexador: match[1],
      spread: parseFloat(match[2]),
    };
  }
  return { indexador: 'CDI', spread: 0 };
}

function calculateRefinancingScore(cri: any): number {
  let score = 50; // Base score

  // Proximidade do vencimento (12-24 meses = melhor oportunidade)
  const dias = getDaysUntilMaturity(cri.maturityDate);
  if (dias >= 365 && dias <= 730) {
    score += 25;
  } else if (dias > 730) {
    score += 10;
  } else if (dias < 365) {
    score += 15;
  }

  // Volume (R$ 20M-150M = ideal)
  const volume = cri.emissionValue || 50_000_000;
  if (volume >= 20_000_000 && volume <= 150_000_000) {
    score += 20;
  }

  // Spread/Taxa (CDI com spread alto ou IPCA + 8%+)
  const { indexador, spread } = parseRate(cri.rate);
  if (indexador === 'CDI' && spread > 3) {
    score += 15;
  } else if (indexador === 'IPCA' && spread >= 8) {
    score += 15;
  }

  // Setor
  const setores = ['Imobiliário', 'Logístico', 'Shoppings', 'Agronegócio', 'Centro-Oeste'];
  if (setores.some(s => cri.carteira?.includes(s) || cri.name?.includes(s))) {
    score += 10;
  }

  return Math.min(100, score);
}

async function analyzeWithGemini(cri: any): Promise<string> {
  try {
    const prompt = `
Você é um analista de inteligência de mercado de capitais especializado em CRIs.

Analise brevemente esta oportunidade de refinanciamento:
- Nome: ${cri.name}
- Devedor: ${cri.debtor}
- Taxa: ${cri.rate}
- Vencimento: ${cri.maturityDate}
- Carteira: ${cri.carteira}
- Status: ${cri.status}

Forneça em 2-3 linhas:
1. Análise de risco
2. Oportunidade de refinanciamento
3. Recomendação de ação

Responda em português, de forma concisa.
    `;

    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'Você é um analista sênior de mercado de capitais. Forneça análises precisas e acionáveis em português.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  } catch (error) {
    console.log('[Refinancing Analysis] Gemini indisponível:', error);
    return 'Análise de IA indisponível no momento.';
  }
}

export const refinancingAnalysisRouter = {
  // Buscar e analisar oportunidades com Gemini
  search: publicProcedure.query(async () => {
    try {
      const cacheKey = 'refinancing-search';
      const cached = analysisCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('[Refinancing] Retornando dados em cache');
        return cached.data;
      }

      console.log('[Refinancing] Buscando oportunidades com Gemini...');

      // Combina todos os CRIs
      const allCRIs = [...criDocuments, ...criCentroOeste, ...criHighYield];

      // Filtra CRIs que atendem aos critérios (12-24 meses)
      const oportunidades: RefinancingOpportunity[] = [];

      for (const cri of allCRIs) {
        if (!cri.maturityDate) continue;

        const diasParaVencimento = getDaysUntilMaturity(cri.maturityDate);

        // Filtra CRIs com vencimento entre 12-24 meses (365-730 dias)
        if (diasParaVencimento >= 365 && diasParaVencimento <= 730) {
          const { indexador, spread } = parseRate(cri.rate);
          const scoreRefinanciamento = calculateRefinancingScore(cri);

          let recomendacao = 'Monitorar';
          if (scoreRefinanciamento >= 75) {
            recomendacao = 'ALTA PRIORIDADE - Contato imediato';
          } else if (scoreRefinanciamento >= 60) {
            recomendacao = 'Média prioridade - Agendar contato';
          } else if (scoreRefinanciamento >= 50) {
            recomendacao = 'Baixa prioridade - Incluir em pipeline';
          }

          // Análise com Gemini
          const analiseGemini = await analyzeWithGemini(cri);

          oportunidades.push({
            ticker: cri.code,
            emissor: cri.securitizer,
            devedor: cri.debtor,
            securitizadora: cri.securitizer,
            dataVencimento: cri.maturityDate,
            diasParaVencimento,
            taxa: cri.rate,
            volume: cri.emissionValue || 50_000_000,
            carteira: cri.carteira,
            risco: cri.status,
            scoreRefinanciamento,
            recomendacao,
            analiseGemini,
          });
        }
      }

      // Ordena por score
      oportunidades.sort((a, b) => b.scoreRefinanciamento - a.scoreRefinanciamento);

      // Salva as oportunidades no banco de dados
      const db = await getDb();
      if (db) {
        for (const oportunidade of oportunidades) {
          try {
            // Verifica se já existe
            const existing = await db
              .select()
              .from(opportunities)
              .where(
                and(
                  eq(opportunities.criName, oportunidade.ticker),
                  eq(opportunities.status, 'pending')
                )
              )
              .limit(1);

            if (!existing || existing.length === 0) {
              // Insere nova oportunidade
              await db.insert(opportunities).values({
                criName: oportunidade.ticker,
                debtor: oportunidade.devedor,
                securitizer: oportunidade.securitizadora,
                rate: oportunidade.taxa,
                maturityDate: oportunidade.dataVencimento,
                portfolio: oportunidade.carteira.includes('High Yield')
                  ? 'high-yield'
                  : 'centro-oeste',
                status: 'pending',
                source: 'gemini-analysis',
                geminiAnalysis: oportunidade.analiseGemini,
                riskLevel:
                  oportunidade.risco === 'critical'
                    ? 'high'
                    : oportunidade.risco === 'warning'
                    ? 'medium'
                    : 'low',
                opportunity: oportunidade.recomendacao,
              });
            }
          } catch (err) {
            console.error('[Refinancing] Erro ao salvar oportunidade:', err);
          }
        }
      }

      const result = {
        success: true,
        totalCRIs: allCRIs.length,
        oportunidadesEncontradas: oportunidades.length,
        oportunidades,
        dataAnalise: new Date().toISOString(),
      };

      // Cache o resultado
      analysisCache.set(cacheKey, { data: result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error('[Refinancing] Erro:', error);
      return {
        success: false,
        error: 'Erro ao analisar oportunidades de refinanciamento',
        oportunidades: [],
      };
    }
  }),

  // Listar oportunidades do banco de dados
  list: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) {
        return {
          success: false,
          oportunidades: [],
          total: 0,
        };
      }

      const oportunidades = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.status, 'pending'))
        .orderBy(desc(opportunities.discoveredAt));

      return {
        success: true,
        oportunidades,
        total: oportunidades.length,
      };
    } catch (error) {
      console.error('[Refinancing List] Erro:', error);
      return {
        success: false,
        oportunidades: [],
        total: 0,
      };
    }
  }),

  // Aceitar oportunidade (salvar na base)
  accept: publicProcedure
    .input((val: any) => {
      if (typeof val?.id !== 'number') throw new Error('ID inválido');
      return val;
    })
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Banco de dados não disponível' };
        }

        await db
          .update(opportunities)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
          })
          .where(eq(opportunities.id, input.id));

        return { success: true };
      } catch (error) {
        console.error('[Refinancing Accept] Erro:', error);
        return { success: false, error: 'Erro ao aceitar oportunidade' };
      }
    }),

  // Rejeitar oportunidade
  reject: publicProcedure
    .input((val: any) => {
      if (typeof val?.id !== 'number') throw new Error('ID inválido');
      return val;
    })
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Banco de dados não disponível' };
        }

        await db
          .update(opportunities)
          .set({
            status: 'rejected',
            rejectedAt: new Date(),
          })
          .where(eq(opportunities.id, input.id));

        return { success: true };
      } catch (error) {
        console.error('[Refinancing Reject] Erro:', error);
        return { success: false, error: 'Erro ao rejeitar oportunidade' };
      }
    }),
};
