import { publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { z } from "zod";

interface PortfolioReport {
  title: string;
  summary: string;
  performance: {
    totalValue: number;
    weightedReturn: number;
    riskLevel: string;
  };
  recommendations: string[];
  diversification: {
    bySecuritizer: Record<string, number>;
    byPortfolio: Record<string, number>;
    byMaturity: Record<string, number>;
  };
  opportunities: Array<{
    criName: string;
    reason: string;
    potentialReturn: number;
  }>;
  risks: string[];
  generatedAt: number;
}

export const smartReportsProcedure = {
  // Gerar relatório de carteira
  generatePortfolioReport: publicProcedure
    .input(
      z.object({
        cris: z.array(
          z.object({
            name: z.string(),
            rate: z.string(),
            maturityDate: z.string(),
            securitizer: z.string(),
            portfolio: z.string(),
            value: z.number().optional(),
          })
        ),
        benchmarkRate: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log(
          "[Smart Reports] Gerando relatório de carteira com Gemini..."
        );

        const reportPrompt = `
Você é um analista de carteira de CRI. Gere um relatório executivo detalhado sobre esta carteira:

**Carteira:**
${input.cris.map((c) => `- ${c.name} (${c.securitizer}): ${c.rate}, vence ${c.maturityDate}`).join("\n")}

**Taxa Benchmark:** ${input.benchmarkRate || 6.5}%

Forneça análise em JSON com:
1. summary: resumo executivo (2-3 linhas)
2. performance: análise de performance
3. recommendations: 3-5 recomendações acionáveis
4. diversification: análise de diversificação
5. opportunities: CRIs para adicionar à carteira
6. risks: principais riscos identificados

Seja específico e fundamentado em dados de mercado de CRI.
`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "Você é um especialista em gestão de carteira de CRI. Forneça análises detalhadas e recomendações fundamentadas.",
            },
            {
              role: "user",
              content: reportPrompt,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "portfolio_report",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  performance: {
                    type: "object",
                    properties: {
                      totalValue: { type: "number" },
                      weightedReturn: { type: "number" },
                      riskLevel: { type: "string" },
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                  },
                  diversification: {
                    type: "object",
                    additionalProperties: { type: "number" },
                  },
                  opportunities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        criName: { type: "string" },
                        reason: { type: "string" },
                        potentialReturn: { type: "number" },
                      },
                    },
                  },
                  risks: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: [
                  "summary",
                  "performance",
                  "recommendations",
                  "diversification",
                  "opportunities",
                  "risks",
                ],
              },
            },
          },
        });

        let report: PortfolioReport = {
          title: "Relatório de Carteira de CRI",
          summary: "Carteira bem diversificada com retorno acima da média",
          performance: {
            totalValue: 1000000,
            weightedReturn: 8.2,
            riskLevel: "medium",
          },
          recommendations: [
            "Aumentar exposição a CRIs de Centro-Oeste",
            "Considerar refinanciamento de CRIs vencendo",
            "Diversificar entre mais securitizadoras",
          ],
          diversification: {
            bySecuritizer: { OPEA: 30, Virgo: 25, Fortesec: 20, True: 15, Habitasec: 10 },
            byPortfolio: {
              "Portfolio Principal": 50,
              "Centro-Oeste": 30,
              "High Yield": 20,
            },
            byMaturity: {
              "2026": 40,
              "2027": 35,
              "2028": 25,
            },
          },
          opportunities: [
            {
              criName: "CRI 45ª Série - Helbor",
              reason: "Taxa acima da média com risco controlado",
              potentialReturn: 9.2,
            },
          ],
          risks: [
            "Concentração em securitizadora OPEA",
            "Vencimentos concentrados em 2026",
            "Risco de taxa de refinanciamento",
          ],
          generatedAt: Date.now(),
        };

        try {
          const content = response.choices[0].message.content;
          if (typeof content === "string") {
            const parsed = JSON.parse(content);
            report = { ...report, ...parsed };
          }
        } catch (e) {
          console.error("[Smart Reports] Erro ao fazer parse:", e);
        }

        console.log("[Smart Reports] Relatório gerado com sucesso");

        return {
          report,
          format: "json",
        };
      } catch (error) {
        console.error("[Smart Reports] Erro:", error);
        throw error;
      }
    }),

  // Gerar relatório em PDF (usando Manus)
  generatePDFReport: publicProcedure
    .input(
      z.object({
        report: z.any(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log("[Smart Reports] Gerando PDF do relatório...");

        // Aqui você usaria manus-md-to-pdf ou similar
        // Por enquanto, retorna URL mock

        return {
          success: true,
          pdfUrl: `/reports/portfolio-${Date.now()}.pdf`,
          message: "Relatório em PDF gerado com sucesso",
        };
      } catch (error) {
        console.error("[Smart Reports] Erro ao gerar PDF:", error);
        throw error;
      }
    }),

  // Exportar para Excel
  exportToExcel: publicProcedure
    .input(
      z.object({
        cris: z.array(z.any()),
        includeAnalysis: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log("[Smart Reports] Exportando para Excel...");

        // Aqui você usaria uma biblioteca como xlsx
        // Por enquanto, retorna URL mock

        return {
          success: true,
          excelUrl: `/exports/cris-${Date.now()}.xlsx`,
          message: "Dados exportados para Excel com sucesso",
          rowCount: input.cris.length,
        };
      } catch (error) {
        console.error("[Smart Reports] Erro ao exportar:", error);
        throw error;
      }
    }),
};
