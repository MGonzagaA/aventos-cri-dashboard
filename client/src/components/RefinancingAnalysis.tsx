import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, RefreshCw, TrendingUp, Check, X } from 'lucide-react';
import { Streamdown } from 'streamdown';

export default function RefinancingAnalysis() {
  const [expandedAnalysis, setExpandedAnalysis] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);

  // Buscar oportunidades com Gemini
  const { data: searchData, isLoading: isSearching, refetch: refetchSearch } = trpc.refinancingAnalysis.search.useQuery();
  
  // Listar oportunidades persistidas
  const { data: listData, refetch: refetchList } = trpc.refinancingAnalysis.list.useQuery();

  // Mutations para aceitar/rejeitar
  const { mutate: acceptOpportunity } = trpc.refinancingAnalysis.accept.useMutation({
    onSuccess: () => {
      refetchList();
    },
  });

  const { mutate: rejectOpportunity } = trpc.refinancingAnalysis.reject.useMutation({
    onSuccess: () => {
      refetchList();
    },
  });

  // Auto-refresh a cada 2 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      refetchSearch();
      refetchList();
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refetchSearch, refetchList]);

  const handleExport = () => {
    if (!searchData?.oportunidades) return;

    const jsonStr = JSON.stringify(searchData.oportunidades, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cris-refinanciamento-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAccept = (opportunity: any) => {
    acceptOpportunity({ id: opportunity.id });
  };

  const handleReject = (opportunity: any) => {
    rejectOpportunity({ id: opportunity.id });
  };

  // Usar dados do banco se disponível, caso contrário usar dados da busca
  const displayOportunidades = listData?.success && listData.oportunidades?.length > 0 
    ? listData.oportunidades 
    : searchData?.oportunidades || [];

  if (isSearching && !displayOportunidades.length) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <RefreshCw className="w-6 h-6 text-teal-500" />
        </div>
        <span className="ml-2 text-gray-400">Analisando oportunidades com Gemini...</span>
      </div>
    );
  }

  if (!searchData?.success && !listData?.success) {
    return (
      <Card className="p-6 border-red-500/30 bg-red-500/10">
        <p className="text-red-400">Erro ao analisar oportunidades de refinanciamento</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-teal-500" />
            Análise de Refinanciamento
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            CRIs próximos ao vencimento (12-24 meses) com análise inteligente via Gemini
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => refetchSearch()}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isSearching}
          >
            <RefreshCw className={`w-4 h-4 ${isSearching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={handleExport}
            size="sm"
            className="gap-2 bg-teal-600 hover:bg-teal-700"
            disabled={!displayOportunidades.length}
          >
            <Download className="w-4 h-4" />
            Exportar JSON
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-blue-500/10 border-blue-500/30">
          <div className="text-gray-400 text-sm">Total de CRIs</div>
          <div className="text-2xl font-bold text-blue-400">{searchData?.totalCRIs || 0}</div>
        </Card>
        <Card className="p-4 bg-teal-500/10 border-teal-500/30">
          <div className="text-gray-400 text-sm">Oportunidades</div>
          <div className="text-2xl font-bold text-teal-400">{displayOportunidades.length}</div>
        </Card>
        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <div className="text-gray-400 text-sm">Taxa de Cobertura</div>
          <div className="text-2xl font-bold text-amber-400">
            {searchData?.totalCRIs ? (((displayOportunidades.length) / (searchData.totalCRIs || 1)) * 100).toFixed(1) : '0'}%
          </div>
        </Card>
      </div>

      {/* Tabela de Oportunidades */}
      <Card className="overflow-hidden border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Ticker</th>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Devedor</th>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Vencimento</th>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Taxa</th>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Volume</th>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Score</th>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Análise Gemini</th>
                <th className="px-4 py-3 text-center text-gray-300 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {displayOportunidades.slice(0, 15).map((oportunidade: any, idx: number) => {
                // Determinar se é do banco ou da busca
                const isFromDB = oportunidade.id !== undefined;
                const ticker = isFromDB ? oportunidade.criName : oportunidade.ticker;
                const devedor = isFromDB ? oportunidade.debtor : oportunidade.devedor;
                const vencimento = isFromDB ? oportunidade.maturityDate : oportunidade.dataVencimento;
                const taxa = isFromDB ? oportunidade.rate : oportunidade.taxa;
                const volume = isFromDB ? 50_000_000 : oportunidade.volume;
                const score = isFromDB ? 50 : oportunidade.scoreRefinanciamento;
                const analise = isFromDB ? oportunidade.geminiAnalysis : oportunidade.analiseGemini;

                return (
                  <tr
                    key={idx}
                    className="border-b border-gray-700 hover:bg-gray-800/50 transition cursor-pointer"
                    onClick={() => setSelectedOpportunity(oportunidade)}
                  >
                    <td className="px-4 py-3 font-mono text-teal-400">{ticker}</td>
                    <td className="px-4 py-3 text-gray-300">{devedor}</td>
                    <td className="px-4 py-3 text-gray-300">{vencimento}</td>
                    <td className="px-4 py-3 text-gray-300">{taxa}</td>
                    <td className="px-4 py-3 text-gray-300">
                      R$ {(volume / 1_000_000).toFixed(0)}M
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition ${
                              score >= 75
                                ? 'bg-green-500'
                                : score >= 60
                                ? 'bg-yellow-500'
                                : 'bg-orange-500'
                            }`}
                            style={{
                              width: `${Math.min(score, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-white">
                          {score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                      {analise ? analise.substring(0, 50) + '...' : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isFromDB && oportunidade.status === 'pending' ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(oportunidade);
                            }}
                            className="p-1 hover:bg-green-500/20 rounded transition"
                            title="Aceitar"
                          >
                            <Check className="w-4 h-4 text-green-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(oportunidade);
                            }}
                            className="p-1 hover:bg-red-500/20 rounded transition"
                            title="Rejeitar"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {isFromDB ? oportunidade.status : 'Novo'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Detalhes */}
      {selectedOpportunity && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedOpportunity(null)}
        >
          <Card className="max-w-2xl w-full bg-gray-900 border-gray-700 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">
                {selectedOpportunity.ticker || selectedOpportunity.criName}
              </h3>
              <button
                onClick={() => setSelectedOpportunity(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-gray-400 text-sm">Devedor:</span>
                <p className="text-white">{selectedOpportunity.devedor || selectedOpportunity.debtor}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Vencimento:</span>
                <p className="text-white">{selectedOpportunity.dataVencimento || selectedOpportunity.maturityDate}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Taxa:</span>
                <p className="text-white">{selectedOpportunity.taxa || selectedOpportunity.rate}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Análise Gemini:</span>
                <div className="text-gray-300 prose prose-invert max-w-none mt-2">
                  <Streamdown>{selectedOpportunity.analiseGemini || selectedOpportunity.geminiAnalysis || 'N/A'}</Streamdown>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedOpportunity(null)}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-500 text-center">
        Análise realizada em {searchData?.dataAnalise ? new Date(searchData.dataAnalise).toLocaleString('pt-BR') : 'N/A'}
      </div>
    </div>
  );
}
