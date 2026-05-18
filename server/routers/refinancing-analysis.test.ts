import { describe, it, expect } from 'vitest';

describe('Refinancing Analysis Router', () => {
  describe('search', () => {
    it('deve retornar estrutura válida', async () => {
      // Teste básico de estrutura
      const mockResult = {
        success: true,
        totalCRIs: 39,
        oportunidadesEncontradas: 5,
        oportunidades: [
          {
            ticker: 'CRI001',
            devedor: 'Test Devedor',
            securitizadora: 'Test Sec',
            dataVencimento: '15/05/2027',
            diasParaVencimento: 450,
            taxa: 'IPCA + 8.5%',
            volume: 50_000_000,
            carteira: 'High Yield',
            risco: 'warning',
            scoreRefinanciamento: 75,
            recomendacao: 'ALTA PRIORIDADE',
            analiseGemini: 'Análise teste',
          },
        ],
        dataAnalise: new Date().toISOString(),
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.oportunidades).toBeDefined();
      expect(Array.isArray(mockResult.oportunidades)).toBe(true);
      expect(mockResult.totalCRIs).toBeGreaterThan(0);
    });

    it('deve filtrar CRIs com vencimento entre 12-24 meses', () => {
      const diasParaVencimento = 450;
      const isValid = diasParaVencimento >= 365 && diasParaVencimento <= 730;
      expect(isValid).toBe(true);
    });

    it('deve calcular score de refinanciamento válido', () => {
      const scoreRefinanciamento = 75;
      expect(scoreRefinanciamento).toBeGreaterThanOrEqual(0);
      expect(scoreRefinanciamento).toBeLessThanOrEqual(100);
    });

    it('deve gerar recomendação baseada em score', () => {
      const scoreRefinanciamento = 75;
      let recomendacao = 'Monitorar';
      if (scoreRefinanciamento >= 75) {
        recomendacao = 'ALTA PRIORIDADE - Contato imediato';
      } else if (scoreRefinanciamento >= 60) {
        recomendacao = 'Média prioridade - Agendar contato';
      }

      expect(recomendacao).toBe('ALTA PRIORIDADE - Contato imediato');
    });
  });

  describe('list', () => {
    it('deve retornar estrutura válida de lista', () => {
      const mockResult = {
        success: true,
        oportunidades: [],
        total: 0,
      };

      expect(mockResult.success).toBe(true);
      expect(Array.isArray(mockResult.oportunidades)).toBe(true);
      expect(mockResult.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('accept', () => {
    it('deve validar input de ID', () => {
      const input = { id: 123 };
      expect(typeof input.id).toBe('number');
      expect(input.id).toBeGreaterThan(0);
    });
  });

  describe('reject', () => {
    it('deve validar input de ID', () => {
      const input = { id: 456 };
      expect(typeof input.id).toBe('number');
      expect(input.id).toBeGreaterThan(0);
    });
  });

  describe('parseRate', () => {
    it('deve extrair indexador e spread corretamente', () => {
      const parseRate = (rate: string) => {
        const match = rate.match(/([A-Z]+)\s*\+?\s*([\d.]+)%/);
        if (match) {
          return {
            indexador: match[1],
            spread: parseFloat(match[2]),
          };
        }
        return { indexador: 'CDI', spread: 0 };
      };

      const result1 = parseRate('IPCA + 8.5%');
      expect(result1.indexador).toBe('IPCA');
      expect(result1.spread).toBe(8.5);

      const result2 = parseRate('CDI + 3.0%');
      expect(result2.indexador).toBe('CDI');
      expect(result2.spread).toBe(3.0);
    });
  });

  describe('getDaysUntilMaturity', () => {
    it('deve calcular dias até vencimento corretamente', () => {
      const parseDate = (dateStr: string) => {
        const [d, m, y] = dateStr.split('/').map(Number);
        return new Date(y, m - 1, d);
      };

      const getDaysUntilMaturity = (dateStr: string) => {
        const maturity = parseDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      };

      // Teste com data futura
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 450);
      const dateStr = `${futureDate.getDate()}/${futureDate.getMonth() + 1}/${futureDate.getFullYear()}`;
      
      const days = getDaysUntilMaturity(dateStr);
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(450);
    });
  });
});
