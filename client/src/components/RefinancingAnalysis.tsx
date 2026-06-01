import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Download, RefreshCw, TrendingUp, X, ExternalLink } from 'lucide-react';

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-white/10 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-white">{score}</span>
    </div>
  );
}

export default function RefinancingAnalysis() {
  const [selectedOpp, setSelectedOpp] = useState<any>(null);

  const { data, isLoading, refetch, isFetching } = trpc.refinancingAnalysis.search.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
  });

  const handleExport = () => {
    if (!data?.oportunidades?.length) return;
    const blob = new Blob([JSON.stringify(data.oportunidades, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cris-refinanciamento-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const opps = data?.oportunidades ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mr-3" />
        <span className="text-[#C4E9F9]/60 text-sm">Carregando CRIs da base CVM...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <TrendingUp className="w-5 h-5 text-teal-400" />
            Análise de Refinanciamento
          </h2>
          <p className="text-xs text-[#C4E9F9]/40 mt-0.5">CRIs vencendo em 12–24 meses · base CVM</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-[#C4E9F9]/60 hover:bg-white/10 hover:text-white transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={handleExport}
            disabled={!opps.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16A085]/20 border border-[#16A085]/30 text-[#16A085] hover:bg-[#16A085]/30 transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar JSON
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="aventos-card p-4">
          <p className="text-xs text-[#C4E9F9]/40 mb-1">Total CRIs CVM</p>
          <p className="text-2xl font-bold text-[#3691ED]">{(data?.totalCRIs ?? 0).toLocaleString('pt-BR')}</p>
        </div>
        <div className="aventos-card p-4">
          <p className="text-xs text-[#C4E9F9]/40 mb-1">Vencendo 12–24 meses</p>
          <p className="text-2xl font-bold text-[#16A085]">{data?.oportunidadesEncontradas ?? 0}</p>
        </div>
        <div className="aventos-card p-4">
          <p className="text-xs text-[#C4E9F9]/40 mb-1">Taxa de Cobertura</p>
          <p className="text-2xl font-bold text-amber-400">
            {data?.totalCRIs ? (((data.oportunidadesEncontradas ?? 0) / data.totalCRIs) * 100).toFixed(1) : '0'}%
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="aventos-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Devedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Securitizadora</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Vencimento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Taxa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Volume</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-wider">Prioridade</th>
              </tr>
            </thead>
            <tbody>
              {opps.slice(0, 20).map((opp: any, idx: number) => (
                <tr
                  key={idx}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setSelectedOpp(opp)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#3691ED]">{opp.ticker}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white max-w-[200px] truncate">{opp.devedor}</td>
                  <td className="px-4 py-3 text-xs text-[#C4E9F9]/60 truncate">{opp.securitizadora?.split(' ')[0]}</td>
                  <td className="px-4 py-3 text-xs text-[#C4E9F9]/80 whitespace-nowrap">{opp.dataVencimento}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#16A085]">{opp.taxa}</td>
                  <td className="px-4 py-3 text-xs text-[#C4E9F9]/70">
                    {opp.volume > 0
                      ? `R$ ${(opp.volume / 1_000_000).toFixed(1)}M`
                      : '—'}
                  </td>
                  <td className="px-4 py-3"><ScoreBar score={opp.scoreRefinanciamento} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      opp.recomendacao.includes('Alta') ? 'bg-green-500/15 text-green-400' :
                      opp.recomendacao.includes('Média') ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-white/5 text-[#C4E9F9]/40'
                    }`}>
                      {opp.recomendacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {opps.length > 20 && (
            <p className="text-xs text-[#C4E9F9]/30 text-center py-3">
              Exibindo 20 de {opps.length} oportunidades · Exporte JSON para visualizar todos
            </p>
          )}
        </div>
      </div>

      {/* Rodapé */}
      {data?.dataAnalise && (
        <p className="text-xs text-[#C4E9F9]/30 text-center">
          Análise em {new Date(data.dataAnalise).toLocaleString('pt-BR')} · Cache 30 min
        </p>
      )}

      {/* Modal */}
      {selectedOpp && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedOpp(null)}
        >
          <div
            className="aventos-card max-w-lg w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedOpp.ticker}</h3>
                <p className="text-xs text-[#C4E9F9]/40">{selectedOpp.isin}</p>
              </div>
              <button onClick={() => setSelectedOpp(null)} className="text-[#C4E9F9]/30 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['Devedor', selectedOpp.devedor],
                ['Securitizadora', selectedOpp.securitizadora],
                ['Vencimento', selectedOpp.dataVencimento],
                ['Dias restantes', `${selectedOpp.diasParaVencimento} dias`],
                ['Taxa', selectedOpp.taxa],
                ['Volume', selectedOpp.volume > 0 ? `R$ ${(selectedOpp.volume / 1_000_000).toFixed(2)}M` : '—'],
                ['Score', selectedOpp.scoreRefinanciamento],
                ['Prioridade', selectedOpp.recomendacao],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-[#C4E9F9]/40 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-white">{value}</p>
                </div>
              ))}
            </div>

            {selectedOpp.isin && (
              <a
                href={`https://data.anbima.com.br/busca/certificado-de-recebiveis?q=${encodeURIComponent(selectedOpp.isin)}&view=caracteristicas`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-[#3691ED] hover:text-[#16A085] transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir no ANBIMA
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
