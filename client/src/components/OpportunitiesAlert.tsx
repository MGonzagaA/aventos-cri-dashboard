import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Map, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Loader2, Sparkles, MapPin } from 'lucide-react';

export function OpportunitiesAlert() {
  const [isMinimized, setIsMinimized]         = useState(false);
  const [filterPortfolio, setFilterPortfolio] = useState<'all' | 'high-yield' | 'centro-oeste' | 'principal'>('all');
  const [successMsg, setSuccessMsg]           = useState<string | null>(null);

  const utils = trpc.useUtils();

  const pendingQuery = trpc.criApproval.getPending.useQuery(undefined, {
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  });

  const scanMutation   = trpc.criApproval.scan.useMutation({
    onSuccess: () => { pendingQuery.refetch(); utils.criApproval.getStats.invalidate(); },
  });
  const approveMutation = trpc.criApproval.approve.useMutation({
    onSuccess: (data) => {
      flashMsg(`✅ ${data.message}`);
      pendingQuery.refetch();
      utils.criApproval.getStats.invalidate();
      utils.anbima.get.invalidate();
    },
    onError: () => flashMsg('❌ Erro ao aprovar CRI'),
  });
  const rejectMutation  = trpc.criApproval.reject.useMutation({
    onSuccess: () => {
      flashMsg('🗑️ CRI descartado permanentemente');
      pendingQuery.refetch();
      utils.criApproval.getStats.invalidate();
    },
    onError: () => flashMsg('❌ Erro ao descartar'),
  });

  const allPending = pendingQuery.data ?? [];

  const filtered = useMemo(() => {
    if (filterPortfolio === 'all') return allPending;
    const map: Record<string, string> = {
      'high-yield':   'high-yield',
      'centro-oeste': 'centro-oeste',
      'principal':    'portfolio-principal',
    };
    return allPending.filter((e: any) => e.portfolio === map[filterPortfolio]);
  }, [allPending, filterPortfolio]);

  const flashMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const portfolioColor: Record<string, string> = {
    'high-yield':        'text-amber-400',
    'centro-oeste':      'text-blue-400',
    'portfolio-principal': 'text-teal-400',
  };
  const portfolioLabel: Record<string, string> = {
    'high-yield':        'High Yield',
    'centro-oeste':      'Centro-Oeste',
    'portfolio-principal': 'Portfólio Principal',
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-20 right-4 bg-gradient-to-r from-slate-900 to-slate-950 border border-teal-500/30 rounded-lg shadow-2xl z-50 cursor-pointer hover:border-teal-400/50 transition-all"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Map size={18} className="text-teal-400" />
          <span className="text-white font-semibold text-sm">Mapa de CRIs</span>
          {allPending.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {allPending.length}
            </span>
          )}
          <ChevronUp size={16} className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 w-[420px] max-h-[580px] bg-gradient-to-b from-slate-900 to-slate-950 border border-teal-500/30 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Map size={16} className="text-white" />
          <h3 className="text-white font-bold text-sm">Mapa de CRIs</h3>
          <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {allPending.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="p-1.5 rounded hover:bg-white/20 text-white transition"
            title="Buscar novos CRIs na CVM agora"
          >
            <RefreshCw size={13} className={scanMutation.isPending ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setIsMinimized(true)} className="p-1.5 rounded hover:bg-white/20 text-white transition">
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {/* Filtros de carteira */}
      <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-900/80 flex-shrink-0">
        <div className="flex gap-1 flex-wrap">
          {(['all', 'high-yield', 'centro-oeste', 'principal'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterPortfolio(f)}
              className={`text-xs px-2 py-0.5 rounded transition ${
                filterPortfolio === f
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'high-yield' ? 'HY' : f === 'centro-oeste' ? 'CO' : 'Principal'}
            </button>
          ))}
        </div>
      </div>

      {/* Flash msg */}
      {successMsg && (
        <div className="px-4 py-2 bg-teal-600/20 border-b border-teal-500/30 text-xs text-teal-300 font-medium flex-shrink-0">
          {successMsg}
        </div>
      )}

      {/* Lista */}
      <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
        {pendingQuery.isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-60" />
            <p className="text-sm">Buscando novos CRIs na CVM...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Sparkles size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma emissão nos últimos 90 dias</p>
            <p className="text-xs mt-1 opacity-60">Tente aumentar a janela de dias</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filtered.map((cri: any) => {
              const isApproving = approveMutation.isPending && approveMutation.variables?.isin === cri.isin;
              const isRejecting = rejectMutation.isPending  && rejectMutation.variables?.isin  === cri.isin;

              return (
                <div key={cri.isin} className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 hover:bg-slate-800/80 transition-all">
                  {/* Título + badge motivo */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{cri.name}</h4>
                      <p className="text-xs text-slate-400 truncate">{cri.debtor}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 whitespace-nowrap">
                      {cri.motivoFiltro ?? 'Novo'}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mb-2">
                    <div>
                      <span className="text-slate-500">Taxa:</span>
                      <p className="text-teal-400 font-semibold">{cri.rate || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Carteira:</span>
                      <p className={`font-semibold ${portfolioColor[cri.portfolio] ?? 'text-slate-300'}`}>
                        {portfolioLabel[cri.portfolio] ?? cri.portfolio}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Vencimento:</span>
                      <p className="text-slate-300">{cri.maturityDate || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Status CVM:</span>
                      <p className="text-slate-300 truncate">{cri.situacao || '—'}</p>
                    </div>
                  </div>

                  {/* Localização + lastro */}
                  <div className="flex items-center gap-1 mb-2">
                    {(cri.estado || cri.regiao) && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400/80">
                        <MapPin size={9} /> {cri.estado || cri.regiao}
                      </span>
                    )}
                    {cri.lastro && (
                      <span className="text-[10px] text-slate-500 truncate ml-1">· {cri.lastro}</span>
                    )}
                  </div>

                  {cri.isin && (
                    <p className="text-[9px] font-mono text-slate-600 mb-2">ISIN: {cri.isin}</p>
                  )}

                  {/* Botões */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveMutation.mutate({ isin: cri.isin })}
                      disabled={isApproving || isRejecting}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-semibold bg-green-600/80 hover:bg-green-600 text-white transition disabled:opacity-50"
                    >
                      {isApproving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                      Aprovar
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ isin: cri.isin })}
                      disabled={isApproving || isRejecting}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-semibold bg-red-600/80 hover:bg-red-600 text-white transition disabled:opacity-50"
                    >
                      {isRejecting ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                      Descartar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/80 flex-shrink-0">
        <p className="text-[11px] text-teal-400 font-semibold">
          Novas emissões · CVM · Atualiza diariamente
        </p>
        <p className="text-[10px] text-slate-500">
          {allPending.length} emissões pendentes · {new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
