import { z } from "zod";
import { publicProcedure } from "../_core/trpc";
import { getCVMStore } from "./cvm-store";

function fmt(v: string | undefined, decimals = 2): string {
  if (!v || v.trim() === "" || v.trim() === "0.00" || v.trim() === "0") return "—";
  const n = parseFloat(v.replace(",", "."));
  if (isNaN(n)) return v;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(iso: string): string {
  if (!iso || iso === "") return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export const criDetailRouter = {
  get: publicProcedure
    .input(z.object({ isin: z.string().min(1) }))
    .query(async ({ input }) => {
      const { isin } = input;
      const s = await getCVMStore();

      const classeRows   = s.classe.get(isin) ?? [];
      const gRow         = s.geral.get(isin) ?? {};
      const fluxoRows    = s.fluxoCaixa.get(isin) ?? [];
      const apRows       = s.ativoPassivo.get(isin) ?? [];
      const creditosRow  = s.creditos.get(isin) ?? {};
      const dfinRow      = s.dfin.get(isin) ?? {};
      const cRow         = classeRows[0] ?? {};

      if (!gRow["CNPJ_Emissora"] && classeRows.length === 0) {
        return { found: false, isin };
      }

      // ── Características ────────────────────────────────────────────────────
      const caracteristicas = {
        codigo_isin:         isin,
        codigo_cetip:        cRow["Codigo_CETIP"]?.trim() ?? "—",
        data_emissao:        fmtDate(gRow["Data_Emissao"] ?? ""),
        data_vencimento:     fmtDate(cRow["Data_Vencimento"] ?? ""),
        numero_emissao:      gRow["Numero_Emissao"] ?? "—",
        numero_serie:        cRow["Numero_Serie"] ?? "—",
        tipo_oferta:         cRow["Tipo_Oferta"] ?? "—",
        classe_serie:        cRow["Classe"] ?? "—",
        taxa_juros:          cRow["Taxa_Juros"] ?? "—",
        situacao:            cRow["Situacao"] ?? "—",
        nivel_subordinacao:  cRow["Nivel_Subordinacao"] ?? "—",
        classificacao_risco: cRow["Classificacao_Risco_Atual"] || "—",
        tipo_lastro:         gRow["Tipo_Lastro"] ?? "—",
        detalhamento_lastro: gRow["Detalhamento_Lastro"] ?? "—",
        garantias:           gRow["Tipos_Garantias_Coobrigacao_Securitizadora"] ?? "—",
        emissora:            gRow["Companhia_Emissora"] ?? "—",
        agente_fiduciario:   gRow["Agente_Fiduciario"] ?? "—",
        custodiante:         gRow["Custodiante"] ?? "—",
        agencia_risco:       gRow["Agencia_Classificadora"] ?? "—",
        retencao_risco:      gRow["Tipo_Retencao_Risco"] ?? "—",
        concentracao:        creditosRow["Concentracao"] ?? "—",
        maior_devedor_pct:   fmt(creditosRow["Maior_Devedor"], 4),
        cinco_maiores_pct:   fmt(creditosRow["Cinco_Maiores_Devedores"], 4),
        natureza_economica:  fmt(creditosRow["Creditos_Natureza_Economica"]),
      };

      // ── Documentos ─────────────────────────────────────────────────────────
      const documentos = dfinRow["Link_Download"]
        ? [{
            nome:          dfinRow["Nome_Certificado"] ?? "Demonstração Financeira",
            tipo:          "Demonstrações Financeiras",
            data:          fmtDate(dfinRow["Data_Referencia"] ?? ""),
            parecer:       dfinRow["Parecer_Auditor"] ?? "—",
            link:          dfinRow["Link_Download"],
          }]
        : [];

      // ── Preços (últimas 12 referências mensais) ────────────────────────────
      const precos = classeRows.slice(0, 12).map(r => {
        const qtd = parseFloat(r["Quantidade_Certificados"]?.replace(",", ".") ?? "0");
        const val = parseFloat(r["Valor_Certificados"]?.replace(",", ".") ?? "0");
        const pu  = qtd > 0 && val > 0
          ? (val / qtd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "—";
        return {
          data_referencia:    fmtDate(r["Data_Referencia"] ?? ""),
          pu_indicativo:      pu,
          rentabilidade:      fmt(r["Rentabilidade"], 4),
          rendimentos:        fmt(r["Rendimentos"]),
          amortizacoes:       fmt(r["Amortizacoes"]),
          valor_total:        fmt(r["Valor_Certificados"]),
          quantidade:         fmt(r["Quantidade_Certificados"], 0),
          total_integralizado: fmt(r["Total_Integralizado"]),
        };
      });

      // ── Agenda (fluxo de caixa mensal) ─────────────────────────────────────
      const agenda = fluxoRows.slice(0, 24).map(r => ({
        data_referencia:          fmtDate(r["Data_Referencia"] ?? ""),
        recebimentos_creditos:    fmt(r["Recebimentos_Creditos"]),
        pagamentos_despesas:      fmt(r["Pagamentos_Despesas"]),
        pagamentos_senior_amort:  fmt(r["Pagamentos_Classe_Senior_Amortizacao_Principal"]),
        pagamentos_senior_juros:  fmt(r["Pagamentos_Classe_Senior_Juros"]),
        pagamentos_total_senior:  fmt(r["Pagamentos_Classe_Senior"]),
        pagamentos_mezanino:      fmt(r["Pagamentos_Classe_Subordinada_Mezanino"]),
        pagamentos_junior:        fmt(r["Pagamentos_Classe_Subordinada_Junior"]),
        variacao_liquida_caixa:   fmt(r["Variacao_Liquida_Caixa"]),
      }));

      // ── Ativo/Passivo summary ───────────────────────────────────────────────
      const apLatest = apRows[0] ?? {};
      const balanco = {
        data_referencia:   fmtDate(apLatest["Data_Referencia"] ?? ""),
        ativo_total:       fmt(apLatest["Ativo"]),
        creditos:          fmt(apLatest["Creditos"]),
        caixa:             fmt(apLatest["Caixa_Equivalentes"]),
        passivo_total:     fmt(apLatest["Passivo"]),
        valor_atualizado:  fmt(apLatest["Valor_Atualizado_Emissao"]),
      };

      return {
        found: true,
        isin,
        anbimaUrl: `https://data.anbima.com.br/busca/certificado-de-recebiveis?q=${encodeURIComponent(isin)}&view=caracteristicas`,
        caracteristicas,
        documentos,
        precos,
        agenda,
        balanco,
      };
    }),
};
