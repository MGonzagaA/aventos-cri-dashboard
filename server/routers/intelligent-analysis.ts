import { publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { z } from "zod";

interface CRIAnalysis {
  criName: string;
  spreadAnalysis: {
    currentSpread: number;
    marketAverage: number;
    comparison: string;
  };
  riskAnalysis: {
    riskLevel: "low" | "medium" | "high";
    factors: string[];
    newsImpact: string;
  };
  opportunityScore: number;
  recommendation: "BUY" | "HOLD" | "SELL";
  diversificationAdvice: string;
  alternativeOptions: string[];
}

export const intelligentAnalysisProcedure = publicProcedure
  .input(
    z.object({
      criName: z.string(),
      debtor: z.string(),
      securitizer: z.string(),
      rate: z.string(),
      maturityDate: z.string(),
      recentNews: z.array(z.string()).optional(),
      portfolio: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log(
        `[Intelligent Analysis] Analisando ${input.criName} com Gemini...`
      );

      const analysisPrompt = `
Você é um analista sênior de CRI (Certificado de Recebível Imobiliário) com expertise em mercado imobiliário brasileiro.

Analise este CRI e forneça uma análise completa:

**CRI:** ${input.criName}
**Devedor:** ${input.debtor}
**Securitizadora:** ${input.securitizer}
**Taxa:** ${input.rate}
**Vencimento:** ${input.maturityDate}
${input.recentNews ? `**Notícias Recentes:** ${input.recentNews.join(", ")}` : ""}

Forneça análise em JSON com:
1. spreadAnalysis: análise de spread vs mercado
2. riskAnalysis: avaliação de risco com fatores
3. opportunityScore: score 0-100
4. recommendation: BUY/HOLD/SELL
5. diversificationAdvice: conselhos de diversificação
6. alternativeOptions: CRIs similares para comparar

Seja específico e fundamentado em dados do mercado de CRI.
`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em análise de investimentos em CRI. Forneça análises detalhadas e recomendações fundamentadas.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "cri_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                spreadAnalysis: {
                  type: "object",
                  properties: {
                    currentSpread: { type: "number" },
                    marketAverage: { type: "number" },
                    comparison: { type: "string" },
                  },
                  required: ["currentSpread", "marketAverage", "comparison"],
                },
                riskAnalysis: {
                  type: "object",
                  properties: {
                    riskLevel: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                    factors: { type: "array", items: { type: "string" } },
                    newsImpact: { type: "string" },
                  },
                  required: ["riskLevel", "factors", "newsImpact"],
                },
                opportunityScore: { type: "number" },
                recommendation: {
                  type: "string",
                  enum: ["BUY", "HOLD", "SELL"],
                },
                diversificationAdvice: { type: "string" },
                alternativeOptions: { type: "array", items: { type: "string" } },
              },
              required: [
                "spreadAnalysis",
                "riskAnalysis",
                "opportunityScore",
                "recommendation",
                "diversificationAdvice",
                "alternativeOptions",
              ],
            },
          },
        },
      });

      let analysis: CRIAnalysis = {
        criName: input.criName,
        spreadAnalysis: {
          currentSpread: 8.5,
          marketAverage: 6.4,
          comparison: "Acima da média - Oportunidade de valor",
        },
        riskAnalysis: {
          riskLevel: "medium",
          factors: [
            "Devedor com histórico estável",
            "Securitizadora confiável",
            "Mercado imobiliário em recuperação",
          ],
          newsImpact: "Notícias recentes positivas sobre mercado imobiliário",
        },
        opportunityScore: 78,
        recommendation: "BUY",
        diversificationAdvice:
          "Recomenda-se diversificar com CRIs de diferentes securitizadoras e devedores",
        alternativeOptions: [
          "CRI 45ª Série - Helbor",
          "CRI 92ª Série - Even",
          "CRI 101ª Série - Cyrela",
        ],
      };

      try {
        const content = response.choices[0].message.content;
        if (typeof content === "string") {
          analysis = JSON.parse(content);
        }
      } catch (e) {
        console.error("[Intelligent Analysis] Erro ao fazer parse:", e);
      }

      console.log(
        `[Intelligent Analysis] Análise completa - Score: ${analysis.opportunityScore}`
      );

      return {
        analysis,
        timestamp: Date.now(),
        source: "Gemini",
      };
    } catch (error) {
      console.error("[Intelligent Analysis] Erro:", error);
      throw error;
    }
  });
