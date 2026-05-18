import { publicProcedure } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { criDocuments, criCentroOeste, criHighYield } from '../../client/src/data/criData';

// Critérios de originação
const ORIGINACAO_CRITERIOS = {
  setores: ['Imobiliário', 'Logístico', 'Shoppings', 'Agronegócio', 'Centro-Oeste'],
  volumeMin: 20_000_000, // R$ 20M
  volumeMax: 150_000_000, // R$ 150M
  dataInicioVencimento: new Date(2026, 6, 1),
  dataFimVencimento: new Date(2027, 11, 31),
};

interface CRIRefinanciamento {
  ticker: string;
  emissor: string;
  devedor: string;
  securitizadora: string;
  dataVencimento: string;
  diasParaVencimento: number;
  taxa: string;
  indexador: string;
  spread: number;
  volume: number;
  carteira: string;
  risco: string;
  scoreRefinanciamento: number;
  recomendacao: string;
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
  if (volume >= ORIGINACAO_CRITERIOS.volumeMin && volume <= ORIGINACAO_CRITERIOS.volumeMax) {
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
  if (ORIGINACAO_CRITERIOS.setores.some(s => cri.carteira?.includes(s) || cri.name?.includes(s))) {
    score += 10;
  }

  return Math.min(100, score);
}

export const refinancingOpportunitiesRouter = {
  analyze: publicProcedure.query(async () => {
    try {
      // Combina todos os CRIs
      const allCRIs = [...criDocuments, ...criCentroOeste, ...criHighYield];

      // Filtra CRIs que atendem aos critérios
      const oportunidades: CRIRefinanciamento[] = allCRIs
        .filter(cri => {
          if (!cri.maturityDate) return false;
          const diasParaVencimento = getDaysUntilMaturity(cri.maturityDate);
          const dataVencimento = parseDate(cri.maturityDate);

          return (
            dataVencimento >= ORIGINACAO_CRITERIOS.dataInicioVencimento &&
            dataVencimento <= ORIGINACAO_CRITERIOS.dataFimVencimento
          );
        })
        .map(cri => {
          const { indexador, spread } = parseRate(cri.rate);
          const scoreRefinanciamento = calculateRefinancingScore(cri);
          const diasParaVencimento = getDaysUntilMaturity(cri.maturityDate);

          let recomendacao = 'Monitorar';
          if (scoreRefinanciamento >= 75) {
            recomendacao = 'ALTA PRIORIDADE - Contato imediato';
          } else if (scoreRefinanciamento >= 60) {
            recomendacao = 'Média prioridade - Agendar contato';
          } else if (scoreRefinanciamento >= 50) {
            recomendacao = 'Baixa prioridade - Incluir em pipeline';
          }

          return {
            ticker: cri.code,
            emissor: cri.securitizer,
            devedor: cri.debtor,
            securitizadora: cri.securitizer,
            dataVencimento: cri.maturityDate,
            diasParaVencimento,
            taxa: cri.rate,
            indexador,
            spread,
            volume: cri.emissionValue || 50_000_000,
            carteira: cri.carteira,
            risco: cri.status,
            scoreRefinanciamento,
            recomendacao,
          };
        })
        .sort((a, b) => b.scoreRefinanciamento - a.scoreRefinanciamento);

      // Usa Gemini para análise estratégica
      const geminiPrompt = `
Você é um analista de inteligência de mercado de capitais especializado em CRIs.

Analise as seguintes oportunidades de refinanciamento de CRIs próximos ao vencimento (12-24 meses):

${JSON.stringify(oportunidades.slice(0, 10), null, 2)}

Forneça:
1. Resumo executivo das 3 melhores oportunidades
2. Análise de mercado: tendências de refinanciamento
3. Recomendações de estratégia de abordagem
4. Riscos e mitigações

Responda em português, de forma concisa e acionável.
      `;

      let geminiAnalysis = '';
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'Você é um analista sênior de mercado de capitais. Forneça análises precisas e acionáveis.',
            },
            {
              role: 'user',
              content: geminiPrompt,
            },
          ],
        });

        const content = response.choices?.[0]?.message?.content;
        geminiAnalysis = typeof content === 'string' ? content : '';
      } catch (error) {
        console.log('[Refinancing] Gemini indisponível, retornando análise sem IA', error);
        geminiAnalysis = 'Análise de IA indisponível no momento. Consulte os dados estruturados abaixo.';
      }

      return {
        success: true,
        totalCRIs: allCRIs.length,
        oportunidadesEncontradas: oportunidades.length,
        oportunidades,
        geminiAnalysis,
        criterios: ORIGINACAO_CRITERIOS,
        dataAnalise: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Refinancing] Erro:', error);
      return {
        success: false,
        error: 'Erro ao analisar oportunidades de refinanciamento',
        oportunidades: [],
      };
    }
  }),

  exportJSON: publicProcedure.query(async () => {
    try {
      const allCRIs = [...criDocuments, ...criCentroOeste, ...criHighYield];

      const oportunidades = allCRIs
        .filter(cri => {
          if (!cri.maturityDate) return false;
          const dataVencimento = parseDate(cri.maturityDate);
          return (
            dataVencimento >= ORIGINACAO_CRITERIOS.dataInicioVencimento &&
            dataVencimento <= ORIGINACAO_CRITERIOS.dataFimVencimento
          );
        })
        .map(cri => ({
          ticker: cri.code,
          emissor: cri.securitizer,
          devedor: cri.debtor,
          securitizadora: cri.securitizer,
          dataVencimento: cri.maturityDate,
          taxa: cri.rate,
          volume: cri.emissionValue || 50_000_000,
          carteira: cri.carteira,
          status: cri.status,
        }))
        .sort((a, b) => new Date(b.dataVencimento).getTime() - new Date(a.dataVencimento).getTime());

      return {
        success: true,
        data: oportunidades,
        totalRegistros: oportunidades.length,
        dataExportacao: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Refinancing Export] Erro:', error);
      return {
        success: false,
        error: 'Erro ao exportar dados',
        data: [],
      };
    }
  }),
};
