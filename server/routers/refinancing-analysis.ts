import { publicProcedure } from '../_core/trpc';
import { getCVMStore } from './cvm-store';

const analysisCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function dateToDD_MM_YYYY(iso: string): string {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "";
}

function getDaysUntilMaturity(dateStr: string): number {
  const [d, m, y] = dateStr.split('/').map(Number);
  const maturity = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function parseRate(rate: string): { indexador: string; spread: number } {
  const match = rate.match(/([A-Z_-]+)\s*\+?\s*([\d.,]+)\s*%/);
  if (match) {
    const indexador = match[1].includes('IPCA') ? 'IPCA' : match[1].includes('CDI') ? 'CDI' : match[1];
    return { indexador, spread: parseFloat(match[2].replace(',', '.')) };
  }
  return { indexador: 'CDI', spread: 0 };
}

function calculateScore(taxa: string, diasParaVencimento: number, volume: number): number {
  let score = 50;

  if (diasParaVencimento >= 365 && diasParaVencimento <= 730) score += 25;
  else if (diasParaVencimento > 730) score += 10;
  else score += 5;

  if (volume >= 20_000_000 && volume <= 150_000_000) score += 20;
  else if (volume > 0) score += 5;

  const { indexador, spread } = parseRate(taxa);
  if (indexador === 'CDI' && spread > 3) score += 15;
  else if (indexador === 'IPCA' && spread >= 8) score += 15;
  else if (spread > 0) score += 5;

  return Math.min(100, score);
}

export const refinancingAnalysisRouter = {
  search: publicProcedure.query(async () => {
    try {
      const cacheKey = 'refinancing-cvm';
      const cached = analysisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('[Refinancing] Retornando cache');
        return cached.data;
      }

      console.log('[Refinancing] Buscando CRIs CVM 12-24 meses...');
      const s = await getCVMStore();
      const today = new Date().toISOString().slice(0, 10);
      const oportunidades: any[] = [];

      for (const [isin, rows] of s.classe) {
        const cRow = rows[0];
        const vencimento = cRow["Data_Vencimento"]?.trim() ?? "";
        const situacao   = cRow["Situacao"]?.trim() ?? "";
        const taxa       = cRow["Taxa_Juros"]?.trim() ?? "";

        if (!vencimento || vencimento <= today) continue;
        if (!situacao.toLowerCase().includes("adimplente")) continue;
        if (!taxa) continue;

        const maturityDate = dateToDD_MM_YYYY(vencimento);
        if (!maturityDate) continue;

        const diasParaVencimento = getDaysUntilMaturity(maturityDate);
        if (diasParaVencimento < 365 || diasParaVencimento > 730) continue;

        const gRow     = s.geral.get(isin) ?? {};
        const emissora = gRow["Companhia_Emissora"]?.trim() || "Securitizadora";
        const numSerie = cRow["Numero_Serie"]?.trim() ?? "";
        const cetip    = cRow["Codigo_CETIP"]?.trim() ?? "";
        const nome     = gRow["Nome_Emissao"]?.trim() ?? "";
        const lastro   = gRow["Detalhamento_Lastro"]?.trim() || gRow["Tipo_Lastro"]?.trim() || "";

        const volume = parseFloat(cRow["Valor_Certificados"]?.replace(",", ".") ?? "0");
        const qtd    = parseFloat(cRow["Quantidade_Certificados"]?.replace(",", ".") ?? "0");
        const pu     = qtd > 0 && volume > 0 ? volume / qtd : 0;

        const devedor = nome && !/^[A-Z]{3}\d+$/.test(nome) ? nome : lastro || "Devedor Diversificado";
        const ticker  = cetip || isin.substring(2, 12);
        const score   = calculateScore(taxa, diasParaVencimento, volume);

        let recomendacao = 'Monitorar';
        if (score >= 75) recomendacao = 'Alta prioridade';
        else if (score >= 60) recomendacao = 'Média prioridade';
        else if (score >= 50) recomendacao = 'Baixa prioridade';

        oportunidades.push({
          ticker,
          isin,
          emissor: emissora,
          devedor,
          securitizadora: emissora,
          numSerie,
          dataVencimento: maturityDate,
          diasParaVencimento,
          taxa,
          volume,
          pu: pu > 0 ? pu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
          scoreRefinanciamento: score,
          recomendacao,
          analiseGemini: '',
        });
      }

      oportunidades.sort((a, b) => b.scoreRefinanciamento - a.scoreRefinanciamento);

      const result = {
        success: true,
        totalCRIs: s.classe.size,
        oportunidadesEncontradas: oportunidades.length,
        oportunidades: oportunidades.slice(0, 100),
        dataAnalise: new Date().toISOString(),
      };

      analysisCache.set(cacheKey, { data: result, timestamp: Date.now() });
      console.log(`[Refinancing] ${oportunidades.length} CRIs vencendo em 12-24 meses`);
      return result;
    } catch (error) {
      console.error('[Refinancing] Erro:', error);
      return { success: false, oportunidades: [], totalCRIs: 0, oportunidadesEncontradas: 0 };
    }
  }),

  // Stubs sem DB — mantidos para não quebrar o client
  list: publicProcedure.query(() => ({ success: true, oportunidades: [], total: 0 })),
  accept: publicProcedure
    .input((val: any) => val)
    .mutation(() => ({ success: true })),
  reject: publicProcedure
    .input((val: any) => val)
    .mutation(() => ({ success: true })),
};
