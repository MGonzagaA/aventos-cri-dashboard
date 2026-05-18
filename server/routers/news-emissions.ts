import { publicProcedure } from "../_core/trpc";

// Cache para armazenar notícias e timestamp
let newsCache: { data: any[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos em ms

export const newsEmissionsProcedure = publicProcedure.query(async () => {
  try {
    // Verificar se cache está válido
    const now = Date.now();
    if (newsCache && now - newsCache.timestamp < CACHE_DURATION) {
      console.log("[News Emissions Cache] Retornando dados em cache");
      return newsCache.data;
    }

    console.log("[News Emissions API] Buscando notícias de novas emissões de CRI...");

    // Busca simplificada para NewsAPI
    // NewsAPI tem limitações com booleana complexa em português
    // Usando busca por palavras-chave: CRI + emissão
    const termoBusca = "CRI emissão";

    // Codificar query conforme exigido pela NewsAPI
    const queryCodificada = encodeURIComponent(termoBusca);

    console.log(`[News Emissions API] Query: ${termoBusca}`);

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      console.warn("[News Emissions API] NEWS_API_KEY não configurada");
      return [];
    }

    // URL com parâmetros conforme documentação da NewsAPI
    // Usar sortBy=publishedAt para ordenar por data mais recente
    // pageSize=20 para limitar a 20 artigos
    const url = `https://newsapi.org/v2/everything?q=${queryCodificada}&language=pt&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "CRI-Dashboard/1.0",
      },
    });

    if (!response.ok) {
      console.error(
        `[News Emissions API] Erro HTTP ${response.status}: ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      console.log(`[News Emissions API] Nenhuma notícia encontrada. Total: ${data.totalResults}`);
      newsCache = { data: [], timestamp: now };
      return [];
    }

    console.log(`[News Emissions API] Total de artigos encontrados: ${data.totalResults}, retornando: ${data.articles.length}`);

    // Mapear resposta da NewsAPI para o formato do dashboard
    const formattedNews = data.articles
      .slice(0, 15) // Limitar a 15 notícias
      .map((article: any, index: number) => {
        // Truncar summary se muito longo
        let summary = article.description || article.content || '';
        if (summary.length > 200) {
          summary = summary.substring(0, 200) + '...';
        }

        return {
          id: `newsapi-emissions-${Date.now()}-${index}`,
          date: new Date(article.publishedAt).toLocaleDateString("pt-BR"),
          publishedDate: article.publishedAt,
          title: article.title,
          summary: summary,
          source: article.source.name,
          url: article.url,
          category: "emissão", // Fixado como "emissão" pois filtramos por emissões de CRI
          imageUrl: article.urlToImage,
        };
      });

    console.log(
      `[News Emissions API] Sucesso! Carregadas ${formattedNews.length} notícias`
    );

    // Armazenar em cache
    newsCache = { data: formattedNews, timestamp: now };

    return formattedNews;
  } catch (error) {
    console.error("[News Emissions API] Erro ao buscar notícias:", error);
    return [];
  }
});
