import React, { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, TrendingUp, ChevronDown, ChevronUp, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function daysUntilMaturity(dateStr: string): number {
  const [d, m, y] = dateStr.split('/').map(Number);
  const maturity = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function OpportunitiesAlert() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterPortfolio, setFilterPortfolio] = useState<'all' | 'high-yield' | 'centro-oeste' | 'principal'>('all');
  const [insertingId, setInsertingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const acceptMutation = trpc.opportunities.accept.useMutation();
  const rejectMutation = trpc.opportunities.reject.useMutation();

  // monitorQuery: inserts new maturing CRIs to DB and returns pending list
  const monitorQuery = trpc.opportunities.monitor.useQuery(undefined, {
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const pendingOpps = useMemo(() => {
    const opps = monitorQuery.data?.opportunities ?? [];
    return (opps as any[])
      .map((o: any) => ({ ...o, daysLeft: daysUntilMaturity(o.maturityDate || '31/12/2030') }))
      .filter((o: any) => o.daysLeft >= -30 && o.daysLeft <= 360)
      .filter((o: any) => filterPortfolio === 'all' || o.portfolio === filterPortfolio)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [monitorQuery.data, filterPortfolio]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleInsert = async (opp: any) => {
    setInsertingId(opp.id);
    try {
      await acceptMutation.mutateAsync({
        id: opp.id,
        criName: opp.criName,
        criData: {
          debtor:      opp.debtor,
          securitizer: opp.securitizer,
          rate:        opp.rate,
          maturityDate: opp.maturityDate,
          portfolio:   opp.portfolio === 'principal' ? 'high-yield' : (opp.portfolio ?? 'high-yield'),
        },
      });
      setSuccessMsg(`✅ ${opp.criName} inserido na base!`);
      playSound(800);
      monitorQuery.refetch();
    } catch (error) {
      console.error('Erro ao inserir:', error);
      setSuccessMsg(`❌ Erro ao inserir ${opp.criName}`);
    } finally {
      setInsertingId(null);
    }
  };

  const handleReject = async (opp: any) => {
    setRejectingId(opp.id);
    try {
      await rejectMutation.mutateAsync({ id: opp.id, criName: opp.criName });
      setSuccessMsg(`🗑️ ${opp.criName} descartado`);
      playSound(400);
      monitorQuery.refetch();
    } catch (error) {
      console.error('Erro ao descartar:', error);
    } finally {
      setRejectingId(null);
    }
  };

  const handleRefresh = () => monitorQuery.refetch();

  const playSound = (freq: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  };

  const getRiskBadge = (daysLeft: number) => {
    if (daysLeft <= 0) return { label: 'VENCIDO', color: 'text-red-300 bg-red-500/20 border border-red-500/30' };
    if (daysLeft <= 30) return { label: 'URGENTE', color: 'text-red-300 bg-red-500/20 border border-red-500/30' };
    if (daysLeft <= 60) return { label: 'ATENÇÃO', color: 'text-yellow-300 bg-yellow-500/20 border border-yellow-500/30' };
    if (daysLeft <= 90) return { label: 'MÉDIO', color: 'text-amber-300 bg-amber-500/20 border border-amber-500/30' };
    return { label: 'MONITORAR', color: 'text-blue-300 bg-blue-500/20 border border-blue-500/30' };
  };

  const getDaysLabel = (days: number) => {
    if (days <= 0) return `Vencido há ${Math.abs(days)} dias`;
    if (days === 1) return 'Vence amanhã';
    return `Vence em ${days} dias`;
  };

  const urgentCount = pendingOpps.filter((c: any) => c.daysLeft <= 30).length;

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-20 right-4 bg-gradient-to-r from-slate-900 to-slate-950 border border-teal-500/30 rounded-lg shadow-2xl z-50 cursor-pointer hover:border-teal-400/50 transition-all"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertCircle size={18} className="text-teal-400" />
          <span className="text-white font-semibold text-sm">CRIs Vencendo</span>
          {pendingOpps.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pendingOpps.length}
            </span>
          )}
          <ChevronUp size={16} className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 w-[380px] max-h-[520px] bg-gradient-to-b from-slate-900 to-slate-950 border border-teal-500/30 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-white" />
          <h3 className="text-white font-bold text-sm">CRIs Vencendo</h3>
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingOpps.length}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-white/20 text-white transition"
            title="Atualizar"
          >
            <RefreshCw size={14} className={monitorQuery.isFetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded hover:bg-white/20 text-white transition"
            title="Minimizar"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-slate-700/50 bg-slate-900/80 space-y-1.5 flex-shrink-0">
        <div className="flex gap-1">
          {(['all', 'high-yield', 'centro-oeste', 'principal'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterPortfolio(f)}
              className={`text-xs px-2.5 py-1 rounded-md transition ${
                filterPortfolio === f
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'high-yield' ? 'High Yield' : f === 'centro-oeste' ? 'Centro-Oeste' : 'Principal'}
            </button>
          ))}
        </div>
        <label className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-3 h-3 rounded"
          />
          Auto-atualizar (60s)
        </label>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="px-4 py-2 bg-teal-600/20 border-b border-teal-500/30 text-xs text-teal-300 font-medium animate-pulse">
          {successMsg}
        </div>
      )}

      {/* CRIs List */}
      <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
        {monitorQuery.isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-60" />
            <p className="text-sm">Carregando dados CVM...</p>
          </div>
        ) : pendingOpps.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <TrendingUp size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum CRI vencendo neste filtro</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {pendingOpps.map((opp: any) => {
              const risk = getRiskBadge(opp.daysLeft);
              const isInserting = insertingId === opp.id;
              const isRejecting = rejectingId === opp.id;

              return (
                <div
                  key={opp.id}
                  className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 hover:bg-slate-800/80 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{opp.criName}</h4>
                      <p className="text-xs text-slate-400">{opp.debtor}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${risk.color} whitespace-nowrap`}>
                      {risk.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2">
                    <div>
                      <span className="text-slate-500">Taxa:</span>
                      <p className="text-teal-400 font-semibold">{opp.rate}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Carteira:</span>
                      <p className="text-blue-400 font-semibold">
                        {opp.portfolio === 'high-yield' ? 'High Yield' : 'Centro-Oeste'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Securitizadora:</span>
                      <p className="text-slate-300 truncate">{opp.securitizer}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Vencimento:</span>
                      <p className="text-slate-300">{opp.maturityDate}</p>
                    </div>
                  </div>

                  {opp.geminiAnalysis && (
                    <p className="text-[11px] text-slate-400 italic mb-2 line-clamp-2">{opp.geminiAnalysis}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs mb-2.5">
                    <Clock size={12} className={opp.daysLeft <= 30 ? 'text-red-400' : 'text-yellow-400'} />
                    <span className={opp.daysLeft <= 30 ? 'text-red-400 font-semibold' : 'text-yellow-400'}>
                      {getDaysLabel(opp.daysLeft)} — {opp.maturityDate}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleInsert(opp)}
                      disabled={isInserting || isRejecting}
                      className="flex-1 bg-green-600/80 hover:bg-green-600 text-white border-0 text-xs h-8"
                    >
                      {isInserting ? (
                        <Loader2 size={14} className="animate-spin mr-1" />
                      ) : (
                        <CheckCircle size={14} className="mr-1" />
                      )}
                      Inserir
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReject(opp)}
                      disabled={isInserting || isRejecting}
                      className="flex-1 bg-red-600/80 hover:bg-red-600 text-white border-0 text-xs h-8"
                    >
                      {isRejecting ? (
                        <Loader2 size={14} className="animate-spin mr-1" />
                      ) : (
                        <XCircle size={14} className="mr-1" />
                      )}
                      Descartar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/80 flex-shrink-0">
        <p className="text-[11px] text-teal-400 font-semibold">Mercado · todas as securitizadoras · 360 dias · CVM</p>
        <p className="text-[10px] text-slate-500">
          {monitorQuery.data?.found ?? 0} encontrados · {urgentCount} urgentes (≤30 dias)
        </p>
      </div>
    </div>
  );
}
