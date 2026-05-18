import { publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { z } from "zod";

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

interface UnifiedSearchResult {
  id: string;
  name: string;
  debtor: string;
  securitizer: string;
  rate: string;
  maturityDate: string;
  riskLevel: "low" | "medium" | "high";
  portfolio: "high-yield" | "centro-oeste" | "portfolio-principal";
  sources: string[];
  relevanceScore: number;
  analysis: {
    opportunity: string;
    recommendation: string;
    spreadComparison?: string;
  };
}

let cachedResults: UnifiedSearchResult[] = [];
let lastSearchTime = 0;

export const comprehensiveSearchProcedure = publicProcedure
  .input(
    z.object({
      query: z.string().optional(),
      portfolio: z
        .enum(["all", "high-yield", "centro-oeste", "portfolio-principal"])
        .optional(),
      riskLevel: z.enum(["all", "low", "medium", "high"]).optional(),
      forceRefresh: z.boolean().optional(),
    })
  )
  .query(async ({ input }) => {
    try {
      // Verificar cache
      if (
        cachedResults.length > 0 &&
        Date.now() - lastSearchTime < CACHE_DURATION &&
        !input.forceRefresh
      ) {
        console.log("[Comprehensive Search] Retornando resultados em cache");
        return {
          results: filterResults(cachedResults, input),
          source: "cache",
          timestamp: lastSearchTime,
          count: cachedResults.length,
        };
      }

      console.log("[Comprehensive Search] Iniciando busca unificada...");

      // Aqui você integraria com:
      // 1. ANBIMA Data (server/routers/anbima-data.ts)
      // 2. GNews (server/routers/gnews-emissions.ts)
      // 3. SerpAPI (server/routers/serpapi-search.ts)
      // 4. Gemini para análise e ranking

      const unifiedResults: UnifiedSearchResult[] = [
        {
          id: "demo-1",
          name: "CRI 182ª Série - Gafisa",
          debtor: "Gafisa S.A.",
          securitizer: "OPEA Securitizadora",
          rate: "IPCA + 8.5%",
          maturityDate: "15/05/2026",
          riskLevel: "medium",
          portfolio: "portfolio-principal",
          sources: ["ANBIMA", "GNews"],
          relevanceScore: 92,
          analysis: {
            opportunity:
              "Oportunidade de refinanciamento com spread atrativo comparado a similares",
            recommendation:
              "COMPRAR - Taxa acima da média do mercado com risco controlado",
            spreadComparison: "+2.1% vs média de mercado",
          },
        },
      ];

      // Usar Gemini para análise e ranking
      const geminiAnalysis = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de CRI (Certificado de Recebível Imobiliário).
Analise os CRIs fornecidos e:
1. Calcule um score de relevância (0-100)
2. Identifique oportunidades de refinanciamento
3. Avalie risco baseado em notícias recentes
4. Compare spreads com similares
5. Forneça recomendações de compra/venda

Retorne análise estruturada em JSON.`,
          },
          {
            role: "user",
            content: `Analise estes CRIs para oportunidades: ${JSON.stringify(unifiedResults)}`,
          },
        ],
      });

      console.log(
        `[Comprehensive Search] Sucesso! Encontrados ${unifiedResults.length} CRIs`
      );

      // Atualizar cache
      cachedResults = unifiedResults;
      lastSearchTime = Date.now();

      return {
        results: filterResults(unifiedResults, input),
        source: "live",
        timestamp: lastSearchTime,
        count: unifiedResults.length,
        geminiAnalysis: geminiAnalysis.choices[0].message.content,
      };
    } catch (error) {
      console.error("[Comprehensive Search] Erro:", error);
      return {
        results: filterResults(cachedResults, input),
        source: "cache-fallback",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        count: cachedResults.length,
      };
    }
  });

function filterResults(
  results: UnifiedSearchResult[],
  input: {
    query?: string;
    portfolio?: string;
    riskLevel?: string;
  }
): UnifiedSearchResult[] {
  let filtered = [...results];

  if (input.query) {
    const query = input.query.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.debtor.toLowerCase().includes(query) ||
        r.securitizer.toLowerCase().includes(query)
    );
  }

  if (input.portfolio && input.portfolio !== "all") {
    filtered = filtered.filter((r) => r.portfolio === input.portfolio);
  }

  if (input.riskLevel && input.riskLevel !== "all") {
    filtered = filtered.filter((r) => r.riskLevel === input.riskLevel);
  }

  // Ordenar por relevância
  filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return filtered;
}
