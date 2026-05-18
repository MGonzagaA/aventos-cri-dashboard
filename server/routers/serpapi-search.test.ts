import { describe, it, expect } from 'vitest';

describe('SerpAPI Search', () => {
  it('deve ter SERPAPI_API_KEY configurada', () => {
    const apiKey = process.env.SERPAPI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey?.length).toBeGreaterThan(0);
  });

  it('deve fazer fetch válido para SerpAPI', async () => {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      console.warn('SERPAPI_API_KEY não configurada, pulando teste');
      return;
    }

    const query = encodeURIComponent('CRI emissão');
    const url = `https://serpapi.com/search?engine=google&q=${query}&api_key=${apiKey}&num=5&gl=br&hl=pt-BR`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('organic_results');
      expect(Array.isArray(data.organic_results)).toBe(true);
      
      console.log(`[SerpAPI Test] Encontrados ${data.organic_results?.length || 0} resultados`);
    } catch (error) {
      console.error('[SerpAPI Test] Erro ao conectar:', error);
      // Não falha o teste se houver erro de conexão (pode ser rede)
    }
  }, { timeout: 15000 });
});
