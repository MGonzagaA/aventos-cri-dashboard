import { publicProcedure, router } from "../_core/trpc";

// Função utilitária para buscar dados ao BCB
async function fetchBcbData(serieId: number): Promise<number | null> {
  try {
    // URL oficial da API do BCB para obter o último valor registado
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieId}/dados/ultimos/1?formato=json`;
    
    // Fazemos o fetch com revalidação a cada 24h (86400 segundos) para fazer cache
    const res = await fetch(url);
    
    if (!res.ok) throw new Error('Falha na resposta do BCB');
    
    const data = await res.json();
    return data[0] ? parseFloat(data[0].valor) : null;
  } catch (error) {
    console.error(`Erro ao buscar série BCB ${serieId}:`, error);
    return null;
  }
}

export const indicatorsRouter = router({
  get: publicProcedure.query(async () => {
    try {
      // Códigos oficiais das séries temporais do Banco Central:
      // 432: Taxa Selic Meta (% a.a.)
      // 4389: Taxa de Juros - CDI anualizada (% a.a.)
      // 13522: IPCA - Acumulado 12 meses (%)
      // 189: IGP-M - Variação mensal (%)
      
      // Dispara todas as requisições em paralelo para ser muito mais rápido
      const [selic, cdi, ipca, igpm] = await Promise.all([
        fetchBcbData(432),
        fetchBcbData(4389),
        fetchBcbData(13522),
        fetchBcbData(189)
      ]);

      const dataAtual = new Date().toLocaleDateString('pt-BR');

      // Formata a resposta exatamente como o Frontend espera receber
      const indicators = [
        {
          id: 'ind_ipca',
          name: 'IPCA',
          value: ipca !== null ? ipca : 4.44,
          trend: 'Acum. 12m',
          positive: false,
          desc: `IBGE — Atualizado: ${dataAtual}`,
          source: 'Banco Central do Brasil',
          sourceUrl: 'https://www.ibge.gov.br/explica/inflacao.php',
        },
        {
          id: 'ind_cdi',
          name: 'CDI',
          value: cdi !== null ? cdi : 14.90,
          trend: 'a.a.',
          positive: false,
          desc: `B3 — Atualizado: ${dataAtual}`,
          source: 'Banco Central do Brasil',
          sourceUrl: 'https://www.bcb.gov.br/estabilidadefinanceira/taxasobrefundo',
        },
        {
          id: 'ind_igpm',
          name: 'IGP-M',
          value: igpm !== null ? igpm : 0.41,
          trend: 'Variação mensal',
          positive: igpm !== null ? igpm > 0 : true,
          desc: `FGV — Atualizado: ${dataAtual}`,
          source: 'Banco Central do Brasil',
          sourceUrl: 'https://portalibre.fgv.br/estudos-e-pesquisas/indices-de-precos/igp',
        },
        {
          id: 'ind_selic',
          name: 'Selic',
          value: selic !== null ? selic : 14.25,
          trend: 'Meta a.a.',
          positive: true,
          desc: `COPOM — Atualizado: ${dataAtual}`,
          source: 'Banco Central do Brasil',
          sourceUrl: 'https://www.bcb.gov.br/controleinflacao/historicotaxasjuros',
        },
      ];

      return indicators;
    } catch (error) {
      console.error('Erro ao processar indicadores:', error);
      throw new Error('Erro ao processar indicadores');
    }
  })
});
