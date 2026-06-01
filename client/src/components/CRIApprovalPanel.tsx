import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { CheckCircle, XCircle, RefreshCw, Bell, MapPin, TrendingUp, Calendar, AlertCircle, ChevronRight } from 'lucide-react';

export function CRIApprovalPanel() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.criApproval.getStats.useQuery(undefined, {
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  });

  const { data: pending, isLoading: pendingLoading, refetch } = trpc.criApproval.getPending.useQuery(undefined, {
    enabled: open,
    staleTime: 0,
  });

  const approveMutation = trpc.criApproval.approve.useMutation({
    onSuccess: () => { refetch(); utils.anbima.get.invalidate(); utils.criApproval.getStats.invalidate(); },
  });

  const rejectMutation = trpc.criApproval.reject.useMutation({
    onSuccess: () => { refetch(); utils.criApproval.getStats.invalidate(); },
  });

  const scanMutation = trpc.criApproval.scan.useMutation({
    onSuccess: () => { refetch(); utils.criApproval.getStats.invalidate(); },
  });

  const pendingCount = stats?.pending ?? 0;

  return (
    <>
      {/* Badge no header */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-[#C4E9F9]/60 hover:text-white hover:bg-white/8"
        title="Novos CRIs para revisão"
      >
        <Bell className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Novos CRIs</span>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center justify-center">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border overflow-hidden"
            style={{ background: '#0F1E36', borderColor: 'rgba(196,233,249,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(196,233,249,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <Bell className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Novos CRIs para Revisão
                  </h3>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
                    Encontrados na base CVM · aprovados entram no mapa permanentemente
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-3 text-[10px] mr-2" style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
                  <span><span className="text-amber-400 font-bold">{stats?.pending ?? 0}</span> pendentes</span>
                  <span><span className="text-emerald-400 font-bold">{stats?.approved ?? 0}</span> aprovados</span>
                  <span><span className="text-red-400 font-bold">{stats?.rejected ?? 0}</span> descartados</span>
                </div>
                <button
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all hover:bg-white/10"
                  style={{ borderColor: 'rgba(196,233,249,0.15)', color: 'rgba(196,233,249,0.6)', fontFamily: "'Poppins', sans-serif" }}
                  title="Buscar novos CRIs na CVM agora"
                >
                  <RefreshCw className={`w-3 h-3 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
                  {scanMutation.isPending ? 'Buscando...' : 'Buscar agora'}
                </button>
                <button onClick={() => setOpen(false)} className="text-[#C4E9F9]/30 hover:text-white transition-colors ml-1">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {(pendingLoading || statsLoading) && (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#16A085]" />
                  <span className="ml-2 text-sm text-[#C4E9F9]/40">Carregando...</span>
                </div>
              )}

              {!pendingLoading && (!pending || pending.length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <CheckCircle className="w-10 h-10 text-[#16A085]/40" />
                  <p className="text-sm text-[#C4E9F9]/40" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Nenhum CRI pendente de revisão
                  </p>
                  <p className="text-[11px] text-[#C4E9F9]/25" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    O sistema varre a CVM diariamente às 00h (BRT)
                  </p>
                </div>
              )}

              {pending && pending.length > 0 && (
                <div className="divide-y" style={{ borderColor: 'rgba(196,233,249,0.06)' }}>
                  {pending.map((cri: any) => (
                    <div key={cri.isin} className="p-4 hover:bg-white/3 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
                              {cri.name}
                            </span>
                            <span
                              className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border"
                              style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b', fontFamily: "'Poppins', sans-serif" }}
                            >
                              {cri.motivoFiltro}
                            </span>
                          </div>

                          <p className="text-[11px] mb-2" style={{ color: 'rgba(196,233,249,0.55)', fontFamily: "'Poppins', sans-serif" }}>
                            Devedor: <span className="text-white/80">{cri.debtor}</span>
                          </p>

                          {/* Info chips */}
                          <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: 'rgba(196,233,249,0.45)', fontFamily: "'Poppins', sans-serif" }}>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-[#16A085]" />
                              {cri.rate || '—'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#3691ED]" />
                              Venc. {cri.maturityDate}
                            </span>
                            {(cri.estado || cri.regiao) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-amber-400" />
                                {cri.estado || cri.regiao}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-[#C4E9F9]/30" />
                              {cri.situacao || 'Status desconhecido'}
                            </span>
                          </div>

                          <p className="text-[10px] mt-2 truncate" style={{ color: 'rgba(196,233,249,0.3)', fontFamily: "'Poppins', sans-serif" }}>
                            Lastro: {cri.lastro}
                          </p>
                          {cri.isin && (
                            <p className="text-[9px] mt-0.5 font-mono" style={{ color: 'rgba(196,233,249,0.2)' }}>
                              ISIN: {cri.isin}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => approveMutation.mutate({ isin: cri.isin })}
                            disabled={approveMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                            style={{ background: 'rgba(22,160,133,0.2)', border: '1px solid rgba(22,160,133,0.4)', color: '#16A085', fontFamily: "'Poppins', sans-serif" }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate({ isin: cri.isin })}
                            disabled={rejectMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontFamily: "'Poppins', sans-serif" }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Descartar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {scanMutation.data && (
              <div className="px-5 py-3 border-t text-[11px] text-center" style={{ borderColor: 'rgba(196,233,249,0.08)', color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
                {scanMutation.data.message}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
