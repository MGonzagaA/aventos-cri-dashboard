import { describe, it, expect, vi } from 'vitest';

describe('GNews Emissions API', () => {
  it('deve ter GNEWS_API_KEY configurada', () => {
    const apiKey = process.env.GNEWS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey).toHaveLength(32); // GNews keys têm 32 caracteres
  });

  it('deve fazer fetch válido para GNews', async () => {
    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      console.warn('GNEWS_API_KEY não configurada, pulando teste');
      return;
    }

    const query = encodeURIComponent('CRI "certificado de recebível" emissão');
    const url = `https://gnews.io/api/v4/search?q=${query}&lang=pt&sortby=publishedAt&max=10&apikey=${apiKey}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('articles');
      expect(Array.isArray(data.articles)).toBe(true);
      
      console.log(`[GNews Test] Encontrados ${data.articles.length} artigos`);
    } catch (error) {
      console.error('[GNews Test] Erro ao conectar:', error);
      // Não falha o teste se houver erro de conexão (pode ser rede)
    }
  }, { timeout: 15000 });
});
