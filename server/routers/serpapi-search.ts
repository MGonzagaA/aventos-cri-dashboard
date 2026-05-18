import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

interface GoogleSearchResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

interface SerpApiResponse {
  organic_results?: Array<{
    position: number;
    title: string;
    link: string;
    snippet: string;
    date?: string;
    source?: string;
  }>;
  search_information?: {
    total_results: string;
    time_taken_displayed: number;
  };
}

// Cache simples em memória
const searchCache = new Map<string, { results: GoogleSearchResult[]; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

async function fetchGoogleSearch(query: string): Promise<GoogleSearchResult[]> {
  try {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      console.warn('[SerpAPI] SERPAPI_API_KEY não configurada');
      return [];
    }

    // Verifica cache
    const cached = searchCache.get(query);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('[SerpAPI Cache] Retornando resultados em cache para:', query);
      return cached.results;
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `https://serpapi.com/search?engine=google&q=${encodedQuery}&api_key=${apiKey}&num=10&gl=br&hl=pt-BR`;

    console.log('[SerpAPI] Buscando:', query);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SerpAPI] Erro ${response.status}:`, errorText);
      return [];
    }

    const data: SerpApiResponse = await response.json();
    
    if (!data.organic_results || data.organic_results.length === 0) {
      console.log('[SerpAPI] Nenhum resultado encontrado para:', query);
      return [];
    }

    const results = data.organic_results.map((result) => ({
      position: result.position,
      title: result.title,
      link: result.link,
      snippet: result.snippet || '',
      date: result.date,
      source: result.source
    }));

    // Atualiza cache
    searchCache.set(query, { results, timestamp: Date.now() });

    console.log(`[SerpAPI] Sucesso! Encontrados ${results.length} resultados para: ${query}`);
    return results;
  } catch (error) {
    console.error('[SerpAPI] Erro ao buscar:', error);
    return [];
  }
}

export const serpapiSearchRouter = router({
  searchCRI: publicProcedure
    .input(z.object({ query: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const query = input?.query || 'CRI emissão certificado de recebível imobiliário';
      return await fetchGoogleSearch(query);
    }),

  searchSecuritizer: publicProcedure
    .input(z.object({ name: z.string() }).optional())
    .query(async ({ input }) => {
      const securitizerName = input?.name || 'securitizadora CRI';
      const query = `${securitizerName} emissão CRI`;
      return await fetchGoogleSearch(query);
    }),

  searchMarket: publicProcedure.query(async () => {
    const query = 'mercado CRI certificado recebível imobiliário Brasil 2026';
    return await fetchGoogleSearch(query);
  }),

  search: publicProcedure
    .input(z.object({ q: z.string() }))
    .query(async ({ input }) => {
      return await fetchGoogleSearch(input.q);
    })
});
